import { randomUUID } from 'node:crypto'
import database from '../db.js'
import { buildAnRedirLink, fetchProductData } from './affiliate-provider.js'
import { config } from './env.js'
import { withDbLog } from './logger.js'
import { extractItemIds, normalizeShopeeUrl, stripTrackingParams } from './url-service.js'

export function ensureSession(sessionId) {
  const id = sessionId || randomUUID()
  withDbLog(
    'UPSERT anonymous_sessions',
    () => database.prepare(`
      INSERT INTO anonymous_sessions (id) VALUES (?)
      ON CONFLICT(id) DO UPDATE SET last_seen_at = CURRENT_TIMESTAMP
    `).run(id),
    { params: { id: id.slice(0, 8) }, sessionId: id }
  )
  return id
}

/**
 * Chuẩn hóa hoa hồng theo docs Product Data:
 *   commission = sellerComFinal + shopeeComFinal
 *   (đã sau user rate & tax; phần Shopee đã cap 40k & limit 8% giá)
 * Cashback dự kiến = floor(hoa_hồng_đã_chuẩn_hóa × tỷ_lệ_chia)
 * PRODUCT-DESIGN: không tự ý coi commission công khai = số dự án nhận;
 * phí MCN chỉ trừ khi cấu hình MCN_FEE_PERCENT > 0.
 */
export function calcCashbackFromProduct(product, options = {}) {
  const sharePercent = options.cashbackSharePercent ?? config.cashbackSharePercent
  const mcnFeePercent = options.mcnFeePercent ?? config.mcnFeePercent

  const sellerComFinal = product?.sellerComFinal != null ? Math.round(Number(product.sellerComFinal)) : null
  const shopeeComFinal = product?.shopeeComFinal != null ? Math.round(Number(product.shopeeComFinal)) : null

  // Ưu tiên công thức docs; fallback field `commission` nếu API thiếu 1 trong 2
  let commissionGross = null
  if (sellerComFinal != null || shopeeComFinal != null) {
    commissionGross = Number(sellerComFinal || 0) + Number(shopeeComFinal || 0)
  } else if (product?.commission != null) {
    commissionGross = Math.round(Number(product.commission))
  }

  if (commissionGross == null || Number.isNaN(commissionGross)) {
    return {
      sellerComFinal,
      shopeeComFinal,
      commissionGross: null,
      mcnFee: null,
      commissionNet: null,
      cashbackSharePercent: sharePercent,
      mcnFeePercent,
      cashbackEstimate: null,
      formula: 'Chưa xác định được hoa hồng từ API.',
    }
  }

  // Chỉ trừ MCN khi vận hành cấu hình; mặc định 0 theo PRODUCT-DESIGN
  const mcnFee = mcnFeePercent > 0
    ? Math.floor(commissionGross * mcnFeePercent / 100)
    : 0
  const commissionNet = commissionGross - mcnFee
  const cashbackEstimate = Math.floor(commissionNet * sharePercent / 100)

  return {
    sellerComFinal,
    shopeeComFinal,
    commissionGross,
    mcnFee,
    commissionNet,
    cashbackSharePercent: sharePercent,
    mcnFeePercent,
    cashbackEstimate,
    formula: `(${sellerComFinal ?? 0} + ${shopeeComFinal ?? 0})${mcnFeePercent > 0 ? ` × (1 − ${mcnFeePercent}% MCN)` : ''} × ${sharePercent}% → ${cashbackEstimate}`,
  }
}

function toPublicLink(row) {
  const commissionEstimate = row.commissionEstimate ?? null
  const cashbackSharePercent = config.cashbackSharePercent
  const mcnFeePercent = config.mcnFeePercent
  const mcnFee = mcnFeePercent > 0 && commissionEstimate != null
    ? Math.floor(Number(commissionEstimate) * mcnFeePercent / 100)
    : 0
  const commissionNet = commissionEstimate != null ? Number(commissionEstimate) - mcnFee : null
  const cashbackEstimate = commissionNet != null
    ? Math.floor(commissionNet * cashbackSharePercent / 100)
    : null

  return {
    id: row.id,
    inputUrl: row.inputUrl,
    normalizedUrl: row.normalizedUrl,
    affiliateUrl: row.affiliateUrl,
    originUrl: row.originUrl,
    itemId: row.itemId,
    productName: row.productName,
    shopName: row.shopName,
    productPrice: row.productPrice,
    productImageUrl: row.productImageUrl,
    commissionEstimate,
    sellerComFinal: row.sellerComFinal ?? null,
    shopeeComFinal: row.shopeeComFinal ?? null,
    mcnFee,
    commissionNet,
    cashbackEstimate,
    cashbackSharePercent,
    mcnFeePercent,
    dataSource: row.dataSource,
    createdAt: row.createdAt,
  }
}

