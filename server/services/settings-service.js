import database from '../db.js'
import { config as envConfig } from './env.js'

/**
 * Cài đặt chạy-time — lưu trong SQLite (bảng app_settings).
 * Ưu tiên DB > env. Sửa được từ Admin mà không cần deploy lại.
 *
 * CHỈ chứa cấu hình API / cashback.
 * Tài khoản admin (username/password) vẫn nằm ở .env.
 */

const SECRET_KEYS = new Set(['addlivetag_api_key', 'shopee_cookie', 'shopeefood_cookie'])

const DEFINITIONS = {
  addlivetag_api_key: {
    label: 'Addlivetag API Key',
    type: 'secret',
    defaultFromEnv: () => envConfig.addlivetagApiKey,
    placeholder: 'Dán API key (X-API-Key) từ addlivetag.com',
  },
  shopee_affiliate_id: {
    label: 'Shopee Affiliate ID',
    type: 'string',
    defaultFromEnv: () => envConfig.shopeeAffiliateId,
    placeholder: 'vd: 17330450011',
  },
  cashback_share_percent: {
    label: '% hoa hồng chia cho người mua',
    type: 'number',
    min: 0,
    max: 100,
    defaultFromEnv: () => String(envConfig.cashbackSharePercent),
    placeholder: '0 – 100',
  },
  mcn_fee_percent: {
    label: '% phí MCN trừ trước khi chia',
    type: 'number',
    min: 0,
    max: 100,
    defaultFromEnv: () => String(envConfig.mcnFeePercent),
    placeholder: '0 = không trừ',
  },
  shopee_base_rate: {
    label: 'Shopee base rate (tùy chọn)',
    type: 'string',
    defaultFromEnv: () => envConfig.shopeeBaseRate,
    placeholder: 'vd: 8 hoặc 0.08 — để trống theo API',
  },
  shopee_cap_raw: {
    label: 'Trần hoa hồng sàn (tùy chọn)',
    type: 'string',
    defaultFromEnv: () => envConfig.shopeeCapRaw,
    placeholder: 'vd: 40000 — để trống theo API',
  },
  product_api_base: {
    label: 'Product API URL',
    type: 'string',
    defaultFromEnv: () => envConfig.productApiBase,
    placeholder: 'https://data.addlivetag.com/product-data/product-data.php',
  },
  conversions_api_base: {
    label: 'Conversions API URL',
    type: 'string',
    defaultFromEnv: () => envConfig.conversionsApiBase,
    placeholder: 'https://addlivetag.com/api/v1/conversions.php',
  },
  data_api_base: {
    label: 'Data API base URL (unofficial)',
    type: 'string',
    defaultFromEnv: () => envConfig.dataApiBase,
    placeholder: 'https://data.addlivetag.com',
  },
  shopee_cookie: {
    label: 'Cookie Shopee Affiliate (J2Team)',
    type: 'secret',
    defaultFromEnv: () => envConfig.shopeeCookie,
    placeholder: 'Dán cookie J2Team export hoặc chuỗi cookie — dùng cho Đơn ShopeeFood',
  },
  shopeefood_cookie: {
    label: 'Cookie ShopeeFood (nếu khác tài khoản)',
    type: 'secret',
    defaultFromEnv: () => envConfig.shopeefoodCookie,
    placeholder: 'Để trống nếu dùng chung cookie Shopee phía trên',
  },
}

function readDbValue(key) {
  try {
    const row = database.prepare('SELECT value FROM app_settings WHERE key = ?').get(key)
    return row?.value ?? null
  } catch {
    return null
  }
}

function clampNumber(value, min, max, fallback) {
  const n = Number(value)
  if (Number.isNaN(n)) return fallback
  return Math.min(max, Math.max(min, n))
}

/**
 * Giá trị runtime: CHỈ đọc DB (Admin → Cài đặt).
 * Env chỉ dùng để seed lần đầu (seedFromEnvOnce) — sau đó DB là nguồn duy nhất.
 */
export function getSetting(key) {
  const def = DEFINITIONS[key]
  const fromDb = readDbValue(key)
  if (fromDb === null || fromDb === '') {
    if (!def) return ''
    return def.type === 'number' ? String(clampNumber('', def.min ?? 0, def.max ?? 100, 0)) : ''
  }
  if (def?.type === 'number') {
    return clampNumber(fromDb, def.min ?? 0, def.max ?? 100, 0)
  }
  return fromDb
}

/** Seed env → DB lần đầu (giữ config cũ không mất). Sau đó DB là nguồn duy nhất. */
export function seedFromEnvOnce() {
  let seeded = 0
  for (const [key, def] of Object.entries(DEFINITIONS)) {
    if (readDbValue(key) !== null) continue // đã có trong DB → bỏ qua
    let envValue = ''
    try {
      envValue = def.defaultFromEnv() ?? ''
    } catch {
      envValue = ''
    }
    if (envValue === '' || envValue == null) continue
    try {
      database.prepare(`
        INSERT INTO app_settings (key, value, updated_at) VALUES (?, ?, CURRENT_TIMESTAMP)
        ON CONFLICT(key) DO NOTHING
      `).run(key, String(envValue))
      seeded += 1
    } catch {
      // bỏ qua lỗi seed
    }
  }
  return seeded
}

export function getSettingsObject() {
  const out = {}
  for (const key of Object.keys(DEFINITIONS)) {
    out[key] = getSetting(key)
  }
  return out
}

function maskSecret(value) {
  if (!value) return ''
  const s = String(value)
  if (s.length <= 8) return '••••••••'
  return `${s.slice(0, 3)}••••••${s.slice(-4)}`
}

/** Trả về UI-safe (secret bị che) — nguồn luôn là db */
export function getSettingsForAdmin() {
  const items = Object.entries(DEFINITIONS).map(([key, def]) => {
    const value = getSetting(key)
    return {
      key,
      label: def.label,
      type: def.type,
      placeholder: def.placeholder,
      min: def.min,
      max: def.max,
      // secret: chỉ trả mask nếu đã cấu hình
      value: def.type === 'secret' ? (value ? maskSecret(value) : '') : String(value ?? ''),
      configured: def.type === 'secret' ? Boolean(value) : true,
    }
  })
  return { items }
}

export function updateSettings(payload = {}) {
  const updated = []
  for (const [key, rawValue] of Object.entries(payload)) {
    const def = DEFINITIONS[key]
    if (!def) continue

    let value = rawValue == null ? '' : String(rawValue).trim()

    // Bỏ qua secret rỗng (giữ nguyên giá trị cũ) — tránh xóa key khi submit form thiếu
    if (def.type === 'secret' && value === '') continue
    // Không lưu placeholder mask
    if (def.type === 'secret' && value.includes('•')) continue

    if (def.type === 'number') {
      value = String(clampNumber(value, def.min ?? 0, def.max ?? 100, 0))
    }

    database.prepare(`
      INSERT INTO app_settings (key, value, updated_at)
      VALUES (?, ?, CURRENT_TIMESTAMP)
      ON CONFLICT(key) DO UPDATE SET
        value = excluded.value,
        updated_at = CURRENT_TIMESTAMP
    `).run(key, value)
    updated.push(key)
  }

  return {
    updated,
    settings: getSettingsForAdmin(),
  }
}

export function clearSetting(key) {
  if (!DEFINITIONS[key]) return false
  const info = database.prepare('DELETE FROM app_settings WHERE key = ?').run(key)
  return info.changes > 0
}

export { DEFINITIONS, SECRET_KEYS, maskSecret }
