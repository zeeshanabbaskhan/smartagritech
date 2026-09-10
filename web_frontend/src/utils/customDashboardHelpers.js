import { DASHBOARD_TEMPLATES, widgetTypeMeta } from '../data/widgetCatalog'

export function uid(prefix = 'id') {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
}

export function makeWidget(partial = {}) {
  const meta = widgetTypeMeta(partial.type)
  return {
    id: partial.id || uid('widget'),
    type: partial.type || 'line',
    title: partial.title || meta.label,
    metric: partial.metric || 'energyConsumption',
    variableName: partial.variableName || null,
    unit: partial.unit || null,
    groupBy: partial.groupBy || 'none',
    color: partial.color || 'primary',
    timeRange: partial.timeRange || 'inherit',
    scopeOverride: partial.scopeOverride || null,
    targetDevice: partial.targetDevice || null,
    targetDeviceId: partial.targetDeviceId || null,
    targetSlave: partial.targetSlave || null,
    targetSlaveId: partial.targetSlaveId || partial.slaveId || null,
    content: partial.content || '',
    thresholds: partial.thresholds || [],
    metrics: partial.metrics || null,
    dbMapping: partial.dbMapping || null,
    w: partial.w || meta.defaultSize.w,
    h: partial.h || meta.defaultSize.h,
  }
}

export function findNextAvailablePosition(layout = [], w = 6, h = 8, maxCols = 12) {
  const width = Math.min(Math.max(1, w), maxCols)
  const height = Math.max(1, h)

  if (!layout || !layout.length) {
    return { x: 0, y: 0, w: width, h: height }
  }

  let maxY = 0
  for (const item of layout) {
    if (item && Number.isFinite(item.y) && Number.isFinite(item.h)) {
      maxY = Math.max(maxY, item.y + item.h)
    }
  }

  const overlaps = (x1, y1, w1, h1, x2, y2, w2, h2) => {
    return x1 < x2 + w2 && x1 + w1 > x2 && y1 < y2 + h2 && y1 + h1 > y2
  }

  for (let y = 0; y <= maxY + 1; y++) {
    for (let x = 0; x <= maxCols - width; x++) {
      let collides = false
      for (const item of layout) {
        if (!item || !Number.isFinite(item.x) || !Number.isFinite(item.y)) continue
        const itemW = item.w || 1
        const itemH = item.h || 1
        if (overlaps(x, y, width, height, item.x, item.y, itemW, itemH)) {
          collides = true
          break
        }
      }
      if (!collides) {
        return { x, y, w: width, h: height }
      }
    }
  }

  return { x: 0, y: maxY, w: width, h: height }
}

export function layoutForWidgets(widgets) {
  const cols = 12
  const layout = []
  widgets.forEach((w) => {
    const pos = findNextAvailablePosition(layout, w.w, w.h, cols)
    layout.push({ i: w.id, x: pos.x, y: pos.y, w: pos.w, h: pos.h, minW: 2, minH: 3 })
  })
  return layout
}

export function buildFromTemplate(templateId, name, targetDeviceId = null, { visibility = 'PRIVATE' } = {}) {
  const template = DASHBOARD_TEMPLATES.find((t) => t.id === templateId) || DASHBOARD_TEMPLATES[0]
  const widgets = template.widgets.map((w) => makeWidget(w))
  return {
    name: name || template.name,
    description: template.description,
    targetDeviceId: targetDeviceId || null,
    visibility: visibility === 'SHARED' || visibility === 'shared' ? 'SHARED' : 'PRIVATE',
    context: {
      level: 'organization',
      buildingId: null,
      floorId: null,
      departmentId: null,
      timeRange: 'today',
      favorites: {},
    },
    widgets,
    layout: layoutForWidgets(widgets),
  }
}

/** Normalize API dashboard for UI. Pass viewerUserId for per-user favorite state. */
export function mapDashboard(d, viewerUserId = null) {
  if (!d) return null
  const context = typeof d.context === 'object' && d.context ? d.context : {}
  const widgets = Array.isArray(d.widgets) ? d.widgets : []
  const layout = Array.isArray(d.layout) ? d.layout : []
  const favorites = context.favorites && typeof context.favorites === 'object' ? context.favorites : {}
  const favorite = viewerUserId
    ? !!favorites[viewerUserId]
    : !!context.favorite
  return {
    id: d.id,
    name: d.name,
    description: d.description || '',
    visibility: (d.visibility || 'PRIVATE').toLowerCase() === 'shared' ? 'shared' : 'private',
    visibilityRaw: d.visibility || 'PRIVATE',
    context: {
      level: 'organization',
      buildingId: null,
      floorId: null,
      departmentId: null,
      timeRange: 'today',
      favorites: {},
      ...context,
      favorites: { ...favorites },
    },
    widgets,
    layout,
    targetDeviceId: d.targetDeviceId || null,
    targetDevice: d.targetDeviceName || d.targetDevice || null,
    organizationId: d.organizationId,
    ownerUserId: d.ownerUserId,
    ownerEmail: d.owner?.email,
    ownerName: d.owner?.fullName,
    favorite,
    createdAt: d.createdAt,
    updatedAt: d.updatedAt,
    _raw: d,
  }
}

/** Build context patch that toggles favorite for one user without clobbering others. */
export function toggleFavoriteContext(context = {}, userId, nextValue) {
  const favorites = {
    ...(context.favorites && typeof context.favorites === 'object' ? context.favorites : {}),
  }
  if (nextValue) favorites[userId] = true
  else delete favorites[userId]
  const { favorite: _legacy, ...rest } = context
  return { ...rest, favorites }
}

export function toApiVisibility(v) {
  return v === 'shared' || v === 'SHARED' ? 'SHARED' : 'PRIVATE'
}
