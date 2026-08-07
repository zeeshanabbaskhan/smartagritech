import { useState, useEffect, useRef } from 'react'
import { ToggleInput, SelectInput } from '../../components/ui/FormFields'
import PageState, { useFetch } from '../../components/ui/PageState'
import { Save, Palette, Trash2 } from 'lucide-react'
import emsApi, { list } from '../../api/emsApi'
import { resolveMediaUrl } from '../../api/client'
import { mapTheme, mapOrganization } from '../../utils/mappers'
import {
  DEFAULT_DISPLAY_NAME,
  DEFAULT_LOGO,
  DEFAULT_PRIMARY_COLOR,
  themeDisplayName,
  themeRecordName,
} from '../../utils/branding'
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
  const [logoPreview, setLogoPreview] = useState(DEFAULT_LOGO)
  const [logoCleared, setLogoCleared] = useState(false)
  const [hasCustomLogo, setHasCustomLogo] = useState(false)
  const fileRef = useRef(null)
  const [form, setForm] = useState({
    platformName: DEFAULT_DISPLAY_NAME,
    primaryColor: DEFAULT_PRIMARY_COLOR,
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
      platformName: themeDisplayName(theme.name),
      primaryColor: theme.headerBgColor || theme.primary || DEFAULT_PRIMARY_COLOR,
      darkModeDefault: theme.darkModeDefault !== false,
      showLogo: theme.showLogoInSidebar !== false,
    })
    const custom = Boolean(theme.logoUrl)
    setHasCustomLogo(custom)
    setLogoCleared(false)
    setLogoPreview(custom ? resolveMediaUrl(theme.logoUrl) : DEFAULT_LOGO)
    setLogoFile(null)
    if (fileRef.current) fileRef.current.value = ''
    const assigned = theme.assignedOrgs?.[0]?.id || ''
    setAssignOrgId(assigned)
  }, [selectedThemeId, meta])

  const handleLogoPick = (e) => {
    const file = e.target.files?.[0]
    if (!file) return
    if (!file.type.startsWith('image/')) {
      showToast('Please choose an image file (PNG, JPG, SVG, WEBP)', 'error')
      return
    }
    if (file.size > 5 * 1024 * 1024) {
      showToast('Logo must be under 5 MB', 'error')
      return
    }
    setLogoFile(file)
    setLogoCleared(false)
    setHasCustomLogo(true)
    setLogoPreview(URL.createObjectURL(file))
  }

  const handleRemoveLogo = () => {
    setLogoFile(null)
    setLogoCleared(true)
    setHasCustomLogo(false)
    setLogoPreview(DEFAULT_LOGO)
    if (fileRef.current) fileRef.current.value = ''
  }

  const buildFormData = () => {
    const fd = new FormData()
    fd.append('name', themeRecordName(form.platformName))
    fd.append('headerBgColor', form.primaryColor)
    fd.append('headerFontColor', '#ffffff')
    fd.append('bodyFontColor', '#1f2937')
    fd.append('darkModeDefault', String(form.darkModeDefault))
    fd.append('showLogoInSidebar', String(form.showLogo))
    fd.append('status', 'ACTIVE')
    if (logoFile) fd.append('imageFile', logoFile)
    else if (logoCleared) fd.append('clearLogo', 'true')
    return fd
  }

  const handleSave = async () => {
    setSaving(true)
    try {
      const body = buildFormData()
      let themeId = selectedThemeId
      let saved
      if (themeId) {
        saved = await emsApi.updateTheme(themeId, body)
      } else {
        saved = await emsApi.createTheme(body)
        themeId = saved?.data?.id ?? saved?.id
        if (themeId) setSelectedThemeId(themeId)
      }
      if (assignOrgId && themeId) {
        await emsApi.assignTheme(themeId, assignOrgId)
      }
      const logoUrl = saved?.data?.logoUrl ?? saved?.logoUrl
      if (logoFile && !logoUrl) {
        showToast('Theme saved but logo upload failed — try again', 'error')
      } else {
        const custom = Boolean(logoUrl)
        setHasCustomLogo(custom)
        setLogoCleared(false)
        setLogoPreview(custom ? resolveMediaUrl(logoUrl) : DEFAULT_LOGO)
        setLogoFile(null)
        if (fileRef.current) fileRef.current.value = ''
        showToast(
          logoFile ? 'Theme and logo saved' : logoCleared ? 'Logo removed — using Elsa default' : 'Theme settings saved',
          'success',
        )
      }
      await refreshBranding()
      reload()
    } catch (e) {
      showToast(e.message || 'Save failed', 'error')
    } finally {
      setSaving(false)
    }
  }

  const showRemove = hasCustomLogo || Boolean(logoFile)

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
              <div className="flex items-center gap-3 flex-wrap">
                <div className="w-12 h-12 rounded-lg bg-white border border-surface-200 dark:border-surface-700 flex items-center justify-center overflow-hidden p-0.5 shadow-sm">
                  <img src={logoPreview || DEFAULT_LOGO} alt="Logo preview" className="w-full h-full object-contain" />
                </div>
                <label className="btn-secondary cursor-pointer text-xs">
                  Choose File
                  <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={handleLogoPick} />
                </label>
                {showRemove && (
                  <button
                    type="button"
                    className="btn-ghost text-xs text-danger-600 hover:bg-danger-500/10 inline-flex items-center gap-1"
                    onClick={handleRemoveLogo}
                    title="Remove custom logo"
                  >
                    <Trash2 size={14} /> Remove
                  </button>
                )}
                <span className="text-xs text-surface-500">
                  {showRemove ? 'PNG, SVG recommended' : 'Default Elsa logo — PNG, SVG recommended'}
                </span>
              </div>
            </div>

            <div>
              <label className="label">Primary Color</label>
              <div className="flex items-center gap-2 max-w-xs">
                <input type="color" value={form.primaryColor}
                  onChange={(e) => setForm((f) => ({ ...f, primaryColor: e.target.value }))}
                  className="w-9 h-9 rounded cursor-pointer bg-surface-100 border border-surface-200 p-0.5" />
                <input className="input flex-1 font-mono text-xs" value={form.primaryColor}
                  onChange={(e) => setForm((f) => ({ ...f, primaryColor: e.target.value }))} />
              </div>
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
