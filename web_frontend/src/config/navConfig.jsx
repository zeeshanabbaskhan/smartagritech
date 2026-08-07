import {
  LayoutDashboard, Building2, Users, Wifi, Cpu, FileCode2,
  Smile, Package, Database, History, Bell, Link2,
  AlarmClock, UserCheck, Timer, CalendarClock,
  Palette, Settings, Activity, Zap,
  CreditCard, ShoppingBag, Calendar, Layers, Clock,
  BellRing, BrainCircuit, Gauge, TrendingUp, AlertOctagon,
  ListTree, UserCog, LayoutGrid, Radio, LayoutTemplate, ShieldCheck, Boxes,
  PlugZap, BarChart3, BatteryCharging, Recycle, Bot, Car, UserCircle, SlidersHorizontal,
} from 'lucide-react'

// ─── Active navigation (aligned with improved CF dashboard) ──────────────────

export const adminNav = [
  { divider: true, label: 'Main' },
  { to: '/admin',               label: 'Dashboard',        icon: LayoutDashboard },
  { to: '/admin/custom-dashboard', label: 'Custom Dashboards', icon: LayoutTemplate },
  { divider: true, label: 'Management' },
  { to: '/admin/organizations', label: 'Organizations',    icon: Building2 },
  { to: '/admin/users',         label: 'Users',            icon: Users },
  { to: '/admin/gateways',      label: 'Manage Gateway',   icon: Wifi },
  { to: '/admin/mqtt-bridges',  label: 'MQTT Bridges',     icon: Radio },
  { to: '/admin/devices',       label: 'Devices',          icon: Cpu },
  { to: '/admin/device-templates', label: 'Device Templates', icon: FileCode2 },
  { to: '/admin/access-groups', label: 'Access Groups',    icon: ShieldCheck },
  { to: '/admin/device-groups', label: 'Device Groups',    icon: Boxes },
  { to: '/admin/icons',         label: 'Manage Icons',     icon: Smile },
  { to: '/admin/products',      label: 'Manage Products',  icon: Package },
  { divider: true, label: 'Data' },
  { to: '/admin/data-center',   label: 'Data Center',      icon: Database },
  { to: '/admin/historical-data', label: 'Historical Data',icon: History },
  { to: '/admin/variable-alarms', label: 'Variable Alarms',icon: Activity },
  { to: '/admin/linkage-records', label: 'Linkage Records',icon: Link2 },
  { divider: true, label: 'Alarms' },
  { to: '/admin/template-triggers', label: 'Template Triggers', icon: Bell },
  { to: '/admin/alarm-settings',    label: 'Alarm Settings',    icon: AlarmClock },
  { to: '/admin/alarm-contacts',    label: 'Alarm Contacts',    icon: UserCheck },
  { divider: true, label: 'System' },
  { to: '/admin/device-timestamps', label: 'Device Timestamps', icon: Timer },
  { to: '/admin/schedule-tasks',    label: 'Schedule Tasks',    icon: CalendarClock },
  { to: '/admin/theme-settings',    label: 'Theme Settings',    icon: Palette },
]

