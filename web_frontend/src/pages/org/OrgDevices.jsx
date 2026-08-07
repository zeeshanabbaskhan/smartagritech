import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import DataTable from '../../components/ui/DataTable'
import PageState, { useFetch } from '../../components/ui/PageState'
import { TextInput, SelectInput } from '../../components/ui/FormFields'
import { Eye, BarChart2, ChevronDown, ChevronUp } from 'lucide-react'
import emsApi, { list } from '../../api/emsApi'
import { mapDevice, mapGateway } from '../../utils/mappers'
import {
  DEVICE_STATUS_OPTIONS,
  deviceStatusBadgeClass,
  matchesDeviceStatus,
  matchesDeviceDates,
} from '../../utils/deviceFilters'

export default function OrgDevices() {
  const navigate = useNavigate()
  const { data, loading, error, reload } = useFetch(async () => {
    const [devicesRes, gatewaysRes] = await Promise.all([
      emsApi.getDevices({ limit: 100 }),
      emsApi.getGateways({ limit: 100 }),
    ])
    return {
      rows: list(devicesRes).map(mapDevice),
      gateways: list(gatewaysRes).map(mapGateway),
    }
  }, [])

  const rows = data?.rows ?? []
  const [statusFilter, setStatusFilter] = useState('')
  const [gatewayFilter, setGatewayFilter] = useState('')
  const [createdFrom, setCreatedFrom] = useState('')
  const [createdTo, setCreatedTo] = useState('')
  const [modifiedFrom, setModifiedFrom] = useState('')
  const [modifiedTo, setModifiedTo] = useState('')
  const [nameQuery, setNameQuery] = useState('')
  const [showMoreFilters, setShowMoreFilters] = useState(false)
  const [applied, setApplied] = useState({
    status: '', gateway: '', name: '',
    createdFrom: '', createdTo: '', modifiedFrom: '', modifiedTo: '',
  })

  const filtered = rows.filter((r) =>
    matchesDeviceStatus(r, applied.status) &&
    (!applied.gateway || r.gateway === applied.gateway || r.gatewayId === applied.gateway) &&
    matchesDeviceDates(r, applied.createdFrom, applied.createdTo, applied.modifiedFrom, applied.modifiedTo) &&
    (!applied.name || String(r.name ?? '').toLowerCase().includes(applied.name.toLowerCase()))
  )

  const totalCount = rows.length
  const onlineCount = rows.filter((d) => d.status === 'Online').length
  const offlineCount = rows.filter((d) => d.status === 'Offline').length

  const gatewayOptions = [...new Set(rows.map((r) => r.gateway).filter(Boolean))]

  const handleQuery = () => setApplied({
    status: statusFilter,
    gateway: gatewayFilter,
    name: nameQuery,
    createdFrom,
    createdTo,
    modifiedFrom,
    modifiedTo,
  })

  const hasActiveDateFilters = !!(applied.createdFrom || applied.createdTo || applied.modifiedFrom || applied.modifiedTo)

  const columns = [
    { key: 'status', label: 'Device Status', render: (v) => <span className={`badge ${deviceStatusBadgeClass(v)}`}>{v}</span> },
    { key: 'name', label: 'Device Name' },
    { key: 'gateway', label: 'Gateway' },
    { key: 'template', label: 'Template', render: (v) => <span className="text-xs text-surface-400 truncate max-w-xs block">{v}</span> },
    { key: 'switchOn', label: 'Switch', render: (v) => <span className={`badge ${v ? 'badge-success' : 'badge-neutral'}`}>{v ? 'On' : 'Off'}</span> },
  ]

  return (
    <PageState loading={loading} error={error} onRetry={reload}>
      <div>
        <div className="page-header">
          <div>
            <h2 className="page-title">My Devices</h2>
            <p className="breadcrumb">Organization / Devices</p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-4 mb-4 text-xs">
          <span className="text-surface-600">Total Devices <strong className="text-surface-900 dark:text-surface-100">{totalCount}</strong></span>
          <span className="text-surface-600 flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-success-600 inline-block" /> Online <strong className="text-surface-900 dark:text-surface-100">{onlineCount}</strong>
          </span>
          <span className="text-surface-600 flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-surface-400 inline-block" /> Offline <strong className="text-surface-900 dark:text-surface-100">{offlineCount}</strong>
          </span>
        </div>

        <div className="card p-4 mb-4">
          <div className="flex flex-wrap items-end gap-3">
            <TextInput
              label="Device Name"
              className="flex-1 min-w-48"
              value={nameQuery}
              onChange={(e) => setNameQuery(e.target.value)}
              placeholder="Search by name…"
            />
            <SelectInput
              label="Gateway"
              className="w-44"
              value={gatewayFilter}
              onChange={(e) => setGatewayFilter(e.target.value)}
              options={gatewayOptions}
              placeholder="All"
            />
            <SelectInput
              label="Status"
              className="w-40"
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              options={DEVICE_STATUS_OPTIONS}
              placeholder="All status"
            />
            <button
              type="button"
              className="btn-secondary"
              onClick={() => setShowMoreFilters((v) => !v)}
              aria-expanded={showMoreFilters}
            >
              {showMoreFilters ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
              More filters
              {hasActiveDateFilters && !showMoreFilters && (
                <span className="ml-1 w-1.5 h-1.5 rounded-full bg-primary-500 inline-block" />
              )}
            </button>
            <button type="button" className="btn-primary" onClick={handleQuery}>
              Query
            </button>
          </div>

          {showMoreFilters && (
            <div className="flex flex-wrap items-end gap-3 mt-3 pt-3 border-t border-surface-200 dark:border-surface-700">
              <div className="w-56">
                <label className="label">Create Time</label>
                <div className="flex items-center gap-1.5">
                  <input type="date" className="input text-xs" value={createdFrom} onChange={(e) => setCreatedFrom(e.target.value)} />
                  <span className="text-surface-400 text-xs">-</span>
                  <input type="date" className="input text-xs" value={createdTo} onChange={(e) => setCreatedTo(e.target.value)} />
                </div>
              </div>
              <div className="w-56">
                <label className="label">Modify Time</label>
                <div className="flex items-center gap-1.5">
                  <input type="date" className="input text-xs" value={modifiedFrom} onChange={(e) => setModifiedFrom(e.target.value)} />
                  <span className="text-surface-400 text-xs">-</span>
                  <input type="date" className="input text-xs" value={modifiedTo} onChange={(e) => setModifiedTo(e.target.value)} />
                </div>
              </div>
            </div>
          )}
        </div>

        <DataTable
          columns={columns}
          data={filtered}
          searchPlaceholder="Search devices..."
          actions={(row) => (
            <>
              <button type="button" className="btn-ghost p-1.5" onClick={() => navigate(`/org/devices/${row.id}`)} title="Open device"><Eye size={14} /></button>
              <button type="button" className="btn-ghost p-1.5 text-primary-600" onClick={() => navigate('/org/sensor-history')} title="Sensor History"><BarChart2 size={14} /></button>
            </>
          )}
        />
      </div>
    </PageState>
  )
}
