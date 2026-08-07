/** Platform default theme — record name "Elsa", display "Elsa Energy". */
export const DEFAULT_THEME_NAME = 'Elsa'
export const DEFAULT_DISPLAY_NAME = 'Elsa Energy'
export const DEFAULT_PRIMARY_COLOR = '#F5A623'
export const DEFAULT_LOGO = '/elsa_logo.jpeg'

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
