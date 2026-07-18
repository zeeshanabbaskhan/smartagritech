import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  Plus, Search, Star, LayoutTemplate, Building2, User, Users, Clock, LayoutGrid, Cpu,
} from 'lucide-react'
import PageState, { useFetch } from '../../components/ui/PageState'
import NewDashboardModal from '../../components/dashboard-builder/NewDashboardModal'
import { useAuth } from '../../context/AuthContext'
import { useToast } from '../../context/ToastContext'
import emsApi, { list, one } from '../../api/emsApi'
import { mapDevice, mapOrganization } from '../../utils/mappers'
import { buildFromTemplate, mapDashboard } from '../../utils/customDashboardHelpers'

const ROLE_EMPTY_COPY = {
  admin: 'Build a fully customizable view for this organization — pick your widgets, chart types, and drill into buildings, floors, or departments.',
  org: "Build your own view or one to share with your organization's users.",
  user: 'Build your own personal dashboard, or view anything your organization shares with you.',
}

function timeAgo(iso) {
  if (!iso) return ''
  const diffMs = Date.now() - new Date(iso).getTime()
  const mins = Math.round(diffMs / 60000)
  if (mins < 1) return 'just now'
  if (mins < 60) return `${mins}m ago`
  const hrs = Math.round(mins / 60)
  if (hrs < 24) return `${hrs}h ago`
  return `${Math.round(hrs / 24)}d ago`
}

