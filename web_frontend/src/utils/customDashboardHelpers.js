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
    content: partial.content || '',
    thresholds: partial.thresholds || [],
    metrics: partial.metrics || null,
    dbMapping: partial.dbMapping || null,
    w: partial.w || meta.defaultSize.w,
    h: partial.h || meta.defaultSize.h,
  }
}

export function layoutForWidgets(widgets) {
  const cols = 12
  let cursorX = 0
  let cursorY = 0
  let rowH = 0
  return widgets.map((w) => {
    const width = Math.min(w.w, cols)
    if (cursorX + width > cols) {
      cursorX = 0
      cursorY += rowH
      rowH = 0
    }
    const item = { i: w.id, x: cursorX, y: cursorY, w: width, h: w.h, minW: 2, minH: 4 }
    cursorX += width
    rowH = Math.max(rowH, w.h)
    return item
  })
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
