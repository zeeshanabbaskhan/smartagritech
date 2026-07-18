import { Clock, Network, Building, Layers, Folder, Cpu, HelpCircle } from 'lucide-react'
import { TIME_RANGES, findNodeInTree } from '../../data/facilitiesHierarchy'

function getNodeIcon(type) {
  switch (type) {
    case 'Organization':
    case 'Campus':
      return <Network size={14} className="text-primary-500" />
    case 'Site':
    case 'Building':
      return <Building size={14} className="text-info-500" />
    case 'Block':
    case 'Wing':
    case 'Floor':
      return <Layers size={14} className="text-warning-500" />
    case 'Department':
    case 'Section':
    case 'Room':
      return <Folder size={14} className="text-success-500" />
    default:
      return <HelpCircle size={14} className="text-surface-400" />
  }
}

function getAllNodesOfType(nodes, type) {
  let result = []
  if (!nodes) return result
  for (const n of nodes) {
    if (n.type === type) result.push(n)
    if (n.children?.length) result = result.concat(getAllNodesOfType(n.children, type))
  }
  return result
}

function getDescendantsOfType(node, type) {
  let result = []
  if (!node?.children?.length) return result
  for (const child of node.children) {
    if (child.type === type) result.push(child)
    result = result.concat(getDescendantsOfType(child, type))
  }
  return result
}

export default function ContextFilterBar({
  hierarchy,
  context,
  onChange,
  userRole,
  organizations = [],
  selectedOrgId,
  onOrgChange,
  devices = [],
}) {
  const isAdmin = userRole === 'admin'
  const tree = hierarchy?.tree || []

  const buildings = getAllNodesOfType(tree, 'Building')
  let floors = []
  if (context.buildingId) {
    const bNode = findNodeInTree(tree, context.buildingId)?.node
    floors = getDescendantsOfType(bNode, 'Floor')
  } else {
    floors = getAllNodesOfType(tree, 'Floor')
  }

  let departments = []
  if (context.floorId) {
    const fNode = findNodeInTree(tree, context.floorId)?.node
    departments = getDescendantsOfType(fNode, 'Department')
  } else if (context.buildingId) {
    const bNode = findNodeInTree(tree, context.buildingId)?.node
    departments = getDescendantsOfType(bNode, 'Department')
  } else {
    departments = getAllNodesOfType(tree, 'Department')
  }

  function handleBuildingChange(selectedId) {
    if (!selectedId) {
      onChange({ ...context, level: 'organization', nodeId: null, buildingId: null, floorId: null, departmentId: null })
    } else {
      onChange({ ...context, level: 'building', nodeId: selectedId, buildingId: selectedId, floorId: null, departmentId: null })
    }
  }

  function handleFloorChange(selectedId) {
    if (!selectedId) {
      if (context.buildingId) {
        onChange({ ...context, level: 'building', nodeId: context.buildingId, floorId: null, departmentId: null })
      } else {
        onChange({ ...context, level: 'organization', nodeId: null, buildingId: null, floorId: null, departmentId: null })
      }
    } else {
      const found = findNodeInTree(tree, selectedId)
      const bId = found?.path?.find((n) => n.type === 'Building')?.id || null
      onChange({ ...context, level: 'floor', nodeId: selectedId, buildingId: bId, floorId: selectedId, departmentId: null })
    }
  }

  function handleDepartmentChange(selectedId) {
    if (!selectedId) {
      if (context.floorId) {
        onChange({ ...context, level: 'floor', nodeId: context.floorId, departmentId: null })
      } else if (context.buildingId) {
        onChange({ ...context, level: 'building', nodeId: context.buildingId, floorId: null, departmentId: null })
      } else {
        onChange({ ...context, level: 'organization', nodeId: null, buildingId: null, floorId: null, departmentId: null })
      }
    } else {
      const found = findNodeInTree(tree, selectedId)
      const bId = found?.path?.find((n) => n.type === 'Building')?.id || null
      const fId = found?.path?.find((n) => n.type === 'Floor')?.id || null
      onChange({ ...context, level: 'department', nodeId: selectedId, buildingId: bId, floorId: fId, departmentId: selectedId })
    }
  }

  return (
    <div className="card p-3 flex flex-wrap items-center gap-4">
      {isAdmin && (
        <div className="flex items-center gap-1.5 text-surface-400">
          {getNodeIcon('Organization')}
          <select
            className="select text-xs py-1.5 px-2.5 w-auto min-w-[9rem]"
            value={selectedOrgId || ''}
            onChange={(e) => onOrgChange?.(e.target.value)}
          >
            {organizations.map((org) => (
              <option key={org.id} value={org.id}>{org.name}</option>
            ))}
          </select>
        </div>
      )}

      <div className="flex items-center gap-1.5 text-surface-400">
        {getNodeIcon('Building')}
        <select
          className="select text-xs py-1.5 px-2.5 w-auto min-w-[9rem]"
          value={context.buildingId || ''}
          onChange={(e) => handleBuildingChange(e.target.value)}
        >
          <option value="">All Buildings</option>
          {buildings.map((opt) => (
            <option key={opt.id} value={opt.id}>{opt.name}</option>
          ))}
        </select>
      </div>

      <div className="flex items-center gap-1.5 text-surface-400">
        {getNodeIcon('Floor')}
        <select
          className="select text-xs py-1.5 px-2.5 w-auto min-w-[9rem]"
          value={context.floorId || ''}
          onChange={(e) => handleFloorChange(e.target.value)}
        >
          <option value="">All Floors</option>
          {floors.map((opt) => (
            <option key={opt.id} value={opt.id}>{opt.name}</option>
          ))}
        </select>
      </div>

      <div className="flex items-center gap-1.5 text-surface-400">
        {getNodeIcon('Department')}
        <select
          className="select text-xs py-1.5 px-2.5 w-auto min-w-[9rem]"
          value={context.departmentId || ''}
          onChange={(e) => handleDepartmentChange(e.target.value)}
        >
          <option value="">All Departments</option>
          {departments.map((opt) => (
            <option key={opt.id} value={opt.id}>{opt.name}</option>
          ))}
        </select>
      </div>

      <div className="flex items-center gap-1.5 text-surface-400">
        <Cpu size={14} className="text-primary-600" />
        <select
          className="select text-xs py-1.5 px-2.5 w-auto min-w-[9rem]"
          value={context.targetDeviceId || ''}
          onChange={(e) => onChange({
            ...context,
            targetDeviceId: e.target.value || null,
            targetDevice: devices.find((d) => d.id === e.target.value)?.name || null,
          })}
        >
          <option value="">All Devices ({devices.length})</option>
          {devices.map((d) => (
            <option key={d.id} value={d.id}>{d.name}</option>
          ))}
        </select>
      </div>

      <div className="flex items-center gap-1.5 text-surface-400 ml-auto">
        <Clock size={14} className="text-primary-500" />
        <select
          className="select text-xs py-1.5 px-2.5 w-auto"
          value={context.timeRange || 'today'}
          onChange={(e) => onChange({ ...context, timeRange: e.target.value })}
        >
          {Object.entries(TIME_RANGES).map(([key, v]) => (
            <option key={key} value={key}>{v.label}</option>
          ))}
        </select>
      </div>
    </div>
  )
}
