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
  const ids = extractItemIds(url)
  const isProduct = isLikelyProductUrl(url)

  // Link ngắn Shopee → cho qua (server sẽ mở rộng khi gọi API)
  if (isShortLink) {
    return { ok: true, url, isShortLink: true, isProduct, ids, message: 'Link hợp lệ' }
  }

  // Link Shopee thường phải là trang sản phẩm
  if (!isProduct) {
    return {
      ok: false,
      code: 'not_product',
      message: 'Hãy dán link một sản phẩm cụ thể trên Shopee.',
    }
  }

  return { ok: true, url, isShortLink: false, isProduct: true, ids, message: '' }
}

/** Ném lỗi nếu link không hợp lệ — dùng cho server */
export function normalizeShopeeUrl(value) {
  const result = parseShopeeUrl(value)
  if (!result.ok) {
    throw new Error(result.message)
  }
  return { url: result.url, isShortLink: result.isShortLink, isProduct: result.isProduct, ids: result.ids }
}

export function isLikelyProductUrl(url) {
  return /\/product\/\d+\/\d+|\-i\.\d+\.\d+|item_id=\d+|itemId=\d+/i.test(url)
}

export function stripTrackingParams(url) {
  try {
    const parsed = new URL(url)
    for (const key of [...parsed.searchParams.keys()]) {
      if (
        key.startsWith('utm_') ||
        key.startsWith('gads_') ||
        key === 'affid' ||
        key === 'affiliate_id' ||
        key === 'sub_id' ||
        key.startsWith('sub_id')
      ) {
        parsed.searchParams.delete(key)
      }
    }
    return parsed.toString()
  } catch {
    return url
  }
}

export function extractItemIds(url) {
  const text = String(url || '')
  const productPath = text.match(/\/product\/(\d+)\/(\d+)/i)
  if (productPath) return { shopId: productPath[1], itemId: productPath[2] }
  const iPath = text.match(/-i\.(\d+)\.(\d+)/i)
  if (iPath) return { shopId: iPath[1], itemId: iPath[2] }
  const queryItem = text.match(/[?&](?:item_id|itemId)=(\d+)/i)
  if (queryItem) return { shopId: null, itemId: queryItem[1] }
  return { shopId: null, itemId: null }
}
