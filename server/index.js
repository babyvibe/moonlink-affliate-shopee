import express from 'express'
import { randomUUID } from 'node:crypto'
import database from './db.js'
import {
  clearSessionCookie,
  ensureAdminBootstrap,
  login,
  logout,
  purgeExpiredSessions,
  readSessionCookie,
  requireAdmin,
  setSessionCookie,
  verifyCsrfOrigin,
} from './services/auth-service.js'
import { fetchConversions } from './services/conversion-service.js'
import { config } from './services/env.js'
import { logHttp, logEnabled } from './services/logger.js'
import { getPriceHistory } from './services/price-history-service.js'
import { lookupBatch } from './services/batch-service.js'
import { checkShops, getShopInfo, getShopProducts, searchProductOffers, searchShopeeOffers, searchShopOffers } from './services/offers-service.js'
import {
  addWatchedShop,
  listAlerts,
  listWatchedShops,
  removeWatchedShop,
  scanWatchedShops,
  updateAlertStatus,
} from './services/shop-watch-service.js'
import { compareTikTok } from './services/tiktok-compare-service.js'
import { listRecentlyViewed } from './services/watch-list-service.js'
import { searchMarket, compareKeywords } from './services/market-service.js'
import { getShopLive, topLiveHours } from './services/shop-live-service.js'
import { compareLazada, getLazadaProduct, resolveLazadaUrl } from './services/lazada-service.js'
import { getFoodOrders, getFoodStores, resolveFoodUrl } from './services/food-service.js'
import { getSetting, getSettingsForAdmin, seedFromEnvOnce, updateSettings } from './services/settings-service.js'
import { getTunnelState, startTunnel, stopTunnel } from './services/tunnel-service.js'
import {
  clearRecentLinks,
  generateLink,
  getLinkStats,
  getRecentLinks,
  listAdminLinks,
} from './services/link-service.js'

const app = express()
const port = config.port

app.disable('x-powered-by')
app.use(express.json({ limit: '32kb' }))

// Chặn clickjacking / MIME sniffing; admin API không cache
app.use((req, res, next) => {
  res.setHeader('X-Content-Type-Options', 'nosniff')
  res.setHeader('X-Frame-Options', 'DENY')
  res.setHeader('Referrer-Policy', 'no-referrer')
  res.setHeader('Permissions-Policy', 'camera=(), microphone=(), geolocation=()')
  if (req.path.startsWith('/api/admin')) {
    res.setHeader('Cache-Control', 'no-store')
  }
  next()
})

app.use((req, res, next) => {
  let sessionId = req.header('x-moon-session')
  if (!sessionId || sessionId.length > 100) sessionId = randomUUID()
  req.sessionId = sessionId
  res.setHeader('x-moon-session', sessionId)
  next()
})

// Log request nội bộ trong dev (xem LOG_API trong logger.js)
app.use((req, res, next) => {
  if (!req.path.startsWith('/api')) return next()
  const startedAt = Date.now()
  res.on('finish', () => {
    logHttp({
      method: req.method,
      path: req.path,
      status: res.statusCode,
      elapsedMs: Date.now() - startedAt,
      sessionId: req.sessionId,
    })
  })
  next()
})

// Rate limit login + convert (in-memory, đủ cho 1 instance local)
const buckets = new Map()
function rateLimit({ key, limit, windowMs, blockMs = 0 }) {
  const now = Date.now()
  const bucket = buckets.get(key)
  if (!bucket || now > bucket.resetAt) {
    buckets.set(key, { count: 1, resetAt: now + windowMs, blockedUntil: 0 })
    return { allowed: true }
  }
  if (bucket.blockedUntil && now < bucket.blockedUntil) {
    return {
      allowed: false,
      retryAfterSec: Math.ceil((bucket.blockedUntil - now) / 1000),
    }
  }
  bucket.count += 1
  if (bucket.count > limit) {
    bucket.blockedUntil = blockMs ? now + blockMs : now + windowMs
    return {
      allowed: false,
      retryAfterSec: Math.ceil((bucket.blockedUntil - now) / 1000),
    }
  }
  return { allowed: true }
}

