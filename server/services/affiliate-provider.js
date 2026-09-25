import { config } from './env.js'
import { fetchOutbound } from './logger.js'

const shopeeHosts = new Set(['shopee.vn', 'www.shopee.vn', 's.shopee.vn', 'shope.ee', 'vn.shp.ee'])

function requireConfig() {
  if (!config.addlivetagApiKey) {
    throw new Error('Chưa cấu hình ADDLIVETAG_API_KEY ở máy chủ.')
  }
}

export async function fetchProductData({ url, itemId, subIds = [], sessionId } = {}) {
  requireConfig()

  const query = {}
  if (url) query.url = url
  if (itemId) query.item_id = String(itemId)
  if (config.shopeeAffiliateId) query.affid = config.shopeeAffiliateId
  // base_rate / cap theo docs product-data-api.md — khớp tỷ lệ tài khoản affiliate
  if (config.shopeeBaseRate) query.base_rate = config.shopeeBaseRate
  if (config.shopeeCapRaw) query.cap = config.shopeeCapRaw
  subIds.filter(Boolean).slice(0, 5).forEach((value, index) => {
    query[`sub${index + 1}`] = String(value).replace(/-/g, '_').slice(0, 50)
  })

  const { response, body } = await fetchOutbound({
    label: 'addlivetag:product-data',
    url: config.productApiBase,
    method: 'GET',
    headers: { 'X-API-Key': config.addlivetagApiKey },
    query,
    sessionId,
    timeoutMs: 15_000,
  })

  if (!response.ok) {
    const message = body?.message || body?.error || `API sản phẩm trả về HTTP ${response.status}`
    throw new Error(message)
  }

  const product = body?.productInfo || body?.data?.productInfo || null
  if (!product) {
    throw new Error(body?.message || 'Không đọc được thông tin sản phẩm từ API.')
  }

  return {
    product,
    affLink: body?.affLink ?? product?.affLink ?? null,
    originLink: body?.originLink ?? product?.originLink ?? null,
    warning: body?.warning || null,
    dataSource: product.dataSource || body?.dataSource || 'api',
  }
}

/**
 * Dựng link an_redir theo chuẩn 2026 khi API chưa trả affLink.
 * origin_link không được kèm utm/ad params.
 */
export function buildAnRedirLink({ originLink, affiliateId, subIds = [] }) {
  if (!originLink || !affiliateId) return null

  let landing
  try {
    landing = new URL(originLink)
  } catch {
    return null
  }

  for (const key of [...landing.searchParams.keys()]) {
    if (
      key.startsWith('utm_') ||
      key.startsWith('gads_') ||
      key === 'affid' ||
      key === 'affiliate_id' ||
      key === 'sub_id'
    ) {
      landing.searchParams.delete(key)
    }
  }

  let host = 's.shopee.vn'
  const hostName = landing.hostname.replace(/^www\./, '')
  if (hostName && !hostName.endsWith('shopee.vn') && hostName.includes('.')) {
    host = `s.${hostName}`
  }

  const segments = subIds.slice(0, 5).map((value) => {
    if (value === undefined || value === null || value === '') return ''
    return String(value).replace(/-/g, '_').slice(0, 50)
  })
  while (segments.length && segments[segments.length - 1] === '') segments.pop()

  const target = new URL(`https://${host}/an_redir`)
  target.searchParams.set('origin_link', landing.toString())
  target.searchParams.set('affiliate_id', String(affiliateId))
  if (segments.length) target.searchParams.set('sub_id', segments.join('-'))
  return target.toString()
}

export function extractIdsFromUrl(value) {
  const text = String(value || '')
  const productPath = text.match(/\/product\/(\d+)\/(\d+)/i)
  if (productPath) return { shopId: productPath[1], itemId: productPath[2] }
  const iPath = text.match(/-i\.(\d+)\.(\d+)/i)
  if (iPath) return { shopId: iPath[1], itemId: iPath[2] }
  const queryItem = text.match(/[?&](?:item_id|itemId)=(\d+)/i)
  if (queryItem) return { shopId: null, itemId: queryItem[1] }
  return { shopId: null, itemId: null }
}

export function isSupportedShopeeHost(urlString) {
  try {
    const parsed = new URL(urlString)
    return shopeeHosts.has(parsed.hostname.toLowerCase())
  } catch {
    return false
  }
}
