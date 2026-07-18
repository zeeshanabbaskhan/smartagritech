import { useState, useEffect } from 'react'
import PageState, { useFetch } from '../../components/ui/PageState'
import { TextInput, SelectInput, TextareaInput, ToggleInput } from '../../components/ui/FormFields'
import HierarchyEditor from '../../components/facility/HierarchyEditor'
import FacilityDeviceLinker from '../../components/facility/FacilityDeviceLinker'
import { Save, CheckCircle } from 'lucide-react'
import emsApi, { one } from '../../api/emsApi'
import { mapOrganization } from '../../utils/mappers'
import { mapTreeFromApi, flattenTreeForApi } from '../../data/facilitiesHierarchy'
import { useToast } from '../../context/ToastContext'
import { loadOrgPrefs, saveOrgPrefs, useOrgId } from '../../utils/orgPrefs'

function SectionCard({ title, description, children, onSave, saved, saving }) {
  return (
    <div className="card mb-5">
      <div className="p-5 border-b border-surface-200">
        <h3 className="text-sm font-semibold text-surface-900">{title}</h3>
        {description && <p className="text-xs text-surface-500 mt-0.5">{description}</p>}
      </div>
      <div className="p-5 space-y-4">{children}</div>
      <div className="px-5 pb-5 flex items-center justify-between">
        <div className={`flex items-center gap-2 text-xs transition-opacity duration-500 ${saved ? 'opacity-100 text-success-600' : 'opacity-0'}`}>
          <CheckCircle size={14} /><span>Saved successfully</span>
        </div>
        <button type="button" className="btn-primary" onClick={onSave} disabled={saving}>
          <Save size={14} /> {saving ? 'Saving...' : 'Save Changes'}
        </button>
      </div>
    </div>
  )
}

const defaultNotifications = { emailAlerts: true, smsAlerts: false, whatsappAlerts: false, frequency: 'Instant', recipients: '' }
const defaultDisplay = { dateFormat: 'DD/MM/YYYY', timeFormat: '12-hour', energyUnit: 'kWh', currency: 'PKR' }