setInterval(() => {
  const now = Date.now()
  for (const [key, bucket] of buckets) {
    if (now > bucket.resetAt && (!bucket.blockedUntil || now > bucket.blockedUntil)) {
      buckets.delete(key)
    }
  }
}, 60_000).unref?.()

setInterval(purgeExpiredSessions, 15 * 60_000).unref?.()

app.get('/api/health', (req, res) => {
  res.json({
    ok: true,
    mode: config.mode,
    hasApiKey: Boolean(getSetting('addlivetag_api_key')),
    hasAffiliateId: Boolean(getSetting('shopee_affiliate_id')),
  })
})

app.get('/api/links/recent', (req, res) => res.json(getRecentLinks(req.sessionId)))

// Lịch sử giá cho 1 link đã tạo — docs/01
app.get('/api/links/:id/price-history', async (req, res) => {
  const limit = rateLimit({ key: `hist:${req.sessionId}`, limit: 30, windowMs: 60_000 })
  if (!limit.allowed) {
    return res.status(429).json({ ok: false, message: 'Bạn xem nhiều quá. Thử lại sau ít phút.' })
  }

  const link = database
    .prepare('SELECT item_id AS itemId FROM generated_links WHERE id = ?')
    .get(String(req.params.id || ''))
  if (!link?.itemId) {
    return res.status(404).json({ ok: false, message: 'Không tìm thấy sản phẩm này.' })
  }

  try {
    const history = await getPriceHistory({
      itemId: link.itemId,
      days: req.query.days,
      sessionId: req.sessionId,
      forceRefresh: req.query.refresh === '1',
    })
    if (history.status === 'error') {
      return res.status(502).json({ ok: false, message: history.message || 'Chưa đọc được lịch sử giá.' })
    }
    res.json({ ok: true, itemId: link.itemId, ...history })
  } catch (error) {
    res.status(500).json({ ok: false, message: error.message })
  }
})
app.delete('/api/links/recent', (req, res) => res.json(clearRecentLinks(req.sessionId)))

app.post('/api/links', async (req, res) => {
  const limit = rateLimit({ key: `convert:${req.sessionId}`, limit: 20, windowMs: 60_000, blockMs: 30_000 })
  if (!limit.allowed) {
    return res.status(429).json({
      ok: false,
      message: `Bạn thao tác nhanh quá. Thử lại sau ${limit.retryAfterSec} giây.`,
      retryAfterSec: limit.retryAfterSec,
    })
  }

  try {
    const link = await generateLink({
      sessionId: req.sessionId,
      url: req.body?.url,
      subIds: Array.isArray(req.body?.subIds) ? req.body.subIds : [],
    })
    res.status(201).json({ ok: true, link })
  } catch (error) {
    res.status(400).json({ ok: false, message: error.message })
  }
})

// ----- Admin auth -----
app.post('/api/admin/login', async (req, res) => {
  const ip = req.socket.remoteAddress || 'unknown'
  const limit = rateLimit({ key: `login:${ip}`, limit: 20, windowMs: 15 * 60_000, blockMs: 15 * 60_000 })
  if (!limit.allowed) {
    return res.status(429).json({
      ok: false,
      message: `Quá nhiều lần đăng nhập. Thử lại sau ${limit.retryAfterSec} giây.`,
      retryAfterSec: limit.retryAfterSec,
    })
  }

  if (!verifyCsrfOrigin(req)) {
    return res.status(403).json({ ok: false, message: 'Nguồn gửi yêu cầu không hợp lệ.' })
  }

  try {
    const result = await login({
      username: req.body?.username,
      password: req.body?.password,
      ip,
      userAgent: req.header('user-agent'),
    })
    setSessionCookie(res, result.token, result.expiresAt)
    res.json({ ok: true, user: result.user, expiresAt: result.expiresAt })
  } catch (error) {
    if (error.retryAfterSec) {
      res.setHeader('Retry-After', String(error.retryAfterSec))
    }
    res.status(error.status || 401).json({ ok: false, message: error.message })
  }
})

