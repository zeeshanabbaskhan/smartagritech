/** Map API entities to UI table/card shapes used across pages */

const fmtDate = (d) => {
  if (!d) return '—'
  const s = typeof d === 'string' ? d : d.toISOString?.() ?? String(d)
  return s.length > 16 ? s.slice(0, 16).replace('T', ' ') : s
}

const statusLabel = (s) => {
  if (!s) return '—'
  const m = { ONLINE: 'Online', OFFLINE: 'Offline', ACTIVE: 'Active', INACTIVE: 'Inactive', ON: 'On', OFF: 'Off' }
  return m[s] ?? s.charAt(0) + s.slice(1).toLowerCase()
}

export const mapOrganization = (o) => ({
  id: o.id,
  name: o.name,
  description: o.description ?? '',
  status: statusLabel(o.status),
  statusRaw: o.status,
  theme: o.theme?.name ?? '—',
  themeId: o.themeId,
  logoUrl: o.logoUrl,
  createdAt: fmtDate(o.createdAt),
  _raw: o,
})

export const mapUser = (u, orgName) => ({
  id: u.id,
  name: u.fullName,
  email: u.email,
  phone: u.phone ?? '—',
  org: orgName ?? u.organization?.name ?? '—',
  organizationId: u.organizationId,
  role: u.role === 'ORG_ADMIN' ? 'Org Admin' : u.role === 'SUPER_ADMIN' ? 'Super Admin' : 'User',
  roleRaw: u.role,
  status: statusLabel(u.status),
  statusRaw: u.status,
  createdAt: fmtDate(u.createdAt),
  _raw: u,
})

export const mapGateway = (g) => ({
  id: g.id,
  name: g.name,
  serial: g.serialNumber,
  model: g.model ?? '—',
  org: g.organization?.name ?? '—',
  organizationId: g.organizationId,
  devices: g._count?.devices ?? 0,
  status: statusLabel(g.status),
  statusRaw: g.status,
  lastSeen: fmtDate(g.lastSeenAt),
  createdAt: fmtDate(g.createdAt),
  _raw: g,
})

export const mapDevice = (d) => ({
  id: d.id,
  name: d.name,
  org: d.organization?.name ?? '—',
  organizationId: d.organizationId,
  gateway: d.gateway?.name ?? '—',
  gatewayId: d.gatewayId,
  template: d.template?.name ?? '—',
  templateId: d.templateId,
  status: statusLabel(d.status),
  statusRaw: d.status,
  switchOn: d.switchState === 'ON',
  switchState: d.switchState,
  lastSeen: fmtDate(d.lastDataReceivedAt),
  latestMetrics: d.latestMetrics,
  _raw: d,
})

export const mapDeviceTemplate = (t) => ({
  id: t.id,
  name: t.name,
  org: t.organization?.name ?? '—',
  organizationId: t.organizationId,
  method: t.acquisitionMethod ?? '—',
  slaves: t._count?.slaves ?? t.totalSlaves ?? 0,
  variables: t.totalVariables ?? 0,
  devices: t._count?.devices ?? 0,
  createdAt: fmtDate(t.createdAt),
  _raw: t,
})

export const mapProduct = (p) => ({
  id: p.id,
  name: p.name,
  category: p.category ?? '—',
  price: p.price != null ? `$${p.price}` : '—',
  status: p.isActive === false ? 'Inactive' : 'Active',
  description: p.description ?? '',
  _raw: p,
})

export const mapIcon = (i) => ({
  id: i.id,
  name: i.name,
  category: i.category ?? 'General',
  url: i.url ?? i.imageUrl,
  _raw: i,
})

export const mapNotification = (n) => ({
  id: n.id,
  title: n.triggerName ?? 'Notification',
  device: n.deviceName ?? '—',
  message: n.description ?? '',
  read: n.read,
  severity: n.read ? 'info' : 'warning',
  time: fmtDate(n.createdAt),
  _raw: n,
})

