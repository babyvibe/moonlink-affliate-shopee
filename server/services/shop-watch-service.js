import { randomUUID } from 'node:crypto'
import database from '../db.js'
import { rawShopChanges } from './offers-service.js'
import { withDbLog } from './logger.js'

/**
 * Watchlist shop + cảnh báo giảm hoa hồng — docs/04-shop-commission-alerts.md
 */

database.exec(`
  CREATE TABLE IF NOT EXISTS watched_shops (
    shop_id TEXT PRIMARY KEY,
    shop_name TEXT,
    note TEXT,
    last_from_rate REAL,
    last_to_rate REAL,
    last_changed_at TEXT,
    added_by TEXT,
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS commission_alerts (
    id TEXT PRIMARY KEY,
    shop_id TEXT NOT NULL,
    shop_name TEXT,
    from_rate REAL,
    to_rate REAL,
    delta REAL,
    window_days INTEGER,
    points INTEGER,
    detail TEXT,
    status TEXT NOT NULL DEFAULT 'new',
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
  );
  CREATE INDEX IF NOT EXISTS commission_alerts_status ON commission_alerts (status, created_at DESC);
`)

export function listWatchedShops() {
  return database.prepare(`
    SELECT shop_id AS shopId, shop_name AS shopName, note,
           last_from_rate AS lastFromRate, last_to_rate AS lastToRate,
           last_changed_at AS lastChangedAt, created_at AS createdAt
    FROM watched_shops
    ORDER BY created_at DESC
  `).all()
}

export function addWatchedShop({ shopId, shopName = null, note = null, addedBy = null } = {}) {
  const id = String(shopId || '').trim()
  if (!/^\d{1,20}$/.test(id)) throw new Error('Shop ID không hợp lệ.')
  withDbLog(
    'UPSERT watched_shops',
    () => database.prepare(`
      INSERT INTO watched_shops (shop_id, shop_name, note, added_by)
      VALUES (?, ?, ?, ?)
      ON CONFLICT(shop_id) DO UPDATE SET
        shop_name = COALESCE(excluded.shop_name, watched_shops.shop_name),
        note = COALESCE(excluded.note, watched_shops.note)
    `).run(id, shopName, note, addedBy),
    { params: { shopId: id } }
  )
  return { shopId: id, shopName, note }
}

export function removeWatchedShop(shopId) {
  const info = database.prepare('DELETE FROM watched_shops WHERE shop_id = ?').run(String(shopId))
  return info.changes > 0
}

export function listAlerts({ status, limit = 50 } = {}) {
  const safeLimit = Math.min(200, Number(limit) || 50)
  if (status) {
    return database.prepare(`
      SELECT id, shop_id AS shopId, shop_name AS shopName,
             from_rate AS fromRate, to_rate AS toRate, delta,
             window_days AS windowDays, points, detail, status, created_at AS createdAt
      FROM commission_alerts
      WHERE status = ?
      ORDER BY created_at DESC
      LIMIT ?
    `).all(status, safeLimit)
  }
  return database.prepare(`
    SELECT id, shop_id AS shopId, shop_name AS shopName,
           from_rate AS fromRate, to_rate AS toRate, delta,
           window_days AS windowDays, points, detail, status, created_at AS createdAt
    FROM commission_alerts
    ORDER BY created_at DESC
    LIMIT ?
  `).all(safeLimit)
}

export function updateAlertStatus(id, status) {
  const allowed = new Set(['new', 'seen', 'ignored'])
  if (!allowed.has(status)) throw new Error('Trạng thái không hợp lệ.')
  const info = database.prepare('UPDATE commission_alerts SET status = ? WHERE id = ?').run(status, String(id))
  return info.changes > 0
}

export async function scanWatchedShops({ days = 7, minDelta = 0.5, sessionId } = {}) {
  const shops = listWatchedShops()
  if (!shops.length) {
    return { ok: true, scanned: 0, newAlerts: 0, message: 'Chưa có shop nào trong danh sách theo dõi.' }
  }

  const shopIds = shops.map((shop) => shop.shopId)
  const body = await rawShopChanges({
    days,
    direction: 'down',
    minDelta,
    shopIds,
    detail: 1,
    limit: 200,
    sessionId,
  })

  const changes = body.changes || []
  let newAlerts = 0

  for (const change of changes) {
    const shopId = String(change.shopId ?? change.shop_id ?? '')
    if (!shopId) continue
    const points = Number(change.points || 0)
    // points < 2 chưa đủ kết luận
    if (points < 2) continue

    const delta = Number(change.delta || 0)
    if (delta > -Number(minDelta)) continue

    const detail = JSON.stringify(change.series || change)
    const existing = database.prepare(`
      SELECT id FROM commission_alerts
      WHERE shop_id = ? AND from_rate IS ? AND to_rate IS ? AND status != 'ignored'
    `).get(shopId, change.fromRate ?? null, change.toRate ?? null)

    if (existing) continue

    withDbLog(
      'INSERT commission_alerts',
      () => database.prepare(`
        INSERT INTO commission_alerts (
          id, shop_id, shop_name, from_rate, to_rate, delta, window_days, points, detail, status
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'new')
      `).run(
        randomUUID(),
        shopId,
        change.shopName || null,
        change.fromRate ?? null,
        change.toRate ?? null,
        delta,
        days,
        points,
        detail
      ),
      { params: { shopId, delta } }
    )
    newAlerts += 1

    database.prepare(`
      UPDATE watched_shops
      SET shop_name = COALESCE(?, shop_name),
          last_from_rate = ?, last_to_rate = ?, last_changed_at = CURRENT_TIMESTAMP
      WHERE shop_id = ?
    `).run(change.shopName || null, change.fromRate ?? null, change.toRate ?? null, shopId)
  }

  return {
    ok: true,
    scanned: shopIds.length,
    changes: changes.length,
    newAlerts,
    days,
  }
}