export default function OrgSettings() {
  const orgId = useOrgId()
  const { showToast } = useToast()
  const { data: org, loading, error, reload } = useFetch(async () => {
    const res = await emsApi.getMyOrganization()
    return mapOrganization(one(res))
  }, [])

  const [saved, setSaved] = useState({ profile: false, notifications: false, display: false, facilities: false })
  const [saving, setSaving] = useState(false)
  const [profile, setProfile] = useState({ name: '', description: '', email: '', phone: '', address: '', industry: 'Manufacturing' })
  const [notifications, setNotifications] = useState(defaultNotifications)
  const [display, setDisplay] = useState(defaultDisplay)
  const [facilityTree, setFacilityTree] = useState([])
  const [facilityLoading, setFacilityLoading] = useState(false)

  useEffect(() => {
    if (!org) return
    setProfile((p) => ({ ...p, name: org.name, description: org.description }))
  }, [org])

  useEffect(() => {
    if (!orgId) return
    const prefs = loadOrgPrefs(orgId)
    if (prefs?.notifications) setNotifications({ ...defaultNotifications, ...prefs.notifications })
    if (prefs?.display) setDisplay({ ...defaultDisplay, ...prefs.display })
    if (prefs?.profile) setProfile((p) => ({ ...p, ...prefs.profile }))
  }, [orgId])

  useEffect(() => {
    let cancelled = false
    async function loadFacilities() {
      setFacilityLoading(true)
      try {
        const res = await emsApi.getFacilityTree()
        if (!cancelled) setFacilityTree(mapTreeFromApi(Array.isArray(res?.data) ? res.data : []))
      } catch (_) {
        if (!cancelled) setFacilityTree([])
      } finally {
        if (!cancelled) setFacilityLoading(false)
      }
    }
    loadFacilities()
    return () => { cancelled = true }
  }, [orgId])

  const triggerSave = (section) => {
    setSaved((s) => ({ ...s, [section]: true }))
    setTimeout(() => setSaved((s) => ({ ...s, [section]: false })), 3000)
  }

  const saveProfile = async () => {
    setSaving(true)
    try {
      await emsApi.updateMyOrganization({ name: profile.name, description: profile.description })
      if (orgId) saveOrgPrefs(orgId, { notifications, display, profile: { email: profile.email, phone: profile.phone, address: profile.address, industry: profile.industry } })
      triggerSave('profile')
      reload()
      showToast('Organization profile saved', 'success')
    } catch (e) {
      showToast(e.message || 'Save failed', 'error')
    } finally {
      setSaving(false)
    }
  }

  const saveNotifications = () => {
    if (orgId) saveOrgPrefs(orgId, { notifications, display, profile: { email: profile.email, phone: profile.phone, address: profile.address, industry: profile.industry } })
    triggerSave('notifications')
    showToast('Notification preferences saved locally', 'success')
  }

  const saveDisplay = () => {
    if (orgId) saveOrgPrefs(orgId, { notifications, display, profile: { email: profile.email, phone: profile.phone, address: profile.address, industry: profile.industry } })
    triggerSave('display')
    showToast('Display preferences saved locally', 'success')
  }

  const saveFacilities = async () => {
    setSaving(true)
    try {
      const nodes = flattenTreeForApi(facilityTree)
      const res = await emsApi.replaceFacilityTree({ nodes })
      setFacilityTree(mapTreeFromApi(Array.isArray(res?.data) ? res.data : []))
      triggerSave('facilities')
      showToast('Facility hierarchy saved', 'success')
    } catch (e) {
      showToast(e.message || 'Failed to save facility hierarchy', 'error')
    } finally {
      setSaving(false)
    }
  }

  const pf = (k) => (e) => setProfile((p) => ({ ...p, [k]: e.target.value }))
  const nf = (k) => (e) => setNotifications((n) => ({ ...n, [k]: e.target.value }))
  const df = (k) => (e) => setDisplay((d) => ({ ...d, [k]: e.target.value }))

  return (
    <PageState loading={loading} error={error} onRetry={reload}>
      <div>
        <div className="page-header">
          <div>
            <h2 className="page-title">Settings</h2>
            <p className="breadcrumb">Organization / Settings</p>
          </div>
        </div>

        <SectionCard title="Organization Profile" description="Synced to your organization record" onSave={saveProfile} saved={saved.profile} saving={saving}>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <TextInput label="Organization Name" required value={profile.name} onChange={pf('name')} />
            <TextInput label="Contact Email" type="email" value={profile.email} onChange={pf('email')} />
            <TextInput label="Contact Phone" type="tel" value={profile.phone} onChange={pf('phone')} />
            <SelectInput label="Industry" value={profile.industry} onChange={pf('industry')}
              options={['Manufacturing', 'Energy', 'Education', 'Healthcare', 'Retail', 'F&B', 'Other']} />
          </div>
          <TextareaInput label="Description" rows={2} value={profile.description} onChange={pf('description')} />
          <TextareaInput label="Address" rows={2} value={profile.address} onChange={pf('address')} />
        </SectionCard>

        <SectionCard title="Notification Preferences" description="Saved for this browser session (used by dashboard UI)" onSave={saveNotifications} saved={saved.notifications}>
          <div className="space-y-1 divide-y divide-surface-800/50">
            <ToggleInput label="Receive Email Alerts" description="Get alarm notifications via email" checked={notifications.emailAlerts} onChange={(v) => setNotifications((n) => ({ ...n, emailAlerts: v }))} />
            <ToggleInput label="Receive SMS Alerts" description="Get alarm notifications via SMS" checked={notifications.smsAlerts} onChange={(v) => setNotifications((n) => ({ ...n, smsAlerts: v }))} />
            <ToggleInput label="Receive WhatsApp Alerts" description="Get alarm notifications via WhatsApp" checked={notifications.whatsappAlerts} onChange={(v) => setNotifications((n) => ({ ...n, whatsappAlerts: v }))} />
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2">
            <SelectInput label="Alert Frequency" value={notifications.frequency} onChange={nf('frequency')} options={['Instant', 'Hourly', 'Daily']} />
            <TextInput label="Alert Email Recipients" value={notifications.recipients} onChange={nf('recipients')} />
          </div>
        </SectionCard>

        <SectionCard title="Display Preferences" description="Saved locally for dashboard formatting" onSave={saveDisplay} saved={saved.display}>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <SelectInput label="Date Format" value={display.dateFormat} onChange={df('dateFormat')} options={['DD/MM/YYYY', 'MM/DD/YYYY', 'YYYY-MM-DD']} />
            <SelectInput label="Time Format" value={display.timeFormat} onChange={df('timeFormat')} options={['12-hour', '24-hour']} />
            <SelectInput label="Energy Unit" value={display.energyUnit} onChange={df('energyUnit')} options={['kWh', 'MWh']} />
            <SelectInput label="Currency" value={display.currency} onChange={df('currency')} options={['PKR', 'USD', 'AED']} />
          </div>
        </SectionCard>

        <SectionCard
          title="Facility Hierarchy"
          description="Define buildings, floors, and departments used by custom dashboard filters"
          onSave={saveFacilities}
          saved={saved.facilities}
          saving={saving || facilityLoading}
        >
          {facilityLoading ? (
            <p className="text-xs text-surface-400">Loading hierarchy…</p>
          ) : (
            <div className="space-y-6">
              <HierarchyEditor
                buildings={facilityTree}
                orgName={profile.name || org?.name}
                onChange={setFacilityTree}
              />
              <div className="pt-4 border-t border-surface-200">
                <h4 className="text-xs font-bold text-surface-700 uppercase tracking-wide mb-3">Link devices to facilities</h4>
                <FacilityDeviceLinker tree={facilityTree} onChange={setFacilityTree} />
              </div>
            </div>
          )}
        </SectionCard>
      </div>
    </PageState>
  )
}