export async function generateLink({ sessionId, url, subIds = [] }) {
  const startedAt = Date.now()
  const session = ensureSession(sessionId)
  const inputUrl = String(url || '').trim()
  let normalizedUrl = inputUrl
  let partial = null

  try {
    // Chặn link sai ngay trên server (không phụ thuộc UI)
    const input = normalizeShopeeUrl(url)
    normalizedUrl = input.url
    const cleaned = stripTrackingParams(input.url)
    const ids = input.ids || extractItemIds(cleaned)

    // Link thường (không rút gọn) phải trích được item_id trước khi gọi API ngoài
    if (!input.isShortLink && !ids.itemId) {
      throw new Error('Hãy dán link sản phẩm Shopee (có shop_id/item_id).')
    }

    // Gọi API thật — không dựng dữ liệu minh họa
    const lookup = await fetchProductData({
      url: cleaned,
      itemId: ids.itemId || undefined,
      subIds,
      sessionId: session,
    })

    const product = lookup.product
    const originLink = lookup.originLink
      || product.productLink
      || product.originalLink
      || (ids.itemId ? `https://shopee.vn/product/${ids.shopId || '0'}/${ids.itemId}` : null)

    const cleanOrigin = originLink ? stripTrackingParams(originLink) : null
    const affiliateUrl = lookup.affLink
      || buildAnRedirLink({
        originLink: cleanOrigin,
        affiliateId: config.shopeeAffiliateId,
        subIds,
      })

    // Giá API có lúc = 0 (flash sale) — fallback priceStats / history
    const priceCandidates = [
      product.price,
      product.priceStats?.currentPrice,
      product.priceStats?.maxPrice,
      product.latestPriceHistory?.originalPrice,
    ]
    const productPrice = priceCandidates
      .map((value) => (value != null ? Math.round(Number(value)) : null))
      .find((value) => value != null && value > 0) ?? null

    const calc = calcCashbackFromProduct(product)

    partial = {
      id: randomUUID(),
      sessionId: session,
      inputUrl,
      normalizedUrl: cleaned,
      originUrl: cleanOrigin,
      itemId: product.itemId ? String(product.itemId) : (ids.itemId || null),
      productName: product.productName ?? null,
      shopName: product.shopName ?? null,
      productPrice,
      productImageUrl: product.imageUrl ?? null,
      commissionEstimate: calc.commissionGross,
      sellerComFinal: calc.sellerComFinal,
      shopeeComFinal: calc.shopeeComFinal,
      dataSource: lookup.dataSource || 'api',
      _calc: calc,
    }

    if (!affiliateUrl) {
      throw new Error(
        config.shopeeAffiliateId
          ? 'API chưa trả về link affiliate hợp lệ cho sản phẩm này.'
          : 'Chưa cấu hình SHOPEE_AFFILIATE_ID nên không tạo được link theo dõi.'
      )
    }

    const link = { ...partial, affiliateUrl }

    // node:sqlite named params: chỉ truyền đúng key trong SQL (tránh Unknown named parameter)
    const row = {
      id: link.id,
      sessionId: link.sessionId,
      inputUrl: link.inputUrl,
      normalizedUrl: link.normalizedUrl,
      affiliateUrl: link.affiliateUrl,
      originUrl: link.originUrl,
      itemId: link.itemId,
      productName: link.productName,
      shopName: link.shopName,
      productPrice: link.productPrice,
      productImageUrl: link.productImageUrl,
      commissionEstimate: link.commissionEstimate,
      dataSource: link.dataSource,
    }

    withDbLog(
      'INSERT generated_links',
      () => database.prepare(`
        INSERT INTO generated_links (
          id, session_id, input_url, normalized_url, affiliate_url, origin_url, item_id,
          product_name, shop_name, product_price, product_image_url, commission_estimate, data_source
        ) VALUES (
          @id, @sessionId, @inputUrl, @normalizedUrl, @affiliateUrl, @originUrl, @itemId,
          @productName, @shopName, @productPrice, @productImageUrl, @commissionEstimate, @dataSource
        )
      `).run(row),
      {
        params: { id: row.id, itemId: row.itemId, productName: row.productName },
        sessionId: session,
      }
    )

    withDbLog(
      'INSERT request_events',
      () => database.prepare(`
        INSERT INTO request_events (id, session_id, event_type, status, elapsed_ms)
        VALUES (?, ?, 'generate_link', 'success', ?)
      `).run(randomUUID(), session, Date.now() - startedAt),
      { sessionId: session }
    )

    return {
      ...toPublicLink(link),
      sellerComFinal: partial.sellerComFinal,
      shopeeComFinal: partial.shopeeComFinal,
      mcnFee: partial._calc?.mcnFee ?? 0,
      commissionNet: partial._calc?.commissionNet ?? null,
      cashbackEstimate: partial._calc?.cashbackEstimate ?? null,
      cashbackSharePercent: partial._calc?.cashbackSharePercent ?? config.cashbackSharePercent,
      mcnFeePercent: partial._calc?.mcnFeePercent ?? config.mcnFeePercent,
      cashbackFormula: partial._calc?.formula ?? null,
      warning: lookup.warning || null,
    }
  } catch (error) {
    // Ghi lại lần thử (kể cả lỗi) để admin theo dõi chất lượng
    try {
      withDbLog(
        'INSERT generated_links (error)',
        () => database.prepare(`
          INSERT INTO generated_links (
            id, session_id, input_url, normalized_url, affiliate_url, origin_url, item_id,
            product_name, shop_name, product_price, product_image_url, commission_estimate, data_source, error_message
          ) VALUES (?, ?, ?, ?, NULL, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `).run(
          partial?.id || randomUUID(),
          session,
          inputUrl,
          normalizedUrl,
          partial?.originUrl || null,
          partial?.itemId || null,
          partial?.productName || null,
          partial?.shopName || null,
          partial?.productPrice ?? null,
          partial?.productImageUrl || null,
          partial?.commissionEstimate ?? null,
          partial?.dataSource || 'error',
          error.message
        ),
        { params: { inputUrl: inputUrl.slice(0, 80), error: error.message }, sessionId: session }
      )
    } catch {
      // bỏ qua lỗi ghi log
    }

    withDbLog(
      'INSERT request_events (error)',
      () => database.prepare(`
        INSERT INTO request_events (id, session_id, event_type, status, detail, elapsed_ms)
        VALUES (?, ?, 'generate_link', 'error', ?, ?)
      `).run(randomUUID(), session, error.message, Date.now() - startedAt),
      { sessionId: session }
    )
    throw error
  }
}

