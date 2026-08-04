import DeviceTemplateSlavesPage from '../shared/DeviceTemplateSlavesPage'

/** Org can view/edit slaves & variables (ORG_ADMIN); mirrors admin portal pattern. */
export default function OrgDeviceTemplateSlaves() {
  return <DeviceTemplateSlavesPage basePath="/org" />
}
