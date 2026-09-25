import express from 'express'
import { randomUUID } from 'node:crypto'
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
    hasApiKey: Boolean(config.addlivetagApiKey),
    hasAffiliateId: Boolean(config.shopeeAffiliateId),
  })
})

app.get('/api/links/recent', (req, res) => res.json(getRecentLinks(req.sessionId)))
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

app.use((error, req, res, next) => {
  console.error(error)
  res.status(500).json({ ok: false, message: 'Máy chủ gặp lỗi. Vui lòng thử lại sau.' })
})

await ensureAdminBootstrap()
app.listen(port, '127.0.0.1', () => {
  console.log(`MOONLINK server listening on http://127.0.0.1:${port}`)
  console.log(`API log: ${logEnabled ? 'ON (dev)' : 'OFF — bật LOG_API=1 nếu cần'}`)
  if (!config.addlivetagApiKey) console.warn('[env] Thiếu ADDLIVETAG_API_KEY — chuyển link sẽ lỗi.')
  if (!config.shopeeAffiliateId) console.warn('[env] Thiếu SHOPEE_AFFILIATE_ID — không tạo được affLink nếu API không trả sẵn.')
})
