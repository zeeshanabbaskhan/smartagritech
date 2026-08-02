import { X } from 'lucide-react'

/**
 * Shared filter bar used across the "Data Center" style pages
 * (Variable Alarm Record, Linkage Record, Historical Data).
 * Mirrors the reference layout: device select, trigger/variable
 * tag-style selects, secondary dropdowns, a date range, and Query.
 */
export default function DataCenterFilterBar({
  devices = [],
  device, onDeviceChange,
  triggerOptions = [],
  trigger, onTriggerChange,
  variableOptions = [],
  variable, onVariableChange,
  extraFilters,
  dateFrom, dateTo, onDateFromChange, onDateToChange,
  onQuery,
}) {
  return (
    <div className="card p-4 mb-5">
      <div className="flex flex-wrap items-end gap-3">
        <div className="w-44">
          <label className="label">Device</label>
          <select className="select" value={device} onChange={e => onDeviceChange(e.target.value)}>
            <option value="">All Devices</option>
            {devices.map(d => <option key={d} value={d}>{d}</option>)}
          </select>
        </div>

        {onTriggerChange && (
          <div className="w-44">
            <label className="label">Trigger Name</label>
            {trigger ? (
              <div className="input flex items-center justify-between text-xs">
                <span>{trigger}</span>
                <button type="button" onClick={() => onTriggerChange('')} className="text-surface-400 hover:text-surface-700">
                  <X size={12} />
                </button>
              </div>
            ) : (
              <select className="select" value={trigger} onChange={e => onTriggerChange(e.target.value)}>
                <option value="">Select trigger</option>
                {triggerOptions.map(t => <option key={t} value={t}>{t}</option>)}
              </select>
            )}
          </div>
        )}

        {onVariableChange && (
          <div className="w-44">
            <label className="label">Variable</label>
            {variable ? (
              <div className="input flex items-center justify-between text-xs">
                <span>{variable}</span>
                <button type="button" onClick={() => onVariableChange('')} className="text-surface-400 hover:text-surface-700">
                  <X size={12} />
                </button>
              </div>
            ) : (
              <select className="select" value={variable} onChange={e => onVariableChange(e.target.value)}>
                <option value="">Select variable</option>
                {variableOptions.map(v => <option key={v} value={v}>{v}</option>)}
              </select>
            )}
          </div>
        )}

        {extraFilters}

        <div className="w-56">
          <label className="label">Date Range</label>
          <div className="flex items-center gap-1.5">
            <input type="date" className="input text-xs" value={dateFrom} onChange={e => onDateFromChange(e.target.value)} />
            <span className="text-surface-400 text-xs">-</span>
            <input type="date" className="input text-xs" value={dateTo} onChange={e => onDateToChange(e.target.value)} />
          </div>
        </div>

        <button className="btn-primary" onClick={onQuery}>Query</button>
      </div>
    </div>
  )
}
