import { useMemo, useState } from 'react'
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import {
  AlertTriangle,
  ArrowLeft,
  BarChart3,
  Download,
  Eye,
  RefreshCw,
  RotateCcw,
  Search,
  SlidersHorizontal,
  User,
  Users,
} from 'lucide-react'
import { useAuth } from '../../../context/AuthContext'
import DataTable from '../../../components/ui/DataTable'
import Modal from '../../../components/ui/Modal'
import { devices, users } from '../../../data/dummy'

const TEAMS = ['Operations', 'Maintenance', 'Energy']
const DEPARTMENTS_BY_TEAM = {
  Operations: ['Production'],
  Maintenance: ['Utilities'],
  Energy: ['Optimization'],
}
const ALL_DEPARTMENTS = Object.values(DEPARTMENTS_BY_TEAM).flat()
const PERIODS = ['Today', 'Last 7 days', 'This Month', 'Last Month', 'Custom']
const CURRENCY = 'PKR'
const REPORT_TODAY = '2026-06-10'

const PAGE_CONFIG = {
  voltage: {
    title: 'Voltage Imbalance',
    crumb: 'Voltage Imbalance',
    chartTitle: 'Phase Voltage Trend',
    chartDescription: 'Average organization phase voltage comparison (V)',
    yDomain: [210, 240],
    tableTitle: 'Detected Imbalance Events',
    tableKind: 'imbalance',
  },
  current: {
    title: 'Current Imbalance',
    crumb: 'Current Imbalance',
    chartTitle: 'Current Imbalance Trend',
    chartDescription: 'Average current by phase (A)',
    yDomain: [0, 32],
    tableTitle: 'Detected Imbalance Events',
    tableKind: 'imbalance',
  },
  powerFactor: {
    title: 'Power Factor',
    crumb: 'Power Factor',
    chartTitle: 'Power Factor Trend',
    chartDescription: 'Organization average compared with selected scope',
    yDomain: [0.8, 1],
    tableTitle: 'PF Below Threshold Events',
    tableKind: 'powerFactor',
  },
  energy: {
    title: 'Energy Consumption',
    crumb: 'Energy Consumption',
    chartTitle: 'Power Consumption',
    chartDescription: 'Active power over the selected reporting period (kW)',
    tableTitle: 'Consumption Records',
    tableKind: 'energy',
  },
  anomalies: {
    title: 'Anomalies',
    crumb: 'Anomalies',
    chartTitle: 'Anomaly Activity',
    chartDescription: 'Active and resolved anomaly trend',
    tableTitle: 'Anomalies',
    tableKind: 'anomaly',
  },
}

const baseSeries = [
  { time: '00:00', voltageA: 224, voltageB: 222, voltageC: 226, currentA: 12.1, currentB: 11.4, currentC: 13.2, power: 8200, pf: 0.93 },
  { time: '02:00', voltageA: 225, voltageB: 223, voltageC: 225, currentA: 11.8, currentB: 10.9, currentC: 12.7, power: 7900, pf: 0.91 },
  { time: '04:00', voltageA: 223, voltageB: 221, voltageC: 224, currentA: 10.5, currentB: 9.8, currentC: 11.1, power: 7100, pf: 0.90 },
  { time: '06:00', voltageA: 226, voltageB: 224, voltageC: 227, currentA: 13.2, currentB: 12.5, currentC: 13.8, power: 8900, pf: 0.94 },
  { time: '08:00', voltageA: 228, voltageB: 226, voltageC: 229, currentA: 18.5, currentB: 17.1, currentC: 19.2, power: 12400, pf: 0.92 },
  { time: '10:00', voltageA: 230, voltageB: 228, voltageC: 231, currentA: 22.1, currentB: 20.6, currentC: 23.4, power: 14800, pf: 0.93 },
  { time: '12:00', voltageA: 231, voltageB: 229, voltageC: 232, currentA: 24.3, currentB: 21.8, currentC: 24.9, power: 16100, pf: 0.91 },
  { time: '14:00', voltageA: 229, voltageB: 227, voltageC: 230, currentA: 23.8, currentB: 22.2, currentC: 24.1, power: 15700, pf: 0.92 },
  { time: '16:00', voltageA: 227, voltageB: 225, voltageC: 228, currentA: 21.2, currentB: 19.6, currentC: 22.7, power: 14200, pf: 0.90 },
  { time: '18:00', voltageA: 225, voltageB: 223, voltageC: 226, currentA: 19.5, currentB: 18.3, currentC: 20.8, power: 13100, pf: 0.93 },
  { time: '20:00', voltageA: 224, voltageB: 222, voltageC: 225, currentA: 16.8, currentB: 15.9, currentC: 17.4, power: 11200, pf: 0.94 },
  { time: '22:00', voltageA: 223, voltageB: 221, voltageC: 224, currentA: 14.1, currentB: 13.5, currentC: 14.8, power: 9500, pf: 0.91 },
]

