import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { AuthProvider, useAuth } from './context/AuthContext'
import { ThemeProvider } from './context/ThemeContext'
import { DeviceProvider } from './context/DeviceContext'
import { ToastProvider } from './context/ToastContext'
import DashboardLayout from './components/layout/DashboardLayout'
import SocketBridge from './components/SocketBridge'
import { adminNav, orgNav, userNav } from './config/navConfig.jsx'

// Pages
import Login               from './pages/Login'

// Admin
import AdminDashboard      from './pages/admin/AdminDashboard'
import AdminOrganizations  from './pages/admin/AdminOrganizations'
import AdminUsers          from './pages/admin/AdminUsers'
import AdminGateways       from './pages/admin/AdminGateways'
import AdminDevices           from './pages/admin/AdminDevices'
import AdminDeviceTemplates   from './pages/admin/AdminDeviceTemplates'
import AdminManageIcons       from './pages/admin/AdminManageIcons'
import AdminProducts          from './pages/admin/AdminProducts'
import AdminDataCenter        from './pages/admin/AdminDataCenter'
import AdminHistoricalData    from './pages/admin/AdminHistoricalData'
import AdminVariableAlarms    from './pages/admin/AdminVariableAlarms'
import AdminLinkageRecords    from './pages/admin/AdminLinkageRecords'
import AdminTemplateTriggers  from './pages/admin/AdminTemplateTriggers'
import AdminAlarmSettings     from './pages/admin/AdminAlarmSettings'
import AdminAlarmContacts     from './pages/admin/AdminAlarmContacts'
import AdminDeviceTimestamps  from './pages/admin/AdminDeviceTimestamps'
import AdminScheduleTasks     from './pages/admin/AdminScheduleTasks'
import AdminThemeSettings     from './pages/admin/AdminThemeSettings'
import AdminSettings          from './pages/admin/AdminSettings'

// Org
import OrgDashboard        from './pages/org/OrgDashboard'
import OrgDevices          from './pages/org/OrgDevices'
import OrgGateways            from './pages/org/OrgGateways'
import OrgDeviceTemplates     from './pages/org/OrgDeviceTemplates'
import OrgHistoricalData      from './pages/org/OrgHistoricalData'
import OrgTemplateTriggers    from './pages/org/OrgTemplateTriggers'
import OrgAlarmSettings       from './pages/org/OrgAlarmSettings'
import OrgAlarmContacts       from './pages/org/OrgAlarmContacts'
import OrgScheduleTasks       from './pages/org/OrgScheduleTasks'
import OrgSettings            from './pages/org/OrgSettings'

// User
import UserDashboard       from './pages/user/UserDashboard'
import UserNotifications   from './pages/user/UserNotifications'
import UserSubscription       from './pages/user/UserSubscription'
import UserProducts           from './pages/user/UserProducts'
import UserSchedule           from './pages/user/UserSchedule'
import UserSlabRates          from './pages/user/UserSlabRates'
import UserIntervalHistory    from './pages/user/UserIntervalHistory'
import UserAlarmTemplate      from './pages/user/UserAlarmTemplate'
import UserAIAnalytics        from './pages/user/UserAIAnalytics'
import UserVoltageImbalance   from './pages/user/UserVoltageImbalance'
import UserCurrentImbalance   from './pages/user/UserCurrentImbalance'
import UserPowerFactor        from './pages/user/UserPowerFactor'
import UserEnergyConsumption  from './pages/user/UserEnergyConsumption'
import UserAnomalies          from './pages/user/UserAnomalies'
import UserAccountSettings    from './pages/user/UserAccountSettings'
import UserAlarmSettings      from './pages/user/UserAlarmSettings'

import DashboardDetailPage    from './pages/shared/DashboardDetailPage'
import SensorHistoryPage      from './pages/shared/SensorHistoryPage'
import AlarmHistoryPage       from './pages/shared/AlarmHistoryPage'
import DeviceDetailPage       from './pages/shared/DeviceDetailPage'

import OrgUsers               from './pages/org/OrgUsers'
import OrgWidgetTemplates     from './pages/org/OrgWidgetTemplates'
import OrgDeviceTimestamps    from './pages/org/OrgDeviceTimestamps'
import TemplateDetailPage     from './pages/shared/TemplateDetailPage'

function ProtectedRoute({ children, requiredRole }) {
  const { user } = useAuth()
  if (!user) return <Navigate to="/login" replace />
  if (requiredRole && user.role !== requiredRole) return <Navigate to={`/${user.role}`} replace />
  return children
}

