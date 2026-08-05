import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import DataTable from '../../components/ui/DataTable'
import PageState, { useFetch } from '../../components/ui/PageState'
import { TextInput, SelectInput } from '../../components/ui/FormFields'
import { Eye, BarChart2 } from 'lucide-react'
import emsApi, { list } from '../../api/emsApi'
import { mapDevice, mapGateway } from '../../utils/mappers'

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
  const [nameQuery, setNameQuery] = useState('')
  const [applied, setApplied] = useState({ status: '', gateway: '', name: '' })

  const filtered = rows.filter((r) =>
    (!applied.status || r.status === applied.status) &&
    (!applied.gateway || r.gateway === applied.gateway || r.gatewayId === applied.gateway) &&
    (!applied.name || String(r.name ?? '').toLowerCase().includes(applied.name.toLowerCase()))
  )

  const totalCount = rows.length
  const onlineCount = rows.filter((d) => d.status === 'Online').length
  const offlineCount = totalCount - onlineCount

  const gatewayOptions = [...new Set(rows.map((r) => r.gateway).filter(Boolean))]

  const columns = [
    { key: 'status', label: 'Device Status', render: (v) => <span className={`badge ${v === 'Online' ? 'badge-success' : 'badge-danger'}`}>{v}</span> },
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
            <SelectInput
              label="Status"
              className="w-36"
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              options={['Online', 'Offline']}
              placeholder="All"
            />
            <SelectInput
              label="Gateway"
              className="w-44"
              value={gatewayFilter}
              onChange={(e) => setGatewayFilter(e.target.value)}
              options={gatewayOptions}
              placeholder="All"
            />
            <TextInput
              label="Device Name"
              className="w-44"
              value={nameQuery}
              onChange={(e) => setNameQuery(e.target.value)}
              placeholder="Search…"
            />
            <button
              type="button"
              className="btn-primary"
              onClick={() => setApplied({ status: statusFilter, gateway: gatewayFilter, name: nameQuery })}
            >
              Query
            </button>
          </div>
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
