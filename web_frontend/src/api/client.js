const TOKEN_KEY = 'ems_token'
const REFRESH_KEY = 'ems_refresh'

const baseUrl = () => import.meta.env.VITE_API_URL || '/api'

function buildUrl(path, query) {
  const base = baseUrl().replace(/\/$/, '')
  const segment = path.startsWith('/') ? path : `/${path}`
  const full = base.startsWith('http')
    ? `${base}${segment}`
    : `${window.location.origin}${base.startsWith('/') ? base : `/${base}`}${segment}`
  const url = new URL(full)
  if (query) {
    Object.entries(query).forEach(([k, v]) => {
      if (v != null && v !== '') url.searchParams.set(k, String(v))
    })
  }
  return url.toString()
}

export class ApiError extends Error {
  constructor(message, status) {
    super(message)
    this.name = 'ApiError'
    this.status = status
  }
}

export const tokenStore = {
  get: () => localStorage.getItem(TOKEN_KEY),
  set: (t) => { if (t) localStorage.setItem(TOKEN_KEY, t); else localStorage.removeItem(TOKEN_KEY) },
  getRefresh: () => localStorage.getItem(REFRESH_KEY),
  setRefresh: (t) => { if (t) localStorage.setItem(REFRESH_KEY, t); else localStorage.removeItem(REFRESH_KEY) },
  clear: () => { localStorage.removeItem(TOKEN_KEY); localStorage.removeItem(REFRESH_KEY) },
}

let onUnauthorized = null
export const setUnauthorizedHandler = (fn) => { onUnauthorized = fn }

async function refreshAccessToken() {
  const refreshToken = tokenStore.getRefresh()
  if (!refreshToken) return null
  const res = await fetch(buildUrl('/auth/refresh'), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
    body: JSON.stringify({ refreshToken }),
  })
  const body = await res.json().catch(() => ({}))
  if (!res.ok) return null
  tokenStore.set(body.token)
  if (body.refreshToken) tokenStore.setRefresh(body.refreshToken)
  return body.token
}

async function request(method, path, { body, query, retry = true } = {}) {
  const headers = { Accept: 'application/json' }
  const token = tokenStore.get()
  if (token) headers.Authorization = `Bearer ${token}`
  if (body != null) headers['Content-Type'] = 'application/json'

  const res = await fetch(buildUrl(path, query), {
    method,
    headers,
    body: body != null ? JSON.stringify(body) : undefined,
    credentials: 'include',
  })

  if (res.status === 204) return { success: true }

  const contentType = res.headers.get('content-type') || ''
  const isJson = contentType.includes('application/json')
  const data = isJson ? await res.json().catch(() => ({})) : await res.text()

  if (res.status === 401 && retry && tokenStore.getRefresh()) {
    const newToken = await refreshAccessToken()
    if (newToken) return request(method, path, { body, query, retry: false })
  }

  if (res.status === 401 && onUnauthorized) await onUnauthorized()

  if (!res.ok) {
    const msg = typeof data === 'object' && data?.message ? data.message : `Request failed (${res.status})`
    throw new ApiError(msg, res.status)
  }

  return data
}

async function upload(method, path, formData, { retry = true } = {}) {
  const headers = { Accept: 'application/json' }
  const token = tokenStore.get()
  if (token) headers.Authorization = `Bearer ${token}`

  const res = await fetch(buildUrl(path), {
    method,
    headers,
    body: formData,
    credentials: 'include',
  })

  if (res.status === 204) return { success: true }

  const contentType = res.headers.get('content-type') || ''
  const isJson = contentType.includes('application/json')
  const data = isJson ? await res.json().catch(() => ({})) : await res.text()

  if (res.status === 401 && retry && tokenStore.getRefresh()) {
    const newToken = await refreshAccessToken()
    if (newToken) return upload(method, path, formData, { retry: false })
  }

  if (res.status === 401 && onUnauthorized) await onUnauthorized()

  if (!res.ok) {
    const msg = typeof data === 'object' && data?.message ? data.message : `Request failed (${res.status})`
    throw new ApiError(msg, res.status)
  }

  return data
}

async function download(path, query, filename = 'export.csv') {
  const headers = { Accept: 'text/csv' }
  const token = tokenStore.get()
  if (token) headers.Authorization = `Bearer ${token}`
  const res = await fetch(buildUrl(path, query), { headers, credentials: 'include' })
  if (!res.ok) {
    const err = await res.json().catch(() => ({}))
    throw new ApiError(err.message || `Download failed (${res.status})`, res.status)
  }
  const blob = await res.blob()
  const link = document.createElement('a')
  link.href = URL.createObjectURL(blob)
  link.download = filename
  link.click()
  URL.revokeObjectURL(link.href)
}

export const api = {
  get: (path, query) => request('GET', path, { query }),
  post: (path, body) => request('POST', path, { body }),
  put: (path, body) => request('PUT', path, { body }),
  patch: (path, body) => request('PATCH', path, { body }),
  delete: (path, body) => request('DELETE', path, { body }),
  upload,
  download,
}

export const list = (res) => (Array.isArray(res?.data) ? res.data : [])
export const one = (res) => res?.data ?? res
