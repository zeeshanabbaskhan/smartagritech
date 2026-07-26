import { Clock, Network, Building, Layers, Folder, Cpu, HelpCircle } from 'lucide-react'
import { TIME_RANGES, findNodeInTree } from '../../data/facilitiesHierarchy'
import { organizations as dummyOrgs, devices as dummyDevices } from '../../data/dummy'

// Resolve matching icon based on node type
function getNodeIcon(type) {
  switch (type) {
    case 'Organization': return <Network size={14} className="text-primary-500" />
    case 'Campus':       return <Network size={14} className="text-primary-500" />
    case 'Site':         return <Building size={14} className="text-info-500" />
    case 'Building':     return <Building size={14} className="text-info-500" />
    case 'Block':        return <Layers size={14} className="text-warning-500" />
    case 'Wing':         return <Layers size={14} className="text-warning-500" />
    case 'Floor':        return <Layers size={14} className="text-info-400" />
    case 'Department':   return <Folder size={14} className="text-success-500" />
    case 'Section':      return <Folder size={14} className="text-success-500" />
    case 'Room':         return <Folder size={14} className="text-success-500" />
    default:             return <HelpCircle size={14} className="text-surface-400" />
  }
}

// Flat-flatten helper to find all descendant nodes of a specific type
function getAllNodesOfType(nodes, type) {
  let result = []
  if (!nodes) return result
  for (const n of nodes) {
    if (n.type === type) {
      result.push(n)
    }
    if (n.children && n.children.length > 0) {
      result = result.concat(getAllNodesOfType(n.children, type))
    }
  }
  return result
}

// Helper to find descendants of a specific node
function getDescendantsOfType(node, type) {
  let result = []
  if (!node) return result
  if (node.children && node.children.length > 0) {
    for (const child of node.children) {
      if (child.type === type) {
        result.push(child)
      }
      result = result.concat(getDescendantsOfType(child, type))
    }
  }
  return result
}