app.post('/api/admin/logout', (req, res) => {
  logout({ token: readSessionCookie(req) })
  clearSessionCookie(res)
  res.json({ ok: true })
})

app.get('/api/admin/me', requireAdmin, (req, res) => {
  res.json({ ok: true, user: req.admin.user, expiresAt: req.admin.expiresAt })
})

// ----- Admin reports (API thật, yêu cầu đăng nhập) -----
app.get('/api/admin/reports/conversions', requireAdmin, async (req, res) => {
  try {
    const report = await fetchConversions({
      type: req.query.type,
      source: req.query.source,
      accountId: req.query.account_id,
      from: req.query.from,
      to: req.query.to,
      status: req.query.status,
      page: req.query.page,
      pageSize: req.query.page_size,
      sessionId: req.sessionId,
    })
    res.json({ ok: true, ...report })
  } catch (error) {
    res.status(502).json({ ok: false, message: error.message })
  }
})

app.get('/api/admin/reports/links', requireAdmin, (req, res) => {
  const result = listAdminLinks({
    limit: req.query.limit,
    offset: req.query.offset,
  })
  res.json({ ok: true, ...result })
})

app.get('/api/admin/reports/stats', requireAdmin, (req, res) => {
  res.json({ ok: true, stats: getLinkStats() })
})

// ----- Batch (docs/02) -----
app.post('/api/batch/lookup', async (req, res) => {
  const limit = rateLimit({ key: `batch:${req.sessionId}`, limit: 5, windowMs: 60_000, blockMs: 30_000 })
  if (!limit.allowed) {
    return res.status(429).json({ ok: false, message: 'Bạn tra nhiều quá. Thử lại sau ít phút.' })
  }
  try {
    const result = await lookupBatch({
      lines: Array.isArray(req.body?.lines) ? req.body.lines : String(req.body?.text || '').split(/\r?\n/),
      subIds: Array.isArray(req.body?.subIds) ? req.body.subIds : [],
      mode: 'estimate',
      sessionId: req.sessionId,
    })
    if (!result.ok) return res.status(400).json({ ok: false, message: result.message })
    res.json({ ok: true, ...result })
  } catch (error) {
    res.status(500).json({ ok: false, message: error.message })
  }
})

app.post('/api/batch/generate', async (req, res) => {
  const limit = rateLimit({ key: `batchgen:${req.sessionId}`, limit: 2, windowMs: 60_000, blockMs: 60_000 })
  if (!limit.allowed) {
    return res.status(429).json({ ok: false, message: 'Tạo link hàng loạt hơi nhanh. Thử lại sau 1 phút.' })
  }
  try {
    const result = await lookupBatch({
      lines: Array.isArray(req.body?.lines) ? req.body.lines : String(req.body?.text || '').split(/\r?\n/),
      subIds: Array.isArray(req.body?.subIds) ? req.body.subIds : [],
      mode: 'generate',
      sessionId: req.sessionId,
      logLinks: true,
    })
    if (!result.ok) return res.status(400).json({ ok: false, message: result.message })
    res.json({ ok: true, ...result })
  } catch (error) {
    res.status(500).json({ ok: false, message: error.message })
  }
})

// ----- Offers (docs/03) -----
app.get('/api/offers/products', async (req, res) => {
  try {
    const result = await searchProductOffers({
      keyword: req.query.keyword,
      sortType: req.query.sortType,
      page: req.query.page,
      limit: req.query.limit,
      sessionId: req.sessionId,
    })
    res.json({ ok: true, ...result })
  } catch (error) {
    res.status(502).json({ ok: false, message: error.message })
  }
})

app.get('/api/offers/shops', async (req, res) => {
  try {
    const result = await searchShopOffers({
      keyword: req.query.keyword,
      sortType: req.query.sortType,
      page: req.query.page,
      limit: req.query.limit,
    })
    res.json({ ok: true, ...result })
  } catch (error) {
    res.status(502).json({ ok: false, message: error.message })
  }
})

