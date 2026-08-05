import { useState, useMemo, useEffect, useCallback } from 'react'
import Modal from '../ui/Modal'
import { TextInput, SelectInput, CheckboxInput, RadioInput } from '../ui/FormFields'
import { Plus, Pencil, Trash2, Info, ChevronDown, ChevronUp, Eye } from 'lucide-react'
import emsApi, { list } from '../../api/emsApi'
import { useToast } from '../../context/ToastContext'
import {
  REGISTER_FUNCTIONS, DATA_FORMATS, NUMBER_FORMATS, READ_WRITE_OPTIONS,
  VARIABLE_TYPE_DIRECT, VARIABLE_TYPE_EQUATION,
  registerDisplayCode, apiVarToUi, uiVarToApi, formatSyncToast,
  VARIABLE_CSV_HEADERS, variableToCsvRow, parseCsvLine, csvRowToUiVar,
} from '../../data/slaveVariables'

const blankVariable = {
  id: null, number: 0, name: '', unit: '', icon: '', identifier: '',
  machineId: '', machineControl: '',
  lineChartColor: '#000000', lineChartLimit: '', lowLimitLineChart: '',
  peakTimeStart: '', peakTimeEnd: '', peakOffTimeStart: '', peakOffTimeEnd: '',
  peakTimeColor: '#00ff00', peakOffTimeColor: '#ff0000',
  variableType: VARIABLE_TYPE_DIRECT,
  registerFuncCode: REGISTER_FUNCTIONS[0], registerAddress: '',
  dataFormat: 'Unsigned Word', numberFormat: 'Integer', decimalPlacesPadding: false,
  storageVariable: true, storageTiming: true,
  readWrite: 'Read Only',
  acquisitionFormula: '', controlFormula: '',
  mainPageSelection: false, sort: '', defaultUnitSelection: false,
  slaves: [],
}

const ICON_OPTIONS = ['Voltage', 'Current', 'Power', 'Switch', 'Temperature', 'Energy', 'Alarm', 'Gauge']

function toastSync(showToast, sync) {
  const msg = formatSyncToast(sync)
  if (msg) showToast(msg, 'success')
}

/**
 * Portal Variables modal wired to live EMS API.
 * @param {{ templateId: string, slave: object, allSlaves?: object[], onClose: Function, onChanged?: Function, readOnly?: boolean }} props
 */
