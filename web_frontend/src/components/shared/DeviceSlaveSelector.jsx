import { useDevices } from '../../context/DeviceContext'

export default function DeviceSlaveSelector({ onChange, className = '' }) {
  const {
    devices, slaves, selectedDeviceId, selectedSlaveId,
    setSelectedSlaveId, selectDevice, loading,
  } = useDevices()

  return (
    <div className={`flex flex-wrap gap-3 ${className}`}>
      <div className="min-w-[200px] flex-1">
        <label className="label text-[10px] uppercase tracking-wider">Device</label>
        <select
          className="input py-2 text-xs w-full"
          value={selectedDeviceId ?? ''}
          disabled={loading || !devices.length}
          onChange={async (e) => {
            await selectDevice(e.target.value || null)
            onChange?.()
          }}
        >
          {!devices.length && <option value="">No devices</option>}
          {devices.map((d) => (
            <option key={d.id} value={d.id}>{d.name} ({d.status})</option>
          ))}
        </select>
      </div>
      <div className="min-w-[160px] flex-1">
        <label className="label text-[10px] uppercase tracking-wider">Slave / Meter</label>
        <select
          className="input py-2 text-xs w-full"
          value={selectedSlaveId ?? ''}
          disabled={!slaves.length}
          onChange={(e) => {
            setSelectedSlaveId(e.target.value || null)
            onChange?.()
          }}
        >
          {!slaves.length && <option value="">—</option>}
          {slaves.map((s) => (
            <option key={s.id} value={s.id}>{s.name ?? s.slaveName ?? s.id}</option>
          ))}
        </select>
      </div>
    </div>
  )
}