app.get('/api/offers/campaigns', async (req, res) => {
  try {
    const result = await searchShopeeOffers({
      keyword: req.query.keyword,
      sortType: req.query.sortType,
      page: req.query.page,
      limit: req.query.limit,
    })
    res.json({ ok: true, ...result })
  } catch (error) {
    res.status(502).json({ ok: false, message: error.message })
  }
})

app.get('/api/offers/shop-products', async (req, res) => {
  try {
    const result = await getShopProducts({
      shopId: req.query.shopId,
      page: req.query.page,
      limit: req.query.limit,
      sortType: req.query.sortType,
    })
    res.json({ ok: true, ...result })
  } catch (error) {
    const status = error.message?.includes('hợp lệ') ? 400 : 502
    res.status(status).json({ ok: false, message: error.message })
  }
})

app.get('/api/offers/shops/:shopId', async (req, res) => {
  try {
    const result = await getShopInfo({ shopId: req.params.shopId })
    res.json({ ok: true, ...result })
  } catch (error) {
    res.status(502).json({ ok: false, message: error.message })
  }
})

app.get('/api/offers/shop-check', async (req, res) => {
  try {
    const result = await checkShops({
      shopIds: req.query.shopIds || req.query.shopId,
      live: req.query.live,
      history: req.query.history,
      fresh: req.query.fresh,
    })
    res.json({ ok: true, ...result })
  } catch (error) {
    res.status(502).json({ ok: false, message: error.message })
  }
})

// ----- TikTok compare (docs/05) -----
app.get('/api/links/:id/tiktok-compare', async (req, res) => {
  const link = database.prepare('SELECT item_id AS itemId, normalized_url AS url FROM generated_links WHERE id = ?')
    .get(String(req.params.id || ''))
  if (!link?.itemId) {
    return res.status(404).json({ ok: false, message: 'Không tìm thấy sản phẩm này.' })
  }
  try {
    const result = await compareTikTok({
      itemId: link.itemId,
      url: link.url,
      sessionId: req.sessionId,
      forceRefresh: req.query.refresh === '1',
    })
    if (result.status === 'error') {
      return res.status(502).json({ ok: false, ...result })
    }
    res.json({ ok: true, ...result })
  } catch (error) {
    res.status(500).json({ ok: false, message: error.message })
  }
})

// ----- Watchlist “Đã xem” (docs/06) -----
app.get('/api/watchlist', (req, res) => {
  res.json({ ok: true, ...listRecentlyViewed({ sessionId: req.sessionId, limit: req.query.limit }) })
})

// ----- Market search (docs/07) -----
app.get('/api/market/search', async (req, res) => {
  const limit = rateLimit({ key: `market:${req.sessionId}`, limit: 20, windowMs: 60_000 })
  if (!limit.allowed) {
    return res.status(429).json({ ok: false, message: 'Tìm kiếm hơi nhanh. Thử lại sau ít phút.' })
  }
  try {
    const result = await searchMarket({
      q: req.query.q,
      sort: req.query.sort,
      limit: req.query.limit,
      offset: req.query.offset,
      priceMin: req.query.price_min,
      priceMax: req.query.price_max,
      commissionMin: req.query.commission_min,
      salesMin: req.query.sales_min,
      sessionId: req.sessionId,
    })
    if (result.status === 'error') return res.status(400).json({ ok: false, message: result.message })
    res.json({ ok: true, ...result })
  } catch (error) {
    res.status(500).json({ ok: false, message: error.message })
  }
})

app.get('/api/market/compare', async (req, res) => {
  const limit = rateLimit({ key: `market:${req.sessionId}`, limit: 10, windowMs: 60_000 })
  if (!limit.allowed) {
    return res.status(429).json({ ok: false, message: 'So sánh hơi nhanh. Thử lại sau ít phút.' })
  }
  try {
    const raw = req.query.q || req.query.keywords || ''
    const keywords = String(raw).split(',').map((value) => value.trim()).filter(Boolean)
    const result = await compareKeywords({
      keywords,
      sort: req.query.sort,
      sessionId: req.sessionId,
    })
    if (result.status === 'error') return res.status(400).json({ ok: false, message: result.message })
    res.json({ ok: true, ...result })
  } catch (error) {
    res.status(500).json({ ok: false, message: error.message })
  }
})

