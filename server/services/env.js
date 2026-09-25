import { readFileSync } from 'node:fs'
import { join } from 'node:path'

function loadDotEnv() {
  try {
    const raw = readFileSync(join(process.cwd(), '.env'), 'utf8')
    for (const line of raw.split(/\r?\n/)) {
      const trimmed = line.trim()
      if (!trimmed || trimmed.startsWith('#')) continue
      const eq = trimmed.indexOf('=')
      if (eq < 1) continue
      const key = trimmed.slice(0, eq).trim()
      let value = trimmed.slice(eq + 1).trim()
      if (
        (value.startsWith('"') && value.endsWith('"')) ||
        (value.startsWith("'") && value.endsWith("'"))
      ) {
        value = value.slice(1, -1)
      }
      if (!(key in process.env)) process.env[key] = value
    }
  } catch {
    // .env is optional in development
  }
}

loadDotEnv()

export const config = {
  port: Number(process.env.PORT || 3000),
  mode: process.env.MOONLINK_MODE || 'production',
  addlivetagApiKey: process.env.ADDLIVETAG_API_KEY || '',
  productApiBase: process.env.PRODUCT_API_BASE || 'https://data.addlivetag.com/product-data/product-data.php',
  conversionsApiBase: process.env.CONVERSIONS_API_BASE || 'https://addlivetag.com/api/v1/conversions.php',
  shopeeAffiliateId: process.env.SHOPEE_AFFILIATE_ID || '',
  adminUsername: process.env.ADMIN_USERNAME || 'admin',
  adminPassword: process.env.ADMIN_PASSWORD || '',
  sessionTtlHours: Number(process.env.ADMIN_SESSION_TTL_HOURS || 8),
  cookieSecure: process.env.COOKIE_SECURE === '1' || process.env.NODE_ENV === 'production',
  allowedOrigins: (process.env.ALLOWED_ORIGINS || 'http://127.0.0.1:5173,http://localhost:5173')
    .split(',')
    .map((value) => value.trim())
    .filter(Boolean),
  // % hoa hồng chia lại cho người mua (cashback dự kiến)
  cashbackSharePercent: Math.min(100, Math.max(0, Number(process.env.CASHBACK_SHARE_PERCENT || 70))),
  // Tỷ lệ hoa hồng sàn (Shopee base rate) gửi lên product API — khớp dashboard affiliate.
  // Docs: 0.08 hoặc 8; nếu Shopee trả 0 thì base_rate không ghi đè.
  shopeeBaseRate: process.env.SHOPEE_BASE_RATE || '',
  // Trần raw hoa hồng Shopee (docs: 40_000 từ 22/06/2026). Để trống = theo API.
  shopeeCapRaw: process.env.SHOPEE_CAP_RAW || '',
  // % phí MCN trừ khỏi hoa hồng trước khi chia cashback (0 = không trừ — theo PRODUCT-DESIGN)
  mcnFeePercent: Math.min(100, Math.max(0, Number(process.env.MCN_FEE_PERCENT || 0))),
}
