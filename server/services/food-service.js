import { callDataApi, friendlyDataApiError } from './data-api.js'
import { getSetting } from './settings-service.js'

/**
 * Thông tin quán ShopeeFood — docs/10-shopeefood-store.md
 * API: shopeefood/store.php (GET only, free cho nội bộ)
 *
 * Lưu ý: KHÔNG convert link food sang affiliate (không có an_redir).
 */

const memoryCache = new Map()
const TTL_MS = 24 * 3_600_000

const foodHosts = new Set([
  'shopeefood.vn',
  'www.shopeefood.vn',
  'food.shopee.vn',
  'now.vn',
  'www.now.vn',
])

/** Trích restaurant_id từ link ShopeeFood / Now */
export function extractRestaurantId(input) {
  const text = String(input || '').trim()
  if (!text) return null
  // https://shopeefood.vn/ho-chi-minh/com-thit-nuong-abc__12345
  const tail = text.match(/__(\d{3,20})/)
  if (tail) return tail[1]
  const q = text.match(/restaurant[_-]?id=(\d{3,20})/i)
  if (q) return q[1]
  if (/^\d{3,20}$/.test(text)) return text
  return null
}

export function isFoodHost(url) {
  try {
    const host = new URL(url).hostname.toLowerCase()
    return foodHosts.has(host) || host.endsWith('.shopeefood.vn')
  } catch {
    return false
  }
}

function normalizeStore(raw) {
  if (!raw) return null
  const restaurantId = String(raw.restaurant_id ?? raw.id ?? '')
  const name = raw.name || raw.restaurant_name || null
  // Bỏ object rỗng (API trả {} khi không có data)
  if (!restaurantId && !name) return null
  return {
    restaurantId,
    name,
    address: raw.address || null,
    isOpen: raw.is_open ?? null,
    openHours: raw.open_hours || raw.operating_hours || null,
    restaurantUrl: raw.restaurant_url || null,
    isQualityMerchant: raw.is_quality_merchant ?? null,
    isPickup: raw.is_pickup ?? null,
  }
}

export async function getFoodStores({ restaurantIds, sessionId, forceRefresh = false } = {}) {
  const ids = (Array.isArray(restaurantIds) ? restaurantIds : String(restaurantIds || '').split(/[\s,]+/))
    .map((value) => String(value).trim())
    .filter((value) => /^\d{3,20}$/.test(value))
    .slice(0, 20)

  if (!ids.length) {
    return { status: 'error', message: 'Thiếu mã quán hợp lệ.' }
  }

  const cacheKey = ids.join(',')
  if (!forceRefresh) {
    const hit = memoryCache.get(cacheKey)
    if (hit && Date.now() - hit.at < TTL_MS) return { ...hit.data, cached: true }
  }

  let body
  try {
    const result = await callDataApi({
      label: 'addlivetag:shopeefood-store',
      path: 'shopeefood/store.php',
      query: { restaurant_id: ids.join(',') },
      sessionId,
      timeoutMs: 15_000,
    })

    if (result.response.status === 400) {
      return { status: 'error', message: 'Mã quán không hợp lệ.' }
    }
    if (result.response.status === 405) {
      return { status: 'error', message: 'Phương thức không được hỗ trợ.' }
    }
    body = result.body
  } catch (error) {
    return { status: 'error', message: friendlyDataApiError(error, 'Không lấy được thông tin quán.') }
  }

  // Shape API: { status, count, data: [...] } — hoặc mảng / object đơn
  const list = Array.isArray(body)
    ? body
    : Array.isArray(body?.data)
      ? body.data
      : (body && body.name ? [body] : [])

  const stores = list.map(normalizeStore).filter(Boolean)
  const foundIds = new Set(stores.map((s) => s.restaurantId))

  const payload = {
    status: 'success',
    stores,
    missing: ids.filter((id) => !foundIds.has(id)),
    note: stores.length ? null : 'Không tìm thấy quán này.',
  }
  memoryCache.set(cacheKey, { at: Date.now(), data: payload })
  return { ...payload, cached: false }
}

/** Resolve link food → restaurant_id → thông tin quán */
export async function resolveFoodUrl({ url, sessionId }) {
  const restaurantId = extractRestaurantId(url)
  if (!restaurantId) {
    return { status: 'error', message: 'Chưa nhận diện được mã quán từ link này.' }
  }
  const result = await getFoodStores({ restaurantIds: [restaurantId], sessionId })
  return { ...result, restaurantId }
}

/**
 * Đơn ShopeeFood — CẦN COOKIE (docs/10)
 * API: shopeefood/orders.php — header X-SPF-Cookie (J2Team export hoặc chuỗi cookie)
 */
export async function getFoodOrders({ from, to, page = 1, pageSize = 20, sessionId } = {}) {
  // Ưu tiên cookie ShopeeFood riêng, fallback cookie Shopee Affiliate
  const cookie = getSetting('shopeefood_cookie') || getSetting('shopee_cookie')
  if (!cookie) {
    return {
      status: 'need_cookie',
      message: 'Chưa có cookie Shopee. Vào Admin → Cài đặt → dán cookie J2Team rồi thử lại.',
    }
  }

  try {
    const result = await callDataApi({
      label: 'addlivetag:shopeefood-orders',
      path: 'shopeefood/orders.php',
      query: {
        from: from || undefined,
        to: to || undefined,
        page: Math.max(1, Number(page) || 1),
        page_size: Math.min(100, Math.max(1, Number(pageSize) || 20)),
      },
      extraHeaders: { 'X-SPF-Cookie': cookie },
      sessionId,
      timeoutMs: 25_000,
    })

    if (result.response.status === 401 || result.response.status === 403) {
      return {
        status: 'need_cookie',
        message: 'Cookie không hợp lệ hoặc đã hết hạn. Lấy lại cookie bằng J2Team và lưu vào Admin → Cài đặt.',
      }
    }
    if (!result.response.ok) {
      return {
        status: 'error',
        message: friendlyDataApiError(new Error(result.body?.message || `HTTP ${result.response.status}`), 'Không lấy được đơn ShopeeFood.'),
      }
    }

    const body = result.body || {}
    const orders = body.orders || body.data || []
    return {
      status: 'success',
      orders: Array.isArray(orders) ? orders : [],
      meta: body.meta || body.paging || null,
      summary: body.summary || null,
    }
  } catch (error) {
    return { status: 'error', message: friendlyDataApiError(error, 'Không lấy được đơn ShopeeFood.') }
  }
}
