import { createContext, useContext, useState, useEffect, useCallback } from 'react'
import emsApi from '../api/emsApi'
import { tokenStore, setUnauthorizedHandler, ensureFreshAccessToken } from '../api/client'
import { backendToFrontend } from '../utils/roles'

const AuthContext = createContext(null)

export const ROLES = {
  ADMIN: 'admin',
  ORG: 'org',
  USER: 'user',
}

function mapSessionUser(apiUser) {
  const u = apiUser?.data ?? apiUser
  if (!u?.id) return null
  const role = backendToFrontend(u.role)
  if (!role) return null
  return {
    id: u.id,
    name: u.fullName,
    email: u.email,
    role,
    backendRole: u.role,
    organizationId: u.organizationId,
    organization: u.organization,
    status: u.status,
  }
}

export function AuthProvider({ children }) {
  const getBuildUser = () => {
    if (typeof window !== 'undefined' && window.__BONEYARD_BUILD) {
      const path = window.location.pathname
      if (path.startsWith('/admin')) return { name: 'App Admin', email: 'superadmin@ems.com', role: ROLES.ADMIN, backendRole: 'SUPER_ADMIN' }
      if (path.startsWith('/org')) return { name: 'Org Admin', email: 'orgadmin@ems.com', role: ROLES.ORG, backendRole: 'ORG_ADMIN' }
      if (path.startsWith('/user')) return { name: 'End User', email: 'user@ems.com', role: ROLES.USER, backendRole: 'USER' }
    }
    return null
  }

  const [user, setUser] = useState(getBuildUser)
  const [initializing, setInitializing] = useState(!getBuildUser())
  const [impersonation, setImpersonation] = useState(() => {
    try { return JSON.parse(sessionStorage.getItem('ems_impersonation') || 'null') } catch { return null }
  })

  const clearSession = useCallback(() => {
    tokenStore.clear()
    sessionStorage.removeItem('ems_impersonation')
    setImpersonation(null)
    setUser(null)
  }, [])

  useEffect(() => {
    setUnauthorizedHandler(async () => clearSession())
    return () => setUnauthorizedHandler(null)
  }, [clearSession])

  // Keep session alive: refresh access token before it expires (and on tab focus).
  useEffect(() => {
    if (getBuildUser()) return
    let cancelled = false
    const tick = async () => {
      if (cancelled || document.visibilityState === 'hidden') return
      if (!tokenStore.getRefresh()) return
      try {
        await ensureFreshAccessToken(180_000)
      } catch (_) { /* ignore — next API call will retry */ }
    }
    tick()
    const id = setInterval(tick, 60_000)
    const onFocus = () => { tick() }
    window.addEventListener('focus', onFocus)
    document.addEventListener('visibilitychange', onFocus)
    return () => {
      cancelled = true
      clearInterval(id)
      window.removeEventListener('focus', onFocus)
      document.removeEventListener('visibilitychange', onFocus)
    }
  }, [])

  useEffect(() => {
    if (getBuildUser()) return
    const token = tokenStore.get()
    if (!token && !tokenStore.getRefresh()) {
      setInitializing(false)
      return
    }
    ;(async () => {
      try {
        // Revive session from refresh token when access JWT already expired
        await ensureFreshAccessToken(0)
        const res = await emsApi.me()
        setUser(mapSessionUser(res))
      } catch (_) {
        clearSession()
      } finally {
        setInitializing(false)
      }
    })()
  }, [clearSession])

  const loginWithCredentials = async (email, password) => {
    const res = await emsApi.login(email.trim(), password)
    if (res.token) tokenStore.set(res.token)
    if (res.refreshToken) tokenStore.setRefresh(res.refreshToken)
    const session = mapSessionUser(res.data ? { data: res.data } : res)
    if (!session) throw new Error('Unsupported role for web dashboard')
    setUser(session)
    return session
  }

  const logout = async () => {
    try { await emsApi.logout() } catch (_) {}
    clearSession()
  }

  // SUPER_ADMIN → operate an Org/User portal with a genuine backend session.
  const impersonate = async ({ userId, organizationId, label } = {}) => {
    const backup = {
      token: tokenStore.get(),
      refreshToken: tokenStore.getRefresh(),
      adminName: user?.name,
      label: label || 'session',
    }
    const res = await emsApi.impersonate(userId ? { userId } : { organizationId })
    if (!res?.token) throw new Error('Impersonation failed')
    tokenStore.set(res.token)
    if (res.refreshToken) tokenStore.setRefresh(res.refreshToken)
    sessionStorage.setItem('ems_impersonation', JSON.stringify(backup))
    setImpersonation(backup)
    // Prefer /auth/me so organization (and any other nested fields) are fully hydrated.
    let session = null
    try {
      const me = await emsApi.me()
      session = mapSessionUser(me)
    } catch (_) {
      session = mapSessionUser(res.data ? { data: res.data } : res)
    }
    if (!session) throw new Error('Target role not supported by web dashboard')
    setUser(session)
    return session
  }

  const stopImpersonation = async () => {
    if (!impersonation) return null
    const adminBackup = { ...impersonation }
    // Revoke the impersonated session's refresh token and clear the target cookie.
    try { await emsApi.logout() } catch (_) {}
    tokenStore.set(adminBackup.token)
    tokenStore.setRefresh(adminBackup.refreshToken)
    sessionStorage.removeItem('ems_impersonation')
    setImpersonation(null)
    try {
      // Refresh re-issues access token and resets the httpOnly cookie for the admin.
      if (adminBackup.refreshToken) {
        const refreshed = await emsApi.refresh(adminBackup.refreshToken)
        if (refreshed?.token) tokenStore.set(refreshed.token)
        if (refreshed?.refreshToken) tokenStore.setRefresh(refreshed.refreshToken)
      }
      const res = await emsApi.me()
      const session = mapSessionUser(res)
      setUser(session)
      return session
    } catch (_) {
      clearSession()
      return null
    }
  }

  return (
    <AuthContext.Provider value={{ user, loginWithCredentials, logout, initializing, impersonation, impersonate, stopImpersonation }}>
      {children}
    </AuthContext.Provider>
  )
}

export const useAuth = () => useContext(AuthContext)