export function getRecentLinks(sessionId) {
  const session = ensureSession(sessionId)
  const rows = withDbLog(
    'SELECT generated_links (recent)',
    () => database.prepare(`
      SELECT id, input_url AS inputUrl, normalized_url AS normalizedUrl, affiliate_url AS affiliateUrl,
        origin_url AS originUrl, item_id AS itemId,
        product_name AS productName, shop_name AS shopName, product_price AS productPrice,
        product_image_url AS productImageUrl, commission_estimate AS commissionEstimate,
        data_source AS dataSource, created_at AS createdAt
      FROM generated_links
      WHERE session_id = ? AND affiliate_url IS NOT NULL
      ORDER BY created_at DESC
      LIMIT 10
    `).all(session),
    { params: { session: session.slice(0, 8) }, sessionId: session }
  )
  return { sessionId: session, links: rows.map(toPublicLink) }
}

export function clearRecentLinks(sessionId) {
  const session = ensureSession(sessionId)
  database.prepare('DELETE FROM generated_links WHERE session_id = ?').run(session)
  return { sessionId: session }
}

export function listAdminLinks({ limit = 50, offset = 0 } = {}) {
  const safeLimit = Math.min(200, Math.max(1, Number(limit) || 50))
  const safeOffset = Math.max(0, Number(offset) || 0)
  const rows = withDbLog(
    'SELECT generated_links (admin)',
    () => database.prepare(`
      SELECT id, input_url AS inputUrl, affiliate_url AS affiliateUrl, item_id AS itemId,
        product_name AS productName, shop_name AS shopName, product_price AS productPrice,
        commission_estimate AS commissionEstimate, data_source AS dataSource, created_at AS createdAt
      FROM generated_links
      WHERE affiliate_url IS NOT NULL
      ORDER BY created_at DESC
      LIMIT ? OFFSET ?
    `).all(safeLimit, safeOffset),
    { params: { limit: safeLimit, offset: safeOffset } }
  )
  const total = withDbLog(
    'COUNT generated_links',
    () => database.prepare('SELECT COUNT(*) AS n FROM generated_links WHERE affiliate_url IS NOT NULL').get().n
  )
  return { total, items: rows.map(toPublicLink) }
}

export function getLinkStats() {
  const row = withDbLog(
    'SELECT generated_links (stats)',
    () => database.prepare(`
      SELECT
        COUNT(*) AS total,
        SUM(CASE WHEN affiliate_url IS NOT NULL THEN 1 ELSE 0 END) AS success,
        SUM(CASE WHEN affiliate_url IS NULL THEN 1 ELSE 0 END) AS failed
      FROM generated_links
    `).get()
  )
  const today = withDbLog(
    'SELECT generated_links (today)',
    () => database.prepare(`
      SELECT COUNT(*) AS n FROM generated_links
      WHERE affiliate_url IS NOT NULL AND date(created_at) = date('now')
    `).get().n
  )
  return {
    total: Number(row?.total || 0),
    success: Number(row?.success || 0),
    failed: Number(row?.failed || 0),
    today: Number(today || 0),
  }
}
