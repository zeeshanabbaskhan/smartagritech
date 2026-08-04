import { useNavigate } from 'react-router-dom'
import DataTable from '../../components/ui/DataTable'
import PageState, { useFetch } from '../../components/ui/PageState'
import { Eye, BarChart2 } from 'lucide-react'
import emsApi, { list } from '../../api/emsApi'
import { mapDevice, mapGateway, mapDeviceTemplate } from '../../utils/mappers'

export default function OrgDevices() {
  const navigate = useNavigate()
  const { data, loading, error, reload } = useFetch(async () => {
    const [devicesRes, gatewaysRes, templatesRes] = await Promise.all([
      emsApi.getDevices({ limit: 100 }),
      emsApi.getGateways({ limit: 100 }),
      emsApi.getDeviceTemplates({ limit: 100 }),
    ])
    return {
      rows: list(devicesRes).map(mapDevice),
      gateways: list(gatewaysRes).map(mapGateway),
      templates: list(templatesRes).map(mapDeviceTemplate),
    }
  }, [])

  const rows = data?.rows ?? []

  const columns = [
    { key: 'name', label: 'Device Name' },
    { key: 'gateway', label: 'Gateway' },
    { key: 'template', label: 'Template', render: (v) => <span className="text-xs text-surface-400 truncate max-w-xs block">{v}</span> },
    { key: 'status', label: 'Status', render: (v) => <span className={`badge ${v === 'Online' ? 'badge-success' : 'badge-danger'}`}>{v}</span> },
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

        <DataTable
          columns={columns}
          data={rows}
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
