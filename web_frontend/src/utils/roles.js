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

export const backendToFrontend = (role) => {
  if (role === BACKEND_ROLES.SUPER_ADMIN) return FRONTEND_ROLES.ADMIN
  if (role === BACKEND_ROLES.ORG_ADMIN) return FRONTEND_ROLES.ORG
  if (role === BACKEND_ROLES.USER) return FRONTEND_ROLES.USER
  return null
}

export const frontendToBackend = (role) => {
  if (role === FRONTEND_ROLES.ADMIN) return BACKEND_ROLES.SUPER_ADMIN
  if (role === FRONTEND_ROLES.ORG) return BACKEND_ROLES.ORG_ADMIN
  if (role === FRONTEND_ROLES.USER) return BACKEND_ROLES.USER
  return null
}

export const isAdmin = (user) => user?.backendRole === BACKEND_ROLES.SUPER_ADMIN
export const isOrgAdmin = (user) => user?.backendRole === BACKEND_ROLES.ORG_ADMIN
export const isUser = (user) => user?.backendRole === BACKEND_ROLES.USER