export default function DashboardList() {
  const navigate = useNavigate()
  const { user } = useAuth()
  const { showToast } = useToast()
  const isAdmin = user?.role === 'admin'
  const isManager = user?.role === 'admin' || user?.role === 'org'
  const basePath = `/${user?.role}/custom-dashboard`

  const [adminOrgId, setAdminOrgId] = useState('')
  const [query, setQuery] = useState('')
  const [filter, setFilter] = useState('all')
  const [newOpen, setNewOpen] = useState(false)
  const [creating, setCreating] = useState(false)

  const { data, loading, error, reload } = useFetch(async () => {
    let orgs = []
    if (isAdmin) {
      orgs = list(await emsApi.getOrganizations({ limit: 100 })).map(mapOrganization)
    }
    const orgId = isAdmin
      ? (adminOrgId || orgs[0]?.id)
      : user?.organizationId

    const params = orgId ? { organizationId: orgId, limit: 100 } : { limit: 100 }
    const [dashRes, devRes] = await Promise.all([
      emsApi.getCustomDashboards(params),
      orgId ? emsApi.getDevices({ organizationId: orgId, limit: 200 }) : emsApi.getDevices({ limit: 200 }),
    ])
    const devices = list(devRes).map(mapDevice)
    const deviceMap = Object.fromEntries(devices.map((d) => [d.id, d.name]))
    const dashboards = list(dashRes).map((d) => {
      const mapped = mapDashboard(d)
      if (mapped.targetDeviceId && deviceMap[mapped.targetDeviceId]) {
        mapped.targetDevice = deviceMap[mapped.targetDeviceId]
      }
      return mapped
    })
    const selectedOrg = orgs.find((o) => o.id === (adminOrgId || orgs[0]?.id))
      || { id: orgId, name: user?.organization?.name || 'Organization' }
    return {
      dashboards,
      devices,
      orgs,
      orgId: adminOrgId || orgs[0]?.id || orgId,
      orgName: selectedOrg?.name || user?.organization?.name || 'Organization',
    }
  }, [isAdmin, adminOrgId, user?.organizationId])

  const dashboards = data?.dashboards ?? []
  const devices = data?.devices ?? []
  const orgs = data?.orgs ?? []
  const orgKey = data?.orgName || 'Organization'
  const orgId = data?.orgId || user?.organizationId

  const filtered = useMemo(() => {
    let rows = dashboards
    if (filter === 'mine') rows = rows.filter((d) => d.ownerUserId === user?.id || d.ownerEmail === user?.email)
    if (filter === 'shared') rows = rows.filter((d) => d.ownerUserId !== user?.id && d.ownerEmail !== user?.email)
    if (filter === 'favorites') rows = rows.filter((d) => d.favorite)
    if (query.trim()) {
      const q = query.trim().toLowerCase()
      rows = rows.filter((d) => d.name.toLowerCase().includes(q) || (d.description || '').toLowerCase().includes(q))
    }
    return [...rows].sort(
      (a, b) => (b.favorite ? 1 : 0) - (a.favorite ? 1 : 0) || new Date(b.updatedAt) - new Date(a.updatedAt),
    )
  }, [dashboards, filter, query, user])

  function canEdit(dash) {
    if (!user || !dash) return false
    if (user.role === 'admin' || user.role === 'org') return true
    return dash.ownerUserId === user.id || dash.ownerEmail === user.email
  }

  async function handleCreate(templateId, name, targetDeviceId) {
    if (!orgId && isAdmin) {
      showToast('Select an organization first', 'error')
      return
    }
    setCreating(true)
    try {
      const body = {
        ...buildFromTemplate(templateId, name, targetDeviceId),
        organizationId: orgId,
      }
      const res = await emsApi.createCustomDashboard(body)
      const created = one(res)
      showToast('Dashboard created', 'success')
      navigate(`${basePath}/${created.id}?edit=1`)
    } catch (e) {
      showToast(e.message || 'Create failed', 'error')
    } finally {
      setCreating(false)
    }
  }

  async function toggleFavorite(e, dash) {
    e.stopPropagation()
    try {
      await emsApi.updateCustomDashboard(dash.id, {
        context: { ...dash.context, favorite: !dash.favorite },
      })
      reload()
    } catch (err) {
      showToast(err.message || 'Update failed', 'error')
    }
  }

  const selectedOrgId = adminOrgId || orgs[0]?.id || ''

  return (
    <PageState loading={loading || creating} error={error} onRetry={reload}>
      <div className="space-y-4">
        {isAdmin && (
          <div className="card p-3 flex items-center gap-2.5 bg-surface-900 border-none">
            <Building2 size={14} className="text-primary-500" />
            <span className="text-xs font-bold text-white uppercase tracking-wide">Managing Org:</span>
            <select
              className="select text-xs py-1.5 px-2 w-auto bg-surface-800 text-white border-surface-700"
              value={selectedOrgId}
              onChange={(e) => setAdminOrgId(e.target.value)}
            >
              {orgs.map((o) => (
                <option key={o.id} value={o.id}>{o.name}</option>
              ))}
            </select>
          </div>
        )}

        <div className="page-header">
          <div>
            <h2 className="page-title flex items-center gap-2">
              <LayoutGrid size={18} className="text-primary-600" /> Custom Dashboards
            </h2>
            <p className="breadcrumb">
              {isManager
                ? <>Build dashboards for <span className="font-semibold text-surface-600">{orgKey}</span></>
                : 'Build personal dashboards or view shared ones'}
            </p>
          </div>
          <button type="button" className="btn-primary" onClick={() => setNewOpen(true)}>
            <Plus size={15} /> New Dashboard
          </button>
        </div>

        <div className="card p-3 flex flex-wrap items-center gap-2.5">
          <div className="relative flex-1 min-w-[14rem]">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-surface-400" />
            <input
              className="input pl-8 text-xs py-2"
              placeholder="Search dashboards..."
              value={query}
              onChange={(e) => setQuery(e.target.value)}
            />
          </div>
          <div className="flex items-center gap-1.5 flex-wrap">
            {[
              { key: 'all', label: 'All' },
              { key: 'mine', label: 'My Dashboards' },
              { key: 'shared', label: 'Shared with me' },
              { key: 'favorites', label: 'Favorites' },
            ].map((f) => (
              <button
                key={f.key}
                type="button"
                onClick={() => setFilter(f.key)}
                className={`px-3 py-1.5 rounded-full text-xs font-bold transition-colors ${
                  filter === f.key ? 'bg-primary-500 text-white' : 'bg-surface-100 text-surface-600 hover:bg-surface-200'
                }`}
              >
                {f.label}
              </button>
            ))}
          </div>
        </div>

        {filtered.length === 0 && (
          <div className="card flex flex-col items-center justify-center py-24 text-center border-dashed">
            <LayoutTemplate size={32} className="text-surface-300 mb-3" />
            <p className="text-sm font-bold text-surface-700">
              {dashboards.length === 0 ? 'No custom dashboards yet' : 'No dashboards match your search'}
            </p>
            {dashboards.length === 0 && (
              <>
                <p className="text-xs text-surface-400 mt-1 mb-4 max-w-sm">
                  {ROLE_EMPTY_COPY[user?.role] || ROLE_EMPTY_COPY.user}
                </p>
                <button type="button" className="btn-primary text-sm" onClick={() => setNewOpen(true)}>
                  <Plus size={15} /> Create Your First Dashboard
                </button>
              </>
            )}
          </div>
        )}

        {filtered.length > 0 && (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {filtered.map((d) => {
              const ownIt = canEdit(d)
              return (
                <button
                  key={d.id}
                  type="button"
                  onClick={() => navigate(`${basePath}/${d.id}`)}
                  className="card p-4 text-left hover:border-primary-300 hover:shadow-floating transition-all group relative"
                >
                  <div className="flex items-start justify-between gap-2 mb-2">
                    <h3 className="text-sm font-bold text-surface-900 leading-tight pr-6">{d.name}</h3>
                    <span
                      role="button"
                      tabIndex={0}
                      onClick={(e) => toggleFavorite(e, d)}
                      onKeyDown={(e) => e.key === 'Enter' && toggleFavorite(e, d)}
                      className="absolute top-3.5 right-3.5 text-surface-300 hover:text-primary-500"
                    >
                      <Star size={16} className={d.favorite ? 'fill-primary-500 text-primary-500' : ''} />
                    </span>
                  </div>
                  <p className="text-xs text-surface-500 leading-relaxed line-clamp-2 min-h-[2.2em]">
                    {d.description || 'No description'}
                  </p>
                  <div className="flex items-center gap-2 mt-3 flex-wrap">
                    <span className={`badge ${ownIt ? 'badge-info' : 'badge-neutral'} flex items-center gap-1`}>
                      {ownIt ? <User size={10} /> : <Users size={10} />} {ownIt ? 'Yours' : 'Shared'}
                    </span>
                    <span className="badge badge-neutral flex items-center gap-1">
                      <Cpu size={10} /> {d.targetDevice || 'All Devices'}
                    </span>
                    {d.visibility === 'shared' && ownIt && (
                      <span className="badge badge-success flex items-center gap-1">
                        <Users size={10} /> Shared with org
                      </span>
                    )}
                    <span className="text-[10px] text-surface-400 font-semibold flex items-center gap-1 ml-auto">
                      <Clock size={10} /> {timeAgo(d.updatedAt)}
                    </span>
                  </div>
                  <p className="text-[10px] text-surface-400 font-semibold mt-2">
                    {(d.widgets?.length || 0)} widget{(d.widgets?.length || 0) !== 1 ? 's' : ''}
                  </p>
                </button>
              )
            })}
          </div>
        )}

        <NewDashboardModal
          open={newOpen}
          onClose={() => setNewOpen(false)}
          onCreate={handleCreate}
          devices={devices}
        />
      </div>
    </PageState>
  )
}
