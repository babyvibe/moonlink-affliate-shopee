/**
 * Validate link Shopee phía client — đồng bộ rule với server/services/url-service.js
 * Chặn ngay trên UI, không chờ server trả lỗi.
 */

const shopeeHosts = new Set([
  'shopee.vn',
  'www.shopee.vn',
  's.shopee.vn',
  'shope.ee',
  'vn.shp.ee',
])
const shortHosts = new Set(['s.shopee.vn', 'shope.ee', 'vn.shp.ee'])
const foodHosts = new Set([
  'shopeefood.vn',
  'www.shopeefood.vn',
  'food.shopee.vn',
  'now.vn',
  'www.now.vn',
  'food.shopee.co.id',
])

const MAX_URL_LENGTH = 2000

export function isLikelyProductUrl(url) {
  return /\/product\/\d+\/\d+|\-i\.\d+\.\d+|item_id=\d+|itemId=\d+/i.test(url)
}

export function parseShopeeUrl(value) {
  const raw = typeof value === 'string' ? value.trim() : ''
  if (!raw) {
    return { ok: false, code: 'empty', message: 'Bạn chưa dán link sản phẩm.' }
  }
  if (raw.length > MAX_URL_LENGTH) {
    return { ok: false, code: 'too_long', message: 'Link quá dài. Hãy dán link sản phẩm Shopee.' }
  }

  let parsed
  try {
    parsed = new URL(raw.startsWith('http') ? raw : `https://${raw}`)
  } catch {
    return { ok: false, code: 'invalid_url', message: 'Hãy dán một đường dẫn Shopee hợp lệ.' }
  }

  if (!['https:', 'http:'].includes(parsed.protocol)) {
    return { ok: false, code: 'bad_protocol', message: 'Hãy dán link sản phẩm Shopee (http/https).' }
  }

  const host = parsed.hostname.toLowerCase()

  if (foodHosts.has(host) || host.endsWith('.shopeefood.vn') || host.includes('shopeefood')) {
    return {
      ok: false,
      code: 'shopeefood',
      message: 'Link ShopeeFood chưa hỗ trợ. Hãy dùng link sản phẩm Shopee.',
    }
  }

  if (!shopeeHosts.has(host)) {
    return { ok: false, code: 'not_shopee', message: 'Hãy sử dụng đường dẫn sản phẩm Shopee.' }
  }

  const isShortLink = shortHosts.has(host)
  const url = parsed.toString()
  const isProduct = isLikelyProductUrl(url)

  if (isShortLink) {
    return { ok: true, url, isShortLink: true, isProduct, message: 'Link hợp lệ' }
  }

  if (!isProduct) {
    return {
      ok: false,
      code: 'not_product',
      message: 'Hãy dán link một sản phẩm cụ thể trên Shopee.',
    }
  }

  return { ok: true, url, isShortLink: false, isProduct: true, message: '' }
}

/** true nếu submit được lên server */
export function canSubmitLink(value) {
  const result = parseShopeeUrl(value)
  return result.ok
}