const repeatToUi = (r) => ({ DAILY: 'Daily', WEEKLY: 'Weekly', ONCE: 'Monthly' }[r] ?? r)

export const mapScheduledTask = (t) => ({
  id: t.id,
  name: t.variableName,
  org: t.organization?.name ?? '—',
  organizationId: t.organizationId,
  device: t.device?.name ?? t.deviceId ?? '—',
  deviceId: t.deviceId,
  variable: t.variableName,
  taskType: t.action === 'ON' ? 'Turn On' : 'Turn Off',
  frequency: repeatToUi(t.repeatType),
  time: t.scheduledTime,
  schedule: `${repeatToUi(t.repeatType)} ${t.scheduledTime}`,
  recipients: '—',
  action: t.action,
  repeat: t.repeatType,
  status: statusLabel(t.status),
  statusRaw: t.status,
  lastRun: fmtDate(t.nextRunAt),
  nextRun: fmtDate(t.nextRunAt),
  _raw: t,
})

export const mapSlabRate = (s) => ({
  id: s.id,
  slave: s.deviceConfigSlave?.name ?? s.deviceConfigSlaveId ?? '—',
  slaveId: s.deviceConfigSlaveId,
  slaveName: s.deviceConfigSlave?.name ?? s.deviceConfigSlaveId ?? '—',
  variable: s.variableName ?? '—',
  variableName: s.variableName ?? 'Power Consumption',
  from: s.unitFrom,
  to: s.unitTo,
  totalUnit: s.unitTo ?? s.unitFrom ?? 0,
  tariff: s.rate != null ? `PKR ${s.rate}/unit` : '—',
  startDate: fmtDate(s.createdAt)?.slice(0, 10) ?? '—',
  endDate: fmtDate(s.updatedAt)?.slice(0, 10) ?? '—',
  rate: s.rate,
  unitFrom: s.unitFrom,
  unitTo: s.unitTo,
  _raw: s,
})

export const mapIntervalHistory = (h) => ({
  id: h.id,
  variable: h.variableName,
  slave: h.slaveName ?? '—',
  unit: h.totalUnit != null ? String(h.totalUnit) : '—',
  tariff: h.tariff != null ? String(h.tariff) : '—',
  from: fmtDate(h.startDate),
  to: fmtDate(h.endDate),
  computedAt: fmtDate(h.computedAt),
  _raw: h,
})

export const mapAnomaly = (a) => ({
  id: a.id,
  device: a.device?.name ?? a.deviceId,
  deviceId: a.deviceId,
  variable: a.variableName,
  trigger: a.triggerName ?? '—',
  type: a.triggerName ?? a.triggerType ?? 'Anomaly',
  desc: a.triggeringCondition ?? '—',
  severity: a.alarmState === 'ACTIVE' ? 'High' : 'Medium',
  status: a.alarmState === 'ACTIVE' ? 'Active' : 'Resolved',
  value: a.currentValue,
  condition: a.triggeringCondition,
  state: a.alarmState,
  process: a.processState,
  time: fmtDate(a.alarmTime),
  _raw: a,
})

export const mapNotificationRow = (n) => ({
  id: n.id,
  triggerName: n.triggerName ?? 'Notification',
  deviceName: n.deviceName ?? '—',
  description: n.description ?? '',
  time: fmtDate(n.createdAt),
  read: n.read,
  severity: n.read ? 'info' : 'warning',
  _raw: n,
})

export const mapSubscriptionUi = (s, orgName) => ({
  id: s.id,
  plan: s.name,
  org: orgName ?? s.organization?.name ?? '—',
  startDate: fmtDate(s.submittedAt)?.slice(0, 10) ?? '—',
  endDate: '—',
  status: s.status === 'CLOSED' ? 'Expired' : s.status === 'CONTACTED' ? 'Active' : 'Pending',
  devices: '—',
  email: s.email,
  phone: s.phone ?? '—',
  description: s.description ?? '',
  _raw: s,
})

