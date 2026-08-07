import { createContext, useContext, useState, useEffect, useCallback } from 'react'
import emsApi from '../api/emsApi'
import { tokenStore } from '../api/client'

const ThemeContext = createContext(null)

const BRANDING_CACHE_KEY = 'ems_branding'

const DEFAULT_BRANDING = {
  name: 'Elsa Energy',
  logoUrl: '/elsa_logo.jpeg',
  primaryColor: '#F5A623',
  secondaryColor: '#0ea5e9',
  sidebarColor: 'Dark',
  fontFamily: 'Inter',
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
    name: t.name || DEFAULT_BRANDING.name,
    logoUrl: t.logoUrl || DEFAULT_BRANDING.logoUrl,
    primaryColor: t.headerBgColor || t.primaryColor || DEFAULT_BRANDING.primaryColor,
    secondaryColor: t.bodyBgColor || t.secondaryColor || DEFAULT_BRANDING.secondaryColor,
    sidebarColor: t.sidebarColor || DEFAULT_BRANDING.sidebarColor,
    fontFamily: t.fontFamily || t.fontSize || DEFAULT_BRANDING.fontFamily,
    darkModeDefault: t.darkModeDefault !== false,
    showLogoInSidebar: t.showLogoInSidebar !== false,
  }
}

function applyBrandingCss(branding) {
  const root = document.documentElement
  root.style.setProperty('--brand-primary', branding.primaryColor)
  root.style.setProperty('--brand-secondary', branding.secondaryColor)
  root.style.setProperty('--brand-font', branding.fontFamily)
  if (branding.fontFamily) {
    root.style.setProperty('font-family', `${branding.fontFamily}, ui-sans-serif, system-ui, sans-serif`)
  }
  // Map primary into common Tailwind-like CSS vars used by btn-primary where possible
  root.style.setProperty('--color-primary-500', branding.primaryColor)
  root.style.setProperty('--color-primary-600', branding.primaryColor)
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
