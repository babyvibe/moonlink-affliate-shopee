import { fetchOutbound } from './logger.js'
import { getSetting } from './settings-service.js'

/**
 * Adapter dùng chung cho Data API unofficial (data.addlivetag.com).
 * Xem docs/00-data-api-overview.md
 *
 * - Key chỉ nằm server (settings / .env) — không gửi xuống client.
 * - Mọi call đi qua fetchOutbound để log [OUTBOUND] + request_events.
 * - Bắt lỗi 429 / cooldown rõ ràng cho UI.
 */
export async function callDataApi({
  label,
  path,
  query,
  method = 'GET',
  body,
  sessionId,
  timeoutMs = 20_000,
  extraHeaders = {},
}) {
  const apiKey = getSetting('addlivetag_api_key')
  if (!apiKey) {
    throw new Error('Chưa cấu hình API key (Admin → Cài đặt hoặc .env).')
  }

  const base = String(getSetting('data_api_base') || 'https://data.addlivetag.com')
  const url = `${base.replace(/\/+$/, '')}/${String(path || '').replace(/^\/+/, '')}`

  const headers = {
    'X-API-Key': apiKey,
    Accept: 'application/json',
    ...(body ? { 'Content-Type': 'application/json' } : {}),
    ...extraHeaders,
  }

  const result = await fetchOutbound({
    label,
    url,
    method,
    headers,
    query,
    body,
    sessionId,
    timeoutMs,
  })

  return result
}

/** Chuyển lỗi API thành message thân thiện cho UI người dùng */
export function friendlyDataApiError(error, fallback = 'Không lấy được dữ liệu. Vui lòng thử lại sau.') {
  const message = String(error?.message || '')
  if (message.includes('429') || /rate.?limit/i.test(message)) {
    return 'Hệ thống đang bận. Thử lại sau ít phút nhé.'
  }
  if (/cooldown|sourceRateLimited/i.test(message)) {
    return 'Đang tải thêm dữ liệu. Thử lại sau ít phút nhé.'
  }
  if (message.includes('401') || /api key/i.test(message)) {
    return 'Chưa cấu hình API key (Admin → Cài đặt).'
  }
  if (message.includes('502') || message.includes('503')) {
    return 'Nguồn dữ liệu tạm gián đoạn. Thử lại sau.'
  }
  return message || fallback
}
