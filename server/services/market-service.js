import { callDataApi, friendlyDataApiError } from './data-api.js'

/**
 * Market search / khám phá ngách — docs/07-market-search.md
 * KHÔNG cộng market (luỹ kế) + last30Days (chu kỳ).
 */

const memoryCache = new Map()
const TTL_MS = 6 * 3_600_000

const SORTS = new Set([
  'revenue_all', 'revenue_30d', 'sales', 'sold_30d',
  'price', 'comm_rate', 'growth', 'rating_star',
])

/** So sánh 2–3 từ khóa (docs/07) — gọi tuần tự, KHÔNG cộng market + last30Days */
export async function compareKeywords({ keywords = [], sort = 'revenue_30d', sessionId } = {}) {
  const list = [...new Set(keywords.map((value) => String(value || '').trim()).filter(Boolean))].slice(0, 3)
  if (list.length < 2) {
    return { status: 'error', message: 'Nhập ít nhất 2 từ khóa để so sánh.' }
  }

  const results = []
  for (const keyword of list) {
    const result = await searchMarket({ q: keyword, sort, limit: 5, sessionId })
    if (result.status === 'error') {
      results.push({ keyword, status: 'error', message: result.message })
      continue
    }
    results.push({
      keyword,
      status: 'success',
      market: result.market,
      last30Days: result.last30Days,
      scopeNote: result.scopeNote,
    })
  }

  return {
    status: 'success',
    rows: results.map((item) => ({
      keyword: item.keyword,
      status: item.status,
      message: item.message || null,
      blueOceanScore: item.market?.blueOceanScore ?? null,
      hhi: item.market?.hhi ?? null,
      avgCommissionRate: item.market?.avgCommissionRate ?? null,
      avgPrice: item.market?.avgPrice ?? null,
      totalProducts: item.market?.totalProducts ?? null,
      totalRevenue: item.market?.totalRevenue ?? null,
      sellThroughRate: item.market?.sellThroughRate ?? null,
      coverage30d: item.last30Days?.coverage ?? null,
    })),
    scopeNote: results.find((item) => item.scopeNote)?.scopeNote
      || 'Dữ liệu tham khảo từ nguồn crawl — so sánh tương đối giữa các từ khóa.',
  }
}

export async function searchMarket({ q, sort = 'revenue_30d', limit = 50, offset = 0, priceMin, priceMax, commissionMin, salesMin, sessionId } = {}) {
  const keyword = String(q || '').trim()
  if (!keyword) {
    return { status: 'error', message: 'Nhập từ khóa cần phân tích.' }
  }
  if (keyword.length > 200) {
    return { status: 'error', message: 'Từ khóa quá dài (tối đa 200 ký tự).' }
  }

  const sortKey = SORTS.has(sort) ? sort : 'revenue_30d'
  const query = {
    q: keyword,
    sort: sortKey,
    limit: Math.min(200, Math.max(5, Number(limit) || 50)),
    offset: Math.max(0, Number(offset) || 0),
    include_gifts: 0,
  }
  if (priceMin != null && priceMin !== '') query.price_min = priceMin
  if (priceMax != null && priceMax !== '') query.price_max = priceMax
  if (commissionMin != null && commissionMin !== '') query.commission_min = commissionMin
  if (salesMin != null && salesMin !== '') query.sales_min = salesMin

  const cacheKey = JSON.stringify(query)
  const hit = memoryCache.get(cacheKey)
  if (hit && Date.now() - hit.at < TTL_MS) {
    return { ...hit.data, cached: true }
  }

  let body
  try {
    const result = await callDataApi({
      label: 'addlivetag:market-search',
      path: 'search/market.php',
      query,
      sessionId,
      timeoutMs: 20_000,
    })

    if (!result.response.ok) {
      const reason = result.body?.reason || ''
      const message = reason === 'search_unavailable'
        ? 'Tìm kiếm tạm thời gián đoạn. Thử lại sau ít phút.'
        : (result.body?.error || result.body?.reason || `HTTP ${result.response.status}`)
      return { status: 'error', message }
    }
    body = result.body
  } catch (error) {
    return { status: 'error', message: friendlyDataApiError(error, 'Không phân tích được từ khóa này.') }
  }

  // Map an toàn: không trộn market + last30Days
  const market = body.market || {}
  const last30Days = body.last30Days || {}

  const payload = {
    status: 'success',
    query: body.query || { raw: keyword },
    giftsExcluded: body.giftsExcluded || null,
    market: {
      totalProducts: market.totalProducts ?? null,
      totalShops: market.totalShops ?? null,
      totalSold: market.totalSold ?? null,
      totalRevenue: market.totalRevenue ?? null,
      avgPrice: market.avgPrice ?? null,
      minPrice: market.minPrice ?? null,
      maxPrice: market.maxPrice ?? null,
      avgCommissionRate: market.avgCommissionRate ?? null,
      maxCommissionRate: market.maxCommissionRate ?? null,
      sellThroughRate: market.sellThroughRate ?? null,
      hhi: market.hhi ?? null,
      blueOceanScore: market.blueOceanScore ?? null,
    },
    last30Days: {
      coverage: last30Days.coverage ?? null,
      totalSold: last30Days.totalSold ?? null,
      totalRevenue: last30Days.totalRevenue ?? null,
    },
    topShops: (body.topShops || []).slice(0, 10).map((shop) => ({
      shopId: shop.shopId != null ? String(shop.shopId) : null,
      shopName: shop.shopName || shop.name || null,
      revenue: shop.revenue ?? null,
    })),
    products: (body.products || []).slice(0, 50).map((product) => ({
      itemId: product.itemId != null ? String(product.itemId) : null,
      productName: product.productName || product.name || null,
      shopName: product.shopName || null,
      imageUrl: product.imageUrl || product.image || null,
      productLink: product.productLink || product.link || null,
      price: product.price ?? null,
      sales: product.sales ?? null,
      sold7d: product.sold7d ?? null,
      sold30d: product.sold30d ?? null,
      growth: product.growth ?? null,
      daysTracked: product.daysTracked ?? null,
      rating: product.rating ?? null,
    })),
    scopeNote: body.scopeNote || 'Dữ liệu tham khảo từ nguồn crawl, không phải toàn bộ thị trường.',
    paging: body.paging || null,
  }

  memoryCache.set(cacheKey, { at: Date.now(), data: payload })
  if (memoryCache.size > 50) {
    memoryCache.delete(memoryCache.keys().next().value)
  }

  return { ...payload, cached: false }
}