// ----- Shop live (docs/08) -----
app.get('/api/live/shops', async (req, res) => {
  const limit = rateLimit({ key: `live:${req.sessionId}`, limit: 30, windowMs: 60_000 })
  if (!limit.allowed) {
    return res.status(429).json({ ok: false, message: 'Yêu cầu hơi nhanh. Thử lại sau ít phút.' })
  }
  try {
    const result = await getShopLive({
      shopIds: req.query.shopIds,
      stats: req.query.stats !== '0',
      recentDays: req.query.recentDays,
      sessionId: req.sessionId,
      forceRefresh: req.query.refresh === '1',
    })
    if (result.status === 'error') return res.status(400).json({ ok: false, message: result.message })
    res.json({
      ok: true,
      ...result,
      shops: (result.shops || []).map((shop) => ({
        ...shop,
        topHours: topLiveHours(shop.stats?.hourHistogram),
      })),
    })
  } catch (error) {
    res.status(500).json({ ok: false, message: error.message })
  }
})

// ----- Lazada compare (docs/09) -----
app.get('/api/links/:id/lazada-compare', async (req, res) => {
  const link = database.prepare(
    'SELECT item_id AS itemId, product_price AS productPrice, commission_estimate AS commissionEstimate, product_name AS productName FROM generated_links WHERE id = ?'
  ).get(String(req.params.id || ''))
  if (!link?.itemId) {
    return res.status(404).json({ ok: false, message: 'Không tìm thấy sản phẩm này.' })
  }
  try {
    const result = await compareLazada({
      shopeeProduct: {
        productPrice: link.productPrice,
        commissionEstimate: link.commissionEstimate,
        productName: link.productName,
      },
      lazadaUrl: req.query.url,
      lazadaItemId: req.query.lazadaItemId,
      sessionId: req.sessionId,
    })
    if (result.status === 'error') return res.status(502).json({ ok: false, ...result })
    res.json({ ok: true, ...result })
  } catch (error) {
    res.status(500).json({ ok: false, message: error.message })
  }
})

app.post('/api/lazada/lookup', async (req, res) => {
  try {
    const resolved = await resolveLazadaUrl({ url: req.body?.url, sessionId: req.sessionId })
    if (resolved.status !== 'success') return res.status(400).json({ ok: false, ...resolved })
    const product = await getLazadaProduct({ itemId: resolved.itemId, sessionId: req.sessionId })
    res.json({ ok: true, resolved, ...product })
  } catch (error) {
    res.status(500).json({ ok: false, message: error.message })
  }
})

// ----- ShopeeFood store (docs/10) -----
app.get('/api/food/stores', async (req, res) => {
  try {
    const result = await getFoodStores({
      restaurantIds: req.query.ids,
      sessionId: req.sessionId,
      forceRefresh: req.query.refresh === '1',
    })
    if (result.status === 'error') return res.status(400).json({ ok: false, message: result.message })
    res.json({ ok: true, ...result })
  } catch (error) {
    res.status(500).json({ ok: false, message: error.message })
  }
})

app.get('/api/food/resolve', async (req, res) => {
  try {
    const result = await resolveFoodUrl({ url: req.query.url, sessionId: req.sessionId })
    if (result.status === 'error') return res.status(400).json({ ok: false, message: result.message })
    res.json({ ok: true, ...result })
  } catch (error) {
    res.status(500).json({ ok: false, message: error.message })
  }
})

// Đơn ShopeeFood — cần cookie J2Team (lưu ở Admin → Cài đặt)
app.get('/api/food/orders', async (req, res) => {
  try {
    const result = await getFoodOrders({
      from: req.query.from,
      to: req.query.to,
      page: req.query.page,
      pageSize: req.query.page_size,
      sessionId: req.sessionId,
    })
    if (result.status === 'need_cookie') {
      return res.status(400).json({ ok: false, needCookie: true, message: result.message })
    }
    if (result.status === 'error') return res.status(502).json({ ok: false, message: result.message })
    res.json({ ok: true, ...result })
  } catch (error) {
    res.status(500).json({ ok: false, message: error.message })
  }
})