function ensureThreeOrgUsers(orgName) {
  const normalizedOrg = orgName.toLowerCase().replace(/\s+/g, '')
  const fallbackUsers = [
    { id: `org-${normalizedOrg}-ops`, org: orgName, name: 'Ayesha Khan', email: `ayesha.${normalizedOrg}@cf.com`, role: 'Customer', status: 'Active' },
    { id: `org-${normalizedOrg}-energy`, org: orgName, name: 'Omar Farooq', email: `omar.${normalizedOrg}@cf.com`, role: 'Customer', status: 'Active' },
    { id: `org-${normalizedOrg}-maintenance`, org: orgName, name: 'Mehwish Ali', email: `mehwish.${normalizedOrg}@cf.com`, role: 'Customer', status: 'Active' },
  ]
  const orgUsers = users.filter(item => item.org === orgName)
  const usersByEmail = new Set(orgUsers.map(item => item.email))
  const topUpUsers = fallbackUsers.filter(item => !usersByEmail.has(item.email))

  return [...orgUsers, ...topUpUsers].slice(0, Math.max(3, orgUsers.length)).map((item, index) => ({
    ...item,
    team: TEAMS[index % TEAMS.length],
    department: DEPARTMENTS_BY_TEAM[TEAMS[index % TEAMS.length]][0],
    analyticsScale: 0.82 + index * 0.18,
  }))
}

function parseDate(value) {
  const dateText = String(value || '').slice(0, 10)
  const date = new Date(`${dateText}T00:00:00`)
  return Number.isNaN(date.getTime()) ? null : date
}

function withinDateRange(row, filters, usePeriod = false) {
  const rowDate = parseDate(row.date || row.time)
  if (!rowDate) return true

  if (usePeriod && filters.period && filters.period !== 'Custom') {
    const today = parseDate(REPORT_TODAY)
    const start = new Date(today)
    const end = new Date(today)

    if (filters.period === 'Today') {
      return rowDate.getTime() === today.getTime()
    }
    if (filters.period === 'Last 7 days') {
      start.setDate(today.getDate() - 6)
      return rowDate >= start && rowDate <= end
    }
    if (filters.period === 'This Month') {
      return rowDate.getMonth() === today.getMonth() && rowDate.getFullYear() === today.getFullYear()
    }
    if (filters.period === 'Last Month') {
      const previousMonth = new Date(today.getFullYear(), today.getMonth() - 1, 1)
      return rowDate.getMonth() === previousMonth.getMonth() && rowDate.getFullYear() === previousMonth.getFullYear()
    }
  }

  const from = parseDate(filters.from)
  const to = parseDate(filters.to)
  return (!from || rowDate >= from) && (!to || rowDate <= to)
}

function buildRows(type, orgUsers, orgDevices) {
  const devicePool = orgDevices.length ? orgDevices : [{ id: 'site-main', name: 'Main Site' }]
  return Array.from({ length: type === 'anomalies' ? 42 : 36 }, (_, index) => {
    const userIndex = index % orgUsers.length
    const user = orgUsers[userIndex]
    const device = devicePool[(index + userIndex) % devicePool.length]
    const day = 1 + (index % 14)
    const month = index > 23 ? '05' : '06'
    const hour = 6 + (index % 14)
    const date = `2026-${month}-${String(day).padStart(2, '0')}`
    const userScale = user.analyticsScale || 1
    const deviceScale = 0.9 + ((index + device.name.length) % 5) * 0.06
    const dateScale = 0.85 + (day % 7) * 0.045
    const signal = Number((userScale * deviceScale * dateScale).toFixed(3))
    const severity = ['Low', 'Warning', 'High', 'Critical'][(index + userIndex) % 4]
    const status = (index + userIndex) % 3 === 0 ? 'Active' : 'Resolved'
    const base = {
      id: `${type}-${index + 1}`,
      time: `${date} ${String(hour).padStart(2, '0')}:${String((index * 7) % 60).padStart(2, '0')}`,
      date,
      userId: user.id,
      user: user.name,
      email: user.email,
      team: user.team,
      department: user.department,
      device: device.name,
      severity,
      status,
      signal,
      slot: index % baseSeries.length,
    }

    if (type === 'powerFactor') {
      return { ...base, pf: Math.max(0.79, 0.91 - signal * 0.035 - (index % 4) * 0.01).toFixed(2), duration: `${20 + (index % 8) * 10} min`, threshold: '0.85' }
    }
    if (type === 'energy') {
      const kWh = Math.round((260 + (index % 12) * 24) * signal)
      return { ...base, kWh, peak: (13 + signal * 9 + (index % 5)).toFixed(1), cost: kWh * 28, trend: index % 2 ? 'Down' : 'Up' }
    }
    if (type === 'anomalies') {
      const anomalyTypes = ['Overvoltage', 'Current Spike', 'PF Degradation', 'Phase Imbalance', 'Data Gap']
      return {
        ...base,
        type: anomalyTypes[(index + userIndex) % anomalyTypes.length],
        variable: ['Voltage Phase A', 'Current Phase B', 'Power Factor', 'All Variables'][index % 4],
        desc: ['Threshold exceeded', 'Sudden spike detected', 'Below configured threshold', 'Telemetry gap detected'][index % 4],
      }
    }
    const voltageA = 222 + (index % 9) + signal * 1.7
    const voltageB = 218 + (index % 8) + signal * 1.2
    const voltageC = 226 + (index % 7) + signal * 1.5
    const currentA = 17 + (index % 9) * 0.8 + signal * 2.4
    const currentB = 15 + (index % 8) * 0.7 + signal * 1.9
    const currentC = 19 + (index % 7) * 0.9 + signal * 2.2
    const imbalance = type === 'current'
      ? 1.3 + signal * 0.9 + (index % 5) * 0.28
      : 0.8 + signal * 0.7 + (index % 5) * 0.22
    return {
      ...base,
      phaseAValue: type === 'current' ? currentA : voltageA,
      phaseBValue: type === 'current' ? currentB : voltageB,
      phaseCValue: type === 'current' ? currentC : voltageC,
      phaseA: type === 'current' ? `${currentA.toFixed(1)}A` : `${voltageA.toFixed(0)}V`,
      phaseB: type === 'current' ? `${currentB.toFixed(1)}A` : `${voltageB.toFixed(0)}V`,
      phaseC: type === 'current' ? `${currentC.toFixed(1)}A` : `${voltageC.toFixed(0)}V`,
      imbalance: `${imbalance.toFixed(1)}%`,
    }
  })
}

