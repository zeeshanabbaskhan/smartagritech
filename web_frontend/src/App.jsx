import { BrowserRouter, Routes, Route, Navigate, useParams } from 'react-router-dom'
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
import AdminMqttBridges       from './pages/admin/AdminMqttBridges'
import AdminDevices           from './pages/admin/AdminDevices'
import AdminDeviceTemplates   from './pages/admin/AdminDeviceTemplates'
import AdminDeviceTemplateSlaves from './pages/admin/AdminDeviceTemplateSlaves'
import AdminManageIcons       from './pages/admin/AdminManageIcons'
import AdminManageLists       from './pages/admin/AdminManageLists'
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
import OrgDeviceTemplateSlaves from './pages/org/OrgDeviceTemplateSlaves'
import OrgHistoricalData      from './pages/org/OrgHistoricalData'
import OrgTemplateTriggers    from './pages/org/OrgTemplateTriggers'
import OrgAlarmSettings       from './pages/org/OrgAlarmSettings'
import OrgAlarmContacts       from './pages/org/OrgAlarmContacts'
import OrgScheduleTasks       from './pages/org/OrgScheduleTasks'
import OrgSettings            from './pages/org/OrgSettings'

// User
import UserDashboard          from './pages/user/UserDashboard'
import UserDashboardDetail    from './pages/user/UserDashboardDetail'
import UserNotifications      from './pages/user/UserNotifications'
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

import DeviceDetailPage       from './pages/shared/DeviceDetailPage'
import DashboardList          from './pages/shared/DashboardList'
import DashboardEditor        from './pages/shared/DashboardEditor'

import AdminAccessGroups      from './pages/admin/AdminAccessGroups'
import AdminDeviceGroups      from './pages/admin/AdminDeviceGroups'
import OrgAccessGroups        from './pages/org/OrgAccessGroups'
import OrgDeviceGroups        from './pages/org/OrgDeviceGroups'

// Org AI Analytics
import OrgVoltageImbalance    from './pages/org/analytics/OrgVoltageImbalance'
import OrgCurrentImbalance    from './pages/org/analytics/OrgCurrentImbalance'
import OrgPowerFactor         from './pages/org/analytics/OrgPowerFactor'
import OrgEnergyConsumption   from './pages/org/analytics/OrgEnergyConsumption'
import OrgAnomalies           from './pages/org/analytics/OrgAnomalies'

// Org EV Chargers
import EvLiveSession          from './pages/org/ev-chargers/EvLiveSession'
import EvAnalytics            from './pages/org/ev-chargers/EvAnalytics'
import EvEnergyHub            from './pages/org/ev-chargers/EvEnergyHub'
import EvV2G                  from './pages/org/ev-chargers/EvV2G'
import EvAiLog                from './pages/org/ev-chargers/EvAiLog'
import EvFleet                from './pages/org/ev-chargers/EvFleet'
import EvProfile              from './pages/org/ev-chargers/EvProfile'
import EvControl              from './pages/org/ev-chargers/EvControl'

function ProtectedRoute({ children, requiredRole }) {
  const { user } = useAuth()
  if (!user) return <Navigate to="/login" replace />
  if (requiredRole && user.role !== requiredRole) return <Navigate to={`/${user.role}`} replace />
  return children
}

