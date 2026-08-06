import { useEffect, useRef, useState } from 'react'
import { Outlet, useLocation } from 'react-router-dom'
import Sidebar from './Sidebar'
import Topbar from './Topbar'

const pageTitles = {
  // Admin
  '/admin':                    'Dashboard',
  '/admin/organizations':      'Manage Organizations',
  '/admin/users':              'Manage Users',
  '/admin/gateways':           'Manage Gateways',
  '/admin/mqtt-bridges':       'MQTT Bridges',
  '/admin/devices':            'Manage Devices',
  '/admin/device-templates':   'Device Templates',
  '/admin/icons':              'Manage Icons',
  '/admin/products':           'Manage Products',
  '/admin/data-center':        'Data Center',
  '/admin/historical-data':    'Historical Data',
  '/admin/variable-alarms':    'Variable Alarm Records',
  '/admin/linkage-records':    'Linkage Records',
  '/admin/template-triggers':  'Template Triggers',
  '/admin/alarm-settings':     'Alarm Settings',
  '/admin/alarm-contacts':     'Alarm Contacts',
  '/admin/device-timestamps':  'Device Timestamps',
  '/admin/schedule-tasks':     'Schedule Tasks',
  '/admin/theme-settings':     'Theme Settings',
  '/admin/settings':           'Platform Settings',
  '/admin/custom-dashboard':   'Custom Dashboards',
  '/admin/access-groups':      'Access Groups',
  '/admin/device-groups':      'Device Groups',
  // Org
  '/org':                      'Dashboard',
  '/org/custom-dashboard':     'Custom Dashboards',
  '/org/devices':              'My Devices',
  '/org/access-groups':        'Access Groups',
  '/org/device-groups':        'Device Groups',
  '/org/gateways':             'My Gateways',
  '/org/mqtt-bridges':         'MQTT Bridges',
  '/org/device-templates':     'Device Templates',
  '/org/ev-chargers/live-session': 'Live Session',
  '/org/ev-chargers/analytics':    'EV Analytics',
  '/org/ev-chargers/energy-hub':   'Energy Hub',
  '/org/ev-chargers/v2g':          'V2G / Exports',
  '/org/ev-chargers/ai-log':       'AI Decision Log',
  '/org/ev-chargers/fleet':        'Fleet',
  '/org/ev-chargers/profile':      'EV Profile',
  '/org/ev-chargers/control':      'EV Control System',
  '/org/ai-analytics/voltage-imbalance':  'Voltage Imbalance',
  '/org/ai-analytics/current-imbalance':  'Current Imbalance',
  '/org/ai-analytics/power-factor':       'Power Factor',
  '/org/ai-analytics/energy-consumption': 'Energy Consumption',
  '/org/ai-analytics/anomalies':          'Anomalies',
  '/org/historical-data':      'Historical Data',
  '/org/template-triggers':    'Template Triggers',
  '/org/alarm-settings':       'Alarm Settings',
  '/org/alarm-contacts':       'Alarm Contacts',
  '/org/schedule-tasks':       'Schedule Tasks',
  '/org/settings':             'Settings',
  // User
  '/user':                     'My Dashboard',
  '/user/detail':              'Dashboard Detail',
  '/user/custom-dashboard':    'Custom Dashboards',
  '/user/subscription':        'Subscription',
  '/user/products':            'Products',
  '/user/schedule':            'Schedule',
  '/user/slab-rates':          'Slab Rates',
  '/user/interval-history':    'Interval History',
  '/user/alarm-template':      'Alarm Template',
  '/user/notifications':       'Notifications',
  '/user/ai-analytics':        'AI Analytics',
  '/user/voltage-imbalance':   'Voltage Imbalance',
  '/user/current-imbalance':   'Current Imbalance',
  '/user/power-factor':        'Power Factor',
  '/user/energy-consumption':  'Energy Consumption',
  '/user/anomalies':           'Anomalies',
}

export default function DashboardLayout({ navItems, role }) {
  const location = useLocation()
  const title = pageTitles[location.pathname]
    ?? (location.pathname.includes('/custom-dashboard/') ? 'Custom Dashboards' : 'EMS Platform')
  const mainRef  = useRef(null)
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false)

  useEffect(() => {
    if (mainRef.current) mainRef.current.scrollTop = 0
    // Close mobile sidebar on route change
    setMobileSidebarOpen(false)
  }, [location.pathname])

  return (
    <div className="flex h-screen overflow-hidden bg-surface-50 dark:bg-surface-950">
      {/* Mobile backdrop */}
      {mobileSidebarOpen && (
        <div
          className="fixed inset-0 bg-black/60 z-30 md:hidden"
          onClick={() => setMobileSidebarOpen(false)}
        />
      )}

      <Sidebar
        navItems={navItems}
        role={role}
        mobileOpen={mobileSidebarOpen}
        onMobileClose={() => setMobileSidebarOpen(false)}
      />

      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        <Topbar title={title} onMenuClick={() => setMobileSidebarOpen(o => !o)} />
        <main ref={mainRef} className="flex-1 overflow-y-auto p-3 sm:p-6 bg-surface-50 dark:bg-surface-950">
          <Outlet />
        </main>
      </div>
    </div>
  )
}
