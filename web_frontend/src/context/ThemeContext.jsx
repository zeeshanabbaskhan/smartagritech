import { createContext, useContext, useState, useEffect, useCallback } from 'react'
import emsApi from '../api/emsApi'
import { tokenStore, resolveMediaUrl } from '../api/client'
import {
  DEFAULT_DISPLAY_NAME,
  DEFAULT_LOGO,
  DEFAULT_PRIMARY_COLOR,
  applyPrimaryCssVars,
  themeDisplayName,
} from '../utils/branding'

const ThemeContext = createContext(null)

const BRANDING_CACHE_KEY = 'ems_branding'

const DEFAULT_BRANDING = {
  name: DEFAULT_DISPLAY_NAME,
  logoUrl: DEFAULT_LOGO,
  primaryColor: DEFAULT_PRIMARY_COLOR,
  darkModeDefault: true,
  showLogoInSidebar: true,
}

function readCachedBranding() {
  try {
    const raw = localStorage.getItem(BRANDING_CACHE_KEY)
    return raw ? { ...DEFAULT_BRANDING, ...JSON.parse(raw) } : DEFAULT_BRANDING
  } catch (_) {
    return DEFAULT_BRANDING
  }
}

function mapApiTheme(t) {
  if (!t) return null
  return {
    id: t.id,
    name: themeDisplayName(t.name),
    logoUrl: resolveMediaUrl(t.logoUrl) || DEFAULT_BRANDING.logoUrl,
    primaryColor: t.headerBgColor || t.primaryColor || DEFAULT_BRANDING.primaryColor,
    darkModeDefault: t.darkModeDefault !== false,
    showLogoInSidebar: t.showLogoInSidebar !== false,
  }
}

function applyBrandingCss(branding) {
  applyPrimaryCssVars(branding.primaryColor, document.documentElement)
}

export function ThemeProvider({ children }) {
  const [theme, setTheme] = useState(() => {
    const saved = localStorage.getItem('theme')
    if (saved === 'light' || saved === 'dark') return saved
    const branding = readCachedBranding()
    return branding.darkModeDefault ? 'dark' : 'light'
  })
  const [branding, setBranding] = useState(readCachedBranding)

  const applyMode = useCallback((mode) => {
    const root = window.document.documentElement
    if (mode === 'dark') root.classList.add('dark')
    else root.classList.remove('dark')
    localStorage.setItem('theme', mode)
  }, [])

  useEffect(() => {
    applyMode(theme)
  }, [theme, applyMode])

  useEffect(() => {
    applyBrandingCss(branding)
    try {
      localStorage.setItem(BRANDING_CACHE_KEY, JSON.stringify(branding))
    } catch (_) {}
  }, [branding])

  const refreshBranding = useCallback(async () => {
    if (!tokenStore.get() && !tokenStore.getRefresh()) return branding
    try {
      const res = await emsApi.getActiveTheme()
      const mapped = mapApiTheme(res?.data ?? res)
      if (mapped) {
        setBranding(mapped)
        // Only apply dark-mode default when user has no explicit preference yet
        if (!localStorage.getItem('theme')) {
          setTheme(mapped.darkModeDefault ? 'dark' : 'light')
        }
        return mapped
      }
    } catch (_) { /* keep cached branding */ }
    return branding
  }, [branding])

  useEffect(() => {
    refreshBranding()
    const onAuth = () => { refreshBranding() }
    window.addEventListener('ems:auth-changed', onAuth)
    return () => window.removeEventListener('ems:auth-changed', onAuth)
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  const toggleTheme = () => {
    setTheme((prev) => (prev === 'light' ? 'dark' : 'light'))
  }

  return (
    <ThemeContext.Provider value={{ theme, toggleTheme, setTheme, branding, refreshBranding }}>
      {children}
    </ThemeContext.Provider>
  )
}

export const useTheme = () => {
  const context = useContext(ThemeContext)
  if (!context) {
    throw new Error('useTheme must be used within a ThemeProvider')
  }
  return context
}
