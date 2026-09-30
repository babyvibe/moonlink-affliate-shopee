import database from '../db.js'
import { callDataApi, friendlyDataApiError } from './data-api.js'

/**
 * So sánh Lazada — docs/09-lazada-compare.md
 * API: lazada/resolve.php + lazada/product.php
 *
 * Lưu ý: KHÔNG so trực tiếp commissionRate Shopee vs Lazada (mô hình khác).
 */

const CACHE_TTL_MS = 24 * 3_600_000

database.exec(`
  CREATE TABLE IF NOT EXISTS lazada_cache (
    item_id TEXT PRIMARY KEY,
    payload TEXT NOT NULL,
    fetched_at_ms INTEGER NOT NULL
  );
`)

function readCache(itemId) {
  const row = database.prepare('SELECT payload, fetched_at_ms FROM lazada_cache WHERE item_id = ?').get(String(itemId))
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
    INSERT INTO lazada_cache (item_id, payload, fetched_at_ms)
    VALUES (?, ?, ?)
    ON CONFLICT(item_id) DO UPDATE SET payload = excluded.payload, fetched_at_ms = excluded.fetched_at_ms
  `).run(String(itemId), JSON.stringify(data), Date.now())
}

/** Resolve link Lazada → itemId (+ skuId) */
export async function resolveLazadaUrl({ url, sessionId } = {}) {
  const input = String(url || '').trim()
  if (!input) return { status: 'error', message: 'Thiếu link Lazada.' }

  try {
    const result = await callDataApi({
      label: 'addlivetag:lazada-resolve',
      path: 'lazada/resolve.php',
      query: { url: input },
      sessionId,
      timeoutMs: 15_000,
    })

    if (result.response.status === 400) {
      return { status: 'error', message: 'Đây không phải link Lazada hợp lệ.' }
    }
    if (!result.response.ok) {
      return {
        status: 'error',
        message: friendlyDataApiError(new Error(result.body?.message || `HTTP ${result.response.status}`), 'Không mở được link Lazada.'),
      }
    }

    return {
      status: result.body?.itemId ? 'success' : 'not_found',
      itemId: result.body?.itemId ? String(result.body.itemId) : null,
      skuId: result.body?.skuId ? String(result.body.skuId) : null,
      originLink: result.body?.originLink || null,
      resolvedBy: result.body?.resolvedBy || null,
    }
  } catch (error) {
    return { status: 'error', message: friendlyDataApiError(error, 'Không mở được link Lazada.') }
  }
}

function normalizeProduct(info) {
  if (!info) return null
  const commission = info.commission ?? null
  return {
    itemId: info.itemId != null ? String(info.itemId) : null,
    productName: info.productName || info.name || null,
    shopName: info.shopName || null,
    brandName: info.brandName || null,
    price: info.price ?? null,
    stock: info.stock ?? null,
    outOfStock: info.outOfStock ?? null,
    // Lazada sales = 7 NGÀY — không giống Shopee
    sales7d: info.sales7d ?? info.sales ?? null,
    imageUrl: info.imageUrl || null,
    productLink: info.productLink || null,
    commission: typeof commission === 'number' ? commission : (commission?.totalCommissionAmount ?? null),
    commissionRate: info.commissionRate ?? null,
    sameStoreCommissionRate: info.sameStoreCommissionRate ?? null,
    crossStoreCommissionRate: info.crossStoreCommissionRate ?? null,
    lastUpdate: info.lastUpdate || null,
    dataSource: info.dataSource || null,
  }
}

export async function getLazadaProduct({ itemId, url, sessionId, forceRefresh = false } = {}) {
  const id = String(itemId || '').trim()
  if (!id && !url) return { status: 'error', message: 'Thiếu sản phẩm Lazada.' }

  if (id && !forceRefresh) {
    const cached = readCache(id)
    if (cached) return { ...cached, cached: true }
  }

  try {
    const result = await callDataApi({
      label: 'addlivetag:lazada-product',
      path: 'lazada/product.php',
      query: {
        item_id: id || undefined,
        url: !id ? url : undefined,
        locale: 'vi-VN',
      },
      sessionId,
      timeoutMs: 15_000,
    })

    if (!result.response.ok) {
      return {
        status: 'error',
        message: friendlyDataApiError(new Error(result.body?.message || `HTTP ${result.response.status}`), 'Không tìm thấy sản phẩm Lazada.'),
      }
    }

    const info = result.body?.productInfo || result.body?.products?.[0] || null
    const product = normalizeProduct(info)
    if (!product) return { status: 'not_found', message: 'Không tìm thấy sản phẩm Lazada.' }

    const payload = { status: 'success', product, disclaimer: 'Hoa hồng Lazada tính theo cơ chế khác Shopee — không so trực tiếp tỷ lệ %.' }
    if (product.itemId) writeCache(product.itemId, payload)
    return { ...payload, cached: false }
  } catch (error) {
    return { status: 'error', message: friendlyDataApiError(error, 'Không tìm thấy sản phẩm Lazada.') }
  }
}

/**
 * So Lazada với 1 sản phẩm Shopee.
 * KHÔNG có matchScore như TikTok → luôn coi là "gợi ý".
 */
export async function compareLazada({ shopeeProduct, lazadaUrl, lazadaItemId, sessionId } = {}) {
  // 1) resolve link Lazada nếu có
  let itemId = lazadaItemId ? String(lazadaItemId) : null
  if (!itemId && lazadaUrl) {
    const resolved = await resolveLazadaUrl({ url: lazadaUrl, sessionId })
    if (resolved.status !== 'success') {
      return { status: 'error', message: resolved.message || 'Không mở được link Lazada.' }
    }
    itemId = resolved.itemId
  }

  // 2) Nếu không có link Lazada → không tự đoán (không có search theo tên)
  if (!itemId) {
    return {
      status: 'need_link',
      message: 'Dán link sản phẩm Lazada để so sánh.',
    }
  }

  const lazada = await getLazadaProduct({ itemId, sessionId })
  if (lazada.status !== 'success') {
    return { status: 'error', message: lazada.message || 'Không tìm thấy sản phẩm Lazada.' }
  }

  const shopeePrice = shopeeProduct?.productPrice ?? shopeeProduct?.price ?? null
  const shopeeCommission = shopeeProduct?.commissionEstimate ?? null
  const lazadaPrice = lazada.product.price ?? null
  const lazadaCommission = lazada.product.commission ?? null

  const priceDiff = shopeePrice != null && lazadaPrice != null ? lazadaPrice - shopeePrice : null
  const commissionDiff = shopeeCommission != null && lazadaCommission != null ? lazadaCommission - shopeeCommission : null

  return {
    status: 'success',
    // luôn là gợi ý — không có scoring chính thức
    safe: false,
    note: 'Sản phẩm tương tự — nên kiểm tra tay trước khi quyết định.',
    shopee: {
      price: shopeePrice,
      commission: shopeeCommission,
    },
    lazada: lazada.product,
    comparison: {
      priceDiff,
      cheaperPlatform: priceDiff == null ? null : (priceDiff < 0 ? 'lazada' : 'shopee'),
      commissionDiff,
      higherCommissionPlatform: commissionDiff == null ? null : (commissionDiff > 0 ? 'lazada' : 'shopee'),
      // KHÔNG so commissionRate (%) — mô hình khác nhau
      rateWarning: 'Tỷ lệ % hoa hồng Lazada và Shopee tính khác nhau — chỉ so số tiền.',
    },
    disclaimer: 'Lazada sales là 7 ngày (không luỹ kế như Shopee). Không so trực tiếp tỷ lệ hoa hồng.',
    cached: lazada.cached,
  }
}
