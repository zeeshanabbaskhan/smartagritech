import { useEffect } from 'react'
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { AuthProvider, useAuth } from './context/AuthContext'
import { ThemeProvider } from './context/ThemeContext'
import { CustomDashboardProvider } from './context/CustomDashboardContext'
import { AccessGroupProvider } from './context/AccessGroupContext'
import { DeviceGroupProvider } from './context/DeviceGroupContext'
import DashboardLayout from './components/layout/DashboardLayout'
import { adminNav, orgNav, userNav } from './config/navConfig.jsx'
import { devices } from './data/dummy'

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
import AccessGroups           from './pages/admin/AccessGroups'
import AdminDeviceGroups      from './pages/admin/AdminDeviceGroups'

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
import OrgAccessGroups        from './pages/org/OrgAccessGroups'
import OrgDeviceGroups        from './pages/org/OrgDeviceGroups'
import OrgVoltageImbalance    from './pages/org/analytics/OrgVoltageImbalance'
import OrgCurrentImbalance    from './pages/org/analytics/OrgCurrentImbalance'
import OrgPowerFactor         from './pages/org/analytics/OrgPowerFactor'
import OrgEnergyConsumption   from './pages/org/analytics/OrgEnergyConsumption'
import OrgAnomalies           from './pages/org/analytics/OrgAnomalies'

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

// Custom Dashboards (shared builder used by admin, org, and user roles)
import DashboardList          from './pages/DashboardList'
import DashboardEditor        from './pages/DashboardEditor'

function ProtectedRoute({ children, requiredRole }) {
  const { user } = useAuth()
  if (!user) return <Navigate to="/login" replace />
  if (requiredRole && user.role !== requiredRole) return <Navigate to={`/${user.role}`} replace />
  return children
}

function AppRoutes() {
  const { user } = useAuth()

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
        <Route path="device-templates"  element={<AdminDeviceTemplates />} />
        <Route path="icons"             element={<AdminManageIcons />} />
        <Route path="products"          element={<AdminProducts />} />
        <Route path="data-center"       element={<AdminDataCenter />} />
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
        <Route path="access-groups"     element={<AccessGroups />} />
        <Route path="device-groups"     element={<AdminDeviceGroups />} />
        <Route path="custom-dashboard" element={<DashboardList />} />
        <Route path="custom-dashboard/:id" element={<DashboardEditor />} />
      </Route>

      {/* ── Organization ── */}
      <Route path="/org" element={
        <ProtectedRoute requiredRole="org">
          <DashboardLayout navItems={orgNav} role="org" />
        </ProtectedRoute>
      }>
        <Route index                    element={<OrgDashboard />} />
        <Route path="devices"           element={<OrgDevices />} />
        <Route path="gateways"          element={<OrgGateways />} />
        <Route path="device-templates"  element={<OrgDeviceTemplates />} />
        <Route path="historical-data"   element={<OrgHistoricalData />} />
        <Route path="ai-analytics"      element={<Navigate to="voltage-imbalance" replace />} />
        <Route path="ai-analytics/voltage-imbalance" element={<OrgVoltageImbalance />} />
        <Route path="ai-analytics/current-imbalance" element={<OrgCurrentImbalance />} />
        <Route path="ai-analytics/power-factor" element={<OrgPowerFactor />} />
        <Route path="ai-analytics/energy-consumption" element={<OrgEnergyConsumption />} />
        <Route path="ai-analytics/anomalies" element={<OrgAnomalies />} />
        <Route path="template-triggers" element={<OrgTemplateTriggers />} />
        <Route path="alarm-settings"    element={<OrgAlarmSettings />} />
        <Route path="alarm-contacts"    element={<OrgAlarmContacts />} />
        <Route path="schedule-tasks"    element={<OrgScheduleTasks />} />
        <Route path="settings"          element={<OrgSettings />} />
        <Route path="access-groups"     element={<OrgAccessGroups />} />
        <Route path="device-groups"     element={<OrgDeviceGroups />} />
        <Route path="custom-dashboard" element={<DashboardList />} />
        <Route path="custom-dashboard/:id" element={<DashboardEditor />} />
      </Route>

      {/* ── User ── */}
      <Route path="/user" element={
        <ProtectedRoute requiredRole="user">
          <DashboardLayout navItems={userNav} role="user" />
        </ProtectedRoute>
      }>
        <Route index                     element={<UserDashboard />} />
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
        <Route path="custom-dashboard" element={<DashboardList />} />
        <Route path="custom-dashboard/:id" element={<DashboardEditor />} />
      </Route>

      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  )
}

