import DeviceTemplateSlavesPage from '../shared/DeviceTemplateSlavesPage'

/** Org can view slaves & variables (read-only). Mutations are SUPER_ADMIN-only. */
export default function OrgDeviceTemplateSlaves() {
  return <DeviceTemplateSlavesPage basePath="/org" readOnly />
}
