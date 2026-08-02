import { useState } from 'react'
import { RefreshCw } from 'lucide-react'
import PageState, { useFetch } from '../../components/ui/PageState'
import emsApi, { list } from '../../api/emsApi'
import { mapOrganization, mapDevice } from '../../utils/mappers'
import { useToast } from '../../context/ToastContext'

const METRIC_LABELS = {
  totalPowerConsumption: 'Active Power',
  totalExportPower: 'Export Power',
  voltageImbalance: 'Voltage Imbalance',
  currentImbalance: 'Current Imbalance',
  powerFactor: 'Power Factor',
  thdV: 'THD Voltage',
  thdI: 'THD Current',
  frequency: 'Frequency',
}

const METRIC_UNITS = {
  totalPowerConsumption: 'kWh',
  totalExportPower: 'kWh',
  voltageImbalance: '%',
  currentImbalance: '%',
  powerFactor: '',
  thdV: '%',
  thdI: '%',
  frequency: 'Hz',
}

function summaryToRows(summary, timestamp) {
  if (!summary) return []
  return Object.entries(METRIC_LABELS).map(([key, label], idx) => ({
    id: idx + 1,
    variable: label,
    value: summary[key]?.value != null ? String(summary[key].value) : '—',
    unit: METRIC_UNITS[key] ?? '',
    time: timestamp ? new Date(timestamp).toLocaleString() : '—',
  }))
}

function latestToRows(latest, timestamp, idOffset = 0) {
  return Object.entries(latest || {}).map(([name, info], idx) => ({
    id: idOffset + idx + 1,
    variable: name,
    value: info?.value != null ? String(info.value) : '—',
    unit: info?.unit ?? '',
    time: info?.lastUpdatedAt ? new Date(info.lastUpdatedAt).toLocaleString() : new Date(timestamp).toLocaleString(),
  }))
}

async function fetchDeviceLiveRows(deviceId) {
  const [summaryRes, latestRes] = await Promise.all([
    emsApi.getDashboardSummary({ deviceId, timeRange: '24h' }).catch(() => null),
    emsApi.getLatestReadings({ deviceId }).catch(() => null),
  ])
  const timestamp = latestRes?.timestamp ?? new Date().toISOString()
  const latest = latestRes?.data ?? {}
  const latestRows = latestToRows(latest, timestamp)
  if (latestRows.length) return latestRows
  return summaryToRows(summaryRes?.data ?? {}, timestamp)
}

export default function AdminDataCenter() {
  const { showToast } = useToast()
  const { data: filters, loading: filtersLoading, error: filtersError, reload: reloadFilters } = useFetch(async () => {
    const [orgsRes, devicesRes] = await Promise.all([
      emsApi.getOrganizations({ limit: 100 }),
      emsApi.getDevices({ limit: 100 }),
    ])
    return {
      organizations: list(orgsRes).map(mapOrganization),
      devices: list(devicesRes).map(mapDevice),
    }
  }, [])

  const [orgFilter, setOrgFilter] = useState('')
  const [deviceFilter, setDeviceFilter] = useState('')
  const [liveData, setLiveData] = useState([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)

  const filteredDevices = orgFilter
    ? (filters?.devices ?? []).filter((d) => d.organizationId === orgFilter)
    : (filters?.devices ?? [])

  const selectedDeviceName = filteredDevices.find((d) => d.id === deviceFilter)?.name
  const scopeLabel = selectedDeviceName
    || (orgFilter
      ? `All devices in ${(filters?.organizations ?? []).find((o) => o.id === orgFilter)?.name || 'org'}`
      : 'All devices')

  const handleRefresh = async () => {
    const targets = deviceFilter
      ? filteredDevices.filter((d) => d.id === deviceFilter)
      : filteredDevices

    if (!targets.length) {
      showToast(orgFilter ? 'No devices found for this organization' : 'No devices available', 'warning')
      return
    }

    setLoading(true)
    setError(null)
    try {
      if (targets.length === 1) {
        const rows = await fetchDeviceLiveRows(targets[0].id)
        setLiveData(rows)
      } else {
        // API requires deviceId; fan-out across devices when "All Devices" is selected.
        const batches = await Promise.all(targets.map(async (d) => {
          try {
            const rows = await fetchDeviceLiveRows(d.id)
            return rows.map((r) => ({ ...r, variable: `${d.name} · ${r.variable}` }))
          } catch {
            return []
          }
        }))
        const merged = batches.flat().map((r, idx) => ({ ...r, id: idx + 1 }))
        setLiveData(merged)
        if (!merged.length) showToast('No live readings returned for selected devices', 'warning')
      }
    } catch (e) {
      setError(e.message || 'Failed to load live data')
    } finally {
      setLoading(false)
    }
  }

  return (
    <PageState loading={filtersLoading} error={filtersError} onRetry={reloadFilters}>
      <div>
        <div className="page-header">
          <div>
            <h2 className="page-title">Data Center</h2>
            <p className="breadcrumb">Admin / Data Center</p>
          </div>
          <button type="button" className="btn-secondary" onClick={handleRefresh} disabled={loading}>
            <RefreshCw size={14} className={loading ? 'animate-spin' : ''} /> Refresh
          </button>
        </div>

        <div className="card p-4 mb-5 flex flex-wrap gap-4">
          <div className="flex-1 min-w-40">
            <label className="label">Select Organization</label>
            <select className="select" value={orgFilter} onChange={(e) => { setOrgFilter(e.target.value); setDeviceFilter('') }}>
              <option value="">All Organizations</option>
              {(filters?.organizations ?? []).map((o) => <option key={o.id} value={o.id}>{o.name}</option>)}
            </select>
          </div>
          <div className="flex-1 min-w-40">
            <label className="label">Select Device</label>
            <select className="select" value={deviceFilter} onChange={(e) => setDeviceFilter(e.target.value)}>
              <option value="">All Devices</option>
              {filteredDevices.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}
            </select>
          </div>
        </div>

        {error && <div className="card p-4 mb-5 text-sm text-danger-600">{error}</div>}

        <div className="table-container">
          <div className="p-4 border-b border-surface-200 flex items-center justify-between">
            <p className="text-xs text-surface-500">
              Live readings — {scopeLabel}
            </p>
            <span className="badge badge-success">● Live</span>
          </div>
          <div className="overflow-x-auto">
            <table className="data-table">
              <thead>
                <tr>
                  <th className="w-10">#</th>
                  <th>Variable Name</th>
                  <th>Value</th>
                  <th>Unit</th>
                  <th>Timestamp</th>
                </tr>
              </thead>
              <tbody>
                {liveData.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="text-center text-surface-400 text-sm py-8">
                      Click Refresh to load live readings{deviceFilter ? '' : ' for all devices'}.
                    </td>
                  </tr>
                ) : (
                  liveData.map((row, idx) => (
                    <tr key={row.id}>
                      <td className="text-surface-500 font-mono text-xs">{idx + 1}</td>
                      <td className="font-medium text-surface-800">{row.variable}</td>
                      <td className="font-mono text-primary-600 font-semibold">{row.value}</td>
                      <td className="text-surface-400 text-xs">{row.unit || '—'}</td>
                      <td className="text-surface-500 text-xs font-mono">{row.time}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </PageState>
  )
}