/** Legacy template detail URL → portal slaves path */
function RedirectTemplateToSlaves({ basePath }) {
  const { templateId } = useParams()
  return <Navigate to={`${basePath}/device-templates/${templateId}/slaves`} replace />
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
        <Route path="mqtt-bridges"      element={<AdminMqttBridges basePath="/admin" />} />
        <Route path="devices"           element={<AdminDevices />} />
        <Route path="device-templates"  element={<AdminDeviceTemplates />} />
        <Route path="device-templates/:templateId/slaves" element={<AdminDeviceTemplateSlaves />} />
        <Route path="device-templates/:templateId" element={<RedirectTemplateToSlaves basePath="/admin" />} />
        <Route path="access-groups"     element={<AdminAccessGroups />} />
        <Route path="device-groups"     element={<AdminDeviceGroups />} />
        <Route path="icons"             element={<AdminManageIcons />} />
        <Route path="lists"             element={<AdminManageLists />} />
        <Route path="products"          element={<AdminProducts />} />
        <Route path="data-center"       element={<AdminDataCenter />} />
        <Route path="custom-dashboard"  element={<DashboardList />} />
        <Route path="custom-dashboard/:id" element={<DashboardEditor />} />
        <Route path="historical-data"   element={<AdminHistoricalData />} />
        <Route path="variable-alarms"   element={<AdminVariableAlarms />} />
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
        <Route path="custom-dashboard"  element={<DashboardList />} />
        <Route path="custom-dashboard/:id" element={<DashboardEditor />} />
        <Route path="devices"           element={<OrgDevices />} />
        <Route path="devices/:deviceId" element={<DeviceDetailPage basePath="/org" />} />
        <Route path="access-groups"     element={<OrgAccessGroups />} />
        <Route path="device-groups"     element={<OrgDeviceGroups />} />
        <Route path="gateways"          element={<OrgGateways />} />
        <Route path="mqtt-bridges"      element={<AdminMqttBridges basePath="/org" readOnly />} />
        <Route path="device-templates"  element={<OrgDeviceTemplates />} />
        <Route path="device-templates/:templateId/slaves" element={<OrgDeviceTemplateSlaves />} />
        <Route path="device-templates/:templateId" element={<RedirectTemplateToSlaves basePath="/org" />} />
        <Route path="ev-chargers/live-session" element={<EvLiveSession />} />
        <Route path="ev-chargers/analytics"    element={<EvAnalytics />} />
        <Route path="ev-chargers/energy-hub"   element={<EvEnergyHub />} />
        <Route path="ev-chargers/v2g"          element={<EvV2G />} />
        <Route path="ev-chargers/ai-log"       element={<EvAiLog />} />
        <Route path="ev-chargers/fleet"        element={<EvFleet />} />
        <Route path="ev-chargers/profile"      element={<EvProfile />} />
        <Route path="ev-chargers/control"      element={<EvControl />} />
        <Route path="ai-analytics"      element={<Navigate to="/org/ai-analytics/voltage-imbalance" replace />} />
        <Route path="ai-analytics/voltage-imbalance"  element={<OrgVoltageImbalance />} />
        <Route path="ai-analytics/current-imbalance"  element={<OrgCurrentImbalance />} />
        <Route path="ai-analytics/power-factor"       element={<OrgPowerFactor />} />
        <Route path="ai-analytics/energy-consumption" element={<OrgEnergyConsumption />} />
        <Route path="ai-analytics/anomalies"          element={<OrgAnomalies />} />
        <Route path="historical-data"   element={<OrgHistoricalData />} />
        <Route path="template-triggers" element={<OrgTemplateTriggers />} />
        <Route path="alarm-settings"    element={<OrgAlarmSettings />} />
        <Route path="alarm-contacts"    element={<OrgAlarmContacts />} />
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
        <Route path="detail"             element={<UserDashboardDetail />} />
        <Route path="notifications"      element={<UserNotifications />} />
        <Route path="subscription"       element={<UserSubscription />} />
        <Route path="products"           element={<UserProducts />} />
        <Route path="schedule"           element={<UserSchedule />} />
        <Route path="slab-rates"         element={<UserSlabRates />} />
        <Route path="interval-history"   element={<UserIntervalHistory />} />
        <Route path="alarm-template"     element={<UserAlarmTemplate />} />
        <Route path="ai-analytics"       element={<UserAIAnalytics />} />
        <Route path="voltage-imbalance"  element={<UserVoltageImbalance />} />
        <Route path="current-imbalance"  element={<UserCurrentImbalance />} />
        <Route path="power-factor"       element={<UserPowerFactor />} />
        <Route path="energy-consumption" element={<UserEnergyConsumption />} />
        <Route path="anomalies"          element={<UserAnomalies />} />
        <Route path="custom-dashboard"  element={<DashboardList />} />
        <Route path="custom-dashboard/:id" element={<DashboardEditor />} />
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
