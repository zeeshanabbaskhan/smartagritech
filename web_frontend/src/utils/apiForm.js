/** Map UI form values to backend enums */
import { apiRoleToLabel, uiRoleLabelToApi } from './roles'

export const uiStatusToApi = (s) => (s === 'Active' || s === 'Online' ? 'ACTIVE' : 'INACTIVE')
export const apiStatusToUi = (s) => (s === 'ACTIVE' || s === 'ONLINE' ? 'Active' : 'Inactive')

export const uiGatewayStatusToApi = (s) => (s === 'Online' ? 'ONLINE' : 'OFFLINE')
export const apiGatewayStatusToUi = (s) => (s === 'ONLINE' ? 'Online' : 'Offline')

export const uiRoleToApi = (r) => uiRoleLabelToApi(r)

export const apiRoleToUi = (r) => apiRoleToLabel(r)

export const uiOperatorToApi = (c) => {
  const m = {
    'Greater Than': 'GT', 'Less Than': 'LT', 'Equal To': 'EQ',
    'Greater or Equal': 'GTE', 'Less or Equal': 'LTE',
  }
  return m[c] ?? c
}

export const uiRepeatToApi = (f) => (
  { Daily: 'DAILY', Weekly: 'WEEKLY', Monthly: 'MONTHLY', Once: 'ONCE' }[f] ?? 'DAILY'
)

export const uiMechanismToApi = (m) => (m === 'Delayed' ? 'DELAYED' : 'INSTANT')
