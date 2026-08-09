/** Platform default theme — record name "Elsa", display "Elsa Energy". */
export const DEFAULT_THEME_NAME = 'Elsa'
export const DEFAULT_DISPLAY_NAME = 'Elsa Energy'
export const DEFAULT_PRIMARY_COLOR = '#F5A623'
export const DEFAULT_LOGO = '/elsa_logo.jpeg'

const PRIMARY_SHADES = [50, 100, 200, 300, 400, 500, 600, 700, 800, 900]

/** Map theme record name to user-facing platform name. */
export function themeDisplayName(name) {
  if (!name || name === 'Default' || name === DEFAULT_THEME_NAME) return DEFAULT_DISPLAY_NAME
  return name
}

/** Map platform name form value back to theme record name. */
export function themeRecordName(displayName) {
  const trimmed = (displayName || '').trim()
  if (!trimmed || trimmed === DEFAULT_DISPLAY_NAME) return DEFAULT_THEME_NAME
  if (trimmed === DEFAULT_THEME_NAME) return DEFAULT_THEME_NAME
  return trimmed
}

function clampByte(n) {
  return Math.min(255, Math.max(0, Math.round(n)))
}

export function hexToRgb(hex) {
  const raw = String(hex || '').trim().replace('#', '')
  const full = raw.length === 3 ? [...raw].map((c) => c + c).join('') : raw
  const n = parseInt(full, 16)
  if (!Number.isFinite(n) || full.length !== 6) {
    return hexToRgb(DEFAULT_PRIMARY_COLOR)
  }
  return { r: (n >> 16) & 255, g: (n >> 8) & 255, b: n & 255 }
}

export function rgbToHex({ r, g, b }) {
  return `#${[r, g, b].map((x) => clampByte(x).toString(16).padStart(2, '0')).join('')}`
}

/** Space-separated RGB channels for Tailwind `rgb(var(--x) / <alpha-value>)`. */
export function hexToRgbChannels(hex) {
  const { r, g, b } = hexToRgb(hex)
  return `${r} ${g} ${b}`
}

function mixRgb(a, b, t) {
  return {
    r: a.r + (b.r - a.r) * t,
    g: a.g + (b.g - a.g) * t,
    b: a.b + (b.b - a.b) * t,
  }
}

/** Build a Tailwind-like primary scale from a single brand hex. */
export function buildPrimaryScale(hex) {
  const base = hexToRgb(hex)
  const white = { r: 255, g: 255, b: 255 }
  const black = { r: 0, g: 0, b: 0 }
  const toward = (amount, target) => rgbToHex(mixRgb(base, target, amount))
  return {
    50: toward(0.92, white),
    100: toward(0.84, white),
    200: toward(0.65, white),
    300: toward(0.45, white),
    400: toward(0.22, white),
    500: rgbToHex(base),
    600: toward(0.1, black),
    700: toward(0.25, black),
    800: toward(0.45, black),
    900: toward(0.65, black),
  }
}

/** Live brand primary from CSS (falls back to default). */
export function resolveBrandPrimary() {
  if (typeof document !== 'undefined') {
    const v = getComputedStyle(document.documentElement).getPropertyValue('--brand-primary').trim()
    if (v) return v
  }
  return DEFAULT_PRIMARY_COLOR
}

/** Apply brand primary CSS variables used by Tailwind + Elsa chatbot. */
export function applyPrimaryCssVars(hex, root = typeof document !== 'undefined' ? document.documentElement : null) {
  if (!root) return buildPrimaryScale(hex)
  const scale = buildPrimaryScale(hex || DEFAULT_PRIMARY_COLOR)
  root.style.setProperty('--brand-primary', scale[500])
  for (const shade of PRIMARY_SHADES) {
    // Tailwind primary-* expects space-separated RGB channels
    root.style.setProperty(`--color-primary-${shade}`, hexToRgbChannels(scale[shade]))
  }
  // Elsa chatbot accents track the same brand primary (hex)
  root.style.setProperty('--elsa-primary', scale[500])
  root.style.setProperty('--elsa-primary-light', scale[400])
  root.style.setProperty('--elsa-primary-dark', scale[700])
  return scale
}
