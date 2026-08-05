import { useMemo, useState } from 'react'
import DataTable from '../../components/ui/DataTable'
import Modal from '../../components/ui/Modal'
import DataCenterFilterBar from '../../components/ui/DataCenterFilterBar'
import PageState, { useFetch } from '../../components/ui/PageState'
import { Eye, Download } from 'lucide-react'
import emsApi, { list } from '../../api/emsApi'
import { mapLinkageRecord, mapDevice } from '../../utils/mappers'
import { useToast } from '../../context/ToastContext'

const EMPTY = []

export default function AdminLinkageRecords() {
  const { showToast } = useToast()

  const [device, setDevice] = useState('')
  const [trigger, setTrigger] = useState('')
  const [variableFilter, setVariableFilter] = useState('')
  const [dateFrom, setDateFrom] = useState('')
  const [dateTo, setDateTo] = useState('')
  const [applied, setApplied] = useState({ deviceId: '', trigger: '', variable: '', dateFrom: '', dateTo: '' })

  const { data: devicesData, loading: devicesLoading } = useFetch(async () => {
    return list(await emsApi.getDevices({ limit: 200 })).map(mapDevice)
  }, [])
  const devices = devicesData ?? EMPTY

  const { data, loading, error, reload } = useFetch(async () => {
    const params = { limit: 200 }
    if (applied.deviceId) params.deviceId = applied.deviceId
    if (applied.dateFrom) params.from = applied.dateFrom
    if (applied.dateTo) params.to = applied.dateTo
    const recordsRes = await emsApi.getLinkageHistory(params)
    const deviceMap = Object.fromEntries(devices.map((d) => [d.id, d.name]))
    return list(recordsRes).map((r) => mapLinkageRecord(r, deviceMap[r.deviceId]))
  }, [applied.deviceId, applied.dateFrom, applied.dateTo, devicesData])

  const rows = data ?? []

  const [modal, setModal] = useState(null)
  const [selected, setSelected] = useState(null)
  const [selectedIds, setSelectedIds] = useState([])
  const [deleting, setDeleting] = useState(false)
  const [downloading, setDownloading] = useState(false)

  const triggerOptions = useMemo(() => [...new Set(rows.map((r) => r.triggerName).filter(Boolean))], [rows])
  const variableOptions = useMemo(() => [...new Set(rows.map((r) => r.watchedVariableName).filter(Boolean))], [rows])

  const openView = (row) => { setSelected(row); setModal('view') }
  const close = () => { setModal(null); setSelected(null) }

  const handleQuery = () => {
    const match = devices.find((d) => d.name === device)
    setApplied({
      deviceId: match?.id ?? '',
      trigger,
      variable: variableFilter,
      dateFrom,
      dateTo,
    })
    setSelectedIds([])
  }

  const filtered = rows.filter((r) => {
    if (applied.trigger && r.triggerName !== applied.trigger) return false
    if (applied.variable && r.watchedVariableName !== applied.variable) return false
    return true
  })

  const handleBatchDelete = async () => {
    if (!selectedIds.length) return
    if (!confirm(`Delete ${selectedIds.length} selected record(s)?`)) return
    setDeleting(true)
    try {
      await emsApi.batchDeleteLinkageHistory({ ids: selectedIds })
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
      const params = {}
      if (applied.deviceId) params.deviceId = applied.deviceId
      if (applied.dateFrom) params.from = applied.dateFrom
      if (applied.dateTo) params.to = applied.dateTo
      await emsApi.downloadLinkageCsv(params)
      showToast('Download started', 'success')
    } catch (e) {
      showToast(e.message || 'Download failed', 'error')
    } finally {
      setDownloading(false)
    }
  }

  const columns = [
    { key: 'srcDevice', label: 'Device Name' },
    { key: 'triggerName', label: 'Trigger Name' },
    { key: 'triggerType', label: 'Trigger Type', render: (v) => (
      <span className={`badge ${String(v).toLowerCase().includes('high') || String(v).toUpperCase() === 'ON' ? 'badge-danger' : 'badge-warning'}`}>{v}</span>
    ) },
    { key: 'slave', label: 'Slave Name' },
    { key: 'variable', label: 'Variable Name' },
    { key: 'condition', label: 'Triggering Condition', render: (v) => <span className="font-mono text-xs">{v}</span> },
    { key: 'triggerDevice', label: 'Trigger Device' },
    { key: 'createdAt', label: 'Linkage Time', render: (v) => <span className="text-xs text-surface-400">{v}</span> },
  ]

  return (
    <PageState loading={(loading || devicesLoading) && !data} error={error} onRetry={reload}>
      <div>
        <div className="page-header">
          <div>
            <h2 className="page-title">Data Center</h2>
            <p className="breadcrumb">Data Center &ndash; Linkage Record</p>
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
          devices={devices.map((d) => d.name)}
          device={device} onDeviceChange={setDevice}
          triggerOptions={triggerOptions}
          trigger={trigger} onTriggerChange={setTrigger}
          variableOptions={variableOptions}
          variable={variableFilter} onVariableChange={setVariableFilter}
          dateFrom={dateFrom} dateTo={dateTo}
          onDateFromChange={setDateFrom} onDateToChange={setDateTo}
          onQuery={handleQuery}
        />

        <DataTable
          columns={columns}
          data={filtered}
          searchPlaceholder="Search linkages..."
          emptyMessage="No data available in table"
          selectable
          selectedIds={selectedIds}
          onSelectionChange={setSelectedIds}
          actions={(row) => (
            <button type="button" className="btn-ghost p-1.5" onClick={() => openView(row)} title="View"><Eye size={14} /></button>
          )}
        />

        <Modal open={modal === 'view'} onClose={close} title="Linkage Details">
          {selected && (
            <div className="space-y-3">
              {[
                ['Device', selected.srcDevice],
                ['Trigger', selected.triggerName],
                ['Trigger Type', selected.triggerType],
                ['Slave', selected.slave],
                ['Variable', selected.variable],
                ['Condition', selected.condition],
                ['Trigger Device', selected.triggerDevice],
                ['Linkage Time', selected.createdAt],
              ].map(([label, value]) => (
                <div key={label} className="flex gap-4">
                  <span className="text-xs text-surface-500 w-32 flex-shrink-0">{label}</span>
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
