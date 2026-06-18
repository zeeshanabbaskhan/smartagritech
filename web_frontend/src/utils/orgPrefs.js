import { useAuth } from '../context/AuthContext'

const PREFS_KEY = 'ems_org_prefs'

export function loadOrgPrefs(orgId) {
  if (!orgId) return null
  try {
    const raw = localStorage.getItem(`${PREFS_KEY}:${orgId}`)
    return raw ? JSON.parse(raw) : null
  } catch {
    return null
  }
}

export function saveOrgPrefs(orgId, data) {
  if (!orgId) return
  localStorage.setItem(`${PREFS_KEY}:${orgId}`, JSON.stringify(data))
}

export function useOrgId() {
  const { user } = useAuth()
  return user?.organizationId ?? user?.organization?.id ?? null
}
