import { callDataApi, friendlyDataApiError } from './data-api.js'
import database from '../db.js'

/**
 * Offers / shop — docs/03-high-commission-offers.md
 */

const cacheTtlMs = 15 * 60_000
const memoryCache = new Map()

function cacheKey(prefix, params) {
  return `${prefix}:${JSON.stringify(params)}`
}

function readCache(key) {
  const hit = memoryCache.get(key)
  if (!hit) return null
  if (Date.now() - hit.at > cacheTtlMs) {
    memoryCache.delete(key)
    return null
  }
  return hit.data
}

function writeCache(key, data) {
  memoryCache.set(key, { at: Date.now(), data })
  // giới hạn bộ nhớ
  if (memoryCache.size > 200) {
    const firstKey = memoryCache.keys().next().value
    memoryCache.delete(firstKey)
  }
}

async function getOffers(path, query, label) {
  const key = cacheKey(path, query)
  const cached = readCache(key)
  if (cached) return { ...cached, cached: true }

  const { response, body } = await callDataApi({
    label,
    path,
    query,
    timeoutMs: 15_000,
  })
  if (!response.ok) {
    throw new Error(friendlyDataApiError(new Error(body?.message || `HTTP ${response.status}`), 'Không lấy được danh sách ưu đãi.'))
  }

  // Chỉ cache khi có dữ liệu — cache rỗng sẽ làm mất nút Trang sau
  const list = body?.products || body?.shops || body?.offers || []
  if (Array.isArray(list) && list.length > 0) {
    writeCache(key, body)
  }
  return { ...body, cached: false }
}

export async function searchProductOffers({ keyword = '', sortType = 1, page = 1, limit = 20, sessionId } = {}) {
  const body = await getOffers('offers/product-offer.php', {
    keyword: String(keyword || '').slice(0, 200),
    sortType: Number(sortType) || 1,
    page: Math.max(1, Number(page) || 1),
    limit: Math.min(50, Math.max(1, Number(limit) || 20)),
  }, 'addlivetag:product-offer')

  return {
    products: (body.products || []).map((product) => ({
      itemId: product.itemId != null ? String(product.itemId) : null,
      name: product.name || null,
      link: product.link || null,
      image: product.image || null,
      commissionRate: product.commissionRate ?? null,
      commissionPercent: product.commissionRate != null ? Number((product.commissionRate * 100).toFixed(2)) : null,
      price: product.price ?? null,
      priceMin: product.priceMin ?? null,
      priceMax: product.priceMax ?? null,
      sales: product.sales ?? null,
      rating: product.rating ?? null,
      shopId: product.shopId != null ? String(product.shopId) : null,
      shopName: product.shopName || null,
      startTime: product.startTime ?? null,
      endTime: product.endTime ?? null,
    })),
    dataSource: body.dataSource || 'db',
    cached: body.cached,
  }
}

export async function searchShopOffers({ keyword = '', sortType = 1, page = 1, limit = 20 } = {}) {
  const body = await getOffers('offers/shop-offer.php', {
    keyword: String(keyword || '').slice(0, 200),
    sortType: Number(sortType) || 1,
    page: Math.max(1, Number(page) || 1),
    limit: Math.min(50, Math.max(1, Number(limit) || 20)),
  }, 'addlivetag:shop-offer')

  return {
    shops: (body.shops || []).map((shop) => ({
      shopId: shop.shopId != null ? String(shop.shopId) : null,
      name: shop.name || null,
      type: shop.type || null,
      commissionRate: shop.commissionRate ?? null,
      commissionPercent: shop.commissionRate != null ? Number((shop.commissionRate * 100).toFixed(2)) : null,
      rating: shop.rating ?? null,
      remainingBudget: shop.remainingBudget ?? null,
      image: shop.image || null,
      link: shop.link || null,
      startTime: shop.startTime ?? null,
      endTime: shop.endTime ?? null,
    })),
    dataSource: body.dataSource || 'db',
    cached: body.cached,
  }
}