const operatorToUi = (op) => {
  const m = { GT: 'Greater Than', LT: 'Less Than', EQ: 'Equal To', GTE: 'Greater or Equal', LTE: 'Less or Equal' }
  return m[op] ?? op ?? '—'
}

export const mapAlarmTemplate = (t) => ({
  id: t.id,
  name: t.name,
  org: t.organization?.name ?? '—',
  organizationId: t.organizationId,
  template: t.deviceTemplate?.name ?? '—',
  templateName: t.deviceTemplate?.name ?? '—',
  deviceTemplateId: t.deviceTemplateId,
  variable: t.watchedVariable?.name ?? '—',
  templateVariableId: t.templateVariableId,
  operator: t.operator,
  condition: operatorToUi(t.operator),
  threshold: t.threshold != null ? String(t.threshold) : '—',
  type: t.anomalyType,
  priority: t.priority,
  methods: [],
  message: '',
  founder: t.creator?.fullName ?? '—',
  triggerCondition: `${operatorToUi(t.operator)} ${t.threshold ?? ''}`.trim(),
  updatedAt: fmtDate(t.updatedAt),
  status: t.isActive === false ? 'Inactive' : 'Active',
  active: t.isActive,
  method: 'Email',
  _raw: t,
})

export const mapAlarmSetting = (s) => ({
  id: s.id,
  name: s.name ?? s.pushType,
  org: s.organization?.name ?? '—',
  organizationId: s.organizationId,
  templateTriggerId: s.templateTriggerId,
  pushType: s.pushType ?? 'Template Trigger',
  pushMethod: s.pushMethod ?? 'Email',
  mechanism: s.pushingMechanism === 'DELAYED' ? 'Delayed' : 'Instant',
  delay: s.pushDelay ?? '',
  status: statusLabel(s.status),
  statusRaw: s.status,
  updatedAt: fmtDate(s.updatedAt),
  devices: s.configDevices?.length ?? s._count?.devices ?? 0,
  _raw: s,
})

export const mapAlarmContact = (c, orgName) => ({
  id: c.id,
  name: c.name ?? c.email ?? c.mobile,
  org: orgName ?? c.organization?.name ?? '—',
  organizationId: c.organizationId,
  email: c.email ?? '—',
  phone: c.mobile ?? c.phone ?? '—',
  whatsapp: c.whatsapp ?? '—',
  remark: c.remark ?? '',
  updatedAt: fmtDate(c.updatedAt),
  type: c.contactType ?? 'email',
  _raw: c,
})

export const mapVariableAlarm = (a, deviceName) => ({
  id: a.id,
  device: deviceName ?? a.deviceId,
  deviceName: deviceName ?? a.deviceId,
  deviceId: a.deviceId,
  variable: a.variableName,
  variableName: a.variableName,
  type: a.triggerType ?? a.triggerName ?? '—',
  threshold: a.triggeringCondition ?? '—',
  actual: a.currentValue != null ? String(a.currentValue) : '—',
  time: fmtDate(a.alarmTime),
  status: a.processState === 'PROCESSED' ? 'Resolved' : 'Active',
  triggerName: a.triggerName,
  currentValue: a.currentValue,
  operator: a.triggeringCondition?.split(' ')[1] ?? '',
  alarmState: a.alarmState,
  processState: a.processState,
  alarmTime: a.alarmTime,
  _raw: a,
})

export const mapLinkageRecord = (r, deviceName) => ({
  id: r.id,
  name: r.triggerName ?? '—',
  srcDevice: deviceName ?? r.deviceId,
  deviceName: deviceName ?? r.deviceId,
  deviceId: r.deviceId,
  srcVar: r.watchedVariableName ?? '—',
  condition: '—',
  threshold: r.watchedVariableValue != null ? String(r.watchedVariableValue) : '—',
  tgtDevice: r.linkedVariableName ?? '—',
  triggerName: r.triggerName,
  watchedVariableName: r.watchedVariableName,
  currentValue: r.watchedVariableValue,
  linkedVariableName: r.linkedVariableName,
  action: r.actionTaken === 'ON' ? 'Turn On' : r.actionTaken === 'OFF' ? 'Turn Off' : (r.actionTaken ?? '—'),
  status: 'Active',
  createdAt: fmtDate(r.firedAt),
  _raw: r,
})

