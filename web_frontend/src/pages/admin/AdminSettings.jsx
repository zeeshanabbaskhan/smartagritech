import { useState, useEffect } from 'react'
import { ToggleInput } from '../../components/ui/FormFields'
import PageState, { useFetch } from '../../components/ui/PageState'
import { Globe, Shield, Bell, Database, Save } from 'lucide-react'
import emsApi, { list } from '../../api/emsApi'
import { mapSetting } from '../../utils/mappers'
import { useToast } from '../../context/ToastContext'

const DEFAULTS = {
  platform: {
    name: 'CF Smart EMS', supportEmail: 'support@cfsmart.com',
    supportPhone: '+92-300-0000000', language: 'English', timezone: 'Asia/Karachi',
  },
  security: {
    sessionTimeout: '1 hour', twoFA: false,
    passwordExpiry: '90', lockoutAttempts: '5',
  },
  notifications: {
    email: true, sms: true, whatsapp: false, frequency: 'Instant',
  },
  dataSettings: {
    retention: '1 year', autoExport: false, exportFormat: 'CSV',
  },
}

function settingsToState(settings) {
  const map = Object.fromEntries(settings.map((s) => [s.key, s.value]))
  const get = (key, fallback) => map[key] ?? fallback
  const getBool = (key, fallback) => {
    const v = map[key]
    if (v == null) return fallback
    return v === 'true' || v === true
  }
  return {
    platform: {
      name: get('platform.name', DEFAULTS.platform.name),
      supportEmail: get('platform.supportEmail', DEFAULTS.platform.supportEmail),
      supportPhone: get('platform.supportPhone', DEFAULTS.platform.supportPhone),
      language: get('platform.language', DEFAULTS.platform.language),
      timezone: get('platform.timezone', DEFAULTS.platform.timezone),
    },
    security: {
      sessionTimeout: get('security.sessionTimeout', DEFAULTS.security.sessionTimeout),
      twoFA: getBool('security.twoFA', DEFAULTS.security.twoFA),
      passwordExpiry: get('security.passwordExpiry', DEFAULTS.security.passwordExpiry),
      lockoutAttempts: get('security.lockoutAttempts', DEFAULTS.security.lockoutAttempts),
    },
    notifications: {
      email: getBool('notifications.email', DEFAULTS.notifications.email),
      sms: getBool('notifications.sms', DEFAULTS.notifications.sms),
      whatsapp: getBool('notifications.whatsapp', DEFAULTS.notifications.whatsapp),
      frequency: get('notifications.frequency', DEFAULTS.notifications.frequency),
    },
    dataSettings: {
      retention: get('data.retention', DEFAULTS.dataSettings.retention),
      autoExport: getBool('data.autoExport', DEFAULTS.dataSettings.autoExport),
      exportFormat: get('data.exportFormat', DEFAULTS.dataSettings.exportFormat),
    },
  }
}

function Section({ icon: Icon, title, description, children, onSave, saving }) {
  return (
    <div className="card p-6">
      <div className="flex items-center justify-between mb-5 pb-4 border-b border-surface-200">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-lg bg-primary-600/20 flex items-center justify-center">
            <Icon size={18} className="text-primary-600" />
          </div>
          <div>
            <h3 className="text-sm font-semibold text-surface-900">{title}</h3>
            {description && <p className="text-xs text-surface-500 mt-0.5">{description}</p>}
          </div>
        </div>
      </div>
      <div className="space-y-4">
        {children}
      </div>
      <div className="mt-5 pt-4 border-t border-surface-200 flex justify-end">
        <button type="button" className="btn-primary text-xs" onClick={onSave} disabled={saving}>
          <Save size={13} /> {saving ? 'Saving...' : 'Save'}
        </button>
      </div>
    </div>
  )
}

function Field({ label, children }) {
  return (
    <div>
      <label className="label">{label}</label>
      {children}
    </div>
  )
}