export const orgNav = [
  { divider: true, label: 'Main' },
  { to: '/org',                    label: 'Dashboard',       icon: LayoutDashboard },
  { to: '/org/custom-dashboard',   label: 'Custom Dashboards', icon: LayoutTemplate },
  { divider: true, label: 'Devices' },
  { to: '/org/devices',            label: 'My Devices',      icon: Cpu },
  { to: '/org/access-groups',      label: 'Access Groups',   icon: ShieldCheck },
  { to: '/org/device-groups',      label: 'Device Groups',   icon: Boxes },
  { to: '/org/gateways',           label: 'Gateways',        icon: Wifi },
  { to: '/org/mqtt-bridges',       label: 'MQTT Bridges',    icon: Radio },
  { to: '/org/device-templates',   label: 'Device Templates',icon: FileCode2 },
  {
    label: 'EV Chargers',
    icon: PlugZap,
    children: [
      { to: '/org/ev-chargers/live-session', label: 'Live Session',    icon: Zap },
      { to: '/org/ev-chargers/analytics',    label: 'Analytics',       icon: BarChart3 },
      { to: '/org/ev-chargers/energy-hub',   label: 'Energy Hub',      icon: BatteryCharging },
      { to: '/org/ev-chargers/v2g',          label: 'V2G / Exports',   icon: Recycle },
      { to: '/org/ev-chargers/ai-log',       label: 'AI Decision Log', icon: Bot },
      { to: '/org/ev-chargers/fleet',        label: 'Fleet',           icon: Car },
      { to: '/org/ev-chargers/profile',      label: 'Profile',         icon: UserCircle },
      { to: '/org/ev-chargers/control',      label: 'Control System',  icon: SlidersHorizontal },
    ],
  },
  { divider: true, label: 'Data' },
  {
    label: 'AI Analytics',
    icon: BrainCircuit,
    children: [
      { to: '/org/ai-analytics/voltage-imbalance',  label: 'Voltage Imbalance',  icon: Gauge },
      { to: '/org/ai-analytics/current-imbalance',  label: 'Current Imbalance',  icon: Activity },
      { to: '/org/ai-analytics/power-factor',       label: 'Power Factor',       icon: TrendingUp },
      { to: '/org/ai-analytics/energy-consumption', label: 'Energy Consumption', icon: Zap },
      { to: '/org/ai-analytics/anomalies',          label: 'Anomalies',          icon: AlertOctagon },
    ],
  },
  { to: '/org/historical-data',    label: 'Historical Data', icon: History },
  { divider: true, label: 'Alarms' },
  { to: '/org/template-triggers',  label: 'Template Triggers', icon: Bell },
  { to: '/org/alarm-settings',     label: 'Alarm Settings',    icon: AlarmClock },
  { to: '/org/alarm-contacts',     label: 'Alarm Contacts',    icon: UserCheck },
  { divider: true, label: 'System' },
  { to: '/org/schedule-tasks',     label: 'Schedule Tasks',  icon: CalendarClock },
  { to: '/org/settings',           label: 'Settings',        icon: Settings },
]

export const userNav = [
  {
    label: 'Manage Dashboard',
    icon: LayoutDashboard,
    children: [
      { to: '/user',        label: 'Dashboard', icon: LayoutDashboard },
      { to: '/user/detail', label: 'Detail',     icon: Gauge },
    ],
  },
  { to: '/user/subscription',      label: 'Subscription',       icon: CreditCard },
  { to: '/user/products',          label: 'Products',           icon: ShoppingBag },
  { to: '/user/schedule',          label: 'Schedule',           icon: Calendar },
  { to: '/user/slab-rates',        label: 'Manage Slab Rates',  icon: Layers },
  { to: '/user/interval-history',  label: 'Manage Interval History', icon: Clock },
  { to: '/user/alarm-template',    label: 'Alarm Template',     icon: BellRing },
  { to: '/user/notifications',     label: 'Notification',       icon: Bell },
  {
    label: 'Manage AI Analytics',
    icon: BrainCircuit,
    children: [
      { to: '/user/ai-analytics',       label: 'AI Analytics',       icon: BrainCircuit },
      { to: '/user/voltage-imbalance',  label: 'Voltage Imbalance',  icon: Gauge },
      { to: '/user/current-imbalance',  label: 'Current Imbalance',  icon: Activity },
      { to: '/user/power-factor',       label: 'Power Factor',       icon: TrendingUp },
      { to: '/user/energy-consumption', label: 'Energy Consumption', icon: Zap },
      { to: '/user/anomalies',          label: 'Anomalies',          icon: AlertOctagon },
    ],
  },
]

// ─── Parked navigation (EMS-only extras / CF-hidden routes) ───────────────────
// Only entries with live App routes (or org restore candidates). No dead paths.
export const parkedNav = {
  admin: [],
  org: [
    { to: '/org/dashboard-detail',   label: 'Dashboard Detail',   icon: ListTree },
    { to: '/org/users',              label: 'Team Users',         icon: UserCog },
    { to: '/org/widget-templates',   label: 'Widget Templates',   icon: LayoutGrid },
    { to: '/org/sensor-history',     label: 'Sensor History',     icon: Radio },
    { to: '/org/device-timestamps',  label: 'Device Connectivity',icon: Timer },
    { to: '/org/alarm-history',      label: 'Alarm History',      icon: History },
  ],
  user: [
    { to: '/user/custom-dashboard',  label: 'Custom Dashboards', icon: LayoutTemplate },
  ],
}
