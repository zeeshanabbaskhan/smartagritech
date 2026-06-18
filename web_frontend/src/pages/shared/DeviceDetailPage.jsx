import { useState, useEffect, useCallback } from 'react'
import { useParams, useNavigate, Link } from 'react-router-dom'
import { ArrowLeft, RefreshCw } from 'lucide-react'
import PageState from '../../components/ui/PageState'
import DataTable from '../../components/ui/DataTable'
import { SelectInput } from '../../components/ui/FormFields'
import { useAuth } from '../../context/AuthContext'
import { useToast } from '../../context/ToastContext'
import emsApi, { list, one } from '../../api/emsApi'
import { mapDevice, mapScheduledTask, mapUser } from '../../utils/mappers'
import { subscribeDevice } from '../../services/socketService'

const TABS = ['Overview', 'Metrics', 'Schedule', 'Users']

export default function DeviceDetailPage({ basePath }) {
  const { deviceId } = useParams()
  const navigate = useNavigate()
  const { user } = useAuth()
  const { showToast } = useToast()
  const canManage = user?.role === 'admin' || user?.role === 'org'
  const [tab, setTab] = useState('Overview')
  const [device, setDevice] = useState(null)
  const [summary, setSummary] = useState(null)
  const [latest, setLatest] = useState({})
  const [tasks, setTasks] = useState([])
  const [deviceUsers, setDeviceUsers] = useState([])
  const [orgUsers, setOrgUsers] = useState([])
  const [assignUserId, setAssignUserId] = useState('')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  const load = useCallback(async () => {
    if (!deviceId) return
    setLoading(true)
    setError(null)
    subscribeDevice(deviceId)
    try {
      const [devRes, summaryRes, latestRes, tasksRes, duRes, usersRes] = await Promise.all([
        emsApi.getDevice(deviceId),
        emsApi.getDashboardSummary({ deviceId, timeRange: '24h' }).catch(() => null),
        emsApi.getLatestReadings({ deviceId }).catch(() => null),
        emsApi.getScheduledTasks({ limit: 100 }).catch(() => ({ data: [] })),
        emsApi.getDeviceUsers(deviceId).catch(() => ({ data: [] })),
        canManage ? emsApi.getUsers({ limit: 100, role: 'USER' }).catch(() => ({ data: [] })) : Promise.resolve({ data: [] }),
      ])
      setDevice(mapDevice(one(devRes)))
      setSummary(summaryRes?.data ?? null)
      setLatest(one(latestRes) ?? {})
      setTasks(list(tasksRes).filter((t) => t.deviceId === deviceId).map(mapScheduledTask))
      setDeviceUsers(list(duRes).map((u) => mapUser(u)))
      setOrgUsers(list(usersRes).map((u) => mapUser(u)))
    } catch (e) {
      setError(e.message || 'Failed to load device')
    } finally {
      setLoading(false)
    }
  }, [deviceId, canManage])

  useEffect(() => { load() }, [load])

  const toggleSwitch = async () => {
    if (!device) return
    const action = device.switchOn ? 'OFF' : 'ON'
    try {
      await emsApi.switchDevice(device.id, action)
      showToast(`Switch ${action} command sent`, 'success')
      load()
    } catch (e) {
      showToast(e.message || 'Switch failed', 'error')
    }
  }

  const assignUser = async () => {
    if (!assignUserId) return
    try {
      await emsApi.assignDeviceUser(deviceId, assignUserId)
      showToast('User assigned', 'success')
      setAssignUserId('')
      load()
    } catch (e) {
      showToast(e.message || 'Assign failed', 'error')
    }
  }

  const removeUser = async (userId) => {
    if (!confirm('Remove user from this device?')) return
    try {
      await emsApi.removeDeviceUser(deviceId, userId)
      load()
    } catch (e) {
      showToast(e.message || 'Remove failed', 'error')
    }
  }

  const readings = Array.isArray(latest.readings) ? latest.readings : []

  return (
    <PageState loading={loading} error={error} onRetry={load}>
      {device && (
        <div className="space-y-6">
          <div className="flex items-start gap-4">
            <button type="button" className="btn-ghost p-2 mt-1" onClick={() => navigate(`${basePath}/devices`)}>
              <ArrowLeft size={18} />
            </button>
            <div className="flex-1">
              <div className="flex flex-wrap items-center gap-3">
                <h2 className="page-title">{device.name}</h2>
                <span className={`badge ${device.status === 'Online' ? 'badge-success' : 'badge-danger'}`}>{device.status}</span>
              </div>
              <p className="text-xs text-surface-500 mt-1">{device.gateway} · {device.template} · Last seen {device.lastSeen}</p>
            </div>
            <button type="button" className="btn-secondary text-xs" onClick={load}><RefreshCw size={14} /> Refresh</button>
          </div>

          <div className="flex gap-2 border-b border-surface-200 dark:border-surface-800 overflow-x-auto">
            {TABS.map((t) => (
              <button
                key={t}
                type="button"
                onClick={() => setTab(t)}
                className={`px-4 py-2 text-xs font-bold whitespace-nowrap border-b-2 -mb-px ${
                  tab === t ? 'border-primary-500 text-primary-600' : 'border-transparent text-surface-500'
                }`}
              >
                {t}
              </button>
            ))}
            <Link to={`${basePath}/sensor-history`} className="px-4 py-2 text-xs font-bold text-surface-500 hover:text-primary-600 ml-auto">
              Sensor History →
            </Link>
          </div>

          {tab === 'Overview' && (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <div className="card p-5 space-y-3">
                <h3 className="text-sm font-bold">Device Info</h3>
                {[['Organization', device.org], ['Gateway', device.gateway], ['Template', device.template], ['Status', device.status]].map(([l, v]) => (
                  <div key={l} className="flex justify-between text-xs">
                    <span className="text-surface-500">{l}</span>
                    <span className="font-medium">{v}</span>
                  </div>
                ))}
                {canManage && (
                  <div className="pt-3 border-t border-surface-200 flex items-center justify-between">
                    <span className="text-xs text-surface-500">Remote Switch</span>
                    <button type="button" className={`btn-${device.switchOn ? 'secondary' : 'primary'} text-xs`} onClick={toggleSwitch}>
                      Turn {device.switchOn ? 'Off' : 'On'}
                    </button>
                  </div>
                )}
              </div>
              <div className="card p-5">
                <h3 className="text-sm font-bold mb-3">KPIs (24h)</h3>
                <div className="grid grid-cols-2 gap-3">
                  {[
                    ['totalPowerConsumption', 'Consumption'],
                    ['powerFactor', 'Power Factor'],
                    ['voltageImbalance', 'V. Imbalance'],
                    ['currentImbalance', 'C. Imbalance'],
                  ].map(([k, label]) => (
                    <div key={k} className="bg-surface-50 dark:bg-surface-950 rounded-lg p-3">
                      <p className="text-[10px] text-surface-400 uppercase">{label}</p>
                      <p className="text-lg font-bold">{summary?.[k]?.value ?? '—'}</p>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {tab === 'Metrics' && (
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
              {readings.length ? readings.map((r) => (
                <div key={r.variableName} className="card p-4">
                  <p className="text-[10px] font-bold text-surface-400 uppercase">{r.variableName}</p>
                  <p className="text-lg font-bold mt-1">{r.value} <span className="text-xs text-surface-400">{r.unit}</span></p>
                </div>
              )) : (
                <div className="col-span-full card p-8 text-center text-sm text-surface-500">No live readings yet</div>
              )}
            </div>
          )}

          {tab === 'Schedule' && (
            <DataTable
              columns={[
                { key: 'variable', label: 'Variable' },
                { key: 'action', label: 'Action' },
                { key: 'schedule', label: 'Schedule' },
                { key: 'status', label: 'Status' },
              ]}
              data={tasks}
              searchPlaceholder="Search tasks..."
            />
          )}

          {tab === 'Users' && (
            <div className="space-y-4">
              {canManage && (
                <div className="card p-4 flex flex-wrap gap-3 items-end">
                  <div className="flex-1 min-w-[200px]">
                    <SelectInput
                      label="Assign user"
                      value={assignUserId}
                      onChange={(e) => setAssignUserId(e.target.value)}
                      options={[{ value: '', label: 'Select user' }, ...orgUsers.map((u) => ({ value: u.id, label: `${u.name} (${u.email})` }))]}
                    />
                  </div>
                  <button type="button" className="btn-primary text-xs" onClick={assignUser}>Assign</button>
                </div>
              )}
              <DataTable
                columns={[
                  { key: 'name', label: 'Name' },
                  { key: 'email', label: 'Email' },
                  { key: 'role', label: 'Role' },
                ]}
                data={deviceUsers}
                actions={canManage ? (row) => (
                  <button type="button" className="btn-danger text-xs px-2 py-1" onClick={() => removeUser(row.id)}>Remove</button>
                ) : undefined}
              />
            </div>
          )}
        </div>
      )}
    </PageState>
  )
}
