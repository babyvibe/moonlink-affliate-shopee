import { fetchOutbound } from './logger.js'
import { getSetting } from './settings-service.js'

const allowedTypes = new Set(['orders', 'items', 'clicks'])
const allowedSources = new Set(['shopee', 'food'])

function requireConfig() {
  if (!getSetting('addlivetag_api_key')) {
    throw new Error('Chưa cấu hình Addlivetag API Key (Admin → Cài đặt hoặc .env).')
  }
}

export async function fetchConversions({
  type = 'orders',
  source = 'shopee',
  accountId,
  from,
  to,
  status,
  page = 1,
  pageSize = 50,
  sessionId,
} = {}) {
  requireConfig()

  const queryType = allowedTypes.has(type) ? type : 'orders'
  const querySource = allowedSources.has(source) ? source : 'shopee'

  const query = {
    type: queryType,
    source: querySource,
    page: String(Math.max(1, Number(page) || 1)),
    page_size: String(Math.min(200, Math.max(1, Number(pageSize) || 50))),
    format: 'json',
  }
  if (accountId) query.account_id = String(accountId)
  if (from) query.from = String(from)
  if (to) query.to = String(to)
  if (status !== undefined && status !== null && status !== '') {
    query.status = String(status)
  }

  const { response, body } = await fetchOutbound({
    label: 'addlivetag:conversions',
    url: getSetting('conversions_api_base'),
    method: 'GET',
    headers: { 'X-API-Key': getSetting('addlivetag_api_key') },
    query,
    sessionId,
    timeoutMs: 20_000,
  })

  if (!response.ok) {
    throw new Error(body?.message || body?.error || `API báo cáo trả về HTTP ${response.status}`)
  }
  if (!body || body.ok === false) {
    throw new Error(body?.message || 'Không lấy được báo cáo từ API.')
  }

  return {
    type: queryType,
    source: querySource,
    meta: body.meta || { type: queryType, page: 1, page_size: 50, total: 0 },
    summary: body.summary || {},
    data: Array.isArray(body.data) ? body.data : [],
  }
}
