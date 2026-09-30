import { randomUUID } from 'node:crypto'
import database from '../db.js'
import { callDataApi, friendlyDataApiError } from './data-api.js'
import { getSetting } from './settings-service.js'
import { withDbLog } from './logger.js'

/**
 * Lịch sử giá — docs/01-price-history-chart.md
 * API: price-tracking/history.php (DB-only phía Addlivetag)
 */

const CACHE_TTL_HOURS = 6

database.exec(`
  CREATE TABLE IF NOT EXISTS price_history_cache (
    item_id TEXT NOT NULL,
    days INTEGER NOT NULL,
    payload TEXT NOT NULL,
    fetched_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    fetched_at_ms INTEGER NOT NULL DEFAULT 0,
    PRIMARY KEY (item_id, days)
  );
`)
// Migration: bảng cũ có thể chưa có fetched_at_ms
try {
  database.exec('ALTER TABLE price_history_cache ADD COLUMN fetched_at_ms INTEGER NOT NULL DEFAULT 0')
} catch {
  // cột đã tồn tại
}

function readCache(itemId, days) {
  const row = database.prepare(`
    SELECT payload, fetched_at, fetched_at_ms FROM price_history_cache
    WHERE item_id = ? AND days = ?
  `).get(String(itemId), days)
  if (!row) return null

  // fetched_at_ms lưu epoch — tránh lệch timezone của CURRENT_TIMESTAMP
  const fetchedAt = Number(row.fetched_at_ms) || new Date(String(row.fetched_at).replace(' ', 'T') + 'Z').getTime()
  const ttlMs = CACHE_TTL_HOURS * 3_600_000
  if (!Number.isFinite(fetchedAt) || Date.now() - fetchedAt > ttlMs) return null

  try {
    return { data: JSON.parse(row.payload), fetchedAt: row.fetched_at }
  } catch {
    return null
  }
}

function writeCache(itemId, days, data) {
  withDbLog(
    'UPSERT price_history_cache',
    () => database.prepare(`
      INSERT INTO price_history_cache (item_id, days, payload, fetched_at, fetched_at_ms)
      VALUES (?, ?, ?, CURRENT_TIMESTAMP, ?)
      ON CONFLICT(item_id, days) DO UPDATE SET
        payload = excluded.payload,
        fetched_at = CURRENT_TIMESTAMP,
        fetched_at_ms = excluded.fetched_at_ms
    `).run(String(itemId), days, JSON.stringify(data), Date.now()),
    { params: { itemId: String(itemId), days } }
  )
}

/** Làm sạch chuỗi giá: bỏ điểm <= 0 (API có thể trả 0 khi flash-sale lỗi) */
function sanitizeSeries(labels = [], values = []) {
  const out = { labels: [], price: [] }
  for (let i = 0; i < labels.length; i++) {
    const value = Number(values[i])
    if (!Number.isFinite(value) || value <= 0) continue
    out.labels.push(labels[i])
    out.price.push(value)
  }
  return out
}

export async function getPriceHistory({ itemId, days = 30, sessionId, forceRefresh = false, includeCommission = true }) {
  const id = String(itemId || '').trim()
  if (!/^\d{5,20}$/.test(id)) {
    return { status: 'error', message: 'Sản phẩm không hợp lệ.' }
  }

  const dayCount = Math.min(730, Math.max(7, Number(days) || 30))
  const cacheKeyDays = dayCount + (includeCommission ? 0 : 1000)

  if (!forceRefresh) {
    const cached = readCache(id, cacheKeyDays)
    if (cached) {
      return { ...cached.data, cached: true, cachedAt: cached.fetchedAt }
    }
  }

  let body
  try {
    const result = await callDataApi({
      label: 'addlivetag:price-history',
      path: 'price-tracking/history.php',
      query: {
        item_ids: id,
        type: includeCommission ? 'both' : 'price',
        format: 'chart',
        days: dayCount,
        base_rate: getSetting('shopee_base_rate') || undefined,
      },
      sessionId,
      timeoutMs: 15_000,
    })
    body = result.body
  } catch (error) {
    return { status: 'error', message: friendlyDataApiError(error) }
  }

  const item = body?.items?.[0]
  if (!item || item.status === 'error') {
    return {
      status: item?.reason === 'no_history_in_range' ? 'no_data' : 'error',
      message: item?.reason === 'no_history_in_range'
        ? 'Chưa đủ lịch sử giá cho sản phẩm này.'
        : 'Chưa đọc được lịch sử giá.',
    }
  }

  if (item.status === 'no_data') {
    return { status: 'no_data', message: 'Chưa đủ lịch sử giá cho sản phẩm này.' }
  }

  const chart = item.price?.chart || {}
  const series = sanitizeSeries(chart.labels, chart.price)
  const rawStats = item.price?.stats || null
  const product = item.product || null

  // Commission series (type=both) — nhãn tham khảo, KHÔNG trộn axis với giá
  const commissionChart = item.commission?.chart || null
  const commissionSeries = commissionChart
    ? sanitizeSeries(commissionChart.labels, commissionChart.commission)
    : null

  // Tính lại min/max/avg trên chuỗi đã lọc (bỏ giá <= 0) để UI không hiện min = 0
  const values = series.price
  const localStats = values.length
    ? {
        min: Math.min(...values),
        max: Math.max(...values),
        avg: Math.round(values.reduce((sum, value) => sum + value, 0) / values.length),
        first: values[0],
        last: values[values.length - 1],
      }
    : { min: null, max: null, avg: null, first: null, last: null }

  const payload = {
    status: 'success',
    days: dayCount,
    product: product
      ? {
          name: product.name || null,
          link: product.link || null,
          image: product.image || null,
        }
      : null,
    series,
    // Chuỗi hoa hồng — để riêng, UI chart 2 panel hoặc toggle
    commissionSeries: commissionSeries && commissionSeries.labels?.length >= 2 ? commissionSeries : null,
    stats: {
      ...localStats,
      isLowest: Boolean(rawStats?.isLowest),
      isHighest: Boolean(rawStats?.isHighest),
      change: localStats.first != null && localStats.last != null
        ? localStats.last - localStats.first
        : (rawStats?.change ?? null),
      changePercent: localStats.first
        ? Number((((localStats.last - localStats.first) / localStats.first) * 100).toFixed(2))
        : (rawStats?.changePercent ?? null),
      dayCount: rawStats?.dayCount ?? series.labels.length,
    },
    allTime: item.price?.allTime || null,
    warning: body?.warning || null,
  }

  writeCache(id, cacheKeyDays, payload)
  return { ...payload, cached: false, cachedAt: new Date().toISOString() }
}

/** Có thể thêm cache clearer khi cần — để debug */
export function clearPriceHistoryCache(itemId) {
  const info = itemId
    ? database.prepare('DELETE FROM price_history_cache WHERE item_id = ?').run(String(itemId))
    : database.prepare('DELETE FROM price_history_cache').run()
  return info.changes
}

export { randomUUID }
