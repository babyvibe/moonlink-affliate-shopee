import { randomUUID } from 'node:crypto'
import database from '../db.js'
import { buildAnRedirLink } from './affiliate-provider.js'
import { callDataApi, friendlyDataApiError } from './data-api.js'
import { calcCashbackFromProduct, ensureSession } from './link-service.js'
import { getSetting } from './settings-service.js'
import { withDbLog } from './logger.js'
import { parseShopeeUrl, stripTrackingParams, extractItemIds } from './url-service.js'

/**
 * Tra hàng loạt ≤100 SP — docs/02-batch-product-lookup.md
 * API: product-data/product-data-batch.php
 */

const MAX_ITEMS = 100

function toItemIdOrUrl(input) {
  const raw = String(input || '').trim()
  if (!raw) return null
  if (/^\d{5,20}$/.test(raw)) return { kind: 'id', value: raw, input: raw }
  const parsed = parseShopeeUrl(raw)
  if (!parsed.ok) return { kind: 'invalid', input: raw, message: parsed.message }
  if (parsed.isShortLink) {
    return { kind: 'short', input: raw, message: 'Dùng link sản phẩm đầy đủ (không dùng link rút gọn).' }
  }
  const ids = extractItemIds(parsed.url)
  if (ids.itemId) return { kind: 'id', value: ids.itemId, input: raw, url: parsed.url }
  return { kind: 'invalid', input: raw, message: 'Hãy dán link một sản phẩm cụ thể trên Shopee.' }
}

export async function lookupBatch({ lines = [], subIds = [], mode = 'estimate', sessionId, logLinks = false } = {}) {
  const session = ensureSession(sessionId)
  const inputs = lines.map((line) => String(line || '').trim()).filter(Boolean).slice(0, MAX_ITEMS)

  const valid = []
  const invalid = []
  for (const line of inputs) {
    const parsed = toItemIdOrUrl(line)
    if (parsed.kind === 'id') valid.push(parsed)
    else invalid.push(parsed)
  }

  if (!valid.length && !invalid.length) {
    return { ok: false, message: 'Bạn chưa dán link sản phẩm nào.' }
  }

  let body = null
  if (valid.length) {
    try {
      const result = await callDataApi({
        label: 'addlivetag:product-batch',
        path: 'product-data/product-data-batch.php',
        method: 'POST',
        body: {
          items: valid.map((item) => item.value),
          affid: getSetting('shopee_affiliate_id') || undefined,
          sub1: subIds[0] || undefined,
          sub2: subIds[1] || undefined,
          sub3: subIds[2] || undefined,
          sub4: subIds[3] || undefined,
          sub5: subIds[4] || undefined,
          base_rate: getSetting('shopee_base_rate') || undefined,
          cap: getSetting('shopee_cap_raw') || undefined,
          cache_only: mode === 'estimate' ? 1 : 0,
          max_api: mode === 'estimate' ? 0 : 20,
        },
        sessionId: session,
        timeoutMs: 60_000,
      })
      body = result.body
    } catch (error) {
      return { ok: false, message: friendlyDataApiError(error, 'Không tra được danh sách sản phẩm.') }
    }
  }

  const affiliateId = getSetting('shopee_affiliate_id')
  const rows = []

  for (const item of invalid) {
    rows.push({
      input: item.input,
      status: item.kind === 'short' ? 'short_link' : 'invalid',
      message: item.message || 'Không hợp lệ',
      productName: null,
      productPrice: null,
      commissionEstimate: null,
      cashbackEstimate: null,
      affiliateUrl: null,
    })
  }

  const products = body?.products || []
  for (const product of products) {
    const info = product.productInfo
    const calc = info ? calcCashbackFromProduct(info) : null
    const origin = info?.originLink || info?.productLink || (product.itemId ? `https://shopee.vn/product/${info?.shopId || '0'}/${product.itemId}` : null)
    const cleanOrigin = origin ? stripTrackingParams(origin) : null

    let affiliateUrl = product.affLink || null
    if (!affiliateUrl && affiliateId && cleanOrigin && product.status === 'success') {
      affiliateUrl = buildAnRedirLink({ originLink: cleanOrigin, affiliateId, subIds })
    }

    const productPrice = (() => {
      const candidates = [info?.price, info?.priceStats?.currentPrice, info?.priceStats?.maxPrice]
      return candidates.find((value) => value != null && Number(value) > 0) != null
        ? Math.round(Number(candidates.find((value) => value != null && Number(value) > 0)))
        : null
    })()

    const row = {
      input: product.input || String(product.itemId || ''),
      itemId: product.itemId ? String(product.itemId) : null,
      status: product.status === 'success' ? 'success' : (product.status || 'error'),
      message: product.reason || product.message || null,
      productName: info?.productName || info?.name || null,
      shopName: info?.shopName || null,
      productPrice,
      productImageUrl: info?.imageUrl || null,
      commissionEstimate: calc?.commissionGross ?? null,
      sellerComFinal: calc?.sellerComFinal ?? null,
      shopeeComFinal: calc?.shopeeComFinal ?? null,
      cashbackEstimate: calc?.cashbackEstimate ?? null,
      cashbackSharePercent: calc?.cashbackSharePercent ?? Number(getSetting('cashback_share_percent')),
      affiliateUrl,
      originUrl: cleanOrigin,
      dataSource: product.dataSource || 'api',
    }
    rows.push(row)

    if (logLinks && mode === 'generate' && affiliateUrl) {
      try {
        withDbLog(
          'INSERT generated_links (batch)',
          () => database.prepare(`
            INSERT INTO generated_links (
              id, session_id, input_url, normalized_url, affiliate_url, origin_url, item_id,
              product_name, shop_name, product_price, product_image_url, commission_estimate, data_source
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
          `).run(
            randomUUID(), session, row.input, row.originUrl || row.input, affiliateUrl,
            row.originUrl, row.itemId, row.productName, row.shopName,
            row.productPrice, row.productImageUrl, row.commissionEstimate, row.dataSource
          ),
          { sessionId: session }
        )
      } catch {
        // bỏ qua lỗi ghi log
      }
    }
  }

  const successRows = rows.filter((row) => row.status === 'success' && row.cashbackEstimate != null)
  const totalCashback = successRows.reduce((sum, row) => sum + Number(row.cashbackEstimate || 0), 0)

  return {
    ok: true,
    rows,
    summary: {
      requested: inputs.length,
      success: successRows.length,
      stale: rows.filter((row) => row.status === 'stale').length,
      notFound: rows.filter((row) => row.status === 'not_found').length,
      invalid: rows.filter((row) => row.status === 'invalid' || row.status === 'short_link').length,
      totalCashback,
      cashbackSharePercent: Number(getSetting('cashback_share_percent')),
    },
    limits: body?.limits || null,
    mode,
    sessionId: session,
  }
}
