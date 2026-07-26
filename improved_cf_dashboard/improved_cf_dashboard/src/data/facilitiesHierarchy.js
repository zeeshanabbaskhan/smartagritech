// ─────────────────────────────────────────────────────────────────────────
// Multi-Level Enterprise Facilities Hierarchy & Telemetry Generator
// ─────────────────────────────────────────────────────────────────────────

// Simple deterministic string hash -> 32-bit int
export function hashString(str) {
  let h = 0
  for (let i = 0; i < str.length; i++) {
    h = (Math.imul(31, h) + str.charCodeAt(i)) | 0
  }
  return h
}

// Seeded pseudo-random generator (mulberry32)
export function seededRandom(seed) {
  let a = seed
  return function () {
    a |= 0; a = (a + 0x6D2B79F5) | 0
    let t = Math.imul(a ^ (a >>> 15), 1 | a)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

// Hierarchy Node Types allowed by standard
export const NODE_TYPES = [
  { value: 'Organization', label: 'Organization' },
  { value: 'Campus',     label: 'Campus' },
  { value: 'Site',       label: 'Site' },
  { value: 'Building',   label: 'Building' },
  { value: 'Block',      label: 'Block' },
  { value: 'Wing',       label: 'Wing' },
  { value: 'Department', label: 'Department' },
  { value: 'Section',    label: 'Section' },
  { value: 'Floor',      label: 'Floor' },
  { value: 'Zone',       label: 'Zone' },
  { value: 'Room',       label: 'Room' },
  { value: 'Asset',      label: 'Asset' },
  { value: 'Device',     label: 'Device' },
  { value: 'Sensor',     label: 'Sensor' }
]

const DEFAULT_DEPARTMENTS = ['HVAC', 'Lighting', 'Server Room', 'Production Line A', 'Admin Section']

const HIERARCHY_OVERRIDE_KEY = 'cf-ems-org-hierarchy-overrides-v1'

function loadHierarchyOverrides() {
  try {
    const raw = localStorage.getItem(HIERARCHY_OVERRIDE_KEY)
    return raw ? JSON.parse(raw) : {}
  } catch {
    return {}
  }
}

function saveHierarchyOverrides(all) {
  try {
    localStorage.setItem(HIERARCHY_OVERRIDE_KEY, JSON.stringify(all))
  } catch {}
}

export function getOrgHierarchyOverride(orgName) {
  const all = loadHierarchyOverrides()
  const val = all[orgName]
  if (!val) return null
  // Convert legacy buildings layout to tree on load if needed
  if (val.buildings && !val.tree) {
    val.tree = convertLegacyBuildingsToTree(val.buildings)
  }
  return val
}

export function hasCustomHierarchy(orgName) {
  return !!getOrgHierarchyOverride(orgName)
}

// Convert legacy list of buildings to new generic tree structure
export function convertLegacyBuildingsToTree(buildings) {
  if (!buildings) return []
  return buildings.map(b => ({
    id: b.id || `b-${Math.random().toString(36).slice(2, 7)}`,
    name: b.name || 'Unnamed Building',
    type: 'Building',
    children: (b.floors || []).map(f => ({
      id: f.id || `f-${Math.random().toString(36).slice(2, 7)}`,
      name: f.name || 'Unnamed Floor',
      type: 'Floor',
      children: (f.departments || []).map(d => ({
        id: d.id || `d-${Math.random().toString(36).slice(2, 7)}`,
        name: d.name || 'Unnamed Department',
        type: 'Department',
        children: []
      }))
    }))
  }))
}

// Convert generic tree back to legacy buildings list for backward-compatibility
export function convertTreeToLegacyBuildings(tree) {
  if (!tree) return []
  // Filter out any nodes that map to buildings
  const buildings = []
  
  const searchForBuildings = (nodes) => {
    for (const n of nodes) {
      if (n.type === 'Building') {
        const floors = (n.children || []).map(f => ({
          id: f.id,
          name: f.name,
          departments: (f.children || []).map(d => ({
            id: d.id,
            name: d.name
          }))
        }))
        buildings.push({
          id: n.id,
          name: n.name,
          floors
        })
      } else if (n.children && n.children.length > 0) {
        searchForBuildings(n.children)
      }
    }
  }
  
  searchForBuildings(tree)
  return buildings
}

export function saveOrgHierarchy(orgName, tree) {
  const all = loadHierarchyOverrides()
  // Ensure every node has id, name, type, children
  const cleanNode = (n) => ({
    id: n.id || `node-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    name: n.name || 'Unnamed Node',
    type: n.type || 'Building',
    children: (n.children || []).map(cleanNode)
  })
  const cleanTree = (tree || []).map(cleanNode)
  all[orgName] = { 
    orgName, 
    tree: cleanTree,
    buildings: convertTreeToLegacyBuildings(cleanTree) // Backward compatibility
  }
  saveHierarchyOverrides(all)
  return all[orgName]
}

export function clearOrgHierarchyOverride(orgName) {
  const all = loadHierarchyOverrides()
  delete all[orgName]
  saveHierarchyOverrides(all)
}

export function renameOrgHierarchyOverride(oldName, newName) {
  if (oldName === newName) return
  const all = loadHierarchyOverrides()
  if (all[oldName]) {
    all[newName] = { ...all[oldName], orgName: newName }
    delete all[oldName]
    saveHierarchyOverrides(all)
  }
}

// Recursively find a node in the tree and return it and its parent path list
export function findNodeInTree(nodes, nodeId, path = []) {
  if (!nodes) return null
  for (const n of nodes) {
    if (n.id === nodeId) {
      return { node: n, path: [...path, n] }
    }
    if (n.children && n.children.length > 0) {
      const match = findNodeInTree(n.children, nodeId, [...path, n])
      if (match) return match
    }
  }
  return null
}

// Generate default enterprise hierarchy: Organization -> Building -> Floor -> Department
function generateDefaultHierarchy(orgName) {
  const rootId = `${orgName}-root`
  const tree = [
    {
      id: rootId,
      name: orgName || 'Main Organization',
      type: 'Organization',
      children: Array.from({ length: 2 }, (_, bi) => {
        const buildingId = `${rootId}-b${bi}`
        const buildingName = bi === 0 ? 'Main Building' : 'Secondary Facility'
        
        return {
          id: buildingId,
          name: buildingName,
          type: 'Building',
          children: Array.from({ length: 3 }, (_, fi) => {
            const floorId = `${buildingId}-f${fi}`
            const floorName = fi === 0 ? 'Ground Floor' : `Floor ${fi}`
            
            return {
              id: floorId,
              name: floorName,
              type: 'Floor',
              children: DEFAULT_DEPARTMENTS.slice(0, 3).map((dName, di) => ({
                id: `${floorId}-d${di}`,
                name: dName,
                type: 'Department',
                children: []
              }))
            }
          })
        }
      })
    }
  ]

  return { orgName, tree, buildings: convertTreeToLegacyBuildings(tree) }
}

export function getOrgHierarchy(orgName) {
  const override = getOrgHierarchyOverride(orgName)
  if (override && override.tree?.length) {
    return { 
      orgName, 
      tree: override.tree, 
      buildings: override.buildings || convertTreeToLegacyBuildings(override.tree) 
    }
  }
  return generateDefaultHierarchy(orgName)
}

// Helper functions matching legacy building/floor/dept queries for backward compatibility
export function findBuilding(hierarchy, buildingId) {
  const match = findNodeInTree(hierarchy.tree, buildingId)
  return match?.node ? { ...match.node, floors: match.node.children || [] } : null
}

export function findFloor(hierarchy, buildingId, floorId) {
  const match = findNodeInTree(hierarchy.tree, floorId)
  return match?.node ? { ...match.node, departments: match.node.children || [] } : null
}

export function findDepartment(hierarchy, buildingId, floorId, departmentId) {
  const match = findNodeInTree(hierarchy.tree, departmentId)
  return match?.node || null
}

// Construct breadcrumb label from scope context
export function scopeLabel(hierarchy, scope) {
  if (!scope || scope.level === 'organization' || !scope.nodeId) {
    // Resolve legacy building/floor/department context to nodeId
    let resolvedNodeId = null
    if (scope?.departmentId) resolvedNodeId = scope.departmentId
    else if (scope?.floorId) resolvedNodeId = scope.floorId
    else if (scope?.buildingId) resolvedNodeId = scope.buildingId

    if (!resolvedNodeId) return hierarchy.orgName
    
    const match = findNodeInTree(hierarchy.tree, resolvedNodeId)
    if (!match) return hierarchy.orgName
    return match.path.map(n => n.name).join(' / ')
  }

  const match = findNodeInTree(hierarchy.tree, scope.nodeId)
  if (!match) return hierarchy.orgName
  return match.path.map(n => n.name).join(' / ')
}

// ── Metric Catalog ─────────────────────────────────────────────────────
export const METRICS = {
  energyConsumption: { label: 'Energy Consumption', unit: 'kWh', base: 420, variance: 180, color: '#F5A623' },
  activePower:       { label: 'Active Power',        unit: 'kW',  base: 68,  variance: 30,  color: '#3B82F6' },
  voltage:           { label: 'Voltage',              unit: 'V',   base: 228, variance: 8,   color: '#F5A623' },
  current:           { label: 'Current',              unit: 'A',   base: 42,  variance: 15,  color: '#EF4444' },
  powerFactor:       { label: 'Power Factor',         unit: '',    base: 0.92,variance: 0.06,color: '#22C55E' },
  cost:              { label: 'Energy Cost',          unit: 'PKR', base: 12500, variance: 4200, color: '#8C510A' },
  carbonEmissions:   { label: 'Carbon Emissions',     unit: 'kg CO₂', base: 210, variance: 90, color: '#16A34A' },
  devicesOnline:     { label: 'Devices Online',       unit: '',    base: 14,  variance: 4,   color: '#2563EB' },
  activeAlarms:      { label: 'Active Alarms',        unit: '',    base: 3,   variance: 3,   color: '#DC2626' },
}

export const TIME_RANGES = {
  today: { label: 'Today',   points: 24, unitLabel: 'hr' },
  week:  { label: 'This Week', points: 7,  unitLabel: 'day' },
  month: { label: 'This Month', points: 30, unitLabel: 'day' },
  year:  { label: 'This Year', points: 12, unitLabel: 'mo' },
}

function scopeSeed(orgName, scope, metric, extra = '') {
  let resolvedNodeId = scope?.nodeId
  if (!resolvedNodeId) {
    if (scope?.departmentId) resolvedNodeId = scope.departmentId
    else if (scope?.floorId) resolvedNodeId = scope.floorId
    else if (scope?.buildingId) resolvedNodeId = scope.buildingId
  }
  const scopeKey = resolvedNodeId || 'org'
  const deviceKey = scope?.targetDevice || ''
  return hashString(`${orgName}::${scopeKey}::${deviceKey}::${metric}::${extra}`)
}

function timeLabel(range, i) {
  if (range === 'today') return `${String(i).padStart(2, '0')}:00`
  if (range === 'week') return ['Mon','Tue','Wed','Thu','Fri','Sat','Sun'][i] || `D${i+1}`
  if (range === 'month') return `${i + 1}`
  if (range === 'year') return ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'][i] || `M${i+1}`
  return `${i}`
}

// Generate time series data scaled based on tree level depth
export function generateSeries(orgName, scope, metric, timeRange = 'today') {
  const cfg = METRICS[metric] || METRICS.energyConsumption
  const rangeCfg = TIME_RANGES[timeRange] || TIME_RANGES.today
  const rnd = seededRandom(scopeSeed(orgName, scope, metric, timeRange))
  const points = rangeCfg.points

  // Dynamically calculate scale based on depth in hierarchy tree
  let depth = 0
  let resolvedNodeId = scope?.nodeId
  if (!resolvedNodeId) {
    if (scope?.departmentId) resolvedNodeId = scope.departmentId
    else if (scope?.floorId) resolvedNodeId = scope.floorId
    else if (scope?.buildingId) resolvedNodeId = scope.buildingId
  }
  
  if (resolvedNodeId) {
    const hierarchy = getOrgHierarchy(orgName)
    const match = findNodeInTree(hierarchy.tree, resolvedNodeId)
    if (match) {
      depth = match.path.length
    }
  }

  // Root is 1.0; each nested level scales down by 25-35%
  const scale = Math.max(0.05, Math.pow(0.7, depth))

  const data = []
  for (let i = 0; i < points; i++) {
    const wave = Math.sin((i / points) * Math.PI * 2) * 0.3 + 1
    const noise = 0.85 + rnd() * 0.3
    let value = cfg.base * scale * wave * noise + (rnd() - 0.5) * cfg.variance * scale * 0.4
    if (metric === 'powerFactor') value = Math.min(0.99, Math.max(0.65, cfg.base + (rnd() - 0.5) * cfg.variance))
    if (metric === 'devicesOnline' || metric === 'activeAlarms') value = Math.max(0, Math.round(cfg.base * scale * (0.7 + rnd() * 0.6)))
    data.push({ label: timeLabel(timeRange, i), value: Math.round(value * 100) / 100 })
  }
  return data
}

// Get nodes directly underneath target scope node
export function getScopeChildren(hierarchy, scope) {
  let resolvedNodeId = scope?.nodeId
  if (!resolvedNodeId) {
    if (scope?.departmentId) resolvedNodeId = scope.departmentId
    else if (scope?.floorId) resolvedNodeId = scope.floorId
    else if (scope?.buildingId) resolvedNodeId = scope.buildingId
  }

  if (!resolvedNodeId) {
    // Org level -> return level 1 children
    return (hierarchy.tree || []).map(n => ({ level: n.type.toLowerCase(), nodeId: n.id, name: n.name }))
  }

  const match = findNodeInTree(hierarchy.tree, resolvedNodeId)
  if (!match || !match.node.children) return []
  return match.node.children.map(n => ({ level: n.type.toLowerCase(), nodeId: n.id, name: n.name }))
}

// Comparison datasets (bar/pie widgets comparing peer sub-entities)
export function generateComparison(orgName, hierarchy, scope, metric, timeRange = 'today') {
  const children = getScopeChildren(hierarchy, scope)
  const cfg = METRICS[metric] || METRICS.energyConsumption
  return children.map(child => {
    const series = generateSeries(orgName, child, metric, timeRange)
    const total = series.reduce((s, p) => s + p.value, 0)
    const value = metric === 'powerFactor'
      ? series[series.length - 1]?.value ?? cfg.base
      : Math.round(total * 100) / 100
    return { name: child.name, value, unit: cfg.unit }
  })
}

// Single current-value read
export function generateCurrentValue(orgName, scope, metric) {
  const series = generateSeries(orgName, scope, metric, 'today')
  return series[series.length - 1]?.value ?? 0
}

// Device breakdowns list
export function generateDeviceTable(orgName, scope, metric) {
  const rnd = seededRandom(scopeSeed(orgName, scope, metric, 'table'))
  const cfg = METRICS[metric] || METRICS.energyConsumption
  const count = 3 + Math.floor(rnd() * 4)
  const rows = []
  for (let i = 0; i < count; i++) {
    rows.push({
      device: `Device-${String(i + 1).padStart(2, '0')}`,
      value: Math.round(cfg.base * 0.1 * (0.5 + rnd()) * 100) / 100,
      status: rnd() > 0.15 ? 'Online' : 'Offline',
      unit: cfg.unit,
    })
  }
  return rows
}

// Alarms feed
export function generateAlarms(orgName, scope) {
  const rnd = seededRandom(scopeSeed(orgName, scope, 'alarms', 'list'))
  const templates = [
    { name: 'Voltage Imbalance', severity: 'warning' },
    { name: 'Overcurrent Trip', severity: 'danger' },
    { name: 'Power Factor Low', severity: 'warning' },
    { name: 'Device Offline', severity: 'danger' },
    { name: 'Temperature High', severity: 'warning' },
    { name: 'Scheduled Maintenance Due', severity: 'info' },
  ]
  const count = 2 + Math.floor(rnd() * 3)
  const rows = []
  for (let i = 0; i < count; i++) {
    const t = templates[Math.floor(rnd() * templates.length)]
    const hoursAgo = Math.floor(rnd() * 48)
    rows.push({ id: i, name: t.name, severity: t.severity, time: `${hoursAgo}h ago` })
  }
  return rows
}

// Strict enterprise hierarchy parent-child sequence map.
// This enforces the standardized layout tree of:
// Organization -> Campus -> Site -> Building -> Block -> Wing -> Department -> Section -> Floor -> Zone -> Room -> Asset -> Device -> Sensor
// It supports skipping levels (e.g. going directly from Building to Floor or Floor to Department)
// but strictly prevents going backwards or placing out-of-order parent types inside lower elements.
export const VALID_CHILD_TYPES = {
  Organization: ['Campus', 'Site', 'Building'],
  Campus:       ['Site', 'Building'],
  Site:         ['Building'],
  Building:     ['Block', 'Wing', 'Floor'],
  Block:        ['Wing', 'Floor'],
  Wing:         ['Floor'],
  Floor:        ['Department', 'Zone', 'Room'],
  Zone:         ['Room', 'Department'],
  Room:         ['Asset', 'Department'],
  Department:   ['Section', 'Device'],
  Section:      ['Device'],
  Asset:        ['Device'],
  Device:       ['Sensor'],
  Sensor:       [], // Leaf
}

export function validChildTypes(parentType) {
  return VALID_CHILD_TYPES[parentType] ?? []
}

