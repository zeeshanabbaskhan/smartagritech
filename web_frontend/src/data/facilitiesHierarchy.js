/** Facility hierarchy helpers + seeded mock telemetry for custom dashboard widgets. */

export function hashString(str) {
  let h = 0
  for (let i = 0; i < str.length; i++) {
    h = (Math.imul(31, h) + str.charCodeAt(i)) | 0
  }
  return h
}

export function seededRandom(seed) {
  let a = seed
  return function () {
    a |= 0
    a = (a + 0x6D2B79F5) | 0
    let t = Math.imul(a ^ (a >>> 15), 1 | a)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

export const NODE_TYPES = [
  { value: 'Organization', label: 'Organization' },
  { value: 'Campus', label: 'Campus' },
  { value: 'Site', label: 'Site' },
  { value: 'Building', label: 'Building' },
  { value: 'Block', label: 'Block' },
  { value: 'Wing', label: 'Wing' },
  { value: 'Department', label: 'Department' },
  { value: 'Section', label: 'Section' },
  { value: 'Floor', label: 'Floor' },
  { value: 'Zone', label: 'Zone' },
  { value: 'Room', label: 'Room' },
  { value: 'Asset', label: 'Asset' },
  { value: 'Device', label: 'Device' },
  { value: 'Sensor', label: 'Sensor' },
]

/** API stores UPPERCASE enums; UI uses Title Case. */
export function apiTypeToUi(type) {
  if (!type) return 'Building'
  return String(type).charAt(0) + String(type).slice(1).toLowerCase()
}

export function uiTypeToApi(type) {
  if (!type) return 'BUILDING'
  const allowed = new Set([
    'ORGANIZATION', 'CAMPUS', 'SITE', 'BUILDING', 'BLOCK', 'WING',
    'FLOOR', 'DEPARTMENT', 'SECTION', 'ROOM',
  ])
  const upper = String(type).toUpperCase()
  if (allowed.has(upper)) return upper
  // Map unsupported HierarchyEditor types to closest allowed
  if (upper === 'ZONE') return 'FLOOR'
  if (upper === 'ASSET' || upper === 'DEVICE') return 'ROOM'
  if (upper === 'SENSOR') return 'ROOM'
  return 'BUILDING'
}

export function mapTreeFromApi(nodes = []) {
  const mapNode = (n) => ({
    id: n.id,
    name: n.name,
    type: apiTypeToUi(n.type),
    parentId: n.parentId || null,
    sortOrder: n.sortOrder ?? 0,
    deviceIds: Array.isArray(n.deviceIds) ? n.deviceIds : (n.devices || []).map((d) => d.id || d.deviceId).filter(Boolean),
    devices: n.devices || [],
    children: (n.children || []).map(mapNode),
  })
  return (nodes || []).map(mapNode)
}

/** Flatten nested UI tree into nodes for replaceFacilityTree. */
export function flattenTreeForApi(tree = [], parentId = null, out = []) {
  for (let i = 0; i < tree.length; i++) {
    const n = tree[i]
    const id = n.id || `temp-${out.length}`
    out.push({
      id,
      tempId: id,
      name: n.name,
      type: uiTypeToApi(n.type),
      parentId,
      sortOrder: i,
      deviceIds: Array.isArray(n.deviceIds) ? n.deviceIds : [],
    })
    if (n.children?.length) flattenTreeForApi(n.children, id, out)
  }
  return out
}

/** Collect deviceIds on a node and all descendants. */
export function collectDeviceIdsFromNode(node) {
  const ids = new Set(node?.deviceIds || [])
  for (const child of node?.children || []) {
    collectDeviceIdsFromNode(child).forEach((id) => ids.add(id))
  }
  return [...ids]
}

/** Resolve device IDs for a dashboard scope (building/floor/department/node). */
export function resolveScopeDeviceIds(hierarchy, scope) {
  if (!hierarchy?.tree?.length) return []
  let resolvedNodeId = scope?.nodeId
  if (!resolvedNodeId) {
    if (scope?.departmentId) resolvedNodeId = scope.departmentId
    else if (scope?.floorId) resolvedNodeId = scope.floorId
    else if (scope?.buildingId) resolvedNodeId = scope.buildingId
  }
  if (!resolvedNodeId) {
    // Whole org: all devices linked anywhere in the tree
    const all = new Set()
    for (const root of hierarchy.tree) {
      collectDeviceIdsFromNode(root).forEach((id) => all.add(id))
    }
    return [...all]
  }
  const match = findNodeInTree(hierarchy.tree, resolvedNodeId)
  if (!match?.node) return []
  return collectDeviceIdsFromNode(match.node)
}

export function findNodeInTree(nodes, nodeId, path = []) {
  if (!nodes) return null
  for (const n of nodes) {
    if (n.id === nodeId) return { node: n, path: [...path, n] }
    if (n.children?.length) {
      const match = findNodeInTree(n.children, nodeId, [...path, n])
      if (match) return match
    }
  }
  return null
}

export function scopeLabel(hierarchy, scope) {
  if (!hierarchy) return 'Organization'
  if (!scope || scope.level === 'organization' || !scope.nodeId) {
    let resolvedNodeId = null
    if (scope?.departmentId) resolvedNodeId = scope.departmentId
    else if (scope?.floorId) resolvedNodeId = scope.floorId
    else if (scope?.buildingId) resolvedNodeId = scope.buildingId
    if (!resolvedNodeId) return hierarchy.orgName || 'Organization'
    const match = findNodeInTree(hierarchy.tree, resolvedNodeId)
    if (!match) return hierarchy.orgName || 'Organization'
    return match.path.map((n) => n.name).join(' / ')
  }
  const match = findNodeInTree(hierarchy.tree, scope.nodeId)
  if (!match) return hierarchy.orgName || 'Organization'
  return match.path.map((n) => n.name).join(' / ')
}

export const METRICS = {
  energyConsumption: { label: 'Energy Consumption', unit: 'kWh', base: 420, variance: 180, color: '#F5A623' },
  activePower: { label: 'Active Power', unit: 'kW', base: 68, variance: 30, color: '#3B82F6' },
  voltage: { label: 'Voltage', unit: 'V', base: 228, variance: 8, color: '#F5A623' },
  current: { label: 'Current', unit: 'A', base: 42, variance: 15, color: '#EF4444' },
  powerFactor: { label: 'Power Factor', unit: '', base: 0.92, variance: 0.06, color: '#22C55E' },
  cost: { label: 'Energy Cost', unit: 'PKR', base: 12500, variance: 4200, color: '#8C510A' },
  carbonEmissions: { label: 'Carbon Emissions', unit: 'kg CO₂', base: 210, variance: 90, color: '#16A34A' },
  devicesOnline: { label: 'Devices Online', unit: '', base: 14, variance: 4, color: '#2563EB' },
  activeAlarms: { label: 'Active Alarms', unit: '', base: 3, variance: 3, color: '#DC2626' },
}

export const TIME_RANGES = {
  today: { label: 'Today', points: 24, unitLabel: 'hr' },
  week: { label: 'This Week', points: 7, unitLabel: 'day' },
  month: { label: 'This Month', points: 30, unitLabel: 'day' },
  year: { label: 'This Year', points: 12, unitLabel: 'mo' },
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
  if (range === 'week') return ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'][i] || `D${i + 1}`
  if (range === 'month') return `${i + 1}`
  if (range === 'year') return ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'][i] || `M${i + 1}`
  return `${i}`
}

function scopeDepth(scope) {
  if (scope?.departmentId || scope?.level === 'department') return 3
  if (scope?.floorId || scope?.level === 'floor') return 2
  if (scope?.buildingId || scope?.level === 'building') return 1
  if (scope?.nodeId) return 2
  return 0
}

export function generateSeries(orgName, scope, metric, timeRange = 'today') {
  const cfg = METRICS[metric] || METRICS.energyConsumption
  const rangeCfg = TIME_RANGES[timeRange] || TIME_RANGES.today
  const rnd = seededRandom(scopeSeed(orgName, scope, metric, timeRange))
  const points = rangeCfg.points
  const scale = Math.max(0.05, Math.pow(0.7, scopeDepth(scope)))
  const data = []
  for (let i = 0; i < points; i++) {
    const wave = Math.sin((i / points) * Math.PI * 2) * 0.3 + 1
    const noise = 0.85 + rnd() * 0.3
    let value = cfg.base * scale * wave * noise + (rnd() - 0.5) * cfg.variance * scale * 0.4
    if (metric === 'powerFactor') value = Math.min(0.99, Math.max(0.65, cfg.base + (rnd() - 0.5) * cfg.variance))
    if (metric === 'devicesOnline' || metric === 'activeAlarms') {
      value = Math.max(0, Math.round(cfg.base * scale * (0.7 + rnd() * 0.6)))
    }
    data.push({ label: timeLabel(timeRange, i), value: Math.round(value * 100) / 100 })
  }
  return data
}

export function getScopeChildren(hierarchy, scope) {
  let resolvedNodeId = scope?.nodeId
  if (!resolvedNodeId) {
    if (scope?.departmentId) resolvedNodeId = scope.departmentId
    else if (scope?.floorId) resolvedNodeId = scope.floorId
    else if (scope?.buildingId) resolvedNodeId = scope.buildingId
  }
  if (!resolvedNodeId) {
    return (hierarchy?.tree || []).map((n) => ({ level: n.type.toLowerCase(), nodeId: n.id, name: n.name }))
  }
  const match = findNodeInTree(hierarchy?.tree, resolvedNodeId)
  if (!match?.node?.children) return []
  return match.node.children.map((n) => ({ level: n.type.toLowerCase(), nodeId: n.id, name: n.name }))
}

export function generateComparison(orgName, hierarchy, scope, metric, timeRange = 'today') {
  const children = getScopeChildren(hierarchy, scope)
  const cfg = METRICS[metric] || METRICS.energyConsumption
  return children.map((child) => {
    const series = generateSeries(orgName, child, metric, timeRange)
    const total = series.reduce((s, p) => s + p.value, 0)
    const value = metric === 'powerFactor'
      ? series[series.length - 1]?.value ?? cfg.base
      : Math.round(total * 100) / 100
    return { name: child.name, value, unit: cfg.unit }
  })
}

export function generateCurrentValue(orgName, scope, metric) {
  const series = generateSeries(orgName, scope, metric, 'today')
  return series[series.length - 1]?.value ?? 0
}

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