function AppRoutes() {
  const { user, initializing } = useAuth()

  if (initializing) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-surface-50 dark:bg-surface-950">
        <div className="text-center text-surface-500 text-sm">Loading session...</div>
      </div>
    )
  }

  return (
    <Routes>
      <Route path="/login" element={<Login />} />
      <Route path="/" element={<Navigate to={user ? `/${user.role}` : '/login'} replace />} />

      {/* ── Super Admin ── */}
      <Route path="/admin" element={
        <ProtectedRoute requiredRole="admin">
          <DashboardLayout navItems={adminNav} role="admin" />
        </ProtectedRoute>
      }>
        <Route index                    element={<AdminDashboard />} />
        <Route path="organizations"     element={<AdminOrganizations />} />
        <Route path="users"             element={<AdminUsers />} />
        <Route path="gateways"          element={<AdminGateways />} />
        <Route path="devices"           element={<AdminDevices />} />
        <Route path="devices/:deviceId" element={<DeviceDetailPage basePath="/admin" />} />
        <Route path="device-templates"  element={<AdminDeviceTemplates />} />
        <Route path="device-templates/:templateId" element={<TemplateDetailPage basePath="/admin" />} />
        <Route path="icons"             element={<AdminManageIcons />} />
        <Route path="products"          element={<AdminProducts />} />
        <Route path="data-center"       element={<AdminDataCenter />} />
        <Route path="dashboard-detail"  element={<DashboardDetailPage title="Dashboard Detail" breadcrumb="Admin / Dashboard Detail" />} />
        <Route path="sensor-history"    element={<SensorHistoryPage title="Sensor History" breadcrumb="Admin / Sensor History" />} />
        <Route path="historical-data"   element={<AdminHistoricalData />} />
        <Route path="variable-alarms"   element={<AdminVariableAlarms />} />
        <Route path="alarm-history"     element={<AlarmHistoryPage title="Alarm History" breadcrumb="Admin / Alarm History" />} />
        <Route path="linkage-records"   element={<AdminLinkageRecords />} />
        <Route path="template-triggers" element={<AdminTemplateTriggers />} />
        <Route path="alarm-settings"    element={<AdminAlarmSettings />} />
        <Route path="alarm-contacts"    element={<AdminAlarmContacts />} />
        <Route path="device-timestamps" element={<AdminDeviceTimestamps />} />
        <Route path="schedule-tasks"    element={<AdminScheduleTasks />} />
        <Route path="theme-settings"    element={<AdminThemeSettings />} />
        <Route path="settings"          element={<AdminSettings />} />
      </Route>

      {/* ── Organization ── */}
      <Route path="/org" element={
        <ProtectedRoute requiredRole="org">
          <DashboardLayout navItems={orgNav} role="org" />
        </ProtectedRoute>
      }>
        <Route index                    element={<OrgDashboard />} />
        <Route path="dashboard-detail"  element={<DashboardDetailPage title="Dashboard Detail" breadcrumb="Organization / Dashboard Detail" />} />
        <Route path="users"             element={<OrgUsers />} />
        <Route path="widget-templates"  element={<OrgWidgetTemplates />} />
        <Route path="devices"           element={<OrgDevices />} />
        <Route path="devices/:deviceId" element={<DeviceDetailPage basePath="/org" />} />
        <Route path="gateways"          element={<OrgGateways />} />
        <Route path="device-templates"  element={<OrgDeviceTemplates />} />
        <Route path="device-templates/:templateId" element={<TemplateDetailPage basePath="/org" />} />
        <Route path="sensor-history"    element={<SensorHistoryPage title="Sensor History" breadcrumb="Organization / Sensor History" />} />
        <Route path="historical-data"   element={<OrgHistoricalData />} />
        <Route path="device-timestamps" element={<OrgDeviceTimestamps />} />
        <Route path="template-triggers" element={<OrgTemplateTriggers />} />
        <Route path="alarm-settings"    element={<OrgAlarmSettings />} />
        <Route path="alarm-contacts"    element={<OrgAlarmContacts />} />
        <Route path="alarm-history"     element={<AlarmHistoryPage title="Alarm History" breadcrumb="Organization / Alarm History" />} />
        <Route path="schedule-tasks"    element={<OrgScheduleTasks />} />
        <Route path="settings"          element={<OrgSettings />} />
      </Route>

      {/* ── User ── */}
      <Route path="/user" element={
        <ProtectedRoute requiredRole="user">
          <DashboardLayout navItems={userNav} role="user" />
        </ProtectedRoute>
      }>
        <Route index                     element={<UserDashboard />} />
        <Route path="dashboard-detail"  element={<DashboardDetailPage title="Dashboard Detail" breadcrumb="User / Dashboard Detail" />} />
        <Route path="account"           element={<UserAccountSettings />} />
        <Route path="notifications"      element={<UserNotifications />} />
        <Route path="subscription"       element={<UserSubscription />} />
        <Route path="products"           element={<UserProducts />} />
        <Route path="schedule"           element={<UserSchedule />} />
        <Route path="slab-rates"         element={<UserSlabRates />} />
        <Route path="interval-history"   element={<UserIntervalHistory />} />
        <Route path="sensor-history"     element={<SensorHistoryPage title="Sensor History" breadcrumb="User / Sensor History" />} />
        <Route path="alarm-template"     element={<UserAlarmTemplate />} />
        <Route path="alarm-settings"     element={<UserAlarmSettings />} />
        <Route path="alarm-history"      element={<AlarmHistoryPage title="Alarm History" breadcrumb="User / Alarm History" />} />
        <Route path="ai-analytics"       element={<UserAIAnalytics />} />
        <Route path="voltage-imbalance"  element={<UserVoltageImbalance />} />
        <Route path="current-imbalance"  element={<UserCurrentImbalance />} />
        <Route path="power-factor"       element={<UserPowerFactor />} />
        <Route path="energy-consumption" element={<UserEnergyConsumption />} />
        <Route path="anomalies"          element={<UserAnomalies />} />
      </Route>

      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  )
}

export default function App() {
  return (
    <ThemeProvider>
      <AuthProvider>
        <ToastProvider>
          <DeviceProvider>
            <BrowserRouter>
              <SocketBridge />
              <AppRoutes />
            </BrowserRouter>
          </DeviceProvider>
        </ToastProvider>
      </AuthProvider>
    </ThemeProvider>
  )
}