export const mapAlarmHistoryNotification = (n) => ({
  id: n.id,
  device: n.device,
  message: n.message,
  pushType: n.pushType,
  sentTo: n.sentTo,
  status: n.status,
  sentAt: n.sentAt,
  _raw: n,
})

export const mapDeviceTimestamp = (t, orgName) => {
  const online = t.onlineStatus === 'ONLINE' || t.device?.status === 'ONLINE'
  const mins = t.lastActiveMinsAgo ?? 0
  const uptimePct = online ? Math.max(0, 100 - Math.min(mins, 100)) : Math.max(0, 100 - Math.min(mins * 2, 100))
  return {
    id: t.id,
    device: t.device?.name ?? t.deviceId,
    deviceId: t.deviceId,
    org: orgName ?? '—',
    lastOnline: fmtDate(t.lastActiveAt),
    lastData: fmtDate(t.lastActiveAt),
    lastActive: fmtDate(t.lastActiveAt),
    uptime: `${uptimePct.toFixed(1)}%`,
    downtime: `${(100 - uptimePct).toFixed(1)}%`,
    status: online ? 'Online' : 'Offline',
    _raw: t,
  }
}

export const mapTheme = (t) => ({
  id: t.id,
  name: t.name,
  primary: t.headerBgColor ?? t.primaryColor ?? '#F5A623',
  secondary: t.bodyBgColor ?? '#0ea5e9',
  headerFontColor: t.headerFontColor,
  headerBgColor: t.headerBgColor,
  bodyFontColor: t.bodyFontColor,
  bodyBgColor: t.bodyBgColor,
  fontSize: t.fontSize,
  status: statusLabel(t.status),
  statusRaw: t.status,
  isDefault: t.status === 'ACTIVE',
  _raw: t,
})

export const mapSetting = (s) => ({
  key: s.key,
  value: s.value,
  _raw: s,
})

export const mapSubscription = (s) => ({
  id: s.id,
  name: s.name,
  email: s.email,
  phone: s.phone ?? '—',
  status: s.status,
  submittedAt: fmtDate(s.submittedAt),
  description: s.description ?? '',
  _raw: s,
})

/** Chart helpers */
export const bucketToChart = (points, valueKey = 'value', timeKey = 'timestamp') =>
  (points ?? []).map((p) => ({
    time: fmtDate(p[timeKey]).slice(11, 16) || fmtDate(p[timeKey]),
    [valueKey]: p[valueKey] ?? p.value,
    ...p,
  }))

export const dashboardChartSeries = (summary, key) =>
  (summary?.[key]?.chartData ?? []).map((p) => ({
    time: fmtDate(p.timestamp).slice(11, 16) || fmtDate(p.timestamp),
    value: p.value,
  }))

export const aiPointsToChart = (points, key = 'value') =>
  (points ?? []).map((p) => ({
    time: new Date(p.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    [key]: p.value,
    value: p.value,
  }))

export const mergeVoltageChart = (chartData) => {
  const len = chartData?.voltageA?.length ?? 0
  return Array.from({ length: len }, (_, i) => ({
    time: new Date(chartData.voltageA[i].timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    voltageA: chartData.voltageA[i]?.value,
    voltageB: chartData.voltageB?.[i]?.value,
    voltageC: chartData.voltageC?.[i]?.value,
  }))
}

export const VAR_API_NAMES = {
  voltageA: 'VoltageA',
  voltageB: 'VoltageB',
  voltageC: 'VoltageC',
  currentA: 'CurrentA',
  power: 'PowerConsumption',
}