function applyFilters(rows, filters, type) {
  const query = filters.search.trim().toLowerCase()
  return rows.filter(row => {
    const matchesTeam = filters.team === 'all' || row.team === filters.team
    const matchesDepartment = filters.department === 'all' || row.department === filters.department
    const matchesUser = filters.userId === 'all' || String(row.userId) === String(filters.userId)
    const matchesSeverity = filters.severity === 'all' || row.severity === filters.severity
    const matchesStatus = filters.status === 'all' || row.status === filters.status
    const matchesType = filters.anomalyType === 'all' || row.type === filters.anomalyType
    const matchesDate = withinDateRange(row, filters, type === 'energy')
    const text = Object.values(row).join(' ').toLowerCase()
    return matchesTeam && matchesDepartment && matchesUser && matchesSeverity && matchesStatus && matchesType && matchesDate && (!query || text.includes(query))
  })
}

function average(rows, key, fallback = 0) {
  if (!rows.length) return fallback
  return rows.reduce((sum, row) => sum + Number(row[key] || 0), 0) / rows.length
}

function buildChartRows(type, rows, filters) {
  if (!rows.length) return []
  const allSignal = average(rows, 'signal', 1)
  const severityBoost = filters.severity === 'Critical' ? 1.18 : filters.severity === 'High' ? 1.1 : filters.severity === 'Low' ? 0.86 : 1
  const statusBoost = filters.status === 'Active' ? 1.08 : filters.status === 'Resolved' ? 0.92 : 1

  return baseSeries.map((point, index) => {
    const slotRows = rows.filter(row => row.slot === index)
    const sourceRows = slotRows.length ? slotRows : rows
    const timeShape = 0.92 + (index % 6) * 0.035
    const signal = average(sourceRows, 'signal', allSignal) * severityBoost * statusBoost

    if (type === 'voltage') {
      return {
        time: point.time,
        voltageA: Number((average(sourceRows, 'phaseAValue', point.voltageA) + signal * 1.1 * timeShape).toFixed(1)),
        voltageB: Number((average(sourceRows, 'phaseBValue', point.voltageB) + signal * 0.8 * timeShape).toFixed(1)),
        voltageC: Number((average(sourceRows, 'phaseCValue', point.voltageC) + signal * 1.3 * timeShape).toFixed(1)),
      }
    }
    if (type === 'current') {
      return {
        time: point.time,
        currentA: Number((average(sourceRows, 'phaseAValue', point.currentA) * timeShape).toFixed(1)),
        currentB: Number((average(sourceRows, 'phaseBValue', point.currentB) * (timeShape - 0.03)).toFixed(1)),
        currentC: Number((average(sourceRows, 'phaseCValue', point.currentC) * (timeShape + 0.02)).toFixed(1)),
      }
    }
    if (type === 'powerFactor') {
      return {
        time: point.time,
        pf: Number(Math.max(0.8, Math.min(1, average(sourceRows, 'pf', point.pf) + (index % 4) * 0.004 - signal * 0.01)).toFixed(2)),
        comparison: Number(Math.max(0.8, Math.min(1, average(rows, 'pf', point.pf) + (index % 3) * 0.003)).toFixed(2)),
      }
    }
    if (type === 'energy') {
      return {
        time: point.time,
        power: Math.round(average(sourceRows, 'peak', 18) * 620 * timeShape),
      }
    }
    return {
      time: point.time,
      active: sourceRows.filter(row => row.status === 'Active').length,
      resolved: sourceRows.filter(row => row.status === 'Resolved').length,
      critical: sourceRows.filter(row => row.severity === 'Critical').length,
    }
  })
}

function buildDailyEnergyRows(rows) {
  const byDate = rows.reduce((acc, row) => {
    if (!acc[row.date]) acc[row.date] = 0
    acc[row.date] += row.kWh || 0
    return acc
  }, {})

  return Object.entries(byDate)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([date, kWh]) => ({
      day: new Date(`${date}T00:00:00`).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
      kWh,
    }))
}

function EmptyState({ onReset, onOverview }) {
  return (
    <div className="card p-10 text-center">
      <div className="w-14 h-14 rounded-full bg-surface-100 text-surface-400 flex items-center justify-center mx-auto mb-4">
        <BarChart3 size={26} />
      </div>
      <h3 className="text-sm font-semibold text-surface-900">No analytics found</h3>
      <p className="text-xs text-surface-400 mt-2 max-w-xl mx-auto">
        No organization analytics match the selected filters. Try changing the date range, user, team, department, device, or search term.
      </p>
      <div className="mt-5 flex items-center justify-center gap-3 flex-wrap">
        <button className="btn-secondary" onClick={onReset}><RotateCcw size={14} /> Reset Filters</button>
        <button className="btn-primary" onClick={onOverview}><Users size={14} /> View Organization Overview</button>
      </div>
    </div>
  )
}

