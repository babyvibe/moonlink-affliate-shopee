import { createHash, randomBytes, randomUUID, scrypt, timingSafeEqual } from 'node:crypto'
import { promisify } from 'node:util'
import database from '../db.js'
import { config } from './env.js'

const scryptAsync = promisify(scrypt)
const SCRYPT = { N: 16384, r: 8, p: 1, keylen: 64 }
const MAX_LOGIN_FAILURES = 5
const LOCKOUT_MINUTES = 15
const SESSION_COOKIE = 'admin_session'

async function hashPassword(password, salt = randomBytes(16)) {
  const derived = await scryptAsync(password, salt, SCRYPT.keylen, SCRYPT)
  return {
    salt: salt.toString('hex'),
    hash: derived.toString('hex'),
    params: SCRYPT,
  }
}

async function verifyPassword(password, saltHex, hashHex) {
  const salt = Buffer.from(saltHex, 'hex')
  const expected = Buffer.from(hashHex, 'hex')
  const derived = await scryptAsync(password, salt, expected.length, SCRYPT)
  return derived.length === expected.length && timingSafeEqual(derived, expected)
}

function hashToken(token) {
  return createHash('sha256').update(token).digest('hex')
}

function safeEqual(a, b) {
  const left = Buffer.from(String(a || ''), 'utf8')
  const right = Buffer.from(String(b || ''), 'utf8')
  if (left.length !== right.length) return false
  return timingSafeEqual(left, right)
}

export async function ensureAdminBootstrap() {
  if (!config.adminPassword || config.adminPassword.length < 10) {
    console.warn('[auth] ADMIN_PASSWORD chưa đặt (tối thiểu 10 ký tự). Không khởi tạo admin.')
    return { created: false, reason: 'missing_password' }
  }

  const existing = database.prepare('SELECT id FROM admin_users WHERE username = ?').get(config.adminUsername)
  if (existing) return { created: false, reason: 'exists' }

  const { salt, hash, params } = await hashPassword(config.adminPassword)
  database.prepare(`
    INSERT INTO admin_users (id, username, password_salt, password_hash, scrypt_params)
    VALUES (?, ?, ?, ?, ?)
  `).run(randomUUID(), config.adminUsername, salt, hash, JSON.stringify(params))
  console.log(`[auth] Đã tạo admin "${config.adminUsername}".`)
  return { created: true }
}

export function getLoginLock({ username, ip }) {
  const row = database.prepare(`
    SELECT failed_count, locked_until FROM admin_login_attempts
    WHERE username = ? AND ip = ?
  `).get(username, ip)

  if (!row) return { locked: false, retryAfterSec: 0, failedCount: 0, remaining: MAX_LOGIN_FAILURES }

  // Hết hạn khóa → reset bộ đếm (chỉ khóa khi đã đủ MAX_LOGIN_FAILURES)
  if (row.locked_until && new Date(row.locked_until).getTime() > Date.now()) {
    const retryAfterSec = Math.ceil((new Date(row.locked_until).getTime() - Date.now()) / 1000)
    return {
      locked: true,
      retryAfterSec,
      failedCount: row.failed_count,
      remaining: 0,
    }
  }

  if (row.failed_count >= MAX_LOGIN_FAILURES || row.locked_until) {
    // khóa đã hết hạn — cho phép thử lại từ đầu
    database.prepare('DELETE FROM admin_login_attempts WHERE username = ? AND ip = ?').run(username, ip)
    return { locked: false, retryAfterSec: 0, failedCount: 0, remaining: MAX_LOGIN_FAILURES }
  }

  return {
    locked: false,
    retryAfterSec: 0,
    failedCount: row.failed_count,
    remaining: Math.max(0, MAX_LOGIN_FAILURES - row.failed_count),
  }
}

function recordFailure({ username, ip }) {
  const now = Date.now()
  const row = database.prepare('SELECT failed_count FROM admin_login_attempts WHERE username = ? AND ip = ?').get(username, ip)
  // Chỉ tính 1 lần cho mỗi lượt nhập sai (tránh double-submit)
  const failedCount = (row?.failed_count || 0) + 1
  // Chỉ khóa khi đạt đúng MAX_LOGIN_FAILURES
  const shouldLock = failedCount >= MAX_LOGIN_FAILURES
  const lockedUntil = shouldLock
    ? new Date(now + LOCKOUT_MINUTES * 60_000).toISOString()
    : null

  database.prepare(`
    INSERT INTO admin_login_attempts (username, ip, failed_count, locked_until, updated_at)
    VALUES (?, ?, ?, ?, CURRENT_TIMESTAMP)
    ON CONFLICT(username, ip) DO UPDATE SET
      failed_count = excluded.failed_count,
      locked_until = excluded.locked_until,
      updated_at = CURRENT_TIMESTAMP
  `).run(username, ip, failedCount, lockedUntil)

  return {
    failedCount,
    justLocked: shouldLock,
    remaining: Math.max(0, MAX_LOGIN_FAILURES - failedCount),
  }
}

function clearFailures({ username, ip }) {
  database.prepare('DELETE FROM admin_login_attempts WHERE username = ? AND ip = ?').run(username, ip)
}

/** Xóa toàn bộ khóa (dùng khi reset vận hành) */
export function clearAllLoginLocks() {
  const info = database.prepare('DELETE FROM admin_login_attempts').run()
  return info.changes
}