export default function ContextFilterBar({ hierarchy, context, onChange, userRole, onOrgChange }) {
  const isAdmin = userRole === 'admin'

  // Load dynamically from localStorage to show recently added orgs
  const orgsList = (() => {
    try {
      const saved = localStorage.getItem('cf-ems-organizations')
      return saved ? JSON.parse(saved) : dummyOrgs
    } catch {
      return dummyOrgs
    }
  })()

  // Load dynamically from localStorage to show recently added devices
  const devicesList = (() => {
    try {
      const saved = localStorage.getItem('cf-ems-devices')
      return saved ? JSON.parse(saved) : dummyDevices
    } catch {
      return dummyDevices
    }
  })()

  // 1. Resolve all buildings
  const buildings = getAllNodesOfType(hierarchy.tree, 'Building')

  // 2. Resolve floors (filtered by active building if selected, otherwise all floors)
  let floors = []
  if (context.buildingId) {
    const bNode = findNodeInTree(hierarchy.tree, context.buildingId)?.node
    floors = getDescendantsOfType(bNode, 'Floor')
  } else {
    floors = getAllNodesOfType(hierarchy.tree, 'Floor')
  }

  // 3. Resolve departments (filtered by active floor/building if selected, otherwise all departments)
  let departments = []
  if (context.floorId) {
    const fNode = findNodeInTree(hierarchy.tree, context.floorId)?.node
    departments = getDescendantsOfType(fNode, 'Department')
  } else if (context.buildingId) {
    const bNode = findNodeInTree(hierarchy.tree, context.buildingId)?.node
    departments = getDescendantsOfType(bNode, 'Department')
  } else {
    departments = getAllNodesOfType(hierarchy.tree, 'Department')
  }

  // 4. Resolve devices belonging to the active organization
  const filteredDevicesForScope = devicesList.filter(d => d.org === hierarchy.orgName)

  // Handle building select change
  function handleBuildingChange(selectedId) {
    if (!selectedId) {
      onChange({
        ...context,
        level: 'organization',
        nodeId: null,
        buildingId: null,
        floorId: null,
        departmentId: null
      })
    } else {
      onChange({
        ...context,
        level: 'building',
        nodeId: selectedId,
        buildingId: selectedId,
        floorId: null,
        departmentId: null
      })
    }
  }

  // Handle floor select change
  function handleFloorChange(selectedId) {
    if (!selectedId) {
      if (context.buildingId) {
        onChange({
          ...context,
          level: 'building',
          nodeId: context.buildingId,
          floorId: null,
          departmentId: null
        })
      } else {
        onChange({
          ...context,
          level: 'organization',
          nodeId: null,
          buildingId: null,
          floorId: null,
          departmentId: null
        })
      }
    } else {
      const found = findNodeInTree(hierarchy.tree, selectedId)
      const bId = found?.path?.find(n => n.type === 'Building')?.id || null
      onChange({
        ...context,
        level: 'floor',
        nodeId: selectedId,
        buildingId: bId,
        floorId: selectedId,
        departmentId: null
      })
    }
  }

  // Handle department select change
  function handleDepartmentChange(selectedId) {
    if (!selectedId) {
      if (context.floorId) {
        onChange({
          ...context,
          level: 'floor',
          nodeId: context.floorId,
          departmentId: null
        })
      } else if (context.buildingId) {
        onChange({
          ...context,
          level: 'building',
          nodeId: context.buildingId,
          floorId: null,
          departmentId: null
        })
      } else {
        onChange({
          ...context,
          level: 'organization',
          nodeId: null,
          buildingId: null,
          floorId: null,
          departmentId: null
        })
      }
    } else {
      const found = findNodeInTree(hierarchy.tree, selectedId)
      const bId = found?.path?.find(n => n.type === 'Building')?.id || null
      const fId = found?.path?.find(n => n.type === 'Floor')?.id || null
      onChange({
        ...context,
        level: 'department',
        nodeId: selectedId,
        buildingId: bId,
        floorId: fId,
        departmentId: selectedId
      })
    }
  }

  function handleTimeRangeChange(timeRange) {
    onChange({ ...context, timeRange })
  }

  return (
    <div className="card p-3 flex flex-wrap items-center gap-4 bg-white dark:bg-surface-900 border border-surface-200 dark:border-surface-800 shadow-sm rounded-xl">
      
      {/* 1. Organization selector (Only visible for Super Admin) */}
      {isAdmin && (
        <div className="flex items-center gap-1.5 text-surface-400">
          {getNodeIcon('Organization')}
          <select
            className="select text-xs py-1.5 px-2.5 w-auto min-w-[9rem] bg-surface-100 dark:bg-surface-800 border border-surface-200 dark:border-surface-700 text-surface-800 dark:text-surface-100 font-bold focus:ring-1 focus:ring-primary-500 rounded-lg cursor-pointer"
            value={hierarchy.orgName}
            onChange={e => onOrgChange && onOrgChange(e.target.value)}
          >
            {orgsList.map(org => (
              <option key={org.id} value={org.name}>{org.name}</option>
            ))}
          </select>
        </div>
      )}

      {/* 2. Building selector */}
      <div className="flex items-center gap-1.5 text-surface-400">
        {getNodeIcon('Building')}
        <select
          className="select text-xs py-1.5 px-2.5 w-auto min-w-[9rem] bg-surface-50 dark:bg-surface-850 border border-surface-200 dark:border-surface-700 text-surface-700 dark:text-surface-200 font-bold focus:ring-1 focus:ring-primary-500 rounded-lg cursor-pointer"
          value={context.buildingId || ''}
          onChange={e => handleBuildingChange(e.target.value)}
        >
          <option value="">All Buildings</option>
          {buildings.map(opt => (
            <option key={opt.id} value={opt.id}>{opt.name}</option>
          ))}
        </select>
      </div>

      {/* 3. Floor selector */}
      <div className="flex items-center gap-1.5 text-surface-400">
        {getNodeIcon('Floor')}
        <select
          className="select text-xs py-1.5 px-2.5 w-auto min-w-[9rem] bg-surface-50 dark:bg-surface-850 border border-surface-200 dark:border-surface-700 text-surface-700 dark:text-surface-200 font-bold focus:ring-1 focus:ring-primary-500 rounded-lg cursor-pointer"
          value={context.floorId || ''}
          onChange={e => handleFloorChange(e.target.value)}
        >
          <option value="">All Floors</option>
          {floors.map(opt => (
            <option key={opt.id} value={opt.id}>{opt.name}</option>
          ))}
        </select>
      </div>

      {/* 4. Department selector */}
      <div className="flex items-center gap-1.5 text-surface-400">
        {getNodeIcon('Department')}
        <select
          className="select text-xs py-1.5 px-2.5 w-auto min-w-[9rem] bg-surface-50 dark:bg-surface-850 border border-surface-200 dark:border-surface-700 text-surface-700 dark:text-surface-200 font-bold focus:ring-1 focus:ring-primary-500 rounded-lg cursor-pointer"
          value={context.departmentId || ''}
          onChange={e => handleDepartmentChange(e.target.value)}
        >
          <option value="">All Departments</option>
          {departments.map(opt => (
            <option key={opt.id} value={opt.id}>{opt.name}</option>
          ))}
        </select>
      </div>

      {/* 5. Device selector tab showing total number of devices */}
      <div className="flex items-center gap-1.5 text-surface-400">
        <Cpu size={14} className="text-purple-500" />
        <select
          className="select text-xs py-1.5 px-2.5 w-auto min-w-[9rem] bg-surface-50 dark:bg-surface-850 border border-surface-200 dark:border-surface-700 text-surface-700 dark:text-surface-200 font-bold focus:ring-1 focus:ring-primary-500 rounded-lg cursor-pointer"
          value={context.targetDevice || ''}
          onChange={e => onChange({ ...context, targetDevice: e.target.value || null })}
        >
          <option value="">All Devices ({filteredDevicesForScope.length})</option>
          {filteredDevicesForScope.map(d => (
            <option key={d.id} value={d.name}>{d.name}</option>
          ))}
        </select>
      </div>

      {/* Time Range Selector */}
      <div className="flex items-center gap-1.5 text-surface-400 ml-auto">
        <Clock size={14} className="text-primary-500" />
        <select
          className="select text-xs py-1.5 px-2.5 w-auto bg-surface-50 dark:bg-surface-850 border border-surface-200 dark:border-surface-700 text-surface-700 dark:text-surface-200 font-bold focus:ring-1 focus:ring-primary-500 rounded-lg cursor-pointer"
          value={context.timeRange}
          onChange={e => handleTimeRangeChange(e.target.value)}
        >
          {Object.entries(TIME_RANGES).map(([key, v]) => (
            <option key={key} value={key}>{v.label}</option>
          ))}
        </select>
      </div>
    </div>
  )
}