export default function AdminSettings() {
  const { showToast } = useToast()
  const { data: settings, loading, error, reload } = useFetch(
    async () => list(await emsApi.getSettings()).map(mapSetting),
    []
  )

  const [saving, setSaving] = useState(null)
  const [platform, setPlatform] = useState(DEFAULTS.platform)
  const [security, setSecurity] = useState(DEFAULTS.security)
  const [notifications, setNotifications] = useState(DEFAULTS.notifications)
  const [dataSettings, setDataSettings] = useState(DEFAULTS.dataSettings)

  useEffect(() => {
    if (settings) {
      const state = settingsToState(settings)
      setPlatform(state.platform)
      setSecurity(state.security)
      setNotifications(state.notifications)
      setDataSettings(state.dataSettings)
    }
  }, [settings])

  const saveSection = async (section, entries) => {
    setSaving(section)
    try {
      await Promise.all(entries.map(([key, value]) =>
        emsApi.updateSetting(key, String(value))
      ))
      showToast(`${section} settings saved successfully`, 'success')
      reload()
    } catch (e) {
      showToast(e.message || 'Save failed', 'error')
    } finally {
      setSaving(null)
    }
  }

  return (
    <PageState loading={loading} error={error} onRetry={reload}>
      <div>
        <div className="page-header">
          <div>
            <h2 className="page-title">Settings</h2>
            <p className="breadcrumb">Admin / System / Settings</p>
          </div>
        </div>

        <div className="space-y-6 max-w-2xl">
          <Section icon={Globe} title="Platform Settings" description="General platform configuration"
            saving={saving === 'Platform'}
            onSave={() => saveSection('Platform', [
              ['platform.name', platform.name],
              ['platform.supportEmail', platform.supportEmail],
              ['platform.supportPhone', platform.supportPhone],
              ['platform.language', platform.language],
              ['platform.timezone', platform.timezone],
            ])}>
            <Field label="Platform Name">
              <input className="input" value={platform.name}
                onChange={(e) => setPlatform((p) => ({ ...p, name: e.target.value }))} />
            </Field>
            <Field label="Support Email">
              <input className="input" type="email" value={platform.supportEmail}
                onChange={(e) => setPlatform((p) => ({ ...p, supportEmail: e.target.value }))} />
            </Field>
            <Field label="Support Phone">
              <input className="input" value={platform.supportPhone}
                onChange={(e) => setPlatform((p) => ({ ...p, supportPhone: e.target.value }))} />
            </Field>
            <Field label="Default Language">
              <select className="select" value={platform.language}
                onChange={(e) => setPlatform((p) => ({ ...p, language: e.target.value }))}>
                <option>English</option>
                <option>Urdu</option>
                <option>Arabic</option>
              </select>
            </Field>
            <Field label="Timezone">
              <select className="select" value={platform.timezone}
                onChange={(e) => setPlatform((p) => ({ ...p, timezone: e.target.value }))}>
                <option>Asia/Karachi</option>
                <option>UTC</option>
                <option>Asia/Dubai</option>
              </select>
            </Field>
          </Section>

          <Section icon={Shield} title="Security Settings" description="Authentication and access control"
            saving={saving === 'Security'}
            onSave={() => saveSection('Security', [
              ['security.sessionTimeout', security.sessionTimeout],
              ['security.twoFA', security.twoFA],
              ['security.passwordExpiry', security.passwordExpiry],
              ['security.lockoutAttempts', security.lockoutAttempts],
            ])}>
            <Field label="Session Timeout">
              <select className="select" value={security.sessionTimeout}
                onChange={(e) => setSecurity((s) => ({ ...s, sessionTimeout: e.target.value }))}>
                <option>30 minutes</option>
                <option>1 hour</option>
                <option>4 hours</option>
                <option>8 hours</option>
              </select>
            </Field>
            <ToggleInput
              label="Two-Factor Authentication"
              description="Require 2FA for all admin logins"
              checked={security.twoFA}
              onChange={(v) => setSecurity((s) => ({ ...s, twoFA: v }))}
            />
            <Field label="Password Expiry Days">
              <input className="input" type="number" value={security.passwordExpiry}
                onChange={(e) => setSecurity((s) => ({ ...s, passwordExpiry: e.target.value }))} />
            </Field>
            <Field label="Failed Login Attempts Before Lockout">
              <select className="select" value={security.lockoutAttempts}
                onChange={(e) => setSecurity((s) => ({ ...s, lockoutAttempts: e.target.value }))}>
                <option>3</option>
                <option>5</option>
                <option>10</option>
              </select>
            </Field>
          </Section>

          <Section icon={Bell} title="Notification Settings" description="Control how alerts are delivered"
            saving={saving === 'Notification'}
            onSave={() => saveSection('Notification', [
              ['notifications.email', notifications.email],
              ['notifications.sms', notifications.sms],
              ['notifications.whatsapp', notifications.whatsapp],
              ['notifications.frequency', notifications.frequency],
            ])}>
            <ToggleInput label="Email Notifications" checked={notifications.email}
              onChange={(v) => setNotifications((n) => ({ ...n, email: v }))} />
            <ToggleInput label="SMS Notifications" checked={notifications.sms}
              onChange={(v) => setNotifications((n) => ({ ...n, sms: v }))} />
            <ToggleInput label="WhatsApp Notifications" checked={notifications.whatsapp}
              onChange={(v) => setNotifications((n) => ({ ...n, whatsapp: v }))} />
            <Field label="Notification Frequency">
              <select className="select" value={notifications.frequency}
                onChange={(e) => setNotifications((n) => ({ ...n, frequency: e.target.value }))}>
                <option>Instant</option>
                <option>Hourly Digest</option>
                <option>Daily Digest</option>
              </select>
            </Field>
          </Section>

          <Section icon={Database} title="Data Settings" description="Data retention and export preferences"
            saving={saving === 'Data'}
            onSave={() => saveSection('Data', [
              ['data.retention', dataSettings.retention],
              ['data.autoExport', dataSettings.autoExport],
              ['data.exportFormat', dataSettings.exportFormat],
            ])}>
            <Field label="Data Retention Period">
              <select className="select" value={dataSettings.retention}
                onChange={(e) => setDataSettings((d) => ({ ...d, retention: e.target.value }))}>
                <option>30 days</option>
                <option>90 days</option>
                <option>1 year</option>
                <option>Forever</option>
              </select>
            </Field>
            <ToggleInput
              label="Auto Export Data"
              description="Automatically export data on a scheduled basis"
              checked={dataSettings.autoExport}
              onChange={(v) => setDataSettings((d) => ({ ...d, autoExport: v }))}
            />
            <Field label="Export Format">
              <select className="select" value={dataSettings.exportFormat}
                onChange={(e) => setDataSettings((d) => ({ ...d, exportFormat: e.target.value }))}>
                <option>CSV</option>
                <option>Excel</option>
                <option>JSON</option>
              </select>
            </Field>
          </Section>
        </div>
      </div>
    </PageState>
  )
}