export default function App() {
  useEffect(() => {
    try {
      // 1. Sync devices
      const savedDevices = localStorage.getItem('cf-ems-devices')
      let currentDevices = devices
      if (savedDevices) {
        const parsed = JSON.parse(savedDevices)
        const parsedIds = new Set(parsed.map(d => d.id))
        const missing = devices.filter(d => !parsedIds.has(d.id))
        if (missing.length > 0) {
          currentDevices = [...parsed, ...missing]
          localStorage.setItem('cf-ems-devices', JSON.stringify(currentDevices))
        } else {
          currentDevices = parsed
        }
      } else {
        localStorage.setItem('cf-ems-devices', JSON.stringify(devices))
      }

      // 2. Sync access groups to grant Ambition's Org Admin access to the new AFL devices
      const savedGroups = localStorage.getItem('cf-ems-access-groups')
      const initialGroups = [
        { id: 1, name: 'CF Panel Group',       org: 'Ambition', deviceIds: [2, 4, 7], createdBy: 'admin', createdAt: '2026-01-15' },
        { id: 2, name: 'FICO Industrial',       org: 'FICO',                deviceIds: [3],       createdBy: 'admin', createdAt: '2026-01-20' },
        { id: 3, name: 'Delicia Cold Storage',  org: 'Delicia Warehouse',   deviceIds: [1],       createdBy: 'org',   createdAt: '2026-02-01' },
        { id: 4, name: 'C Power Generation',    org: 'C Power',             deviceIds: [8],       createdBy: 'admin', createdAt: '2026-02-10' },
      ]
      let currentGroups = savedGroups ? JSON.parse(savedGroups) : initialGroups

      const aflDeviceIds = currentDevices.filter(d => d.org === 'Ambition').map(d => d.id)
      if (aflDeviceIds.length > 0) {
        let updated = false
        currentGroups = currentGroups.map(g => {
          if (g.org === 'Ambition' && g.createdBy === 'admin') {
            const existingIds = new Set(g.deviceIds || [])
            const missingIds = aflDeviceIds.filter(id => !existingIds.has(id))
            if (missingIds.length > 0) {
              updated = true
              return { ...g, deviceIds: [...(g.deviceIds || []), ...missingIds] }
            }
          }
          return g
        })
        if (updated || !savedGroups) {
          localStorage.setItem('cf-ems-access-groups', JSON.stringify(currentGroups))
        }
      }

      // 3. Sync device groups to seed default categories for Ambition
      const savedDeviceGroups = localStorage.getItem('cf-ems-device-groups')
      if (!savedDeviceGroups || JSON.parse(savedDeviceGroups).length === 0) {
        const defaultDeviceGroups = [
          {
            id: 201,
            name: 'Washing Area',
            org: 'Ambition',
            description: 'Ground floor main washing panels and analyzers',
            deviceIds: [117], // AFL Main - G.F Washing Main Panels
            userIds: [1],
            createdBy: 'org',
            createdAt: '2026-07-14',
            active: true
          },
          {
            id: 202,
            name: 'Boilers & Compressors',
            org: 'Ambition',
            description: 'Ground floor boilers and heavy utility compressors',
            deviceIds: [119, 127, 108, 109], // Boiler, Main Compressor, Compressor 132kW, 55kW
            userIds: [1],
            createdBy: 'org',
            createdAt: '2026-07-14',
            active: true
          },
          {
            id: 203,
            name: 'Main DB Distribution',
            org: 'Ambition',
            description: 'Incoming utility mains and main block breakers',
            deviceIds: [136, 116, 120, 125], // Main, ST-Main DB, ST Main-DB, 1 F Main-DB
            userIds: [1],
            createdBy: 'org',
            createdAt: '2026-07-14',
            active: true
          },
          {
            id: 204,
            name: 'Solar Generation',
            org: 'Ambition',
            description: 'Main solar inverter generation panels',
            deviceIds: [133, 134, 112], // Solar Inverter 04, Solar Inverter 05, B-side Solar
            userIds: [1],
            createdBy: 'org',
            createdAt: '2026-07-14',
            active: true
          },
          {
            id: 205,
            name: 'Backup Generators',
            org: 'Ambition',
            description: 'G1 and G2 synchronization backup generation',
            deviceIds: [137, 138], // G1, G2
            userIds: [1],
            createdBy: 'org',
            createdAt: '2026-07-14',
            active: true
          }
        ]
        localStorage.setItem('cf-ems-device-groups', JSON.stringify(defaultDeviceGroups))
      }
    } catch (e) {
      console.error('Error syncing default devices/groups:', e)
    }
  }, [])

  return (
    <ThemeProvider>
      <AuthProvider>
        <AccessGroupProvider>
          <DeviceGroupProvider>
            <CustomDashboardProvider>
              <BrowserRouter>
                <AppRoutes />
              </BrowserRouter>
            </CustomDashboardProvider>
          </DeviceGroupProvider>
        </AccessGroupProvider>
      </AuthProvider>
    </ThemeProvider>
  )
}
