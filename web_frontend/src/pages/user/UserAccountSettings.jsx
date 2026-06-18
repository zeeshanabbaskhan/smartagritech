import { useState, useEffect } from 'react'
import { Save } from 'lucide-react'
import PageState, { useFetch } from '../../components/ui/PageState'
import { TextInput } from '../../components/ui/FormFields'
import { useAuth } from '../../context/AuthContext'
import { useToast } from '../../context/ToastContext'
import emsApi, { one } from '../../api/emsApi'

export default function UserAccountSettings() {
  const { user } = useAuth()
  const { showToast } = useToast()
  const { data: profile, loading, error, reload } = useFetch(async () => {
    const res = await emsApi.me()
    return one(res)
  }, [user?.id])

  const [form, setForm] = useState({ fullName: '', email: '', phone: '' })
  const [pw, setPw] = useState({ current: '', next: '', confirm: '' })
  const [saving, setSaving] = useState(false)
  const [savingPw, setSavingPw] = useState(false)

  useEffect(() => {
    if (!profile) return
    setForm({
      fullName: profile.fullName ?? user?.name ?? '',
      email: profile.email ?? '',
      phone: profile.phone ?? '',
    })
  }, [profile, user])

  const saveProfile = async () => {
    if (!user?.id) return
    setSaving(true)
    try {
      await emsApi.updateMe(user.id, {
        fullName: form.fullName.trim(),
        email: form.email.trim(),
        phone: form.phone.trim() || undefined,
      })
      showToast('Profile updated', 'success')
      reload()
    } catch (e) {
      showToast(e.message || 'Update failed', 'error')
    } finally {
      setSaving(false)
    }
  }

  const changePassword = async () => {
    if (pw.next !== pw.confirm) {
      showToast('New passwords do not match', 'error')
      return
    }
    if (pw.next.length < 8) {
      showToast('Password must be at least 8 characters', 'error')
      return
    }
    setSavingPw(true)
    try {
      await emsApi.changePassword(pw.current, pw.next)
      setPw({ current: '', next: '', confirm: '' })
      showToast('Password changed — sign in again on other devices', 'success')
    } catch (e) {
      showToast(e.message || 'Password change failed', 'error')
    } finally {
      setSavingPw(false)
    }
  }

  return (
    <PageState loading={loading} error={error} onRetry={reload}>
      <div className="max-w-xl space-y-6">
        <div className="page-header">
          <div>
            <h2 className="page-title">Account Settings</h2>
            <p className="breadcrumb">User / Account</p>
          </div>
        </div>

        <div className="card p-6 space-y-4">
          <h3 className="text-sm font-bold">Profile</h3>
          <TextInput label="Full Name" required value={form.fullName} onChange={(e) => setForm((f) => ({ ...f, fullName: e.target.value }))} />
          <TextInput label="Email" type="email" required value={form.email} onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))} />
          <TextInput label="Phone" value={form.phone} onChange={(e) => setForm((f) => ({ ...f, phone: e.target.value }))} />
          <button type="button" className="btn-primary text-xs" onClick={saveProfile} disabled={saving}>
            <Save size={14} /> {saving ? 'Saving...' : 'Save Profile'}
          </button>
        </div>

        <div className="card p-6 space-y-4">
          <h3 className="text-sm font-bold">Change Password</h3>
          <TextInput label="Current Password" type="password" value={pw.current} onChange={(e) => setPw((p) => ({ ...p, current: e.target.value }))} />
          <TextInput label="New Password" type="password" value={pw.next} onChange={(e) => setPw((p) => ({ ...p, next: e.target.value }))} />
          <TextInput label="Confirm New Password" type="password" value={pw.confirm} onChange={(e) => setPw((p) => ({ ...p, confirm: e.target.value }))} />
          <button type="button" className="btn-primary text-xs" onClick={changePassword} disabled={savingPw}>
            <Save size={14} /> {savingPw ? 'Updating...' : 'Update Password'}
          </button>
        </div>
      </div>
    </PageState>
  )
}