function SeverityBadge({ value }) {
  const klass = value === 'Critical' || value === 'High' ? 'badge-danger' : value === 'Warning' || value === 'Medium' ? 'badge-warning' : 'badge-info'
  return <span className={`badge ${klass}`}>{value}</span>
}

function StatusBadge({ value }) {
  return <span className={`badge ${value === 'Active' ? 'badge-danger' : 'badge-success'}`}>{value}</span>
}

function MetricCard({ label, value, color = 'text-primary-600', tooltip }) {
  return (
    <div className="card p-4 text-center" title={tooltip}>
      <p className={`text-2xl font-bold ${color}`}>{value}</p>
      <p className="text-xs text-surface-400 mt-1">{label}</p>
    </div>
  )
}

function Gauge({ value, title, scope }) {
  const pct = Math.max(0, Math.min(1, (value - 0.7) / 0.3))
  const angle = pct * 180 - 180
  const color = value >= 0.9 ? '#16a34a' : value >= 0.85 ? '#F5A623' : '#dc2626'
  const needleX = 100 + 62 * Math.cos((angle * Math.PI) / 180)
  const needleY = 90 + 62 * Math.sin((angle * Math.PI) / 180)
  const status = value >= 0.9 ? 'Excellent' : value >= 0.85 ? 'Acceptable' : value >= 0.8 ? 'Warning' : 'Critical'

  return (
    <div className="card p-6">
      <h3 className="text-sm font-semibold text-surface-800 text-center mb-1">{title}</h3>
      <p className="text-xs text-surface-400 text-center mb-4">{scope} · threshold 0.85</p>
      <svg viewBox="0 0 200 110" className="w-full max-w-xs mx-auto" role="img" aria-label={`Power factor gauge ${value}`}>
        <path d="M 30 90 A 70 70 0 0 1 170 90" fill="none" stroke="#ECEEE6" strokeWidth="14" strokeLinecap="round" />
        <path d={`M 30 90 A 70 70 0 ${pct > 0.5 ? 1 : 0} 1 ${30 + pct * 140} ${90 - Math.sin(pct * Math.PI) * 70}`} fill="none" stroke={color} strokeWidth="14" strokeLinecap="round" />
        <line x1="100" y1="90" x2={needleX} y2={needleY} stroke="#1F2937" strokeWidth="2.5" strokeLinecap="round" />
        <circle cx="100" cy="90" r="4" fill="#1F2937" />
        <text x="100" y="78" fontSize="20" fill="#1F2937" textAnchor="middle" fontWeight="700">{value.toFixed(2)}</text>
        <text x="100" y="94" fontSize="8" fill="#64748b" textAnchor="middle">POWER FACTOR</text>
        <text x="28" y="106" fontSize="9" fill="#64748b" textAnchor="middle">0.70</text>
        <text x="172" y="106" fontSize="9" fill="#64748b" textAnchor="middle">1.00</text>
      </svg>
      <p className={`text-center text-xs mt-2 ${value >= 0.9 ? 'text-success-600' : value >= 0.85 ? 'text-primary-600' : 'text-danger-600'}`}>{status} · selected scope</p>
    </div>
  )
}

function Filters({ filters, setFilters, orgUsers, type, onApply, onReset }) {
  const departments = filters.team === 'all' ? ALL_DEPARTMENTS : DEPARTMENTS_BY_TEAM[filters.team]
  const filteredUsers = orgUsers.filter(item =>
    (filters.team === 'all' || item.team === filters.team) &&
    (filters.department === 'all' || item.department === filters.department)
  )

  const update = (key, value) => {
    setFilters(prev => {
      const next = { ...prev, [key]: value }
      if (key === 'scope' && value === 'user' && prev.userId === 'all') next.userId = filteredUsers[0]?.id ?? 'all'
      if (key === 'scope' && value === 'organization') next.userId = 'all'
      if (key === 'team') {
        next.department = 'all'
        next.userId = 'all'
      }
      if (key === 'department') next.userId = 'all'
      return next
    })
  }

  return (
    <div className="card p-4">
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-8 gap-3 items-end">
        <div>
          <label className="label">View Mode</label>
          <select className="select" value={filters.scope} onChange={e => update('scope', e.target.value)}>
            <option value="organization">Organization Overview</option>
            <option value="user">User Detail</option>
          </select>
        </div>
        {type === 'energy' ? (
          <>
            <div>
              <label className="label">Period</label>
              <select className="select" value={filters.period} onChange={e => update('period', e.target.value)}>
                {PERIODS.map(item => <option key={item}>{item}</option>)}
              </select>
            </div>
            {filters.period === 'Custom' && (
              <>
                <div>
                  <label className="label">From Date</label>
                  <input type="date" className="input" value={filters.from} onChange={e => update('from', e.target.value)} />
                </div>
                <div>
                  <label className="label">To Date</label>
                  <input type="date" className="input" value={filters.to} onChange={e => update('to', e.target.value)} />
                </div>
              </>
            )}
          </>
        ) : (
          <>
            <div>
              <label className="label">From Date</label>
              <input type="date" className="input" value={filters.from} onChange={e => update('from', e.target.value)} />
            </div>
            <div>
              <label className="label">To Date</label>
              <input type="date" className="input" value={filters.to} onChange={e => update('to', e.target.value)} />
            </div>
          </>
        )}
        <div>
          <label className="label">Team</label>
          <select className="select" value={filters.team} onChange={e => update('team', e.target.value)}>
            <option value="all">All teams</option>
            {TEAMS.map(item => <option key={item}>{item}</option>)}
          </select>
        </div>
        <div>
          <label className="label">Department</label>
          <select className="select" value={filters.department} onChange={e => update('department', e.target.value)}>
            <option value="all">All departments</option>
            {departments.map(item => <option key={item}>{item}</option>)}
          </select>
        </div>
        <div>
          <label className="label">User</label>
          <select className="select" value={filters.userId} onChange={e => update('userId', e.target.value)}>
            <option value="all">All users</option>
            {filteredUsers.map(item => <option key={item.id} value={item.id}>{item.name}</option>)}
          </select>
        </div>
        <div>
          <label className="label">Search</label>
          <div className="relative">
            <Search size={14} className="absolute left-3 top-2.5 text-surface-400" />
            <input className="input pl-9" value={filters.search} onChange={e => update('search', e.target.value)} placeholder="Search..." />
          </div>
        </div>
        {type === 'anomalies' && (
          <>
            <div>
              <label className="label">Type</label>
              <select className="select" value={filters.anomalyType} onChange={e => update('anomalyType', e.target.value)}>
                <option value="all">All types</option>
                {['Overvoltage', 'Current Spike', 'PF Degradation', 'Phase Imbalance', 'Data Gap'].map(item => <option key={item}>{item}</option>)}
              </select>
            </div>
            <div>
              <label className="label">Severity</label>
              <select className="select" value={filters.severity} onChange={e => update('severity', e.target.value)}>
                <option value="all">All severities</option>
                {['Low', 'Warning', 'High', 'Critical'].map(item => <option key={item}>{item}</option>)}
              </select>
            </div>
            <div>
              <label className="label">Status</label>
              <select className="select" value={filters.status} onChange={e => update('status', e.target.value)}>
                <option value="all">All statuses</option>
                <option>Active</option>
                <option>Resolved</option>
              </select>
            </div>
          </>
        )}
        <button className="btn-primary" onClick={onApply}>Load</button>
        <button className="btn-secondary" onClick={onReset}><RotateCcw size={14} /> Reset</button>
      </div>
    </div>
  )
}