export async function login({ username, password, ip, userAgent }) {
  const user = String(username || '').trim()
  const pass = String(password || '')

  if (!user || !pass) {
    throw Object.assign(new Error('Sai tài khoản hoặc mật khẩu.'), { status: 400 })
  }

  const lock = getLoginLock({ username: user, ip })
  if (lock.locked) {
    throw Object.assign(
      new Error(`Bạn đã nhập sai ${MAX_LOGIN_FAILURES} lần. Tạm khóa ${LOCKOUT_MINUTES} phút. Thử lại sau ${lock.retryAfterSec} giây.`),
      {
        status: 429,
        retryAfterSec: lock.retryAfterSec,
        locked: true,
      }
    )
  }

  const account = database.prepare(`
    SELECT id, username, password_salt, password_hash, is_active FROM admin_users WHERE username = ?
  `).get(user)

  // Luôn chạy verify để không lộ user tồn tại qua timing
  const dummySalt = Buffer.alloc(16, 1)
  const dummyHash = Buffer.alloc(SCRYPT.keylen, 0)
  const ok = account?.is_active
    ? await verifyPassword(pass, account.password_salt, account.password_hash)
    : await verifyPassword(pass, dummySalt.toString('hex'), dummyHash.toString('hex'))

  if (!account || !account.is_active || !ok) {
    const fail = recordFailure({ username: user, ip })
    const message = fail.justLocked
      ? `Bạn đã nhập sai ${MAX_LOGIN_FAILURES} lần. Tạm khóa ${LOCKOUT_MINUTES} phút.`
      : `Sai tài khoản hoặc mật khẩu. Còn ${fail.remaining} lần thử trước khi khóa ${LOCKOUT_MINUTES} phút.`
    throw Object.assign(new Error(message), {
      status: fail.justLocked ? 429 : 401,
      failedCount: fail.failedCount,
      remaining: fail.remaining,
      locked: fail.justLocked,
    })
  }

  clearFailures({ username: user, ip })

  // tạo session mới
  const token = randomBytes(32).toString('base64url')
  const tokenHash = hashToken(token)
  const expiresAt = new Date(Date.now() + config.sessionTtlHours * 3_600_000).toISOString()

  database.prepare(`
    INSERT INTO admin_sessions (id, user_id, token_hash, expires_at, user_agent, ip)
    VALUES (?, ?, ?, ?, ?, ?)
  `).run(randomUUID(), account.id, tokenHash, expiresAt, (userAgent || '').slice(0, 300), ip)

  return {
    token,
    expiresAt,
    user: { id: account.id, username: account.username },
  }
}

export function logout({ token }) {
  if (!token) return false
  const info = database.prepare('DELETE FROM admin_sessions WHERE token_hash = ?').run(hashToken(token))
  return info.changes > 0
}

export function resolveSession(token) {
  if (!token) return null
  const row = database.prepare(`
    SELECT s.id AS session_id, s.expires_at, u.id AS user_id, u.username, u.is_active
    FROM admin_sessions s
    JOIN admin_users u ON u.id = s.user_id
    WHERE s.token_hash = ?
  `).get(hashToken(token))

  if (!row) return null
  if (!row.is_active) return null
  if (new Date(row.expires_at).getTime() <= Date.now()) {
    database.prepare('DELETE FROM admin_sessions WHERE id = ?').run(row.session_id)
    return null
  }

  return {
    sessionId: row.session_id,
    user: { id: row.user_id, username: row.username },
    expiresAt: row.expires_at,
  }
}

export function purgeExpiredSessions() {
  database.prepare('DELETE FROM admin_sessions WHERE expires_at <= CURRENT_TIMESTAMP').run()
}

export function setSessionCookie(res, token, expiresAt) {
  const maxAge = Math.max(60, Math.floor((new Date(expiresAt).getTime() - Date.now()) / 1000))
  const parts = [
    `${SESSION_COOKIE}=${token}`,
    'HttpOnly',
    'SameSite=Strict',
    `Path=/api`,
    `Max-Age=${maxAge}`,
  ]
  if (config.cookieSecure) parts.push('Secure')
  res.setHeader('Set-Cookie', parts.join('; '))
}

export function clearSessionCookie(res) {
  const parts = [`${SESSION_COOKIE}=`, 'HttpOnly', 'SameSite=Strict', 'Path=/api', 'Max-Age=0']
  if (config.cookieSecure) parts.push('Secure')
  res.setHeader('Set-Cookie', parts.join('; '))
}

export function readSessionCookie(req) {
  const header = req.headers.cookie || ''
  for (const part of header.split(';')) {
    const [key, ...rest] = part.trim().split('=')
    if (key === SESSION_COOKIE) return rest.join('=')
  }
  return null
}

export function requireAdmin(req, res, next) {
  const session = resolveSession(readSessionCookie(req))
  if (!session) {
    return res.status(401).json({ ok: false, message: 'Chưa đăng nhập hoặc phiên đã hết hạn.' })
  }
  req.admin = session
  next()
}

export function verifyCsrfOrigin(req) {
  // SameSite=Strict + kiểm tra Origin/Referer (chống CSRF).
  // Cho phép khác cổng khi cùng hostname (Vite proxy :5173 → API :3000).
  const origin = req.headers.origin || req.headers.referer || ''
  if (!origin) return false
  try {
    const parsed = new URL(origin)
    const allowed = (config.allowedOrigins || [])
      .map((value) => {
        try {
          return new URL(value).host.toLowerCase()
        } catch {
          return String(value).toLowerCase()
        }
      })

    const originHost = parsed.host.toLowerCase()
    const requestHost = String(req.headers.host || '').toLowerCase()
    if (allowed.includes(originHost)) return true
    if (originHost === requestHost) return true

    const originName = parsed.hostname.toLowerCase()
    const requestName = String(requestHost.split(':')[0])
    return originName === requestName && ['localhost', '127.0.0.1', '::1'].includes(originName)
  } catch {
    return false
  }
}

export { safeEqual, hashToken, SESSION_COOKIE }
