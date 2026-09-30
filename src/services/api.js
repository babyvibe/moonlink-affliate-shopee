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
  adminSettings() {
    return request('/api/admin/settings')
  },
  adminUpdateSettings(payload) {
    return request('/api/admin/settings', {
      method: 'PUT',
      body: JSON.stringify(payload),
    })
  },
  priceHistory(linkId, days = 30) {
    return request(`/api/links/${encodeURIComponent(linkId)}/price-history?days=${days}`)
  },
  // Batch (docs/02)
  batchLookup(payload) {
    return request('/api/batch/lookup', { method: 'POST', body: JSON.stringify(payload) })
  },
  batchGenerate(payload) {
    return request('/api/batch/generate', { method: 'POST', body: JSON.stringify(payload) })
  },
  // Offers (docs/03)
  searchProductOffers(params = {}) {
    const query = new URLSearchParams()
    for (const [key, value] of Object.entries(params)) {
      if (value !== undefined && value !== null && value !== '') query.set(key, String(value))
    }
    return request(`/api/offers/products?${query.toString()}`)
  },
  searchShopOffers(params = {}) {
    const query = new URLSearchParams()
    for (const [key, value] of Object.entries(params)) {
      if (value !== undefined && value !== null && value !== '') query.set(key, String(value))
    }
    return request(`/api/offers/shops?${query.toString()}`)
  },
  searchShopeeOffers(params = {}) {
    const query = new URLSearchParams()
    for (const [key, value] of Object.entries(params)) {
      if (value !== undefined && value !== null && value !== '') query.set(key, String(value))
    }
    return request(`/api/offers/campaigns?${query.toString()}`)
  },
  shopProducts(params = {}) {
    const query = new URLSearchParams()
    for (const [key, value] of Object.entries(params)) {
      if (value !== undefined && value !== null && value !== '') query.set(key, String(value))
    }
    return request(`/api/offers/shop-products?${query.toString()}`)
  },
  // TikTok (docs/05)
  tiktokCompare(linkId, refresh = false) {
    return request(`/api/links/${encodeURIComponent(linkId)}/tiktok-compare${refresh ? '?refresh=1' : ''}`)
  },
  // Watchlist (docs/06)
  watchlist(limit = 20) {
    return request(`/api/watchlist?limit=${limit}`)
  },
  // Market (docs/07)
  marketSearch(params = {}) {
    const query = new URLSearchParams()
    for (const [key, value] of Object.entries(params)) {
      if (value !== undefined && value !== null && value !== '') query.set(key, String(value))
    }
    return request(`/api/market/search?${query.toString()}`)
  },
  marketCompare(keywords, sort = 'revenue_30d') {
    const query = new URLSearchParams()
    query.set('keywords', Array.isArray(keywords) ? keywords.join(',') : String(keywords))
    query.set('sort', sort)
    return request(`/api/market/compare?${query.toString()}`)
  },
  // Shop live (docs/08)
  shopLive(params = {}) {
    const query = new URLSearchParams()
    for (const [key, value] of Object.entries(params)) {
      if (value !== undefined && value !== null && value !== '') query.set(key, String(value))
    }
    return request(`/api/live/shops?${query.toString()}`)
  },
  // Lazada (docs/09)
  lazadaCompare(linkId, params = {}) {
    const query = new URLSearchParams()
    for (const [key, value] of Object.entries(params)) {
      if (value !== undefined && value !== null && value !== '') query.set(key, String(value))
    }
    const qs = query.toString()
    return request(`/api/links/${encodeURIComponent(linkId)}/lazada-compare${qs ? `?${qs}` : ''}`)
  },
  // ShopeeFood store (docs/10)
  foodStores(ids, refresh = false) {
    const query = new URLSearchParams()
    query.set('ids', Array.isArray(ids) ? ids.join(',') : String(ids))
    if (refresh) query.set('refresh', '1')
    return request(`/api/food/stores?${query.toString()}`)
  },
  foodResolve(url) {
    return request(`/api/food/resolve?url=${encodeURIComponent(url)}`)
  },
  foodOrders(params = {}) {
    const query = new URLSearchParams()
    for (const [key, value] of Object.entries(params)) {
      if (value !== undefined && value !== null && value !== '') query.set(key, String(value))
    }
    const qs = query.toString()
    return request(`/api/food/orders${qs ? `?${qs}` : ''}`)
  },
  // Cloudflare Tunnel (admin tab Kiểm thử)
  adminTunnel() {
    return request('/api/admin/tunnel')
  },
  adminTunnelStart(target) {
    return request('/api/admin/tunnel/start', {
      method: 'POST',
      body: JSON.stringify(target ? { target } : {}),
    })
  },
  adminTunnelStop() {
    return request('/api/admin/tunnel/stop', { method: 'POST' })
  },
  // Admin shop alerts (docs/04)
  watchedShops() {
    return request('/api/admin/watched-shops')
  },
  addWatchedShop(shopId, note) {
    return request('/api/admin/watched-shops', {
      method: 'POST',
      body: JSON.stringify({ shopId, note }),
    })
  },
  removeWatchedShop(shopId) {
    return request(`/api/admin/watched-shops/${encodeURIComponent(shopId)}`, { method: 'DELETE' })
  },
  commissionAlerts(status) {
    return request(`/api/admin/commission-alerts${status ? `?status=${encodeURIComponent(status)}` : ''}`)
  },
  scanCommissionAlerts(days = 7) {
    return request('/api/admin/commission-alerts/scan', {
      method: 'POST',
      body: JSON.stringify({ days }),
    })
  },
  updateCommissionAlert(id, status) {
    return request(`/api/admin/commission-alerts/${encodeURIComponent(id)}`, {
      method: 'PATCH',
      body: JSON.stringify({ status }),
    })
  },
}