/** Chiến dịch sàn (không gắn 1 shop) — shopee-offer.php */
export async function searchShopeeOffers({ keyword = '', sortType = 1, page = 1, limit = 20 } = {}) {
  const body = await getOffers('offers/shopee-offer.php', {
    keyword: String(keyword || '').slice(0, 200),
    sortType: Number(sortType) || 1,
    page: Math.max(1, Number(page) || 1),
    limit: Math.min(50, Math.max(1, Number(limit) || 20)),
  }, 'addlivetag:shopee-offer')

  return {
    offers: (body.offers || []).map((offer) => ({
      name: offer.name || null,
      type: offer.type || null,
      commissionRate: offer.commissionRate ?? null,
      commissionPercent: offer.commissionRate != null ? Number((offer.commissionRate * 100).toFixed(2)) : null,
      image: offer.image || null,
      link: offer.link || null,
      startTime: offer.startTime ?? null,
      endTime: offer.endTime ?? null,
    })),
    dataSource: body.dataSource || 'db',
    cached: body.cached,
  }
}

/** SP của 1 shop — shop-products.php (limit max 50, cache 10′) */
export async function getShopProducts({ shopId, page = 1, limit = 20, sortType = 1 } = {}) {
  const id = String(shopId || '').trim()
  if (!/^\d{1,20}$/.test(id)) throw new Error('Shop ID không hợp lệ.')

  const body = await getOffers('offers/shop-products.php', {
    shopId: id,
    page: Math.max(1, Number(page) || 1),
    limit: Math.min(50, Math.max(1, Number(limit) || 20)),
    sortType: Number(sortType) || 1,
  }, 'addlivetag:shop-products')

  return {
    shopId: body.shopId != null ? String(body.shopId) : id,
    shopName: body.shopName || null,
    page: body.page ?? null,
    pageSize: body.pageSize ?? null,
    total: body.total ?? null,
    products: (body.products || []).map((product) => ({
      itemId: product.itemId != null ? String(product.itemId) : null,
      name: product.name || null,
      link: product.link || null,
      image: product.image || null,
      commissionRate: product.commissionRate ?? null,
      commissionPercent: product.commissionRate != null ? Number((product.commissionRate * 100).toFixed(2)) : null,
      price: product.price ?? null,
      priceMin: product.priceMin ?? null,
      priceMax: product.priceMax ?? null,
      sales: product.sales ?? null,
      rating: product.rating ?? null,
      startTime: product.startTime ?? null,
      endTime: product.endTime ?? null,
    })),
    dataSource: body.dataSource || 'db',
    cached: body.cached,
  }
}

export async function getShopInfo({ shopId, shopIds } = {}) {
  const ids = shopIds || shopId
  if (!ids) throw new Error('Thiếu shopId.')
  const body = await getOffers('offers/shop-info.php', {
    shopIds: String(ids).slice(0, 400),
  }, 'addlivetag:shop-info')

  const shops = body.shops || body.data || []
  return {
    shops: Array.isArray(shops) ? shops : [shops],
    cached: body.cached,
  }
}

export async function checkShops({ shopIds, live = 1, history = 0, fresh = 21600 } = {}) {
  const body = await getOffers('offers/shop-check.php', {
    shopIds: Array.isArray(shopIds) ? shopIds.join(',') : String(shopIds || ''),
    live,
    history,
    fresh,
  }, 'addlivetag:shop-check')
  return {
    requested: body.requested,
    count: body.count,
    pending: body.pending || [],
    shops: body.shops || [],
    source: body.source || null,
    cached: body.cached,
  }
}

/** Không dùng memory cache riêng cho scan — để service khác quản lý */
export async function rawShopChanges({ days = 7, direction = 'down', minDelta = 0.5, shopIds = [], detail = 1, limit = 100, sessionId } = {}) {
  const { response, body } = await callDataApi({
    label: 'addlivetag:shop-changes',
    path: 'offers/shop-changes.php',
    query: {
      days: Math.min(365, Math.max(1, Number(days) || 7)),
      direction: direction === 'up' || direction === 'down' ? direction : 'any',
      minDelta: Number(minDelta) || 0.5,
      shopIds: Array.isArray(shopIds) ? shopIds.filter(Boolean).slice(0, 500).join(',') : '',
      detail: detail ? 1 : 0,
      limit: Math.min(500, Number(limit) || 100),
    },
    sessionId,
    timeoutMs: 30_000,
  })
  if (!response.ok) {
    throw new Error(friendlyDataApiError(new Error(body?.message || `HTTP ${response.status}`), 'Không quét được thay đổi hoa hồng.'))
  }
  return body
}

export { cacheTtlMs as offersCacheTtlMs }
