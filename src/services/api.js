const sessionStorageKey = 'moonlink-session'

function getSessionId() {
  return localStorage.getItem(sessionStorageKey) || ''
}

async function request(path, options = {}) {
  let response
  try {
    response = await fetch(path, {
      credentials: 'same-origin',
      ...options,
      headers: {
        'Content-Type': 'application/json',
        'x-moon-session': getSessionId(),
        ...options.headers,
      },
    })
  } catch (networkError) {
    throw new Error('Không kết nối được máy chủ (http://127.0.0.1:3000). Hãy chạy `pnpm dev` rồi thử lại.')
  }

  const sessionId = response.headers.get('x-moon-session')
  if (sessionId) localStorage.setItem(sessionStorageKey, sessionId)

  const text = await response.text()
  let body = null
  try {
    body = text ? JSON.parse(text) : {}
  } catch {
    body = { message: 'Phản hồi từ máy chủ không hợp lệ.' }
  }

  if (!response.ok) {
    throw new Error(body.message || 'Trạm gặp nhiễu tín hiệu. Bạn hãy thử lại sau.')
  }
  return body
}

export const api = {
  createLink(url, subIds = []) {
    return request('/api/links', {
      method: 'POST',
      body: JSON.stringify({ url, subIds }),
    })
  },
  getRecentLinks() {
    return request('/api/links/recent')
  },
  clearRecentLinks() {
    return request('/api/links/recent', { method: 'DELETE' })
  },

  adminLogin(username, password) {
    return request('/api/admin/login', {
      method: 'POST',
      body: JSON.stringify({ username, password }),
    })
  },
  adminLogout() {
    return request('/api/admin/logout', { method: 'POST' })
  },
  adminMe() {
    return request('/api/admin/me')
  },
  adminStats() {
    return request('/api/admin/reports/stats')
  },
  adminLinks(params = {}) {
    const query = new URLSearchParams()
    if (params.limit) query.set('limit', String(params.limit))
    if (params.offset) query.set('offset', String(params.offset))
    const qs = query.toString()
    return request(`/api/admin/reports/links${qs ? `?${qs}` : ''}`)
  },
  adminConversions(params = {}) {
    const query = new URLSearchParams()
    for (const [key, value] of Object.entries(params)) {
      if (value !== undefined && value !== null && value !== '') query.set(key, String(value))
    }
    const qs = query.toString()
    return request(`/api/admin/reports/conversions${qs ? `?${qs}` : ''}`)
  },
}
