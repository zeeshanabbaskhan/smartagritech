import { useMemo, useState } from 'react'
import DataTable from '../../components/ui/DataTable'
import Modal from '../../components/ui/Modal'
import DataCenterFilterBar, { resolvePresetRange } from '../../components/ui/DataCenterFilterBar'
import PageState, { useFetch } from '../../components/ui/PageState'
import { Eye, CheckCircle, Download } from 'lucide-react'
import emsApi, { list } from '../../api/emsApi'
import { mapVariableAlarm, mapDevice, mapOrganization } from '../../utils/mappers'
import { useToast } from '../../context/ToastContext'
import { useAuth, ROLES } from '../../context/AuthContext'

const EMPTY = []
const defaultRange = resolvePresetRange('last30') || { from: '', to: '' }

export default function AdminVariableAlarms() {
  const { showToast } = useToast()
  const { user } = useAuth()
  const isAdmin = user?.role === ROLES.ADMIN

  const [organization, setOrganization] = useState('')
  const [deviceId, setDeviceId] = useState('')
  const [variableFilter, setVariableFilter] = useState('')
  const [alarmState, setAlarmState] = useState('')
  const [processState, setProcessState] = useState('')
  const [dateFrom, setDateFrom] = useState(defaultRange.from)
  const [dateTo, setDateTo] = useState(defaultRange.to)
  const [applied, setApplied] = useState({
    organizationId: '',
    deviceId: '',
    variable: '',
    alarmState: '',
    processState: '',
    dateFrom: defaultRange.from,
    dateTo: defaultRange.to,
  })

  const { data: meta, loading: metaLoading } = useFetch(async () => {
    const reqs = [emsApi.getDevices({ limit: 200 })]
    if (isAdmin) reqs.push(emsApi.getOrganizations({ limit: 100 }))
    const [devicesRes, orgsRes] = await Promise.all(reqs)
    return {
      devices: list(devicesRes).map(mapDevice),
      organizations: orgsRes ? list(orgsRes).map(mapOrganization) : [],
    }
  }, [isAdmin])

  const devices = meta?.devices ?? EMPTY
  const organizations = meta?.organizations ?? EMPTY

  const filteredDevices = useMemo(() => {
    if (!organization) return devices
    return devices.filter((d) => d.organizationId === organization)
  }, [devices, organization])

  const { data, loading, error, reload, setData } = useFetch(async () => {
    const params = { limit: 100 }
    if (applied.organizationId) params.organizationId = applied.organizationId
    if (applied.deviceId) params.deviceId = applied.deviceId
    if (applied.alarmState) params.alarmState = applied.alarmState
    if (applied.processState) params.processState = applied.processState
    if (applied.dateFrom) params.from = applied.dateFrom
    if (applied.dateTo) params.to = `${applied.dateTo}T23:59:59.999`
    const alarmsRes = await emsApi.getVariableAlarmHistory(params)
    const deviceMap = Object.fromEntries(devices.map((d) => [d.id, d.name]))
    return list(alarmsRes).map((a) => mapVariableAlarm(a, deviceMap[a.deviceId]))
  }, [
    applied.organizationId,
    applied.deviceId,
    applied.alarmState,
    applied.processState,
    applied.dateFrom,
    applied.dateTo,
    meta?.devices,
  ])

  const rows = data ?? []

  const [selected, setSelected] = useState(null)
  const [modal, setModal] = useState(null)
  const [selectedIds, setSelectedIds] = useState([])
  const [deleting, setDeleting] = useState(false)
  const [downloading, setDownloading] = useState(false)

  const variableOptions = useMemo(
    () => [...new Set(rows.map((r) => r.variable).filter(Boolean))].sort(),
    [rows],
  )

  const openView = (row) => { setSelected(row); setModal('view') }
  const close = () => { setModal(null); setSelected(null) }

  const markResolved = async (row) => {
    try {
      await emsApi.processVariableAlarm(row.id)
      setData((prev) => (prev ?? []).map((r) => (
        r.id === row.id
          ? { ...r, status: 'Resolved', alarmState: 'RESOLVED', processState: 'PROCESSED' }
          : r
      )))
      showToast('Alarm marked as resolved', 'success')
    } catch (e) {
      showToast(e.message || 'Failed to resolve alarm', 'error')
    }
  }

  const handleOrgChange = (orgId) => {
    setOrganization(orgId)
    setDeviceId('')
  }

  const handleQuery = () => {
    setApplied({
      organizationId: organization,
      deviceId,
      variable: variableFilter,
      alarmState,
      processState,
      dateFrom,
      dateTo,
    })
    setSelectedIds([])
  }

  // Variable name is refined client-side (API has no variableName filter)
  const filtered = rows.filter((r) => {
    if (applied.variable && r.variable !== applied.variable) return false
    return true
  })

  const buildDownloadParams = () => {
    const params = {}
    if (applied.organizationId) params.organizationId = applied.organizationId
    if (applied.deviceId) params.deviceId = applied.deviceId
    if (applied.alarmState) params.alarmState = applied.alarmState
    if (applied.processState) params.processState = applied.processState
    if (applied.dateFrom) params.from = applied.dateFrom
    if (applied.dateTo) params.to = `${applied.dateTo}T23:59:59.999`
    return params
  }

  const handleBatchDelete = async () => {
    if (!selectedIds.length) return
    if (!confirm(`Delete ${selectedIds.length} selected record(s)?`)) return
    setDeleting(true)
    try {
      await emsApi.batchDeleteVariableAlarms({ ids: selectedIds })
      showToast('Selected records deleted', 'success')
      setSelectedIds([])
      reload()
    } catch (e) {
      showToast(e.message || 'Batch delete failed', 'error')
    } finally {
      setDeleting(false)
    }
  }

  const handleDownload = async () => {
    setDownloading(true)
    try {
      await emsApi.downloadVariableAlarmCsv(buildDownloadParams())
      showToast('Download started', 'success')
    } catch (e) {
      showToast(e.message || 'Download failed', 'error')
    } finally {
      setDownloading(false)
    }
  }

  const columns = [
    { key: 'device', label: 'Device Name' },
    { key: 'triggerName', label: 'Trigger Name' },
    { key: 'type', label: 'Trigger Type', render: (v) => <span className={`badge ${String(v).toLowerCase().includes('high') ? 'badge-danger' : 'badge-warning'}`}>{v}</span> },
    { key: 'slave', label: 'Slave Name' },
    { key: 'variable', label: 'Variable' },
    { key: 'actual', label: 'Current Value', render: (v) => <span className="font-mono text-xs text-primary-600">{v}</span> },
    { key: 'threshold', label: 'Triggering Condition', render: (v) => <span className="font-mono text-xs">{v}</span> },
    { key: 'time', label: 'Alarm Time', render: (v) => <span className="text-xs text-surface-400">{v}</span> },
    {
      key: 'alarmState',
      label: 'Alarm State',
      render: (v) => {
        const active = v === 'ACTIVE' || v === 'Active'
        return <span className={`badge ${active ? 'badge-danger' : 'badge-success'}`}>{active ? 'Active' : 'Resolved'}</span>
      },
    },
    {
      key: 'processState',
      label: 'Process State',
      render: (v) => (
        <span className={`badge ${v === 'PROCESSED' ? 'badge-success' : 'badge-neutral'}`}>
          {v === 'PROCESSED' ? 'Processed' : 'Unprocessed'}
        </span>
      ),
    },
  ]

  return (
    <PageState loading={(loading || metaLoading) && !data} error={error} onRetry={reload}>
      <div>
        <div className="page-header">
          <div>
            <h2 className="page-title">Data Center</h2>
            <p className="breadcrumb">Data Center &ndash; Variable Alarm Record</p>
          </div>
          <div className="flex items-center gap-2">
            <button type="button" className="btn-primary" onClick={handleDownload} disabled={downloading}>
              <Download size={14} /> {downloading ? 'Downloading...' : 'Download Data'}
            </button>
            <button type="button" className="btn-secondary" onClick={handleBatchDelete} disabled={!selectedIds.length || deleting}>
              {deleting ? 'Deleting...' : 'Batch Delete'}
            </button>
          </div>
        </div>

        <DataCenterFilterBar
          showOrganization={isAdmin}
          organizations={organizations}
          organization={organization}
          onOrganizationChange={handleOrgChange}
          devices={filteredDevices}
          device={deviceId}
          onDeviceChange={setDeviceId}
          variableOptions={variableOptions}
          variable={variableFilter}
          onVariableChange={setVariableFilter}
          showStateFilters
          alarmState={alarmState}
          onAlarmStateChange={setAlarmState}
          processState={processState}
          onProcessStateChange={setProcessState}
          dateFrom={dateFrom}
          dateTo={dateTo}
          onDateRangeChange={(from, to) => { setDateFrom(from); setDateTo(to) }}
          onQuery={handleQuery}
        />

        <DataTable
          columns={columns}
          data={filtered}
          searchPlaceholder="Search alarms..."
          emptyMessage="No data available in table"
          selectable
          selectedIds={selectedIds}
          onSelectionChange={setSelectedIds}
          actions={(row) => (
            <>
              <button type="button" className="btn-ghost p-1.5" onClick={() => openView(row)} title="View"><Eye size={14} /></button>
              {(row.alarmState === 'ACTIVE' || row.processState !== 'PROCESSED') && (
                <button type="button" className="btn-ghost p-1.5 text-success-600" onClick={() => markResolved(row)} title="Mark Resolved">
                  <CheckCircle size={14} />
                </button>
              )}
            </>
          )}
        />

        <Modal open={modal === 'view'} onClose={close} title="Alarm Details">
          {selected && (
            <div className="space-y-3">
              {[
                ['Device', selected.device],
                ['Trigger', selected.triggerName],
                ['Type', selected.type],
                ['Slave', selected.slave],
                ['Variable', selected.variable],
                ['Current Value', selected.actual],
                ['Condition', selected.threshold],
                ['Alarm Time', selected.time],
                ['State', selected.alarmState === 'ACTIVE' ? 'Active' : 'Resolved'],
                ['Process', selected.processState === 'PROCESSED' ? 'Processed' : 'Unprocessed'],
              ].map(([label, value]) => (
                <div key={label} className="flex gap-4">
                  <span className="text-xs text-surface-500 w-28 flex-shrink-0">{label}</span>
                  <span className="text-xs text-surface-800">{value}</span>
                </div>
              ))}
            </div>
          )}
        </Modal>
      </div>
    </PageState>
  )
}
