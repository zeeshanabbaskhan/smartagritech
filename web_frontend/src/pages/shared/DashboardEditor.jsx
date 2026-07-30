import { useState, useEffect, lazy, Suspense, useCallback } from 'react'
import { useParams, useNavigate, useSearchParams } from 'react-router-dom'
import { Plus } from 'lucide-react'
import PageState, { useFetch } from '../../components/ui/PageState'
import DashboardToolbar from '../../components/dashboard-builder/DashboardToolbar'
import ContextFilterBar from '../../components/dashboard-builder/ContextFilterBar'
import AddWidgetModal from '../../components/dashboard-builder/AddWidgetModal'
import WidgetSettingsModal from '../../components/dashboard-builder/WidgetSettingsModal'
import { useAuth } from '../../context/AuthContext'
import { useToast } from '../../context/ToastContext'
import emsApi, { list, one } from '../../api/emsApi'
import { mapDevice, mapOrganization } from '../../utils/mappers'
import { mapTreeFromApi, scopeLabel } from '../../data/facilitiesHierarchy'
import { mapDashboard, makeWidget, toApiVisibility, toggleFavoriteContext } from '../../utils/customDashboardHelpers'

const GridCanvas = lazy(() => import('../../components/dashboard-builder/GridCanvas'))

function GridCanvasSkeleton() {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
      {[0, 1, 2].map((i) => <div key={i} className="card h-48 animate-pulse bg-surface-100" />)}
    </div>
  )
}

