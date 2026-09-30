import { randomUUID } from 'node:crypto'
import database from '../db.js'
import { calcCashbackFromProduct } from './link-service.js'
import { getSetting } from './settings-service.js'

/**
 * “Đã xem” + so giá lần trước / nay — docs/06-price-watch-list.md
 * Đọc SQLite trước, không gọi API mỗi lần mở.
 */

database.exec(`
  CREATE TABLE IF NOT EXISTS price_snapshots (
    id TEXT PRIMARY KEY,
    item_id TEXT NOT NULL,
    price INTEGER,
    commission_estimate INTEGER,
    source TEXT NOT NULL DEFAULT 'lookup',
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
  );
  CREATE INDEX IF NOT EXISTS price_snapshots_item
    ON price_snapshots (item_id, created_at DESC);
`)

export function recordPriceSnapshot({ itemId, price, commissionEstimate, source = 'lookup' }) {
  if (!itemId) return
  database.prepare(`
    INSERT INTO price_snapshots (id, item_id, price, commission_estimate, source)
    VALUES (?, ?, ?, ?, ?)
  `).run(randomUUID(), String(itemId), price ?? null, commissionEstimate ?? null, source)
}

export function listRecentlyViewed({ sessionId, limit = 20 } = {}) {
  const safeLimit = Math.min(50, Number(limit) || 20)
  const rows = database.prepare(`
    SELECT id, item_id AS itemId, input_url AS inputUrl, product_name AS productName,
           shop_name AS shopName, product_price AS productPrice,
           commission_estimate AS commissionEstimate, product_image_url AS productImageUrl,
           affiliate_url AS affiliateUrl, origin_url AS originUrl,
           created_at AS createdAt
    FROM generated_links
    WHERE session_id = ? AND item_id IS NOT NULL
    ORDER BY created_at DESC
    LIMIT ?
  `).all(String(sessionId || ''), safeLimit)

  const share = Number(getSetting('cashback_share_percent'))
  const seen = new Set()
  const items = []

  for (const row of rows) {
    if (seen.has(row.itemId)) continue
    seen.add(row.itemId)

    const snapshots = database.prepare(`
      SELECT price, commission_estimate AS commissionEstimate, created_at AS createdAt, source
      FROM price_snapshots
      WHERE item_id = ?
      ORDER BY created_at DESC
      LIMIT 2
    `).all(row.itemId)

    const curr = snapshots[0] || null
    const prev = snapshots[1] || null
    const currPrice = curr?.price ?? row.productPrice ?? null
    const prevPrice = prev?.price ?? null

    const currCashback = curr?.commissionEstimate != null
      ? Math.floor(Number(curr.commissionEstimate) * share / 100)
      : (row.commissionEstimate != null ? Math.floor(Number(row.commissionEstimate) * share / 100) : null)
    const prevCashback = prev?.commissionEstimate != null
      ? Math.floor(Number(prev.commissionEstimate) * share / 100)
      : null

    items.push({
      id: row.id,
      itemId: row.itemId,
      productName: row.productName,
      shopName: row.shopName,
      productImageUrl: row.productImageUrl,
      affiliateUrl: row.affiliateUrl,
      originUrl: row.originUrl,
      createdAt: row.createdAt,
      currentPrice: currPrice,
      previousPrice: prevPrice,
      priceDelta: prevPrice != null && currPrice != null ? currPrice - prevPrice : null,
      currentCashback: currCashback,
      previousCashback: prevCashback,
      cashbackDelta: prevCashback != null && currCashback != null ? currCashback - prevCashback : null,
    })
  }

  return { items, cashbackSharePercent: share }
}

export function clearWatchHistory(sessionId) {
  const info = database.prepare('DELETE FROM generated_links WHERE session_id = ?').run(String(sessionId || ''))
  return info.changes
}
