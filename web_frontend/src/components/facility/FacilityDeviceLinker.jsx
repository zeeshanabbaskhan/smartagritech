import { useEffect, useMemo, useState } from 'react'
import { Cpu } from 'lucide-react'
import emsApi, { list } from '../../api/emsApi'
import { findNodeInTree } from '../../data/facilitiesHierarchy'

function flattenNodes(nodes, path = [], out = []) {
  for (const n of nodes || []) {
    const nextPath = [...path, n.name]
    out.push({ ...n, pathLabel: nextPath.join(' / ') })
    if (n.children?.length) flattenNodes(n.children, nextPath, out)
  }
  return out
}

/**
 * Assign EMS devices to facility nodes so dashboard group-by can aggregate live metrics.
 */
export default function FacilityDeviceLinker({ tree, onChange }) {
  const [devices, setDevices] = useState([])
  const [loading, setLoading] = useState(true)
  const [selectedNodeId, setSelectedNodeId] = useState('')

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      setLoading(true)
      try {
        const rows = list(await emsApi.getDevices({ limit: 100 }))
        if (!cancelled) setDevices(rows)
      } catch (_) {
        if (!cancelled) setDevices([])
      } finally {
        if (!cancelled) setLoading(false)
      }
    })()
    return () => { cancelled = true }
  }, [])

  const flat = useMemo(() => flattenNodes(tree), [tree])

  useEffect(() => {
    if (!selectedNodeId && flat.length) setSelectedNodeId(flat[0].id)
  }, [flat, selectedNodeId])

  const selected = selectedNodeId ? findNodeInTree(tree, selectedNodeId)?.node : null
  const selectedIds = new Set(selected?.deviceIds || [])

  const updateNodeDevices = (nodeId, deviceIds) => {
    const patch = (nodes) => nodes.map((n) => {
      if (n.id === nodeId) return { ...n, deviceIds }
      if (n.children?.length) return { ...n, children: patch(n.children) }
      return n
    })
    onChange(patch(tree || []))
  }

  const toggleDevice = (deviceId) => {
    if (!selectedNodeId) return
    const next = new Set(selectedIds)
    if (next.has(deviceId)) next.delete(deviceId)
    else next.add(deviceId)
    updateNodeDevices(selectedNodeId, [...next])
  }

  if (loading) {
    return <p className="text-xs text-surface-400">Loading devices…</p>
  }

  if (!flat.length) {
    return (
      <p className="text-xs text-surface-400">
        Save a facility hierarchy above first, then link devices to buildings / floors / rooms.
      </p>
    )
  }

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
      <div>
        <label className="block text-xs font-bold text-surface-500 uppercase tracking-wide mb-2">Facility node</label>
        <select
          className="select w-full"
          value={selectedNodeId}
          onChange={(e) => setSelectedNodeId(e.target.value)}
        >
          {flat.map((n) => (
            <option key={n.id} value={n.id}>
              {n.pathLabel} ({n.deviceIds?.length || 0} devices)
            </option>
          ))}
        </select>
        <p className="text-[11px] text-surface-400 mt-2">
          Devices linked here are used for custom dashboard filters and group-by charts.
        </p>
      </div>
      <div>
        <label className="block text-xs font-bold text-surface-500 uppercase tracking-wide mb-2">
          <span className="inline-flex items-center gap-1"><Cpu size={12} /> Devices</span>
        </label>
        <div className="max-h-56 overflow-auto border border-surface-200 rounded-lg divide-y divide-surface-100">
          {devices.length === 0 && (
            <p className="text-xs text-surface-400 p-3">No devices in this organization</p>
          )}
          {devices.map((d) => (
            <label key={d.id} className="flex items-center gap-2 px-3 py-2 text-xs cursor-pointer hover:bg-surface-50">
              <input
                type="checkbox"
                checked={selectedIds.has(d.id)}
                onChange={() => toggleDevice(d.id)}
              />
              <span className="font-semibold text-surface-800 flex-1 truncate">{d.name}</span>
              <span className={`badge ${String(d.status).toUpperCase() === 'ONLINE' ? 'badge-success' : 'badge-danger'}`}>
                {d.status || 'OFFLINE'}
              </span>
            </label>
          ))}
        </div>
      </div>
    </div>
  )
}