export default function VariablesModal({ templateId, slave, allSlaves = [], onClose, onChanged, readOnly = false }) {
  const { showToast } = useToast()
  const [variables, setVariables] = useState([])
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState(false)
  const [nameQuery, setNameQuery] = useState('')
  const [remoteSlave, setRemoteSlave] = useState('')
  const [appliedQuery, setAppliedQuery] = useState('')
  const [subModal, setSubModal] = useState(null)
  const [editingVar, setEditingVar] = useState(null)
  const [importFile, setImportFile] = useState(null)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const res = await emsApi.getTemplateVariables(templateId, slave.id, { limit: 500 })
      setVariables(list(res).map(apiVarToUi))
    } catch (e) {
      showToast(e.message || 'Failed to load variables', 'error')
    } finally {
      setLoading(false)
    }
  }, [templateId, slave.id, showToast])

  useEffect(() => { load() }, [load])

  const filtered = useMemo(() => {
    if (!appliedQuery.trim()) return variables
    const q = appliedQuery.toLowerCase().trim()
    return variables.filter((v) => v.name.toLowerCase().includes(q))
  }, [variables, appliedQuery])

  const handleQuery = () => setAppliedQuery(nameQuery)

  const openAddVariable = () => {
    setEditingVar({ ...blankVariable })
    setSubModal('addVariable')
  }
  const openAddEquation = () => {
    setEditingVar({ ...blankVariable, variableType: VARIABLE_TYPE_EQUATION })
    setSubModal('addEquation')
  }
  const openEdit = (v) => {
    setEditingVar({ ...v })
    setSubModal(v.variableType === VARIABLE_TYPE_EQUATION ? 'addEquation' : 'addVariable')
  }
  const closeSub = () => { setSubModal(null); setEditingVar(null) }

  const handleSubmitVariable = async () => {
    if (!editingVar?.name?.trim()) return
    setBusy(true)
    try {
      const body = uiVarToApi(editingVar)
      const isEdit = variables.some((v) => v.id === editingVar.id)
      let res
      if (isEdit) {
        res = await emsApi.updateTemplateVariable(templateId, slave.id, editingVar.id, body)
      } else {
        res = await emsApi.createTemplateVariable(templateId, slave.id, body)
      }
      toastSync(showToast, res?.sync)
      closeSub()
      await load()
      onChanged?.()
    } catch (e) {
      showToast(e.message || 'Save failed', 'error')
    } finally {
      setBusy(false)
    }
  }

  const handleDeleteVariable = async (v) => {
    if (!confirm(`Delete variable "${v.name}"?`)) return
    setBusy(true)
    try {
      const res = await emsApi.deleteTemplateVariable(templateId, slave.id, v.id)
      toastSync(showToast, res?.sync)
      await load()
      onChanged?.()
    } catch (e) {
      showToast(e.message || 'Delete failed', 'error')
    } finally {
      setBusy(false)
    }
  }

  const handleToggleMainPage = async (v) => {
    try {
      const res = await emsApi.updateTemplateVariable(templateId, slave.id, v.id, {
        mainPageSelection: !v.mainPageSelection,
      })
      toastSync(showToast, res?.sync)
      setVariables((prev) => prev.map((x) => (x.id === v.id ? { ...x, mainPageSelection: !x.mainPageSelection } : x)))
    } catch (e) {
      showToast(e.message || 'Update failed', 'error')
    }
  }

  const handleSetDefaultUnit = async (v) => {
    try {
      const res = await emsApi.setTemplateVariableDefaultUnit(templateId, slave.id, v.id)
      toastSync(showToast, res?.sync)
      setVariables((prev) => prev.map((x) => ({ ...x, defaultUnitSelection: x.id === v.id })))
    } catch (e) {
      showToast(e.message || 'Update failed', 'error')
    }
  }

  const handleSortChange = (v, value) => {
    setVariables((prev) => prev.map((x) => (x.id === v.id ? { ...x, sort: value } : x)))
  }

  const handleSortBlur = async (v) => {
    const sortOrder = v.sort === '' || v.sort == null ? null : Number(v.sort)
    try {
      await emsApi.updateTemplateVariable(templateId, slave.id, v.id, { sortOrder })
    } catch (e) {
      showToast(e.message || 'Sort update failed', 'error')
    }
  }

  const handleSaveSortOrder = async () => {
    const ordered = [...variables]
      .sort((a, b) => {
        const av = a.sort === '' || a.sort == null ? Infinity : Number(a.sort)
        const bv = b.sort === '' || b.sort == null ? Infinity : Number(b.sort)
        return av - bv
      })
      .map((v, i) => ({ id: v.id, sortOrder: i + 1, sortNumber: i + 1 }))
    setBusy(true)
    try {
      const res = await emsApi.sortTemplateVariables(templateId, slave.id, ordered)
      toastSync(showToast, res?.sync)
      showToast('Sort order saved', 'success')
      await load()
      onChanged?.()
    } catch (e) {
      showToast(e.message || 'Sort save failed', 'error')
    } finally {
      setBusy(false)
    }
  }

  const handleExportVariable = () => {
    const rows = variables.map(variableToCsvRow)
    const csv = [VARIABLE_CSV_HEADERS, ...rows]
      .map((r) => r.map((c) => `"${String(c ?? '').replace(/"/g, '""')}"`).join(','))
      .join('\n')
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `${slave.name}-variables.csv`
    a.click()
    URL.revokeObjectURL(url)
  }

  const handleImportFile = async () => {
    if (!importFile) {
      showToast('Choose a CSV file first', 'error')
      return
    }
    setBusy(true)
    try {
      const text = await importFile.text()
      const lines = text.split(/\r?\n/).filter((l) => l.trim())
      if (lines.length < 2) throw new Error('CSV has no data rows')
      const headers = parseCsvLine(lines[0]).map((h) => h.trim())
      const headerKeys = headers.map((h) => h.toLowerCase())
      const hasName = headerKeys.some((h) => h === 'variable name' || h === 'name')
      if (!hasName) throw new Error('CSV missing Variable Name column')

      const byName = new Map(variables.map((v) => [v.name.toLowerCase(), v]))
      let created = 0
      let updated = 0
      let lastSync = null

      for (let i = 1; i < lines.length; i++) {
        const cols = parseCsvLine(lines[i])
        const ui = csvRowToUiVar(headers, cols, blankVariable)
        if (!ui) continue

        const body = uiVarToApi(ui)
        const existing = byName.get(ui.name.toLowerCase())
        let res
        if (existing) {
          res = await emsApi.updateTemplateVariable(templateId, slave.id, existing.id, body)
          updated += 1
        } else {
          res = await emsApi.createTemplateVariable(templateId, slave.id, body)
          created += 1
          if (res?.data?.id) {
            byName.set(ui.name.toLowerCase(), { id: res.data.id, name: ui.name })
          }
        }
        lastSync = res?.sync
      }

      if (!created && !updated) throw new Error('No valid variable rows found in CSV')

      toastSync(showToast, lastSync)
      const parts = []
      if (created) parts.push(`${created} created`)
      if (updated) parts.push(`${updated} updated`)
      showToast(`Imported ${parts.join(', ')}`, 'success')
      setSubModal(null)
      setImportFile(null)
      await load()
      onChanged?.()
    } catch (e) {
      showToast(e.message || 'Import failed', 'error')
    } finally {
      setBusy(false)
    }
  }

  const slaveNames = (allSlaves.length ? allSlaves : [slave]).map((s) => s.name)

  return (
    <>
      <Modal open onClose={onClose} title={`Variables — ${slave.name}`} size="2xl">
        <div className="space-y-4">
          {readOnly ? (
            <div className="flex flex-wrap items-center gap-2">
              <div className="flex-1 min-w-[10rem]" />
              <input
                type="text"
                className="input py-1.5 text-xs w-44"
                placeholder="Please Input variable name"
                value={nameQuery}
                onChange={(e) => setNameQuery(e.target.value)}
              />
              <button type="button" className="btn-primary" onClick={handleQuery}>Query</button>
            </div>
          ) : (
            <div className="flex flex-wrap items-center gap-2">
              <button type="button" className="btn-primary" onClick={openAddVariable} disabled={busy}>
                <Plus size={14} /> Add Variable
              </button>
              <button type="button" className="btn-primary" onClick={openAddEquation} disabled={busy}>
                <Plus size={14} /> Add Equation
              </button>
              <button type="button" className="btn-primary" onClick={() => setSubModal('import')} disabled={busy}>
                Import Variable
              </button>
              <button type="button" className="btn-secondary" onClick={handleExportVariable}>Export Variable</button>
              <button
                type="button"
                className="btn text-white bg-success-600 hover:bg-success-700 active:scale-95"
                onClick={handleSaveSortOrder}
                disabled={busy}
              >
                Save Sort Order
              </button>
              <div className="flex-1 min-w-[10rem]" />
              <select
                className="select py-1.5 px-2 text-xs w-auto"
                value={remoteSlave}
                onChange={(e) => setRemoteSlave(e.target.value)}
              >
                <option value="">Select Remote Control Slave</option>
                {slaveNames.map((n) => <option key={n} value={n}>{n}</option>)}
              </select>
              <input
                type="text"
                className="input py-1.5 text-xs w-44"
                placeholder="Please Input variable name"
                value={nameQuery}
                onChange={(e) => setNameQuery(e.target.value)}
              />
              <button type="button" className="btn-primary" onClick={handleQuery}>Query</button>
            </div>
          )}

          {loading ? (
            <p className="text-center py-10 text-xs text-surface-400">Loading variables…</p>
          ) : (
            <div className="overflow-x-auto border border-surface-200 dark:border-surface-800 rounded-xl">
              <table className="data-table">
                <thead>
                  <tr>
                    <th className="w-16">Main Page Selection</th>
                    <th className="w-16">Sort</th>
                    <th className="w-20">Default Unit Selection</th>
                    <th className="w-14">Number</th>
                    <th>Variable Name</th>
                    <th>Variable Type</th>
                    <th>Value Type</th>
                    <th>Register</th>
                    <th>Write &amp; Read</th>
                    <th>Storage Mode</th>
                    <th className="!text-center">Operation</th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.length === 0 ? (
                    <tr>
                      <td colSpan={11} className="text-center py-10 text-xs text-surface-400">No variables found.</td>
                    </tr>
                  ) : (
                    filtered.map((v) => (
                      <tr key={v.id}>
                        <td>
                          <input
                            type="checkbox"
                            className="w-3.5 h-3.5 rounded text-primary-500"
                            checked={!!v.mainPageSelection}
                            disabled={readOnly}
                            onChange={() => handleToggleMainPage(v)}
                          />
                        </td>
                        <td>
                          <input
                            type="text"
                            className="input py-1 px-1.5 text-xs w-12 text-center"
                            placeholder="-"
                            value={v.sort}
                            disabled={readOnly}
                            onChange={(e) => handleSortChange(v, e.target.value)}
                            onBlur={() => handleSortBlur(v)}
                          />
                        </td>
                        <td>
                          <button
                            type="button"
                            disabled={readOnly}
                            onClick={() => handleSetDefaultUnit(v)}
                            className={`w-4 h-4 rounded-full border-2 flex items-center justify-center mx-auto ${v.defaultUnitSelection ? 'border-info-600' : 'border-surface-300 dark:border-surface-700'}`}
                          >
                            {v.defaultUnitSelection && <span className="w-2 h-2 rounded-full bg-info-600" />}
                          </button>
                        </td>
                        <td className="text-surface-400 font-mono text-xs">{v.number}</td>
                        <td className="font-semibold text-surface-800 dark:text-surface-100">{v.name}</td>
                        <td className="text-xs text-surface-500">{v.variableType}</td>
                        <td className="text-xs text-surface-500">{registerDisplayCode(v.dataFormat)}</td>
                        <td className="font-mono text-xs text-surface-500">{v.registerAddress || '—'}</td>
                        <td className="text-xs text-surface-500">{v.readWrite}</td>
                        <td className="text-xs text-surface-500">
                          {[v.storageVariable && 'Variable Storage', v.storageTiming && 'Timing Storage'].filter(Boolean).join('-') || '—'}
                        </td>
                        <td className="!text-center">
                          <div className="flex items-center justify-center gap-1">
                            {readOnly ? (
                              <button type="button" className="btn-ghost p-1.5" onClick={() => openEdit(v)} title="View">
                                <Eye size={13} />
                              </button>
                            ) : (
                              <>
                                <button type="button" className="btn-ghost p-1.5" onClick={() => openEdit(v)} title="Edit"><Pencil size={13} /></button>
                                <button type="button" className="btn-danger p-1.5" onClick={() => handleDeleteVariable(v)} title="Delete"><Trash2 size={13} /></button>
                              </>
                            )}
                          </div>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          )}
          <p className="text-xs text-surface-400">Showing 1 to {filtered.length} of {filtered.length} records</p>
        </div>
      </Modal>

      {subModal === 'addVariable' && editingVar && (
        <AddVariableModal
          value={editingVar}
          isEdit={variables.some((v) => v.id === editingVar.id)}
          onChange={setEditingVar}
          onClose={closeSub}
          onSubmit={handleSubmitVariable}
          busy={busy}
          readOnly={readOnly}
        />
      )}
      {subModal === 'addEquation' && editingVar && (
        <AddEquationModal
          value={editingVar}
          isEdit={variables.some((v) => v.id === editingVar.id)}
          onChange={setEditingVar}
          onClose={closeSub}
          onSubmit={handleSubmitVariable}
          slaveNames={slaveNames}
          busy={busy}
          readOnly={readOnly}
        />
      )}
      {subModal === 'import' && !readOnly && (
        <ImportVariableModal
          onClose={() => { setSubModal(null); setImportFile(null) }}
          onImport={handleImportFile}
          fileName={importFile?.name || ''}
          onFile={(f) => setImportFile(f)}
          busy={busy}
        />
      )}
    </>
  )
}

function ColorField({ label, value, onChange }) {
  return (
    <div className="space-y-1.5">
      <label className="label">{label}</label>
      <div className="flex items-center gap-2">
        <input
          type="color"
          value={value || '#000000'}
          onChange={(e) => onChange(e.target.value)}
          className="w-9 h-9 rounded-lg border border-surface-300 dark:border-surface-800 cursor-pointer p-0.5 bg-white dark:bg-surface-950"
        />
        <input type="text" className="input flex-1" placeholder="#ffffff" value={value} onChange={(e) => onChange(e.target.value)} />
      </div>
    </div>
  )
}

function TimeRangeField({ label, start, end, onStart, onEnd }) {
  return (
    <div className="space-y-1.5">
      <label className="label">{label}</label>
      <div className="flex items-center gap-2">
        <input type="time" className="input" value={start} onChange={(e) => onStart(e.target.value)} />
        <span className="text-xs text-surface-400 flex-shrink-0">to</span>
        <input type="time" className="input" value={end} onChange={(e) => onEnd(e.target.value)} />
      </div>
    </div>
  )
}

function AddVariableModal({ value, isEdit, onChange, onClose, onSubmit, busy, readOnly = false }) {
  const [showAdvanced, setShowAdvanced] = useState(true)
  const set = (patch) => { if (!readOnly) onChange({ ...value, ...patch }) }
  const registerDisplay = `${String(value.registerAddress || '0').padStart(5, '0')}(${registerDisplayCode(value.dataFormat)})`

  return (
    <Modal
      open
      onClose={onClose}
      title={readOnly ? 'View Variable' : isEdit ? 'Edit Variable' : 'Add Variable'}
      size="2xl"
      footer={
        <>
          <button type="button" className="btn-secondary" onClick={onClose}>Close</button>
          {!readOnly && (
            <button type="button" className="btn-primary" onClick={onSubmit} disabled={busy}>
              {busy ? 'Saving…' : 'Submit'}
            </button>
          )}
        </>
      }
    >
      <fieldset disabled={readOnly} className="space-y-4 border-0 p-0 m-0 min-w-0 disabled:opacity-90">
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <TextInput label="Variable Name" required placeholder="e.g. Voltage"
            value={value.name} onChange={(e) => set({ name: e.target.value })} />
          <TextInput label="Variable Unit" placeholder="e.g. V"
            value={value.unit} onChange={(e) => set({ unit: e.target.value })} />
          <SelectInput label="Icon" placeholder="Icons"
            value={value.icon} onChange={(e) => set({ icon: e.target.value })}
            options={ICON_OPTIONS} />
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <TextInput label="Variable Identifier" value={value.identifier} onChange={(e) => set({ identifier: e.target.value })} />
          <TextInput label="Machine Id" value={value.machineId} onChange={(e) => set({ machineId: e.target.value })} />
          <TextInput label="Machine Control" value={value.machineControl} onChange={(e) => set({ machineControl: e.target.value })} />
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <ColorField label="Line Chart Color Picker" value={value.lineChartColor} onChange={(v) => set({ lineChartColor: v })} />
          <TextInput label="Line Chart Limit" value={value.lineChartLimit} onChange={(e) => set({ lineChartLimit: e.target.value })} />
          <TextInput label="Low Limit Line Chart" value={value.lowLimitLineChart} onChange={(e) => set({ lowLimitLineChart: e.target.value })} />
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <TimeRangeField label="Peak Time Range" start={value.peakTimeStart} end={value.peakTimeEnd}
            onStart={(v) => set({ peakTimeStart: v })} onEnd={(v) => set({ peakTimeEnd: v })} />
          <TimeRangeField label="Peak Off Time Range" start={value.peakOffTimeStart} end={value.peakOffTimeEnd}
            onStart={(v) => set({ peakOffTimeStart: v })} onEnd={(v) => set({ peakOffTimeEnd: v })} />
          <ColorField label="Peak Time Color" value={value.peakTimeColor} onChange={(v) => set({ peakTimeColor: v })} />
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <ColorField label="Peak Off Time Color" value={value.peakOffTimeColor} onChange={(v) => set({ peakOffTimeColor: v })} />
        </div>
        <SelectInput label="Variable Type" required
          value={value.variableType} onChange={(e) => set({ variableType: e.target.value })}
          options={[VARIABLE_TYPE_DIRECT]} />
        <div className="space-y-1.5">
          <label className="label">Register</label>
          <div className="flex flex-wrap items-center gap-2">
            <select className="select w-56" value={value.registerFuncCode} onChange={(e) => set({ registerFuncCode: e.target.value })}>
              {REGISTER_FUNCTIONS.map((f) => <option key={f} value={f}>{f}</option>)}
            </select>
            <input type="text" className="input w-32" placeholder="Address" value={value.registerAddress}
              onChange={(e) => set({ registerAddress: e.target.value.replace(/[^0-9]/g, '') })} />
            <span className="text-xs text-surface-400 font-mono">{registerDisplay}</span>
          </div>
        </div>
        <SelectInput label="Data Format" required
          value={value.dataFormat} onChange={(e) => set({ dataFormat: e.target.value })}
          options={DATA_FORMATS} />
        <div className="flex flex-wrap items-end gap-4">
          <SelectInput label="Number Format" required className="w-56"
            value={value.numberFormat} onChange={(e) => set({ numberFormat: e.target.value })}
            options={NUMBER_FORMATS} />
          <CheckboxInput label="decimalPlacesPadding" checked={value.decimalPlacesPadding}
            onChange={(v) => set({ decimalPlacesPadding: v })} className="pb-2.5" />
        </div>
        <div className="space-y-1.5">
          <span className="label">Storage Format</span>
          <div className="flex flex-wrap gap-5">
            <CheckboxInput label="Variable Storage" checked={value.storageVariable} onChange={(v) => set({ storageVariable: v })} />
            <CheckboxInput label="Timing Storage" checked={value.storageTiming} onChange={(v) => set({ storageTiming: v })} />
          </div>
        </div>
        <RadioInput label="Read/Write" name="readWrite" options={READ_WRITE_OPTIONS}
          value={value.readWrite} onChange={(v) => set({ readWrite: v })} />
        <button
          type="button"
          className="flex items-center gap-1 text-xs font-bold text-primary-600 hover:text-primary-700"
          onClick={() => setShowAdvanced((s) => !s)}
        >
          Advanced Options {showAdvanced ? <ChevronUp size={13} /> : <ChevronDown size={13} />}
          <span className="text-surface-400 font-normal ml-2">Control formula (e.g. =s/100)</span>
        </button>
        {showAdvanced && (
          <div className="space-y-4">
            <div className="space-y-1.5">
              <label className="label flex items-center gap-1.5">
                Control Formula <Info size={12} className="text-surface-400" title="e.g. =s/100 — s is the raw sensor value; applied on ingest and shown everywhere" />
              </label>
              <input type="text" className="input" placeholder="e.g. =s/100"
                value={value.controlFormula}
                onChange={(e) => set({ controlFormula: e.target.value })} />
            </div>
            <div className="space-y-1.5">
              <label className="label flex items-center gap-1.5">
                Acquisition Formula <Info size={12} className="text-surface-400" title="Optional legacy field — used only if Control Formula is empty" />
              </label>
              <input type="text" className="input" placeholder="Optional"
                value={value.acquisitionFormula}
                onChange={(e) => set({ acquisitionFormula: e.target.value })} />
            </div>
          </div>
        )}
      </fieldset>
    </Modal>
  )
}

function AddEquationModal({ value, isEdit, onChange, onClose, onSubmit, slaveNames, busy, readOnly = false }) {
  const [slavesOpen, setSlavesOpen] = useState(false)
  const set = (patch) => { if (!readOnly) onChange({ ...value, ...patch }) }
  const toggleSlave = (name) => {
    if (readOnly) return
    const cur = value.slaves || []
    const next = cur.includes(name) ? cur.filter((s) => s !== name) : [...cur, name]
    set({ slaves: next })
  }

  return (
    <Modal
      open
      onClose={onClose}
      title={readOnly ? 'View Equation Variable' : isEdit ? 'Edit Equation Variable' : 'Add Equation Variable'}
      size="lg"
      footer={
        <>
          <button type="button" className="btn-secondary" onClick={onClose}>Close</button>
          {!readOnly && (
            <button type="button" className="btn-primary" onClick={onSubmit} disabled={busy}>
              {busy ? 'Saving…' : 'Submit'}
            </button>
          )}
        </>
      }
    >
      <fieldset disabled={readOnly} className="space-y-4 border-0 p-0 m-0 min-w-0 disabled:opacity-90">
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <TextInput label="Variable Name" required placeholder="e.g. Total Power"
            value={value.name} onChange={(e) => set({ name: e.target.value })} />
          <TextInput label="Variable Unit" placeholder="e.g. kW"
            value={value.unit} onChange={(e) => set({ unit: e.target.value })} />
          <SelectInput label="Icon" placeholder="Icons"
            value={value.icon} onChange={(e) => set({ icon: e.target.value })}
            options={ICON_OPTIONS} />
        </div>
        <TextInput label="Variable Identifier" value={value.identifier} onChange={(e) => set({ identifier: e.target.value })} />
        <SelectInput label="Variable Type" required disabled
          value={VARIABLE_TYPE_EQUATION} options={[VARIABLE_TYPE_EQUATION]} />
        <div className="pt-2 border-t border-surface-100 dark:border-surface-800">
          <h4 className="text-sm font-bold text-surface-900 dark:text-surface-100 mt-3 mb-3">Equation Variables</h4>
          <div className="space-y-1.5 relative">
            <label className="label">Slaves <span className="text-danger-600">*</span></label>
            <button type="button" onClick={() => !readOnly && setSlavesOpen((o) => !o)} className="select text-left flex items-center justify-between w-full">
              <span className={value.slaves?.length ? 'text-surface-800 dark:text-surface-100' : 'text-surface-400'}>
                {value.slaves?.length ? value.slaves.join(', ') : 'Please select slaves'}
              </span>
              <ChevronDown size={14} className="text-surface-400 flex-shrink-0" />
            </button>
            {slavesOpen && !readOnly && (
              <div className="absolute z-10 mt-1 w-full bg-white dark:bg-surface-900 border border-surface-200 dark:border-surface-700 rounded-xl shadow-floating overflow-hidden">
                {slaveNames.map((s) => (
                  <label key={s} className="flex items-center gap-2 px-3 py-2 text-xs font-semibold text-surface-700 dark:text-surface-300 hover:bg-surface-50 dark:hover:bg-surface-800 cursor-pointer">
                    <input type="checkbox" className="w-3.5 h-3.5 rounded text-primary-500"
                      checked={(value.slaves || []).includes(s)} onChange={() => toggleSlave(s)} />
                    {s}
                  </label>
                ))}
              </div>
            )}
          </div>
          <div className="space-y-1.5 mt-4">
            <label className="label flex items-center gap-1.5">
              Equation Formula (Slave Name$$Variable Name)
              <Info size={12} className="text-surface-400" title="Combine other variables, e.g. Slave$$Voltage + Slave$$Current. Do not use =s/100 here — that belongs on a direct variable’s Control Formula." />
            </label>
            <input type="text" className="input" placeholder={`e.g. ${slaveNames[0] || 'Slave'}$$Voltage * 2`}
              value={value.controlFormula} onChange={(e) => set({ controlFormula: e.target.value })} />
          </div>
        </div>
      </fieldset>
    </Modal>
  )
}

function ImportVariableModal({ onClose, onImport, fileName, onFile, busy }) {
  return (
    <Modal
      open
      onClose={onClose}
      title="Import Variable"
      size="sm"
      footer={
        <>
          <button type="button" className="btn-danger" onClick={onClose}>Cancel</button>
          <button type="button" className="btn-primary" onClick={onImport} disabled={busy}>
            {busy ? 'Importing…' : 'Ok'}
          </button>
        </>
      }
    >
      <div className="space-y-1.5">
        <label className="label">Select the File (CSV)</label>
        <div className="flex items-center gap-2">
          <label className="btn-secondary cursor-pointer !py-1.5 !px-3 text-xs">
            Choose File
            <input
              type="file"
              className="hidden"
              accept=".csv"
              onChange={(e) => onFile(e.target.files?.[0] || null)}
            />
          </label>
          <span className="text-xs text-surface-400 truncate">{fileName || 'No file chosen'}</span>
        </div>
      </div>
    </Modal>
  )
}