// ----- Cloudflare Tunnel (admin tab Kiểm thử) -----
app.get('/api/admin/tunnel', requireAdmin, (req, res) => {
  res.json({ ok: true, ...getTunnelState() })
})

app.post('/api/admin/tunnel/start', requireAdmin, (req, res) => {
  const result = startTunnel({ target: req.body?.target })
  res.status(result.ok ? 200 : 400).json(result)
})

app.post('/api/admin/tunnel/stop', requireAdmin, (req, res) => {
  res.json(stopTunnel())
})

// ----- Admin: watched shops + alerts (docs/04) -----
app.get('/api/admin/watched-shops', requireAdmin, (req, res) => {
  res.json({ ok: true, shops: listWatchedShops() })
})

app.post('/api/admin/watched-shops', requireAdmin, (req, res) => {
  try {
    const shop = addWatchedShop({
      shopId: req.body?.shopId,
      shopName: req.body?.shopName || null,
      note: req.body?.note || null,
      addedBy: req.admin?.user?.username || null,
    })
    res.json({ ok: true, shop })
  } catch (error) {
    res.status(400).json({ ok: false, message: error.message })
  }
})

app.delete('/api/admin/watched-shops/:shopId', requireAdmin, (req, res) => {
  const removed = removeWatchedShop(req.params.shopId)
  res.json({ ok: true, removed })
})

app.get('/api/admin/commission-alerts', requireAdmin, (req, res) => {
  res.json({ ok: true, alerts: listAlerts({ status: req.query.status, limit: req.query.limit }) })
})

app.post('/api/admin/commission-alerts/scan', requireAdmin, async (req, res) => {
  try {
    const result = await scanWatchedShops({
      days: req.body?.days || 7,
      minDelta: req.body?.minDelta ?? 0.5,
      sessionId: req.sessionId,
    })
    res.json(result)
  } catch (error) {
    res.status(502).json({ ok: false, message: error.message })
  }
})

app.patch('/api/admin/commission-alerts/:id', requireAdmin, (req, res) => {
  try {
    const updated = updateAlertStatus(req.params.id, req.body?.status)
    res.json({ ok: true, updated })
  } catch (error) {
    res.status(400).json({ ok: false, message: error.message })
  }
})

// ----- Admin settings (API key, affiliate ID, cashback…) -----
app.get('/api/admin/settings', requireAdmin, (req, res) => {
  res.json({ ok: true, ...getSettingsForAdmin() })
})

app.put('/api/admin/settings', requireAdmin, (req, res) => {
  try {
    const result = updateSettings(req.body || {})
    res.json({ ok: true, updated: result.updated, ...result.settings })
  } catch (error) {
    res.status(400).json({ ok: false, message: error.message })
  }
})

app.use((error, req, res, next) => {
  console.error(error)
  res.status(500).json({ ok: false, message: 'Máy chủ gặp lỗi. Vui lòng thử lại sau.' })
})

await ensureAdminBootstrap()
const seeded = seedFromEnvOnce()
app.listen(port, '127.0.0.1', () => {
  console.log(`MOONLINK server listening on http://127.0.0.1:${port}`)
  console.log(`API log: ${logEnabled ? 'ON (dev)' : 'OFF — bật LOG_API=1 nếu cần'}`)
  if (seeded) console.log(`[config] Đã seed ${seeded} cài đặt từ .env → DB (lần đầu). Sau đó sửa ở Admin → Cài đặt.`)
  if (!getSetting('addlivetag_api_key')) console.warn('[config] Thiếu Addlivetag API Key — vào Admin → Cài đặt.')
  if (!getSetting('shopee_affiliate_id')) console.warn('[config] Thiếu Affiliate ID — vào Admin → Cài đặt.')
})
