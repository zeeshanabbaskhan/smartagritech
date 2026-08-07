import { createContext, useContext, useState, useEffect, useCallback } from 'react'
import emsApi from '../api/emsApi'
import { tokenStore, setUnauthorizedHandler, ensureFreshAccessToken } from '../api/client'
import { backendToFrontend } from '../utils/roles'

const AuthContext = createContext(null)
const IMPERSONATION_KEY = 'ems_impersonation'

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

function readImpersonationMeta() {
  try {
    const raw = sessionStorage.getItem(IMPERSONATION_KEY)
    if (!raw) return null
    const parsed = JSON.parse(raw)
    if (!parsed?.adminUser) return null
    return parsed
  } catch (_) {
    return null
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
  const [impersonation, setImpersonation] = useState(() => {
    const meta = readImpersonationMeta()
    return meta
      ? { active: true, adminName: meta.adminUser?.name, adminEmail: meta.adminUser?.email }
      : null
  })
  const [initializing, setInitializing] = useState(!getBuildUser())

  const clearSession = useCallback(() => {
    tokenStore.clear()
    sessionStorage.removeItem(IMPERSONATION_KEY)
    setImpersonation(null)
    setUser(null)
    window.dispatchEvent(new Event('ems:auth-changed'))
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
        const meta = readImpersonationMeta()
        setImpersonation(
          meta
            ? { active: true, adminName: meta.adminUser?.name, adminEmail: meta.adminUser?.email }
            : null
        )
      } catch (_) {
        clearSession()
      } finally {
        setInitializing(false)
      }
    })()
  }, [clearSession])

  const applySessionTokens = (res) => {
    if (res.token) tokenStore.set(res.token)
    if (res.refreshToken) tokenStore.setRefresh(res.refreshToken)
    const session = mapSessionUser(res.data ? { data: res.data } : res)
    if (!session) throw new Error('Unsupported role for web dashboard')
    setUser(session)
    return session
  }

  const loginWithCredentials = async (email, password) => {
    sessionStorage.removeItem(IMPERSONATION_KEY)
    setImpersonation(null)
    const res = await emsApi.login(email.trim(), password)
    const session = applySessionTokens(res)
    window.dispatchEvent(new Event('ems:auth-changed'))
    return session
  }

  const startImpersonation = async (res) => {
    if (!user || user.backendRole !== 'SUPER_ADMIN') {
      throw new Error('Only Super Admin can login as another account')
    }
    // Preserve the admin session so we can restore it without re-entering password
    sessionStorage.setItem(IMPERSONATION_KEY, JSON.stringify({
      token: tokenStore.get(),
      refreshToken: tokenStore.getRefresh(),
      adminUser: {
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role,
        backendRole: user.backendRole,
      },
    }))
    const session = applySessionTokens(res)
    setImpersonation({
      active: true,
      adminName: user.name,
      adminEmail: user.email,
    })
    window.dispatchEvent(new Event('ems:auth-changed'))
    return session
  }

  const impersonateUser = async (userId) => {
    const res = await emsApi.impersonateUser(userId)
    return startImpersonation(res)
  }

  const impersonateOrganization = async (organizationId) => {
    const res = await emsApi.impersonateOrganization(organizationId)
    return startImpersonation(res)
  }

  const stopImpersonation = async () => {
    const meta = readImpersonationMeta()
    if (!meta?.token) {
      clearSession()
      throw new Error('Admin session expired — please sign in again')
    }
    // Drop the impersonated refresh token so it cannot be reused
    try { await emsApi.logout() } catch (_) {}

    tokenStore.set(meta.token)
    tokenStore.setRefresh(meta.refreshToken)
    sessionStorage.removeItem(IMPERSONATION_KEY)
    setImpersonation(null)

    try {
      await ensureFreshAccessToken(0)
      const res = await emsApi.me()
      const session = mapSessionUser(res)
      setUser(session)
      window.dispatchEvent(new Event('ems:auth-changed'))
      return session
    } catch (_) {
      clearSession()
      throw new Error('Could not restore Super Admin session — please sign in again')
    }
  }

  const logout = async () => {
    try { await emsApi.logout() } catch (_) {}
    clearSession()
  }

  return (
    <AuthContext.Provider
      value={{
        user,
        loginWithCredentials,
        logout,
        initializing,
        impersonation,
        impersonateUser,
        impersonateOrganization,
        stopImpersonation,
      }}
    >
      {children}
    </AuthContext.Provider>
  )
}

export const useAuth = () => useContext(AuthContext)
