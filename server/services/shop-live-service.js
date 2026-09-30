import { callDataApi, friendlyDataApiError } from './data-api.js'

/**
 * Shop đang live — docs/08-shop-live.md
 * API: live/shop-live.php (DB-only, quota 300 req/min/IP)
 */

const memoryCache = new Map()
const TTL_MS = 10 * 60_000

function parseIds(shopIds) {
  const list = Array.isArray(shopIds) ? shopIds : String(shopIds || '').split(/[\s,]+/)
  return list
    .map((value) => String(value).trim())
    .filter((value) => /^\d{1,20}$/.test(value))
    .slice(0, 20)
}

function toNumber(value) {
  const n = Number(value)
  return Number.isFinite(n) ? n : null
}

function normalizeShop(shopId, raw, stats) {
  if (!raw) return null
  const endTime = toNumber(raw.end_time) ?? 0
  const startTimeMs = toNumber(raw.start_time)
  return {
    shopId: String(shopId),
    title: raw.title || null,
    coverPic: raw.cover_pic || null,
    memberCnt: toNumber(raw.member_cnt),
    likeCnt: toNumber(raw.like_cnt),
    ccu: toNumber(raw.ccu),
    // start_time là ms (13 số); time_created là giây (10 số)
    startTime: startTimeMs,
    endTime: endTime || null,
    // end_time = 0 → đang live (hoặc thiếu data)
    isLive: endTime === 0,
    numLive: toNumber(raw.num_live),
    stats: stats
      ? {
          totalSessions: stats.total_sessions ?? null,
          recentSessions: stats.recent_sessions ?? null,
          recentActiveDays: stats.recent_active_days ?? null,
          firstLiveAt: stats.first_live_at ?? null,
          lastLiveAt: stats.last_live_at ?? null,
          avgDurationSec: stats.avg_duration_sec ?? null,
          totalDurationSec: stats.total_duration_sec ?? null,
          longestDurationSec: stats.longest_duration_sec ?? null,
          hourHistogram: stats.hour_histogram || null,
          hourHistogramRecent: stats.hour_histogram_recent || null,
        }
      : null,
  }
}

export async function getShopLive({ shopIds, stats = true, recentDays = 30, sessionId, forceRefresh = false } = {}) {
  const ids = parseIds(shopIds)
  if (!ids.length) {
    return { status: 'error', message: 'Thiếu mã shop hợp lệ.' }
  }

  const cacheKey = `${ids.join(',')}:${stats ? 1 : 0}:${recentDays}`
  if (!forceRefresh) {
    const hit = memoryCache.get(cacheKey)
    if (hit && Date.now() - hit.at < TTL_MS) return { ...hit.data, cached: true }
  }

  let body
  try {
    const result = await callDataApi({
      label: 'addlivetag:shop-live',
      path: 'live/shop-live.php',
      query: {
        shop_ids: ids.join(','),
        stats: stats ? 1 : 0,
        recent_days: Math.min(365, Math.max(1, Number(recentDays) || 30)),
      },
      sessionId,
      timeoutMs: 15_000,
    })
    body = result.body
  } catch (error) {
    return { status: 'error', message: friendlyDataApiError(error, 'Không lấy được dữ liệu live.') }
  }

  const map = body && typeof body === 'object' ? body : {}
  const shops = []
  const missing = []

  for (const id of ids) {
    const raw = map[id]
    if (!raw) {
      missing.push(id)
      continue
    }
    const normalized = normalizeShop(id, raw, raw.stats)
    if (normalized) shops.push(normalized)
  }

  const payload = { status: 'success', shops, missing, requested: ids }
  memoryCache.set(cacheKey, { at: Date.now(), data: payload })
  if (memoryCache.size > 50) memoryCache.delete(memoryCache.keys().next().value)
  return { ...payload, cached: false }
}

/** Top 3 khung giờ hay live từ histogram 24 */
export function topLiveHours(hourHistogram) {
  if (!Array.isArray(hourHistogram) || hourHistogram.length !== 24) return []
  return hourHistogram
    .map((count, hour) => ({ hour, count: Number(count) || 0 }))
    .filter((item) => item.count > 0)
    .sort((a, b) => b.count - a.count)
    .slice(0, 3)
}
