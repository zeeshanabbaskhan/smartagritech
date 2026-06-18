import { api, list, one, tokenStore } from './client'

const q = (params = {}) => {
  const out = { limit: '100', ...params }
  Object.keys(out).forEach((k) => out[k] == null && delete out[k])
  return out
}

const emsApi = {
  // ─── Auth ─────────────────────────────────────────────────────────────────
  login: (email, password) => api.post('/auth/login', { email, password }),
  logout: () => api.post('/auth/logout', { refreshToken: tokenStore.getRefresh() }),
  me: () => api.get('/auth/me'),
  forgotPassword: (email) => api.post('/auth/forgot-password', { email }),
  resetPassword: (body) => api.post('/auth/reset-password', body),
  changePassword: (currentPassword, newPassword) =>
    api.post('/auth/change-password', { currentPassword, newPassword }),

  // ─── Template slaves / variables ────────────────────────────────────────
  getTemplateSlaves: (templateId, params) =>
    api.get(`/device-templates/${templateId}/slaves`, q(params)),
  createTemplateSlave: (templateId, body) =>
    api.post(`/device-templates/${templateId}/slaves`, body),
  updateTemplateSlave: (templateId, slaveId, body) =>
    api.put(`/device-templates/${templateId}/slaves/${slaveId}`, body),
  deleteTemplateSlave: (templateId, slaveId) =>
    api.delete(`/device-templates/${templateId}/slaves/${slaveId}`),
  getTemplateVariables: (templateId, slaveId, params) =>
    api.get(`/device-templates/${templateId}/slaves/${slaveId}/variables`, q(params)),
  createTemplateVariable: (templateId, slaveId, body) =>
    api.post(`/device-templates/${templateId}/slaves/${slaveId}/variables`, body),
  updateTemplateVariable: (templateId, slaveId, variableId, body) =>
    api.put(`/device-templates/${templateId}/slaves/${slaveId}/variables/${variableId}`, body),
  deleteTemplateVariable: (templateId, slaveId, variableId) =>
    api.delete(`/device-templates/${templateId}/slaves/${slaveId}/variables/${variableId}`),

  updateMe: (userId, body) => api.put(`/users/${userId}`, body),

  // ─── Organizations ────────────────────────────────────────────────────────
  getOrganizations: (params) => api.get('/organizations', q(params)),
  getOrganization: (id) => api.get(`/organizations/${id}`),
  createOrganization: (body) => api.post('/organizations', body),
  updateOrganization: (id, body) => api.put(`/organizations/${id}`, body),
  deleteOrganization: (id) => api.delete(`/organizations/${id}`),
  getMyOrganization: () => api.get('/organizations/me'),
  updateMyOrganization: (body) => api.put('/organizations/me', body),

  // ─── Users ──────────────────────────────────────────────────────────────
  getUsers: (params) => api.get('/users', q(params)),
  getUser: (id) => api.get(`/users/${id}`),
  createUser: (body) => api.post('/users', body),
  updateUser: (id, body) => api.put(`/users/${id}`, body),
  updateUserStatus: (id, status) => api.patch(`/users/${id}/status`, { status }),
  resetUserPassword: (id, password) => api.post(`/users/${id}/reset-password`, { password }),

  // ─── Gateways ───────────────────────────────────────────────────────────
  getGateways: (params) => api.get('/gateways', q(params)),
  getGateway: (id) => api.get(`/gateways/${id}`),
  createGateway: (body) => api.post('/gateways', body),
  updateGateway: (id, body) => api.put(`/gateways/${id}`, body),
  deleteGateway: (id) => api.delete(`/gateways/${id}`),

  // ─── Devices ────────────────────────────────────────────────────────────
  getDevices: (params) => api.get('/devices', q(params)),
  getDevice: (id) => api.get(`/devices/${id}`),
  createDevice: (body) => api.post('/devices', body),
  updateDevice: (id, body) => api.put(`/devices/${id}`, body),
  deleteDevice: (id) => api.delete(`/devices/${id}`),
  switchDevice: (id, action) => api.patch(`/devices/${id}/switch`, { action }),
  regenerateIngestKey: (id) => api.post(`/devices/${id}/regenerate-ingest-key`),
  getCommandStatus: (deviceId, commandId) => api.get(`/devices/${deviceId}/commands/${commandId}`),

  // ─── Device config ──────────────────────────────────────────────────────
  getDeviceConfig: (deviceId) => api.get(`/devices/${deviceId}/config/slaves`),
  getDeviceVariables: (deviceId, slaveId) =>
    api.get(`/devices/${deviceId}/config/slaves/${slaveId}/variables`),

  // ─── Device users ───────────────────────────────────────────────────────
  getDeviceUsers: (deviceId) => api.get(`/devices/${deviceId}/users`, q()),
  assignDeviceUser: (deviceId, userId) => api.post(`/devices/${deviceId}/users`, { userId }),
  removeDeviceUser: (deviceId, userId) => api.delete(`/devices/${deviceId}/users/${userId}`),

  // ─── Device templates ───────────────────────────────────────────────────
  getDeviceTemplates: (params) => api.get('/device-templates', q(params)),
  getDeviceTemplate: (id) => api.get(`/device-templates/${id}`),
  createDeviceTemplate: (body) => api.post('/device-templates', body),
  updateDeviceTemplate: (id, body) => api.put(`/device-templates/${id}`, body),
  deleteDeviceTemplate: (id) => api.delete(`/device-templates/${id}`),
  cloneDeviceTemplate: (id) => api.post(`/device-templates/${id}/clone`),

  // ─── Sensor data ────────────────────────────────────────────────────────
  getLatestReadings: (params) => api.get('/sensor-data/latest', params),
  getSensorHistory: (params) => api.get('/sensor-data/history', params),
  getSensorReadings: (params) => api.get('/sensor-data/readings', q(params)),
  getSensorAggregate: (params) => api.get('/sensor-data/aggregate', params),
  getDashboardSummary: (params) => api.get('/sensor-data/dashboard-summary', params),

  // ─── AI analytics ───────────────────────────────────────────────────────
  getAiVoltage: (params) => api.get('/ai/voltage-imbalance', params),
  getAiCurrent: (params) => api.get('/ai/current-imbalance', params),
  getAiPowerFactor: (params) => api.get('/ai/power-factor', params),
  getAiEnergy: (params) => api.get('/ai/energy-consumption', params),
  getAiPredictions: (params) => api.get('/ai/predictions', params),

  // ─── Anomalies ──────────────────────────────────────────────────────────
  getAnomalies: (params) => api.get('/anomalies', q(params)),
  getAnomalyTimeline: (params) => api.get('/anomalies/timeline', params),
  acknowledgeAnomaly: (id) => api.patch(`/anomalies/${id}/acknowledge`),

  // ─── Interval history ───────────────────────────────────────────────────
  getIntervalHistory: (params) => api.get('/interval-history', q(params)),
  createIntervalHistory: (body) => api.post('/interval-history', body),
  deleteIntervalHistory: (id) => api.delete(`/interval-history/${id}`),

  // ─── Alarms ─────────────────────────────────────────────────────────────
  getAlarmTemplates: (params) => api.get('/alarm-templates', q(params)),
  createAlarmTemplate: (body) => api.post('/alarm-templates', body),
  updateAlarmTemplate: (id, body) => api.put(`/alarm-templates/${id}`, body),
  deleteAlarmTemplate: (id) => api.delete(`/alarm-templates/${id}`),

  getAlarmSettings: (params) => api.get('/alarm-settings', q(params)),
  createAlarmSetting: (body) => api.post('/alarm-settings', body),
  updateAlarmSetting: (id, body) => api.put(`/alarm-settings/${id}`, body),
  deleteAlarmSetting: (id) => api.delete(`/alarm-settings/${id}`),

  getAlarmContacts: (params) => api.get('/alarm-contacts', q(params)),
  createAlarmContact: (body) => api.post('/alarm-contacts', body),
  updateAlarmContact: (id, body) => api.put(`/alarm-contacts/${id}`, body),
  deleteAlarmContact: (id) => api.delete(`/alarm-contacts/${id}`),

  getVariableAlarmHistory: (params) => api.get('/alarm-history/variable-alarms', q(params)),
  processVariableAlarm: (id) => api.patch(`/alarm-history/variable-alarms/${id}/process`),
  batchDeleteVariableAlarms: (body) => api.delete('/alarm-history/variable-alarms', body),

  getLinkageHistory: (params) => api.get('/alarm-history/linkage-records', q(params)),
  batchDeleteLinkageHistory: (body) => api.delete('/alarm-history/linkage-records', body),

  getAlarmHistoryNotifications: (params) => api.get('/alarm-history/notifications', q(params)),

  // ─── Notifications ──────────────────────────────────────────────────────
  getNotifications: (params) => api.get('/notifications', q({ limit: '30', ...params })),
  markNotificationRead: (id) => api.patch(`/notifications/${id}/read`),
  markAllNotificationsRead: () => api.patch('/notifications/read-all'),
  deleteNotification: (id) => api.delete(`/notifications/${id}`),
  deleteAllNotifications: () => api.delete('/notifications'),

  // ─── Scheduled tasks ────────────────────────────────────────────────────
  getScheduledTasks: (params) => api.get('/scheduled-tasks', q(params)),
  createScheduledTask: (body) => api.post('/scheduled-tasks', body),
  updateScheduledTask: (id, body) => api.put(`/scheduled-tasks/${id}`, body),
  deleteScheduledTask: (id) => api.delete(`/scheduled-tasks/${id}`),
  toggleScheduledTask: (id) => api.patch(`/scheduled-tasks/${id}/toggle`),
  getTaskLogs: (id) => api.get(`/scheduled-tasks/${id}/logs`, q({ limit: '50' })),

  // ─── Slab rates ─────────────────────────────────────────────────────────
  getSlabRates: (params) => api.get('/slab-rates', q(params)),
  createSlabRate: (body) => api.post('/slab-rates', body),
  updateSlabRate: (id, body) => api.put(`/slab-rates/${id}`, body),
  deleteSlabRate: (id) => api.delete(`/slab-rates/${id}`),

  // ─── Device timestamps ──────────────────────────────────────────────────
  getDeviceTimestamps: (params) => api.get('/device-timestamps', q(params)),

  // ─── Icons / Products / Themes / Settings ───────────────────────────────
  getIcons: (params) => api.get('/icons', q(params)),
  createIcon: (formData) => api.upload('POST', '/icons', formData),
  updateIcon: (id, formData) => api.upload('PUT', `/icons/${id}`, formData),
  deleteIcon: (id) => api.delete(`/icons/${id}`),

  getProducts: (params) => api.get('/products', q(params)),
  createProduct: (body) => api.post('/products', body),
  updateProduct: (id, body) => api.put(`/products/${id}`, body),
  deleteProduct: (id) => api.delete(`/products/${id}`),

  getThemes: (params) => api.get('/themes', q(params)),
  createTheme: (body) => api.post('/themes', body),
  updateTheme: (id, body) => api.put(`/themes/${id}`, body),
  deleteTheme: (id) => api.delete(`/themes/${id}`),
  assignTheme: (id, organizationId) => api.post(`/themes/${id}/assign`, { orgId: organizationId }),

  getSettings: () => api.get('/settings'),
  updateSetting: (key, value) => api.put(`/settings/${key}`, { value }),
  deleteSetting: (key) => api.delete(`/settings/${key}`),

  // ─── Subscriptions ──────────────────────────────────────────────────────
  getSubscriptions: (params) => api.get('/subscriptions', q(params)),
  submitSubscription: (body) => api.post('/subscriptions', body),
  updateSubscriptionStatus: (id, status) => api.patch(`/subscriptions/${id}/status`, { status }),

  // ─── Widget templates ───────────────────────────────────────────────────
  getWidgetTemplates: (params) => api.get('/widget-templates', q(params)),
  createWidgetTemplate: (body) => api.post('/widget-templates', body),
  updateWidgetTemplate: (id, body) => api.put(`/widget-templates/${id}`, body),
  deleteWidgetTemplate: (id) => api.delete(`/widget-templates/${id}`),

  downloadSensorCsv: (params) => api.download('/sensor-data/download', params, 'sensor-data.csv'),
}

export { api, list, one }
export default emsApi
