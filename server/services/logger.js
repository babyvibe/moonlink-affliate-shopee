import { randomUUID } from 'node:crypto'
import database from '../db.js'
import { config } from './env.js'

/** Bật log chi tiết: mặc định ON ở dev, OFF khi NODE_ENV=production (trừ LOG_API=1) */
function devLogEnabled() {
  if (process.env.LOG_API === '1') return true
  if (process.env.LOG_API === '0') return false
  return process.env.NODE_ENV !== 'production'
}

export const logEnabled = devLogEnabled()

const SECRET_KEYS = new Set([
  'x-api-key',
  'authorization',
  'api_key',
  'apikey',
  'key',
  'token',
  'secret',
  'password',
  'cookie',
])

function isSecretKey(key) {
  const k = String(key || '').toLowerCase()
  return SECRET_KEYS.has(k) || k.includes('secret') || k.includes('token') || k.endsWith('_key') || k.endsWith('key')
}

function redact(value) {
  if (value == null) return value
  if (typeof value !== 'object') return value
  if (Array.isArray(value)) return value.map(redact)
  const out = {}
  for (const [key, val] of Object.entries(value)) {
    if (isSecretKey(key)) {
      out[key] = '[redacted]'
    } else {
      out[key] = redact(val)
    }
  }
  return out
}

function redactUrl(url) {
  try {
    const parsed = new URL(url)
    for (const key of [...parsed.searchParams.keys()]) {
      if (isSecretKey(key)) {
        parsed.searchParams.set(key, '[redacted]')
      }
    }
    return parsed.toString()
  } catch {
    return String(url).slice(0, 200)
  }
}

function stamp() {
  return new Date().toISOString()
}

function writeEvent({ sessionId = null, eventType, status, detail, elapsedMs = null }) {
  try {
    database.prepare(`
      INSERT INTO request_events (id, session_id, event_type, status, detail, elapsed_ms)
      VALUES (?, ?, ?, ?, ?, ?)
    `).run(randomUUID(), sessionId, eventType, status, detail ? String(detail).slice(0, 2000) : null, elapsedMs)
  } catch {
    // không làm hỏng luồng chính vì log
  }
}

/** Request HTTP nội bộ (client → Express) */
export function logHttp({ method, path, status, elapsedMs, sessionId, message }) {
  const level = status >= 500 ? 'ERROR' : status >= 400 ? 'WARN' : 'INFO'
  if (logEnabled) {
    console.log(`[${stamp()}] [HTTP] [${level}] ${method} ${path} → ${status} (${elapsedMs}ms)${sessionId ? ` session=${sessionId.slice(0, 8)}` : ''}${message ? ` | ${message}` : ''}`)
  }
  if (status >= 400 || path?.startsWith('/api/links') || path?.startsWith('/api/admin/login')) {
    writeEvent({
      sessionId,
      eventType: `http ${method} ${path}`,
      status: status >= 400 ? 'error' : 'success',
      detail: message || `status=${status}`,
      elapsedMs,
    })
  }
}

/** Gọi API ngoài (Addlivetag) — log URL đã che secret */
export function logOutbound({ label, url, method = 'GET', query, status, elapsedMs, ok, message, summary, sessionId }) {
  const level = ok ? 'INFO' : 'WARN'
  if (logEnabled) {
    const q = query ? ` query=${JSON.stringify(redact(query))}` : ''
    const s = summary ? ` summary=${JSON.stringify(redact(summary))}` : ''
    console.log(
      `[${stamp()}] [OUTBOUND] [${level}] ${label} ${method} ${redactUrl(url)}${q} → ${status ?? 'ERR'} (${elapsedMs}ms)${s}${message ? ` | ${message}` : ''}`
    )
  }
  writeEvent({
    sessionId,
    eventType: `outbound:${label}`,
    status: ok ? 'success' : 'error',
    detail: JSON.stringify({
      url: redactUrl(url),
      query: redact(query || {}),
      status: status ?? null,
      message: message || null,
      summary: summary ? redact(summary) : null,
    }),
    elapsedMs,
  })
}

/**
 * Ghi thao tác DB (dev).
 * `op` ví dụ: INSERT generated_links, SELECT admin_sessions
 */
export function logDb({ op, params, elapsedMs, rowCount, sessionId, ok = true, message }) {
  if (logEnabled) {
    const p = params ? ` params=${JSON.stringify(redact(params)).slice(0, 300)}` : ''
    const n = rowCount != null ? ` rows=${rowCount}` : ''
    console.log(
      `[${stamp()}] [DB] [${ok ? 'INFO' : 'WARN'}] ${op}${p}${n} (${elapsedMs ?? 0}ms)${message ? ` | ${message}` : ''}`
    )
  }
  if (!ok) {
    writeEvent({
      sessionId,
      eventType: `db:${op}`,
      status: 'error',
      detail: message || 'db_error',
      elapsedMs,
    })
  }
}

/** Wrapper fetch cho outbound Addlivetag: tự đo thời gian + log */
export async function fetchOutbound({ label, url, method = 'GET', headers = {}, query, sessionId, timeoutMs = 15_000 }) {
  const startedAt = Date.now()
  let target = url
  try {
    if (query) {
      const parsed = new URL(url)
      for (const [key, value] of Object.entries(query)) {
        if (value !== undefined && value !== null && value !== '') {
          parsed.searchParams.set(key, String(value))
        }
      }
      target = parsed.toString()
    }

    const response = await fetch(target, {
      method,
      headers: { Accept: 'application/json', ...headers },
      signal: AbortSignal.timeout(timeoutMs),
    })
    const elapsedMs = Date.now() - startedAt
    const body = await response.json().catch(() => null)

    logOutbound({
      label,
      url: target,
      method,
      query,
      status: response.status,
      elapsedMs,
      ok: response.ok,
      message: response.ok ? null : body?.message || body?.error || `HTTP ${response.status}`,
      summary: body && typeof body === 'object'
        ? {
            ok: body.ok,
            hasProduct: Boolean(body.productInfo || body.data?.productInfo),
            hasAffLink: Boolean(body.affLink),
            dataSource: body.productInfo?.dataSource || body.dataSource,
            total: body.meta?.total,
            dataCount: Array.isArray(body.data) ? body.data.length : undefined,
          }
        : null,
      sessionId,
    })

    return { response, body, elapsedMs, ok: response.ok }
  } catch (error) {
    const elapsedMs = Date.now() - startedAt
    logOutbound({
      label,
      url: target,
      method,
      query,
      status: null,
      elapsedMs,
      ok: false,
      message: error.message,
      sessionId,
    })
    throw error
  }
}

/** Wrapper DB: đo thời gian + log op */
export function withDbLog(op, fn, meta = {}) {
  const startedAt = Date.now()
  try {
    const result = fn()
    const elapsedMs = Date.now() - startedAt
    const rowCount = Array.isArray(result) ? result.length : result?.changes ?? (result ? 1 : 0)
    logDb({ op, params: meta.params, elapsedMs, rowCount, sessionId: meta.sessionId, ok: true })
    return result
  } catch (error) {
    logDb({
      op,
      params: meta.params,
      elapsedMs: Date.now() - startedAt,
      sessionId: meta.sessionId,
      ok: false,
      message: error.message,
    })
    throw error
  }
}

export { redact, redactUrl, writeEvent }