export default function DashboardEditor() {
  const { id } = useParams()
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const { user } = useAuth()
  const { showToast } = useToast()
  const basePath = `/${user?.role}/custom-dashboard`
  const isAdmin = user?.role === 'admin'
  const isManager = user?.role === 'admin' || user?.role === 'org'

  const [editing, setEditing] = useState(searchParams.get('edit') === '1')
  const [addOpen, setAddOpen] = useState(false)
  const [settingsWidget, setSettingsWidget] = useState(null)
  const [localDash, setLocalDash] = useState(null)

  const { data, loading, error, reload } = useFetch(async () => {
    const res = await emsApi.getCustomDashboard(id)
    const mapped = mapDashboard(one(res), user?.id)
    const orgId = mapped.organizationId || user?.organizationId

    const [orgsRes, facRes, devRes] = await Promise.all([
      isAdmin ? emsApi.getOrganizations({ limit: 100 }) : Promise.resolve({ data: [] }),
      orgId ? emsApi.getFacilityTree({ organizationId: orgId }).catch(() => ({ data: [] })) : Promise.resolve({ data: [] }),
      orgId ? emsApi.getDevices({ organizationId: orgId, limit: 200 }) : emsApi.getDevices({ limit: 200 }),
    ])

    const orgs = list(orgsRes).map(mapOrganization)
    const devices = list(devRes).map(mapDevice)
    const deviceMap = Object.fromEntries(devices.map((d) => [d.id, d.name]))
    if (mapped.targetDeviceId && deviceMap[mapped.targetDeviceId]) {
      mapped.targetDevice = deviceMap[mapped.targetDeviceId]
    }

    const tree = mapTreeFromApi(Array.isArray(facRes?.data) ? facRes.data : [])
    const orgName = orgs.find((o) => o.id === orgId)?.name
      || user?.organization?.name
      || 'Organization'

    return {
      dashboard: mapped,
      hierarchy: { orgName, tree },
      devices,
      orgs,
      orgId,
    }
  }, [id, isAdmin, user?.organizationId])

  useEffect(() => {
    if (data?.dashboard) setLocalDash(data.dashboard)
  }, [data])

  useEffect(() => {
    if (!loading && error) {
      const t = setTimeout(() => navigate(basePath, { replace: true }), 1500)
      return () => clearTimeout(t)
    }
  }, [loading, error, navigate, basePath])

  const dashboard = localDash
  const hierarchy = data?.hierarchy || { orgName: 'Organization', tree: [] }
  const devices = data?.devices || []
  const orgs = data?.orgs || []

  const persist = useCallback(async (patch) => {
    if (!dashboard) return
    try {
      const body = { ...patch }
      if (body.visibility) body.visibility = toApiVisibility(body.visibility)
      const res = await emsApi.updateCustomDashboard(dashboard.id, body)
      const mapped = mapDashboard(one(res), user?.id)
      if (mapped.targetDeviceId) {
        const d = devices.find((x) => x.id === mapped.targetDeviceId)
        if (d) mapped.targetDevice = d.name
      }
      setLocalDash(mapped)
    } catch (e) {
      showToast(e.message || 'Save failed', 'error')
    }
  }, [dashboard, devices, showToast, user?.id])

  const canEditDash = (dash) => {
    if (!user || !dash) return false
    if (user.role === 'admin' || user.role === 'org') return true
    return dash.ownerUserId === user.id
  }

  if (loading) return <PageState loading />
  if (error || !dashboard) {
    return <PageState error={error || 'Dashboard not found'} onRetry={reload} />
  }

  const ownIt = canEditDash(dashboard)
  const effectiveContext = {
    ...dashboard.context,
    targetDevice: dashboard.targetDevice,
    targetDeviceId: dashboard.targetDeviceId,
  }

  async function handleDelete() {
    if (!confirm('Delete this dashboard? This cannot be undone.')) return
    try {
      await emsApi.deleteCustomDashboard(dashboard.id)
      showToast('Dashboard deleted', 'success')
      navigate(basePath)
    } catch (e) {
      showToast(e.message || 'Delete failed', 'error')
    }
  }

  async function handleDuplicate(asOwnerCopy = false) {
    try {
      // When making a copy of a dashboard shared by someone else, scope the new
      // dashboard to the current user's own organization (backend assigns
      // ownership to the creator). A plain copy keeps the source org.
      const ownOrgId = user?.organizationId || data.orgId
      const organizationId = asOwnerCopy
        ? (ownOrgId || dashboard.organizationId || data.orgId)
        : (dashboard.organizationId || data.orgId)
      const res = await emsApi.createCustomDashboard({
        name: `${dashboard.name} (Copy)`,
        description: dashboard.description,
        visibility: 'PRIVATE',
        context: toggleFavoriteContext(
          { ...dashboard.context, favorites: {} },
          user?.id,
          false,
        ),
        layout: dashboard.layout,
        widgets: dashboard.widgets,
        targetDeviceId: dashboard.targetDeviceId,
        organizationId,
      })
      showToast(asOwnerCopy ? 'Copied to your dashboards' : 'Dashboard duplicated', 'success')
      navigate(`${basePath}/${one(res).id}`)
    } catch (e) {
      showToast(e.message || 'Duplicate failed', 'error')
    }
  }

  function handleExport() {
    const blob = new Blob([JSON.stringify(dashboard, null, 2)], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `${dashboard.name.replace(/\s+/g, '_')}.json`
    a.click()
    URL.revokeObjectURL(url)
  }

  async function handleImport(json) {
    try {
      const res = await emsApi.createCustomDashboard({
        name: json.name || 'Imported Dashboard',
        description: json.description || '',
        visibility: 'PRIVATE',
        context: json.context || {},
        layout: json.layout || [],
        widgets: json.widgets || [],
        targetDeviceId: json.targetDeviceId || null,
        organizationId: dashboard.organizationId || data.orgId,
      })
      navigate(`${basePath}/${one(res).id}`)
    } catch (e) {
      showToast(e.message || 'Import failed', 'error')
    }
  }

  async function handleAddWidget(partial) {
    const widget = makeWidget(partial)
    const widgets = [...dashboard.widgets, widget]
    const layout = [
      ...dashboard.layout,
      { i: widget.id, x: 0, y: Infinity, w: widget.w, h: widget.h, minW: 2, minH: 4 },
    ]
    setLocalDash((d) => ({ ...d, widgets, layout }))
    await persist({ widgets, layout })
  }

  async function handleUpdateWidget(widgetId, patch) {
    const widgets = dashboard.widgets.map((w) => (w.id === widgetId ? { ...w, ...patch } : w))
    setLocalDash((d) => ({ ...d, widgets }))
    await persist({ widgets })
  }

  async function handleRemoveWidget(widgetId) {
    const widgets = dashboard.widgets.filter((w) => w.id !== widgetId)
    const layout = dashboard.layout.filter((l) => l.i !== widgetId)
    setLocalDash((d) => ({ ...d, widgets, layout }))
    await persist({ widgets, layout })
  }

  return (
    <div className="space-y-4">
      <DashboardToolbar
        dashboard={dashboard}
        basePath={basePath}
        editing={editing && ownIt}
        onToggleEdit={() => setEditing((e) => !e)}
        ownIt={ownIt}
        onRename={(name) => persist({ name })}
        onDuplicate={handleDuplicate}
        onDelete={handleDelete}
        onExport={handleExport}
        onImport={handleImport}
        onToggleShare={() => persist({
          visibility: dashboard.visibility === 'shared' ? 'private' : 'shared',
        })}
        onToggleFavorite={() => {
          if (!user?.id) return
          persist({
            context: toggleFavoriteContext(dashboard.context, user.id, !dashboard.favorite),
          })
        }}
        isManager={isManager}
      />

      <ContextFilterBar
        hierarchy={hierarchy}
        context={dashboard.context}
        onChange={(context) => {
          setLocalDash((d) => ({ ...d, context }))
          persist({ context })
        }}
        userRole={user?.role}
        organizations={orgs}
        selectedOrgId={dashboard.organizationId}
        onOrgChange={() => navigate(basePath)}
        devices={devices}
      />

      <div className="flex items-center justify-between">
        <p className="text-xs text-surface-400 font-semibold">
          Viewing: <span className="text-surface-700">{scopeLabel(hierarchy, dashboard.context)}</span>
        </p>
        {editing && ownIt && (
          <button type="button" className="btn-secondary text-xs py-2 px-3" onClick={() => setAddOpen(true)}>
            <Plus size={14} /> Add Widget
          </button>
        )}
      </div>

      <Suspense fallback={<GridCanvasSkeleton />}>
        <GridCanvas
          dashboard={dashboard}
          editing={editing && ownIt}
          orgName={hierarchy.orgName}
          hierarchy={hierarchy}
          dashboardContext={effectiveContext}
          onLayoutChange={(layout) => {
            setLocalDash((d) => ({ ...d, layout }))
            persist({ layout })
          }}
          onWidgetSettings={(w) => setSettingsWidget(w)}
          onWidgetRemove={handleRemoveWidget}
        />
      </Suspense>

      <AddWidgetModal
        open={addOpen}
        onClose={() => setAddOpen(false)}
        onAdd={handleAddWidget}
        devices={devices}
        dashboardDeviceId={dashboard.targetDeviceId}
      />

      <WidgetSettingsModal
        open={!!settingsWidget}
        onClose={() => setSettingsWidget(null)}
        widget={settingsWidget}
        hierarchy={hierarchy}
        devices={devices}
        dashboardDeviceId={dashboard.targetDeviceId}
        onSave={(patch) => handleUpdateWidget(settingsWidget.id, patch)}
      />
    </div>
  )
}
