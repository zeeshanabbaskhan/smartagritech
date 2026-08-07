const TOKEN_KEY = 'ems_token'
const REFRESH_KEY = 'ems_refresh'

function normalizeApiBase(raw) {
  if (!raw) return '/api'
  let base = String(raw).trim()
  // Repair common misconfigured build URLs (e.g. https://http//host/api)
  base = base.replace(/^https:\/\/http\/\//i, 'https://')
  base = base.replace(/^https:\/\/http:\/\//i, 'https://')
  base = base.replace(/^https:\/\/https:\/\//i, 'https://')
  return base.replace(/\/$/, '')
}

const baseUrl = () => normalizeApiBase(import.meta.env.VITE_API_URL || '/api')

/** Turn API-relative media paths (/uploads/...) into absolute URLs for <img src>. */
export function resolveMediaUrl(url) {
  if (!url) return url
  if (
    /^https?:\/\//i.test(url)
    || url.startsWith('blob:')
    || url.startsWith('data:')
    || url.startsWith('/elsa_')
    || url.startsWith('/embedded')
  ) {
    return url
  }
  const api = baseUrl()
  const path = url.startsWith('/') ? url : `/${url}`
  if (api.startsWith('http')) {
    const origin = api.replace(/\/api\/?$/, '')
    return `${origin}${path}`
  }
  return path
}

function buildUrl(path, query) {
  const base = baseUrl()
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

/** Single in-flight refresh — prevents parallel 401s from rotating the refresh token twice and logging the user out. */
let refreshPromise = null

async function refreshAccessToken() {
  if (refreshPromise) return refreshPromise

  refreshPromise = (async () => {
    const refreshToken = tokenStore.getRefresh()
    if (!refreshToken) return null
    try {
      const res = await fetch(buildUrl('/auth/refresh'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
        body: JSON.stringify({ refreshToken }),
        credentials: 'include',
      })
      const body = await res.json().catch(() => ({}))
      if (!res.ok) return null
      const nextAccess = body.token || body.data?.token
      const nextRefresh = body.refreshToken || body.data?.refreshToken
      if (!nextAccess) return null
      tokenStore.set(nextAccess)
      if (nextRefresh) tokenStore.setRefresh(nextRefresh)
      return nextAccess
    } catch (_) {
      return null
    }
  })()

  try {
    return await refreshPromise
  } finally {
    refreshPromise = null
  }
}

/** Decode JWT exp (seconds). Returns null if unreadable. */
export function getAccessTokenExpiry() {
  const token = tokenStore.get()
  if (!token) return null
  try {
    const payload = JSON.parse(atob(token.split('.')[1].replace(/-/g, '+').replace(/_/g, '/')))
    return typeof payload.exp === 'number' ? payload.exp * 1000 : null
  } catch (_) {
    return null
  }
}

/** Refresh access token if missing or expiring within `skewMs` (default 2 minutes). */
export async function ensureFreshAccessToken(skewMs = 120_000) {
  if (!tokenStore.getRefresh()) return tokenStore.get()
  const exp = getAccessTokenExpiry()
  if (!tokenStore.get() || (exp != null && exp - Date.now() < skewMs)) {
    return refreshAccessToken()
  }
  return tokenStore.get()
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
    const msg =
      typeof data === 'object' && (data?.message || data?.error)
        ? (data.message || data.error)
        : `Request failed (${res.status})`
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
  delete: (path, body, query) => request('DELETE', path, { body, query }),
  upload,
  download,
}

export const list = (res) => (Array.isArray(res?.data) ? res.data : [])
export const one = (res) => res?.data ?? res
