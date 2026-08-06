/** Map backend Prisma roles ↔ frontend route roles */
export const BACKEND_ROLES = {
  SUPER_ADMIN: 'SUPER_ADMIN',
  ORG_ADMIN: 'ORG_ADMIN',
  USER: 'USER',
}

export const FRONTEND_ROLES = {
  ADMIN: 'admin',
  ORG: 'org',
  USER: 'user',
}

/** User-facing role labels (API still stores SUPER_ADMIN / ORG_ADMIN / USER). */
export const ROLE_UI_LABELS = {
  SUPER_ADMIN: 'Super Admin',
  ORG_ADMIN: 'Org Admin',
  USER: 'User',
}

/** Options for admin role pickers (display strings). */
export const ROLE_UI_OPTIONS = [
  ROLE_UI_LABELS.SUPER_ADMIN,
  ROLE_UI_LABELS.ORG_ADMIN,
  ROLE_UI_LABELS.USER,
]

export const backendToFrontend = (role) => {
  // Accept legacy aliases from older deployments/backfills.
  if (role === BACKEND_ROLES.SUPER_ADMIN || role === 'ADMIN') return FRONTEND_ROLES.ADMIN
  if (role === BACKEND_ROLES.ORG_ADMIN || role === 'ORG') return FRONTEND_ROLES.ORG
  if (role === BACKEND_ROLES.USER || role === 'CUSTOMER') return FRONTEND_ROLES.USER
  return null
}

export const frontendToBackend = (role) => {
  if (role === FRONTEND_ROLES.ADMIN) return BACKEND_ROLES.SUPER_ADMIN
  if (role === FRONTEND_ROLES.ORG) return BACKEND_ROLES.ORG_ADMIN
  if (role === FRONTEND_ROLES.USER) return BACKEND_ROLES.USER
  return null
}

/** Display label for an API / Prisma role (USER and legacy CUSTOMER → "User"). */
export const apiRoleToLabel = (role) => {
  if (role === BACKEND_ROLES.SUPER_ADMIN || role === 'ADMIN') return ROLE_UI_LABELS.SUPER_ADMIN
  if (role === BACKEND_ROLES.ORG_ADMIN || role === 'ORG') return ROLE_UI_LABELS.ORG_ADMIN
  if (role === BACKEND_ROLES.USER || role === 'CUSTOMER') return ROLE_UI_LABELS.USER
  return role ?? '—'
}

/** Map a UI role label back to the API enum (accepts legacy "Customer"). */
export const uiRoleLabelToApi = (label) => {
  if (label === ROLE_UI_LABELS.SUPER_ADMIN || label === 'Admin') return BACKEND_ROLES.SUPER_ADMIN
  if (label === ROLE_UI_LABELS.ORG_ADMIN) return BACKEND_ROLES.ORG_ADMIN
  if (label === ROLE_UI_LABELS.USER || label === 'Customer') return BACKEND_ROLES.USER
  return label
}

export const isAdmin = (user) => user?.backendRole === BACKEND_ROLES.SUPER_ADMIN
export const isOrgAdmin = (user) => user?.backendRole === BACKEND_ROLES.ORG_ADMIN
export const isUser = (user) =>
  user?.backendRole === BACKEND_ROLES.USER || user?.backendRole === 'CUSTOMER'
