import { useState, useEffect, useRef } from 'react'
import { ToggleInput, SelectInput } from '../../components/ui/FormFields'
import PageState, { useFetch } from '../../components/ui/PageState'
import { Save, Palette } from 'lucide-react'
import emsApi, { list } from '../../api/emsApi'
import { mapTheme, mapOrganization } from '../../utils/mappers'
import { useToast } from '../../context/ToastContext'
import { useTheme } from '../../context/ThemeContext'

export default function AdminThemeSettings() {
  const { showToast } = useToast()
  const { refreshBranding } = useTheme()
  const { data: meta, loading, error, reload } = useFetch(async () => {
    const [themesRes, orgsRes] = await Promise.all([
      emsApi.getThemes({ limit: 100 }),
      emsApi.getOrganizations({ limit: 100 }),
    ])
    return {
      themes: list(themesRes).map(mapTheme),
      organizations: list(orgsRes).map(mapOrganization),
    }
  }, [])

  const [selectedThemeId, setSelectedThemeId] = useState('')
  const [assignOrgId, setAssignOrgId] = useState('')
  const [logoFile, setLogoFile] = useState(null)
  const [logoPreview, setLogoPreview] = useState(null)
  const fileRef = useRef(null)
  const [form, setForm] = useState({
    platformName: 'Elsa Energy',
    primaryColor: '#F5A623',
    secondaryColor: '#0ea5e9',
    sidebarColor: 'Dark',
    fontFamily: 'Inter',
    darkModeDefault: true,
    showLogo: true,
  })
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (!meta?.themes?.length || selectedThemeId) return
    setSelectedThemeId(meta.themes[0].id)
  }, [meta, selectedThemeId])

  useEffect(() => {
    const theme = meta?.themes?.find((t) => t.id === selectedThemeId)
    if (!theme) return
    setForm({
      platformName: theme.name || 'Elsa Energy',
      primaryColor: theme.headerBgColor || theme.primary || '#F5A623',
      secondaryColor: theme.bodyBgColor || theme.secondary || '#0ea5e9',
      sidebarColor: theme.sidebarColor || 'Dark',
      fontFamily: theme.fontFamily || 'Inter',
      darkModeDefault: theme.darkModeDefault !== false,
      showLogo: theme.showLogoInSidebar !== false,
    })
    setLogoPreview(theme.logoUrl || null)
    setLogoFile(null)
    if (fileRef.current) fileRef.current.value = ''
    const assigned = theme.assignedOrgs?.[0]?.id || ''
    setAssignOrgId(assigned)
  }, [selectedThemeId, meta])

  const handleLogoPick = (e) => {
    const file = e.target.files?.[0]
    if (!file) return
    setLogoFile(file)
    setLogoPreview(URL.createObjectURL(file))
  }

  const buildFormData = () => {
    const fd = new FormData()
    fd.append('name', form.platformName)
    fd.append('headerBgColor', form.primaryColor)
    fd.append('bodyBgColor', form.secondaryColor)
    fd.append('headerFontColor', '#ffffff')
    fd.append('bodyFontColor', '#1f2937')
    fd.append('sidebarColor', form.sidebarColor)
    fd.append('fontFamily', form.fontFamily)
    fd.append('darkModeDefault', String(form.darkModeDefault))
    fd.append('showLogoInSidebar', String(form.showLogo))
    fd.append('status', 'ACTIVE')
    if (logoFile) fd.append('imageFile', logoFile)
    return fd
  }

  const handleSave = async () => {
    setSaving(true)
    try {
      const body = buildFormData()
      let themeId = selectedThemeId
      if (themeId) {
        await emsApi.updateTheme(themeId, body)
      } else {
        const res = await emsApi.createTheme(body)
        themeId = res?.data?.id ?? res?.id
        if (themeId) setSelectedThemeId(themeId)
      }
      if (assignOrgId && themeId) {
        await emsApi.assignTheme(themeId, assignOrgId)
      }
      await refreshBranding()
      showToast('Theme settings saved — branding applied', 'success')
      reload()
    } catch (e) {
      showToast(e.message || 'Save failed', 'error')
    } finally {
      setSaving(false)
    }
  }

  return (
    <PageState loading={loading} error={error} onRetry={reload}>
      <div>
        <div className="page-header">
          <div>
            <h2 className="page-title">Theme Settings</h2>
            <p className="breadcrumb">Admin / System / Theme Settings</p>
          </div>
        </div>

        <div className="card p-6 max-w-2xl">
          <div className="flex items-center gap-3 mb-6 pb-5 border-b border-surface-200 dark:border-surface-800">
            <div className="w-9 h-9 rounded-lg bg-primary-600/20 flex items-center justify-center">
              <Palette size={18} className="text-primary-600" />
            </div>
            <div>
              <h3 className="text-sm font-semibold text-surface-900 dark:text-surface-100">Platform Theme</h3>
              <p className="text-xs text-surface-500 mt-0.5">Customize the look and feel of the platform</p>
            </div>
          </div>

          <div className="space-y-5">
            {(meta?.themes?.length ?? 0) > 0 && (
              <div>
                <label className="label">Select Theme</label>
                <select className="select" value={selectedThemeId} onChange={(e) => setSelectedThemeId(e.target.value)}>
                  {(meta?.themes ?? []).map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
                </select>
              </div>
            )}

            <div>
              <label className="label">Platform Name</label>
              <input className="input" value={form.platformName}
                onChange={(e) => setForm((f) => ({ ...f, platformName: e.target.value }))} />
            </div>

            <div>
              <label className="label">Platform Logo</label>
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-lg bg-surface-100 dark:bg-surface-800 border border-surface-200 dark:border-surface-700 flex items-center justify-center text-surface-500 text-xs overflow-hidden">
                  {logoPreview
                    ? <img src={logoPreview} alt="Logo preview" className="w-full h-full object-contain" />
                    : 'Logo'}
                </div>
                <label className="btn-secondary cursor-pointer text-xs">
                  Choose File
                  <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={handleLogoPick} />
                </label>
                <span className="text-xs text-surface-500">PNG, SVG recommended</span>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="label">Primary Color</label>
                <div className="flex items-center gap-2">
                  <input type="color" value={form.primaryColor}
                    onChange={(e) => setForm((f) => ({ ...f, primaryColor: e.target.value }))}
                    className="w-9 h-9 rounded cursor-pointer bg-surface-100 border border-surface-200 p-0.5" />
                  <input className="input flex-1 font-mono text-xs" value={form.primaryColor}
                    onChange={(e) => setForm((f) => ({ ...f, primaryColor: e.target.value }))} />
                </div>
              </div>
              <div>
                <label className="label">Secondary Color</label>
                <div className="flex items-center gap-2">
                  <input type="color" value={form.secondaryColor}
                    onChange={(e) => setForm((f) => ({ ...f, secondaryColor: e.target.value }))}
                    className="w-9 h-9 rounded cursor-pointer bg-surface-100 border border-surface-200 p-0.5" />
                  <input className="input flex-1 font-mono text-xs" value={form.secondaryColor}
                    onChange={(e) => setForm((f) => ({ ...f, secondaryColor: e.target.value }))} />
                </div>
              </div>
            </div>

            <div>
              <label className="label">Sidebar Color</label>
              <select className="select"
                value={form.sidebarColor}
                onChange={(e) => setForm((f) => ({ ...f, sidebarColor: e.target.value }))}>
                <option value="Dark">Dark</option>
                <option value="Light">Light</option>
              </select>
            </div>

            <div>
              <label className="label">Font Family</label>
              <select className="select"
                value={form.fontFamily}
                onChange={(e) => setForm((f) => ({ ...f, fontFamily: e.target.value }))}>
                <option value="Inter">Inter</option>
                <option value="Roboto">Roboto</option>
                <option value="Open Sans">Open Sans</option>
                <option value="Poppins">Poppins</option>
              </select>
            </div>

            <SelectInput label="Assign to Organization" placeholder="Optional — assign theme to org"
              value={assignOrgId} onChange={(e) => setAssignOrgId(e.target.value)}
              options={[{ value: '', label: '— None —' }, ...(meta?.organizations ?? []).map((o) => ({ value: o.id, label: o.name }))]} />

            <div className="space-y-1 pt-2 border-t border-surface-200 dark:border-surface-800">
              <ToggleInput
                label="Dark Mode Default"
                description="Enable dark mode by default for new sessions (users can still toggle)"
                checked={form.darkModeDefault}
                onChange={(v) => setForm((f) => ({ ...f, darkModeDefault: v }))}
              />
              <ToggleInput
                label="Show Logo in Sidebar"
                description="Display platform logo in the sidebar header"
                checked={form.showLogo}
                onChange={(v) => setForm((f) => ({ ...f, showLogo: v }))}
              />
            </div>
          </div>

          <div className="mt-6 pt-5 border-t border-surface-200 dark:border-surface-800 flex justify-end">
            <button type="button" className="btn-primary" onClick={handleSave} disabled={saving}
              style={{ backgroundColor: form.primaryColor }}>
              <Save size={15} /> {saving ? 'Saving...' : 'Save Changes'}
            </button>
          </div>
        </div>
      </div>
    </PageState>
  )
}