function exportCsv(filename, rows) {
  if (!rows.length) return
  const headers = Object.keys(rows[0]).filter(key => !['id', 'userId', 'email'].includes(key))
  const csv = [
    headers.join(','),
    ...rows.map(row => headers.map(key => `"${String(row[key] ?? '').replace(/"/g, '""')}"`).join(',')),
  ].join('\n')
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = filename
  link.click()
  URL.revokeObjectURL(url)
}

export default function OrganizationAnalyticsPage({ type }) {
  const config = PAGE_CONFIG[type]
  const { user } = useAuth()
  const orgName = user?.name || 'Ambition'
  const [filters, setFilters] = useState({
    scope: 'organization',
    from: '2026-06-07',
    to: '2026-06-10',
    period: 'This Month',
    team: 'all',
    department: 'all',
    userId: 'all',
    device: 'all',
    search: '',
    anomalyType: 'all',
    severity: 'all',
    status: 'all',
  })
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [detail, setDetail] = useState(null)

  const orgUsers = useMemo(() => ensureThreeOrgUsers(orgName), [orgName])
  const orgDevices = useMemo(() => devices.filter(item => item.org === orgName), [orgName])
  const rawRows = useMemo(() => buildRows(type, orgUsers, orgDevices), [type, orgUsers, orgDevices])
  const rows = useMemo(() => applyFilters(rawRows, filters, type), [rawRows, filters, type])
  const selectedUser = orgUsers.find(item => String(item.id) === String(filters.userId))
  const isUserDetail = filters.scope === 'user' || filters.userId !== 'all'
  const scopeLabel = isUserDetail && selectedUser ? selectedUser.name : orgName
  const chartRows = useMemo(() => buildChartRows(type, rows, filters), [filters, rows, type])
  const dailyEnergyRows = useMemo(() => buildDailyEnergyRows(rows), [rows])

  const resetFilters = () => setFilters(prev => ({
    ...prev,
    scope: 'organization',
    team: 'all',
    department: 'all',
    userId: 'all',
    device: 'all',
    search: '',
    anomalyType: 'all',
    severity: 'all',
    status: 'all',
  }))

  const load = () => {
    setError('')
    setLoading(true)
    window.setTimeout(() => setLoading(false), 500)
  }

  const drillIntoUser = (row) => {
    setFilters(prev => ({ ...prev, scope: 'user', userId: row.userId }))
  }

  const stats = useMemo(() => {
    if (type === 'powerFactor') {
      const values = rows.map(row => Number(row.pf))
      const avg = values.length ? values.reduce((sum, value) => sum + value, 0) / values.length : 0
      return [
        ['Avg Power Factor', avg ? avg.toFixed(2) : '-', 'text-success-600', 'Average measured power factor for the active filters.'],
        ['Min Power Factor', values.length ? Math.min(...values).toFixed(2) : '-', 'text-primary-600', 'Lowest power factor event in the selected scope.'],
        ['Hours Below 0.85', rows.length ? `${Math.round(rows.length * 0.7)} hrs` : '-', 'text-danger-600', 'Estimated cumulative duration under threshold.'],
        ['Users / Devices Below', rows.length ? new Set(rows.map(row => row.user)).size : '-', 'text-info-600', 'Unique affected users for this reporting period.'],
      ]
    }
    if (type === 'energy') {
      const total = rows.reduce((sum, row) => sum + row.kWh, 0)
      const peak = rows.length ? Math.max(...rows.map(row => Number(row.peak))) : 0
      return [
        ['Total Energy', rows.length ? total.toLocaleString() : '-', 'text-primary-600', 'Total kWh across filtered users and devices.'],
        ['Peak Power', rows.length ? `${peak.toFixed(1)} kW` : '-', 'text-primary-600', 'Maximum active power in the selected period.'],
        ['Off-Peak Energy', rows.length ? `${Math.round(total * 0.49).toLocaleString()} kWh` : '-', 'text-info-600', 'Energy consumed in off-peak windows.'],
        ['On-Peak Energy', rows.length ? `${Math.round(total * 0.51).toLocaleString()} kWh` : '-', 'text-success-600', 'Energy consumed in on-peak windows.'],
        ['Estimated Cost', rows.length ? `${CURRENCY} ${rows.reduce((sum, row) => sum + row.cost, 0).toLocaleString()}` : '-', 'text-danger-600', 'Estimated cost using configured tariff data.'],
        ['Avg / Active User', rows.length ? `${Math.round(total / Math.max(1, new Set(rows.map(row => row.user)).size)).toLocaleString()} kWh` : '-', 'text-info-600', 'Average consumption by active user.'],
      ]
    }
    if (type === 'anomalies') {
      return [
        ['Active Anomalies', rows.filter(row => row.status === 'Active').length || '-', 'text-danger-600', 'Currently active anomalies.'],
        ['Resolved Anomalies', rows.filter(row => row.status === 'Resolved').length || '-', 'text-success-600', 'Resolved anomalies in the selected period.'],
        ['Critical Anomalies', rows.filter(row => row.severity === 'Critical').length || '-', 'text-danger-600', 'Critical severity anomaly count.'],
        ['Users / Devices Affected', rows.length ? new Set(rows.map(row => `${row.user}-${row.device}`)).size : '-', 'text-info-600', 'Unique affected user and device pairs.'],
      ]
    }
    return [
      [`Maximum ${type === 'current' ? 'Current ' : ''}Imbalance`, rows.length ? rows.map(row => Number(row.imbalance.replace('%', ''))).sort((a, b) => b - a)[0].toFixed(1) + '%' : '-', 'text-primary-600', 'Largest imbalance in the active filter scope.'],
      [`Average ${type === 'current' ? 'Current ' : ''}Imbalance`, rows.length ? (rows.reduce((sum, row) => sum + Number(row.imbalance.replace('%', '')), 0) / rows.length).toFixed(1) + '%' : '-', 'text-info-600', 'Average imbalance across filtered events.'],
      ['Events Detected', rows.length || '-', 'text-danger-600', 'Filtered event count.'],
      ['Users / Devices Affected', rows.length ? new Set(rows.map(row => `${row.user}-${row.device}`)).size : '-', 'text-success-600', 'Unique affected user and device pairs.'],
    ]
  }, [rows, type])

  const columns = {
    imbalance: [
      { key: 'time', label: 'Timestamp', render: value => <span className="font-mono text-xs">{value}</span> },
      { key: 'user', label: 'User' },
      { key: 'team', label: 'Team' },
      { key: 'department', label: 'Department' },
      { key: 'device', label: 'Device / Site' },
      { key: 'phaseA', label: 'Phase A' },
      { key: 'phaseB', label: 'Phase B' },
      { key: 'phaseC', label: 'Phase C' },
      { key: 'imbalance', label: 'Imbalance', render: value => <span className="font-semibold text-primary-600">{value}</span> },
      { key: 'severity', label: 'Severity', render: value => <SeverityBadge value={value} /> },
      { key: 'status', label: 'Status', render: value => <StatusBadge value={value} /> },
    ],
    powerFactor: [
      { key: 'time', label: 'Timestamp', render: value => <span className="font-mono text-xs">{value}</span> },
      { key: 'user', label: 'User' },
      { key: 'team', label: 'Team' },
      { key: 'department', label: 'Department' },
      { key: 'device', label: 'Device' },
      { key: 'pf', label: 'Power Factor', render: value => <span className="font-semibold text-primary-600">{value}</span> },
      { key: 'duration', label: 'Duration' },
      { key: 'threshold', label: 'Threshold' },
      { key: 'status', label: 'Status', render: value => <StatusBadge value={value} /> },
    ],
    energy: [
      { key: 'date', label: 'Date', render: value => <span className="font-mono text-xs">{value}</span> },
      { key: 'user', label: 'User' },
      { key: 'team', label: 'Team' },
      { key: 'department', label: 'Department' },
      { key: 'device', label: 'Device' },
      { key: 'kWh', label: 'Energy Consumed', render: value => `${value.toLocaleString()} kWh` },
      { key: 'peak', label: 'Peak Power', render: value => `${value} kW` },
      { key: 'cost', label: 'Estimated Cost', render: value => `${CURRENCY} ${value.toLocaleString()}` },
      { key: 'trend', label: 'Trend' },
    ],
    anomaly: [
      { key: 'type', label: 'Anomaly Type' },
      { key: 'user', label: 'User' },
      { key: 'team', label: 'Team' },
      { key: 'department', label: 'Department' },
      { key: 'device', label: 'Device' },
      { key: 'variable', label: 'Variable' },
      { key: 'desc', label: 'Description' },
      { key: 'time', label: 'Detected At', render: value => <span className="font-mono text-xs">{value}</span> },
      { key: 'severity', label: 'Severity', render: value => <SeverityBadge value={value} /> },
      { key: 'status', label: 'Status', render: value => <StatusBadge value={value} /> },
    ],
  }[config.tableKind]

  return (
    <div className="space-y-6">
      <div className="page-header">
        <div>
          <div className="flex items-center gap-2">
            <h2 className="page-title">{config.title}</h2>
            <span className="badge badge-info">Organization</span>
          </div>
          <p className="breadcrumb">Organization / AI Analytics / {config.crumb}</p>
          <p className="text-xs text-surface-500 mt-1">
            {isUserDetail && selectedUser
              ? `${selectedUser.name} · ${selectedUser.email} · ${selectedUser.team} / ${selectedUser.department}`
              : `${orgName} · Organization Overview`}
          </p>
        </div>
        <div className="flex items-center gap-2">
          {isUserDetail && (
            <button className="btn-secondary" onClick={resetFilters}><ArrowLeft size={14} /> Back to Organization Overview</button>
          )}
          <button className="btn-secondary px-3" onClick={load} title="Retry or refresh analytics"><RefreshCw size={15} className={loading ? 'animate-spin' : ''} /></button>
          <button className="btn-secondary" onClick={() => exportCsv(`${config.title.toLowerCase().replace(/\s+/g, '-')}.csv`, rows)}>
            <Download size={14} /> Export
          </button>
        </div>
      </div>

      <Filters filters={filters} setFilters={setFilters} orgUsers={orgUsers} type={type} onApply={load} onReset={resetFilters} />

      {error && (
        <div className="card p-4 border-danger-600/30 bg-danger-100/20 flex items-center justify-between gap-4">
          <div className="flex items-center gap-2 text-sm text-danger-700"><AlertTriangle size={16} /> {error}</div>
          <button className="btn-danger py-1.5" onClick={load}>Retry</button>
        </div>
      )}

      {loading ? (
        <div className="space-y-4">
          <div className="card h-72 animate-pulse bg-surface-100" />
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">{Array.from({ length: 4 }).map((_, index) => <div key={index} className="card h-24 animate-pulse bg-surface-100" />)}</div>
        </div>
      ) : rows.length === 0 ? (
        <EmptyState onReset={resetFilters} onOverview={resetFilters} />
      ) : (
        <>
          {type === 'powerFactor' && <Gauge value={chartRows.reduce((sum, row) => sum + row.pf, 0) / chartRows.length} title={`Current Power Factor - ${scopeLabel}`} scope={isUserDetail ? 'User Detail' : 'Organization Overview'} />}

          <div className="card p-5">
            <div className="flex items-start justify-between gap-3 mb-4">
              <div>
                <h3 className="text-sm font-semibold text-surface-800 mb-1">{config.chartTitle} - {scopeLabel}</h3>
                <p className="text-xs text-surface-500">{config.chartDescription}</p>
              </div>
              <span className="badge badge-neutral">{isUserDetail ? 'User Detail' : 'Organization Overview'}</span>
            </div>
            <ResponsiveContainer width="100%" height={type === 'powerFactor' ? 220 : 260}>
              {type === 'current' ? (
                <BarChart data={chartRows} aria-label="Current imbalance chart">
                  <CartesianGrid strokeDasharray="3 3" stroke="#ECEEE6" />
                  <XAxis dataKey="time" tick={{ fontSize: 11, fill: '#9AA09A' }} stroke="#D1D5C8" />
                  <YAxis domain={config.yDomain} tick={{ fontSize: 11, fill: '#9AA09A' }} stroke="#D1D5C8" />
                  <Tooltip />
                  <Legend wrapperStyle={{ fontSize: 11 }} />
                  <Bar dataKey="currentA" fill="#F5A623" radius={[3, 3, 0, 0]} name="Phase A" />
                  <Bar dataKey="currentB" fill="#3B82F6" radius={[3, 3, 0, 0]} name="Phase B" />
                  <Bar dataKey="currentC" fill="#EF4444" radius={[3, 3, 0, 0]} name="Phase C" />
                </BarChart>
              ) : type === 'energy' ? (
                <AreaChart data={chartRows} aria-label="Energy consumption chart">
                  <defs>
                    <linearGradient id="orgEnergyGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#F5A623" stopOpacity={0.3} />
                      <stop offset="95%" stopColor="#F5A623" stopOpacity={0.02} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="#ECEEE6" />
                  <XAxis dataKey="time" tick={{ fontSize: 11, fill: '#9AA09A' }} stroke="#D1D5C8" />
                  <YAxis tick={{ fontSize: 11, fill: '#9AA09A' }} stroke="#D1D5C8" tickFormatter={value => `${(value / 1000).toFixed(0)}kW`} />
                  <Tooltip formatter={value => [`${(value / 1000).toFixed(1)} kW`, 'Active Power']} />
                  <Area type="monotone" dataKey="power" stroke="#F5A623" fill="url(#orgEnergyGrad)" strokeWidth={2} name="Power" />
                </AreaChart>
              ) : type === 'anomalies' ? (
                <BarChart data={chartRows} aria-label="Anomaly activity chart">
                  <CartesianGrid strokeDasharray="3 3" stroke="#ECEEE6" />
                  <XAxis dataKey="time" tick={{ fontSize: 11, fill: '#9AA09A' }} stroke="#D1D5C8" />
                  <YAxis tick={{ fontSize: 11, fill: '#9AA09A' }} stroke="#D1D5C8" />
                  <Tooltip />
                  <Legend wrapperStyle={{ fontSize: 11 }} />
                  <Bar dataKey="active" fill="#EF4444" radius={[3, 3, 0, 0]} name="Active" />
                  <Bar dataKey="resolved" fill="#22C55E" radius={[3, 3, 0, 0]} name="Resolved" />
                </BarChart>
              ) : (
                <LineChart data={chartRows} aria-label={`${config.title} chart`}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#ECEEE6" />
                  <XAxis dataKey="time" tick={{ fontSize: 11, fill: '#9AA09A' }} stroke="#D1D5C8" />
                  <YAxis domain={config.yDomain} tick={{ fontSize: 11, fill: '#9AA09A' }} stroke="#D1D5C8" />
                  <Tooltip />
                  <Legend wrapperStyle={{ fontSize: 11 }} />
                  {type === 'powerFactor' ? (
                    <>
                      <Line type="monotone" dataKey="pf" stroke="#F5A623" dot={false} strokeWidth={2} name="Power Factor" />
                      {filters.team !== 'all' && <Line type="monotone" dataKey="pf" stroke="#3B82F6" dot={false} strokeWidth={1.5} name={`${filters.team} comparison`} />}
                    </>
                  ) : (
                    <>
                      <Line type="monotone" dataKey="voltageA" stroke="#F5A623" dot={false} strokeWidth={2} name="Phase A" />
                      <Line type="monotone" dataKey="voltageB" stroke="#3B82F6" dot={false} strokeWidth={2} name="Phase B" />
                      <Line type="monotone" dataKey="voltageC" stroke="#EF4444" dot={false} strokeWidth={2} name="Phase C" />
                    </>
                  )}
                </LineChart>
              )}
            </ResponsiveContainer>
          </div>

          <div className={`grid grid-cols-1 sm:grid-cols-2 ${type === 'energy' ? 'xl:grid-cols-6' : 'xl:grid-cols-4'} gap-4`}>
            {stats.map(([label, value, color, tooltip]) => <MetricCard key={label} label={label} value={value} color={color} tooltip={tooltip} />)}
          </div>

          {type === 'energy' && (
            <div className="card p-5">
              <h3 className="text-sm font-semibold text-surface-800 mb-1">Daily Consumption - Selected Period</h3>
              <p className="text-xs text-surface-500 mb-4">Grouped by {filters.team !== 'all' ? 'team' : filters.department !== 'all' ? 'department' : isUserDetail ? 'user' : 'organization'}</p>
              <ResponsiveContainer width="100%" height={210}>
                <BarChart data={dailyEnergyRows}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#ECEEE6" />
                  <XAxis dataKey="day" tick={{ fontSize: 11, fill: '#9AA09A' }} stroke="#D1D5C8" />
                  <YAxis tick={{ fontSize: 11, fill: '#9AA09A' }} stroke="#D1D5C8" />
                  <Tooltip formatter={value => [`${value} kWh`, 'Consumption']} />
                  <Bar dataKey="kWh" fill="#F5A623" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}

          <div>
            <div className="flex items-center justify-between gap-3 mb-3">
              <h3 className="text-sm font-semibold text-surface-700 flex items-center gap-2">
                <AlertTriangle size={14} className="text-primary-600" /> {config.tableTitle}
              </h3>
              {type === 'anomalies' && <button className="btn-secondary py-1.5 text-xs"><SlidersHorizontal size={12} /> Columns</button>}
            </div>
            <DataTable
              columns={columns}
              data={rows}
              pageSize={7}
              searchPlaceholder={`Search ${config.title.toLowerCase()}...`}
              emptyMessage="No analytics found"
              actions={row => (
                <>
                  <button className="btn-ghost p-1.5 rounded" title="View details" onClick={() => setDetail(row)}><Eye size={14} /></button>
                  <button className="btn-ghost p-1.5 rounded" title="Open user detail" onClick={() => drillIntoUser(row)}><User size={14} /></button>
                </>
              )}
            />
          </div>
        </>
      )}

      <button className="sr-only" onClick={() => setError('Unable to load organization analytics. Please retry.')}>Trigger analytics error</button>

      <Modal open={!!detail} onClose={() => setDetail(null)} title={`${config.title} Details`} size="lg">
        {detail && (
          <div className="space-y-3">
            <div className="flex items-center gap-2 mb-4">
              {detail.severity && <SeverityBadge value={detail.severity} />}
              {detail.status && <StatusBadge value={detail.status} />}
            </div>
            {Object.entries(detail)
              .filter(([key]) => !['id', 'userId', 'email'].includes(key))
              .map(([key, value]) => (
                <div key={key} className="flex justify-between text-sm gap-4">
                  <span className="text-surface-400 capitalize flex-shrink-0">{key.replace(/([A-Z])/g, ' $1')}</span>
                  <span className="text-surface-900 font-medium text-right">{String(value)}</span>
                </div>
              ))}
            <div className="pt-4 flex justify-end gap-2">
              <button className="btn-secondary" onClick={() => drillIntoUser(detail)}>Open User Analytics</button>
              {type === 'anomalies' && detail.status === 'Active' && <button className="btn-primary" onClick={() => setDetail({ ...detail, status: 'Resolved' })}>Mark as resolved</button>}
            </div>
          </div>
        )}
      </Modal>
    </div>
  )
}
