import { callDataApi, friendlyDataApiError } from './data-api.js'
import database from '../db.js'

/**
 * So sánh TikTok Shop — docs/05-tiktok-compare.md
 * Chỉ trả số so sánh khi matchConfidence === 'high'
 */

const CACHE_TTL_MS = 24 * 3_600_000

database.exec(`
  CREATE TABLE IF NOT EXISTS tiktok_compare_cache (
    item_id TEXT PRIMARY KEY,
    payload TEXT NOT NULL,
    fetched_at_ms INTEGER NOT NULL
  );
`)

function readCache(itemId) {
  const row = database.prepare('SELECT payload, fetched_at_ms FROM tiktok_compare_cache WHERE item_id = ?').get(String(itemId))
  if (!row) return null
  if (Date.now() - Number(row.fetched_at_ms) > CACHE_TTL_MS) return null
  try {
    return JSON.parse(row.payload)
  } catch {
    return null
  }
}

function writeCache(itemId, data) {
  database.prepare(`
    INSERT INTO tiktok_compare_cache (item_id, payload, fetched_at_ms)
    VALUES (?, ?, ?)
    ON CONFLICT(item_id) DO UPDATE SET
      payload = excluded.payload,
      fetched_at_ms = excluded.fetched_at_ms
  `).run(String(itemId), JSON.stringify(data), Date.now())
}

export async function compareTikTok({ itemId, url, sessionId, forceRefresh = false } = {}) {
  const key = String(itemId || '').trim()
  if (!key && !url) {
    return { status: 'error', message: 'Thiếu sản phẩm để so sánh.' }
  }

  if (key && !forceRefresh) {
    const cached = readCache(key)
    if (cached) return { ...cached, cached: true }
  }

  let body
  try {
    const result = await callDataApi({
      label: 'addlivetag:tiktok-compare',
      path: 'tiktok/find-by-shopee.php',
      query: {
        item_id: key || undefined,
        url: url || undefined,
        limit: 5,
      },
      sessionId,
      timeoutMs: 25_000,
    })

    if (result.response.status === 424) {
      return {
        status: 'error',
        code: 'creator_token_invalid',
        message: 'Tài khoản TikTok chưa kết nối với hệ thống dữ liệu.',
      }
    }
    if (!result.response.ok) {
      const status = result.response.status
      const message = status === 502 || status === 503
        ? 'Chưa kết nối được nguồn TikTok. Thử lại sau.'
        : friendlyDataApiError(new Error(result.body?.message || `HTTP ${status}`), 'Chưa so sánh được với TikTok.')
      return { status: 'error', message }
    }
    body = result.body
  } catch (error) {
    return { status: 'error', message: friendlyDataApiError(error, 'Chưa so sánh được với TikTok.') }
  }

  const matches = body.matches || []
  const best = body.bestMatch || matches[0] || null
  const confidence = best?.matchConfidence || null
  const safe = confidence === 'high'

  const payload = {
    status: 'success',
    safe,
    confidence,
    // Chỉ lộ số so sánh khi high — enforce ở server
    comparison: safe ? (body.comparison || null) : null,
    bestMatch: safe && best
      ? {
          productName: best.productName,
          shopName: best.shopName,
          price: best.price ?? null,
          commissionRate: best.commissionRate ?? null,
          productLink: best.productLink || null,
          matchScore: best.matchScore ?? null,
        }
      : null,
    candidates: matches.map((match) => ({
      name: match.productName || null,
      score: match.matchScore ?? null,
      confidence: match.matchConfidence || null,
      // không trả price/commission khi không safe
    })),
    sourceProduct: body.sourceProduct
      ? {
          name: body.sourceProduct.name || null,
          price: body.sourceProduct.price ?? null,
          commission: body.sourceProduct.commission ?? null,
        }
      : null,
    warning: body.comparison?.warning || null,
    note: safe
      ? 'Trùng khớp cao — có thể so sánh trực tiếp.'
      : 'Có SP tương tự trên TikTok — cần xác nhận thủ công trước khi so sánh.',
  }

  if (key) writeCache(key, payload)
  return { ...payload, cached: false }
}
