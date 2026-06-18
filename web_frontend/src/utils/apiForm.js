/** Map UI form values to backend enums */

export const uiStatusToApi = (s) => (s === 'Active' || s === 'Online' ? 'ACTIVE' : 'INACTIVE')
export const apiStatusToUi = (s) => (s === 'ACTIVE' || s === 'ONLINE' ? 'Active' : 'Inactive')

export const uiGatewayStatusToApi = (s) => (s === 'Online' ? 'ONLINE' : 'OFFLINE')
export const apiGatewayStatusToUi = (s) => (s === 'ONLINE' ? 'Online' : 'Offline')

export const uiRoleToApi = (r) => {
  const m = { 'Super Admin': 'SUPER_ADMIN', 'Org Admin': 'ORG_ADMIN', Customer: 'USER', User: 'USER' }
  return m[r] ?? r
}

export const apiRoleToUi = (r) => {
  const m = { SUPER_ADMIN: 'Super Admin', ORG_ADMIN: 'Org Admin', USER: 'Customer' }
  return m[r] ?? r
}

export const uiOperatorToApi = (c) => {
  const m = {
    'Greater Than': 'GT', 'Less Than': 'LT', 'Equal To': 'EQ',
    'Greater or Equal': 'GTE', 'Less or Equal': 'LTE',
  }
  return m[c] ?? c
}

export const uiRepeatToApi = (f) => ({ Daily: 'DAILY', Weekly: 'WEEKLY', Monthly: 'ONCE' }[f] ?? 'DAILY')

export const uiMechanismToApi = (m) => (m === 'Delayed' ? 'DELAYED' : 'INSTANT')
