/** Map UI form values to backend enums */
import { apiRoleToLabel, uiRoleLabelToApi } from './roles'

export const uiStatusToApi = (s) => (s === 'Active' || s === 'Online' ? 'ACTIVE' : 'INACTIVE')
export const apiStatusToUi = (s) => (s === 'ACTIVE' || s === 'ONLINE' ? 'Active' : 'Inactive')

/** Gateway status labels shown in admin/org UI (filter + create/edit forms). */
export const GATEWAY_STATUS_OPTIONS = [
  'Online',
  'Offline',
  'Upgrading',
  'In the configuration',
  'Gateway alarm',
  'Disabled',
]

const GATEWAY_STATUS_UI_TO_API = {
  Online: 'ONLINE',
  Offline: 'OFFLINE',
  Upgrading: 'UPGRADING',
  'In the configuration': 'IN_CONFIGURATION',
  'Gateway alarm': 'GATEWAY_ALARM',
  Disabled: 'DISABLED',
}

const GATEWAY_STATUS_API_TO_UI = {
  ONLINE: 'Online',
  OFFLINE: 'Offline',
  UPGRADING: 'Upgrading',
  IN_CONFIGURATION: 'In the configuration',
  GATEWAY_ALARM: 'Gateway alarm',
  DISABLED: 'Disabled',
}

export const uiGatewayStatusToApi = (s) => GATEWAY_STATUS_UI_TO_API[s] ?? 'OFFLINE'
export const apiGatewayStatusToUi = (s) => GATEWAY_STATUS_API_TO_UI[s] ?? 'Offline'

export const gatewayStatusBadgeClass = (status) => {
  switch (status) {
    case 'Online':
      return 'badge-success'
    case 'Offline':
      return 'badge-danger'
    case 'Upgrading':
      return 'badge-info'
    case 'In the configuration':
      return 'badge-warning'
    case 'Gateway alarm':
      return 'badge-danger'
    case 'Disabled':
      return 'badge-neutral'
    default:
      return 'badge-neutral'
  }
}

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
