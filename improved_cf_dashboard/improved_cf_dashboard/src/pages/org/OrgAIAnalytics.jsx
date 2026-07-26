import { useMemo, useState } from 'react'
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import {
  Activity,
  AlertCircle,
  Bot,
  BrainCircuit,
  CalendarDays,
  Clock3,
  Gauge,
  RefreshCw,
  Search,
  Sparkles,
  TrendingUp,
  User,
  Users,
  Zap,
} from 'lucide-react'
import { useAuth } from '../../context/AuthContext'
import { devices, users } from '../../data/dummy'

const TEAMS = ['Operations', 'Maintenance', 'Energy', 'Finance']
const DEPARTMENTS = ['Production', 'Utilities', 'Facilities', 'Management']
const RANGES = {
  '7d': { label: 'Last 7 days', days: 7 },
  '30d': { label: 'Last 30 days', days: 30 },
  '90d': { label: 'Last 90 days', days: 90 },
}
const COLORS = ['#F5A623', '#0EA5E9', '#22C55E', '#EF4444']

const formatNumber = (value) => new Intl.NumberFormat('en-US').format(value)

function profileForUser(user, index) {
  const seed = user.name.split('').reduce((sum, char) => sum + char.charCodeAt(0), 0) + index * 17
  return {
    ...user,
    team: TEAMS[seed % TEAMS.length],
    department: DEPARTMENTS[(seed + 1) % DEPARTMENTS.length],
    prompts: 82 + (seed % 170),
    automations: 18 + (seed % 56),
    insights: 9 + (seed % 24),
    avgResponse: Number((1.1 + (seed % 20) / 10).toFixed(1)),
    satisfaction: 82 + (seed % 15),
    activeHours: 28 + (seed % 72),
  }
}

function ensureThreeOrgUsers(orgName) {
  const orgScopedUsers = users.filter(item => item.org === orgName)
  const fallbackUsers = [
    {
      id: `org-${orgName}-ops`,
      org: orgName,
      name: 'Ayesha Khan',
      email: `ayesha.${orgName.toLowerCase().replace(/\s+/g, '')}@cf.com`,
      phone: '+92-311-1029384',
      role: 'Customer',
      status: 'Active',
      createdAt: '2026-06-12',
    },
    {
      id: `org-${orgName}-energy`,
      org: orgName,
      name: 'Omar Farooq',
      email: `omar.${orgName.toLowerCase().replace(/\s+/g, '')}@cf.com`,
      phone: '+92-312-5647382',
      role: 'Customer',
      status: 'Active',
      createdAt: '2026-06-18',
    },
    {
      id: `org-${orgName}-maintenance`,
      org: orgName,
      name: 'Mehwish Ali',
      email: `mehwish.${orgName.toLowerCase().replace(/\s+/g, '')}@cf.com`,
      phone: '+92-313-8473625',
      role: 'Customer',
      status: 'Active',
      createdAt: '2026-06-25',
    },
  ]

  return [...orgScopedUsers, ...fallbackUsers].slice(0, 3)
}

function buildTrend(rangeDays, selectedUser, team, department) {
  const points = rangeDays === 7 ? 7 : 10
  const step = Math.max(1, Math.round(rangeDays / points))
  const userFactor = selectedUser === 'all' ? 1 : 0.36
  const teamFactor = team === 'all' ? 1 : 0.78
  const departmentFactor = department === 'all' ? 1 : 0.82

  return Array.from({ length: points }, (_, index) => {
    const day = index * step + 1
    const base = (64 + index * 11 + (index % 3) * 18) * userFactor * teamFactor * departmentFactor
    return {
      day: rangeDays === 7 ? `Day ${index + 1}` : `${day}d`,
      prompts: Math.round(base),
      insights: Math.round(base * 0.24),
      automations: Math.round(base * 0.16),
      anomalies: Math.max(1, Math.round(base * 0.035)),
    }
  })
}

function StatCard({ label, value, change, icon: Icon, tone = 'primary', tooltip }) {
  const toneClass = {
    primary: 'text-primary-600 bg-primary-500/10',
    info: 'text-info-600 bg-info-600/10',
    success: 'text-success-600 bg-success-600/10',
    danger: 'text-danger-600 bg-danger-600/10',
  }[tone]

  return (
    <div className="stat-card group" title={tooltip}>
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-xs font-semibold text-surface-500 uppercase tracking-wide">{label}</p>
          <p className="mt-2 text-2xl font-bold text-surface-900">{value}</p>
        </div>
        <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${toneClass}`}>
          <Icon size={18} />
        </div>
      </div>
      <p className="mt-3 text-xs text-success-600 flex items-center gap-1">
        <TrendingUp size={12} /> {change}
      </p>
    </div>
  )
}

function ChartTooltip({ active, payload, label }) {
  if (!active || !payload?.length) return null
  return (
    <div className="bg-white dark:bg-surface-900 border border-surface-200 dark:border-surface-800 rounded-lg shadow-elevated p-3 text-xs">
      <p className="font-semibold text-surface-800 mb-2">{label}</p>
      <div className="space-y-1">
        {payload.map(item => (
          <p key={item.dataKey} className="flex items-center justify-between gap-5" style={{ color: item.color }}>
            <span>{item.name}</span>
            <span className="font-semibold">{formatNumber(item.value)}</span>
          </p>
        ))}
      </div>
    </div>
  )
}

export default function OrgAIAnalytics() {
  const { user } = useAuth()
  const orgName = user?.name || 'Ambition'
  const [viewMode, setViewMode] = useState('org')
  const [range, setRange] = useState('30d')
  const [selectedUserId, setSelectedUserId] = useState('all')
  const [team, setTeam] = useState('all')
  const [department, setDepartment] = useState('all')
  const [query, setQuery] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const orgUsers = useMemo(() => ensureThreeOrgUsers(orgName).map(profileForUser), [orgName])
  const orgDevices = useMemo(() => devices.filter(item => item.org === orgName), [orgName])

  const selectedUser = useMemo(
    () => orgUsers.find(item => String(item.id) === String(selectedUserId)),
    [orgUsers, selectedUserId]
  )

  const filteredUsers = useMemo(() => {
    const normalized = query.trim().toLowerCase()
    return orgUsers.filter(item => {
      const matchesUser = selectedUserId === 'all' || String(item.id) === String(selectedUserId)
      const matchesTeam = team === 'all' || item.team === team
      const matchesDepartment = department === 'all' || item.department === department
      const matchesQuery = !normalized || `${item.name} ${item.email}`.toLowerCase().includes(normalized)
      return matchesUser && matchesTeam && matchesDepartment && matchesQuery
    })
  }, [department, orgUsers, query, selectedUserId, team])

  const trendData = useMemo(
    () => buildTrend(RANGES[range].days, selectedUserId, team, department),
    [department, range, selectedUserId, team]
  )

  const totals = useMemo(() => {
    const baseUsers = filteredUsers.length ? filteredUsers : orgUsers
    const prompts = baseUsers.reduce((sum, item) => sum + item.prompts, 0)
    const automations = baseUsers.reduce((sum, item) => sum + item.automations, 0)
    const insights = baseUsers.reduce((sum, item) => sum + item.insights, 0)
    const avgResponse = baseUsers.length
      ? (baseUsers.reduce((sum, item) => sum + item.avgResponse, 0) / baseUsers.length).toFixed(1)
      : '0.0'
    const satisfaction = baseUsers.length
      ? Math.round(baseUsers.reduce((sum, item) => sum + item.satisfaction, 0) / baseUsers.length)
      : 0
    return { prompts, automations, insights, avgResponse, satisfaction, activeUsers: baseUsers.length }
  }, [filteredUsers, orgUsers])

  const categoryData = useMemo(() => [
    { name: 'Forecasting', value: Math.round(totals.prompts * 0.34) },
    { name: 'Anomaly checks', value: Math.round(totals.prompts * 0.26) },
    { name: 'Cost insights', value: Math.round(totals.prompts * 0.22) },
    { name: 'Reports', value: Math.round(totals.prompts * 0.18) },
  ], [totals.prompts])

  const teamData = useMemo(() => TEAMS.map(name => ({
    name,
    prompts: orgUsers.filter(item => item.team === name).reduce((sum, item) => sum + item.prompts, 0),
  })).filter(item => item.prompts > 0), [orgUsers])

  const refreshAnalytics = () => {
    setError('')
    setLoading(true)
    window.setTimeout(() => setLoading(false), 700)
  }

  const showUserView = viewMode === 'user'
  const visibleTitle = showUserView && selectedUser ? selectedUser.name : orgName

  return (
    <div className="space-y-6">
      <div className="page-header">
        <div>
          <h2 className="page-title">AI Analytics</h2>
          <p className="breadcrumb">Organization / AI Analytics / {visibleTitle}</p>
        </div>
        <div className="flex items-center gap-2">
          <span className="badge badge-info flex items-center gap-1"><Bot size={11} /> AI Powered</span>
          <button className="btn-secondary px-3" onClick={refreshAnalytics} title="Reload analytics">
            <RefreshCw size={15} className={loading ? 'animate-spin' : ''} />
          </button>
        </div>
      </div>

      {error && (
        <div className="card p-4 border-danger-600/30 bg-danger-100/20 flex items-center justify-between gap-4">
          <div className="flex items-center gap-2 text-sm text-danger-700">
            <AlertCircle size={16} />
            {error}
          </div>
          <button className="btn-danger py-1.5" onClick={() => setError('')}>Dismiss</button>
        </div>
      )}

      <div className="card p-4">
        <div className="flex flex-col xl:flex-row xl:items-end gap-4">
          <div className="grid grid-cols-2 bg-surface-100 dark:bg-surface-950 border border-surface-200 dark:border-surface-800 rounded-lg p-1 w-full sm:w-auto">
            <button
              className={`px-4 py-2 rounded-md text-sm font-semibold transition-colors ${!showUserView ? 'bg-white dark:bg-surface-900 text-primary-600 shadow-card' : 'text-surface-500'}`}
              onClick={() => setViewMode('org')}
            >
              Organization
            </button>
            <button
              className={`px-4 py-2 rounded-md text-sm font-semibold transition-colors ${showUserView ? 'bg-white dark:bg-surface-900 text-primary-600 shadow-card' : 'text-surface-500'}`}
              onClick={() => setViewMode('user')}
            >
              User Detail
            </button>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3 flex-1">
            <div>
              <label className="label">Date Range</label>
              <select className="select" value={range} onChange={event => setRange(event.target.value)}>
                {Object.entries(RANGES).map(([value, item]) => <option key={value} value={value}>{item.label}</option>)}
              </select>
            </div>
            <div>
              <label className="label">User</label>
              <select
                className="select"
                value={selectedUserId}
                onChange={event => {
                  setSelectedUserId(event.target.value)
                  if (event.target.value !== 'all') setViewMode('user')
                }}
              >
                <option value="all">All users</option>
                {orgUsers.map(item => <option key={item.id} value={item.id}>{item.name}</option>)}
              </select>
            </div>
            <div>
              <label className="label">Team</label>
              <select className="select" value={team} onChange={event => setTeam(event.target.value)}>
                <option value="all">All teams</option>
                {TEAMS.map(item => <option key={item} value={item}>{item}</option>)}
              </select>
            </div>
            <div>
              <label className="label">Department</label>
              <select className="select" value={department} onChange={event => setDepartment(event.target.value)}>
                <option value="all">All departments</option>
                {DEPARTMENTS.map(item => <option key={item} value={item}>{item}</option>)}
              </select>
            </div>
            <div>
              <label className="label">Search</label>
              <div className="relative">
                <Search size={14} className="absolute left-3 top-2.5 text-surface-400" />
                <input className="input pl-9" value={query} onChange={event => setQuery(event.target.value)} placeholder="Name or email" />
              </div>
            </div>
          </div>
        </div>
      </div>

      {loading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
          {Array.from({ length: 4 }).map((_, index) => (
            <div key={index} className="card p-5 animate-pulse">
              <div className="h-3 bg-surface-200 dark:bg-surface-800 rounded w-24" />
              <div className="h-8 bg-surface-200 dark:bg-surface-800 rounded w-32 mt-4" />
              <div className="h-3 bg-surface-200 dark:bg-surface-800 rounded w-20 mt-4" />
            </div>
          ))}
        </div>
      ) : (
        <>
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
            <StatCard label="AI Prompts" value={formatNumber(totals.prompts)} change="+12.4% vs previous period" icon={BrainCircuit} tooltip="Total assistant prompts generated by the current filters." />
            <StatCard label="Insights Generated" value={formatNumber(totals.insights)} change="+8.1% insight velocity" icon={Sparkles} tone="info" tooltip="Forecasts, anomaly explanations, and optimization recommendations." />
            <StatCard label="Automations" value={formatNumber(totals.automations)} change="+6.8% workflow activity" icon={Activity} tone="success" tooltip="Scheduled analysis and AI-assisted report runs." />
            <StatCard label="Avg Response" value={`${totals.avgResponse}s`} change={`${totals.satisfaction}% satisfaction`} icon={Gauge} tone="danger" tooltip="Average AI response time across selected analytics." />
          </div>

          {orgUsers.length === 0 ? (
            <div className="card p-10 text-center">
              <Users size={30} className="mx-auto text-surface-300 mb-3" />
              <p className="text-sm font-semibold text-surface-700">No users available for {orgName}</p>
              <p className="text-xs text-surface-400 mt-1">Add organization users to populate AI analytics.</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
              <div className="xl:col-span-2 card p-5">
                <div className="flex items-center justify-between gap-3 mb-4">
                  <div>
                    <p className="text-sm font-semibold text-surface-800">Usage Trend</p>
                    <p className="text-xs text-surface-400 mt-1">Prompts, insights, automations, and anomalies over {RANGES[range].label.toLowerCase()}</p>
                  </div>
                  <span className="badge badge-neutral flex items-center gap-1"><CalendarDays size={11} /> {RANGES[range].label}</span>
                </div>
                <div className="h-72">
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={trendData}>
                      <defs>
                        <linearGradient id="aiPrompts" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="#F5A623" stopOpacity={0.3} />
                          <stop offset="95%" stopColor="#F5A623" stopOpacity={0.02} />
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" stroke="#E5E7EB" />
                      <XAxis dataKey="day" tick={{ fontSize: 11 }} stroke="#9CA3AF" />
                      <YAxis tick={{ fontSize: 11 }} stroke="#9CA3AF" />
                      <Tooltip content={<ChartTooltip />} />
                      <Area type="monotone" dataKey="prompts" name="Prompts" stroke="#F5A623" fill="url(#aiPrompts)" strokeWidth={2} />
                      <Area type="monotone" dataKey="insights" name="Insights" stroke="#0EA5E9" fill="#0EA5E922" strokeWidth={2} />
                      <Area type="monotone" dataKey="automations" name="Automations" stroke="#22C55E" fill="#22C55E18" strokeWidth={2} />
                    </AreaChart>
                  </ResponsiveContainer>
                </div>
              </div>

              <div className="card p-5">
                <div className="mb-4">
                  <p className="text-sm font-semibold text-surface-800">AI Workload Mix</p>
                  <p className="text-xs text-surface-400 mt-1">Share of assistant activity by use case</p>
                </div>
                <div className="h-60">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie data={categoryData} dataKey="value" nameKey="name" innerRadius={54} outerRadius={86} paddingAngle={3}>
                        {categoryData.map((entry, index) => <Cell key={entry.name} fill={COLORS[index % COLORS.length]} />)}
                      </Pie>
                      <Tooltip content={<ChartTooltip />} />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  {categoryData.map((item, index) => (
                    <div key={item.name} className="flex items-center gap-2 text-xs text-surface-500">
                      <span className="w-2 h-2 rounded-full" style={{ background: COLORS[index % COLORS.length] }} />
                      {item.name}
                    </div>
                  ))}
                </div>
              </div>

              <div className="card p-5">
                <div className="mb-4">
                  <p className="text-sm font-semibold text-surface-800">Team Comparison</p>
                  <p className="text-xs text-surface-400 mt-1">AI prompt activity by team</p>
                </div>
                <div className="h-64">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={teamData}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#E5E7EB" />
                      <XAxis dataKey="name" tick={{ fontSize: 11 }} stroke="#9CA3AF" />
                      <YAxis tick={{ fontSize: 11 }} stroke="#9CA3AF" />
                      <Tooltip content={<ChartTooltip />} />
                      <Bar dataKey="prompts" name="Prompts" fill="#F5A623" radius={[6, 6, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </div>

              <div className="xl:col-span-2 card overflow-hidden">
                <div className="p-5 border-b border-surface-100 dark:border-surface-800 flex items-center justify-between gap-3">
                  <div>
                    <p className="text-sm font-semibold text-surface-800">{showUserView ? 'Selected User Analytics' : 'User Performance'}</p>
                    <p className="text-xs text-surface-400 mt-1">Switch to any user for detailed AI analytics</p>
                  </div>
                  <span className="badge badge-neutral">{totals.activeUsers} users</span>
                </div>
                {filteredUsers.length === 0 ? (
                  <div className="p-10 text-center">
                    <Search size={28} className="mx-auto text-surface-300 mb-3" />
                    <p className="text-sm font-semibold text-surface-700">No analytics match these filters</p>
                    <p className="text-xs text-surface-400 mt-1">Try a different user, team, department, or search term.</p>
                  </div>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="data-table">
                      <thead>
                        <tr>
                          <th>User</th>
                          <th>Team</th>
                          <th>Prompts</th>
                          <th>Insights</th>
                          <th>Avg Response</th>
                          <th>Action</th>
                        </tr>
                      </thead>
                      <tbody>
                        {filteredUsers.map(item => (
                          <tr key={item.id}>
                            <td>
                              <div className="flex items-center gap-2">
                                <div className="w-8 h-8 rounded-full bg-primary-500/10 text-primary-600 flex items-center justify-center">
                                  <User size={14} />
                                </div>
                                <div>
                                  <p className="font-semibold text-surface-800">{item.name}</p>
                                  <p className="text-xs text-surface-400">{item.email}</p>
                                </div>
                              </div>
                            </td>
                            <td>
                              <p className="text-sm text-surface-700">{item.team}</p>
                              <p className="text-xs text-surface-400">{item.department}</p>
                            </td>
                            <td>{formatNumber(item.prompts)}</td>
                            <td>{formatNumber(item.insights)}</td>
                            <td>{item.avgResponse}s</td>
                            <td>
                              <button
                                className="btn-secondary py-1.5 px-3"
                                onClick={() => {
                                  setSelectedUserId(String(item.id))
                                  setViewMode('user')
                                }}
                              >
                                View
                              </button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>

              <div className="card p-5">
                <p className="text-sm font-semibold text-surface-800 mb-4">Operational Signals</p>
                <div className="space-y-3">
                  {[
                    ['Devices monitored', orgDevices.length, Zap, 'badge-info'],
                    ['AI active users', totals.activeUsers, Users, 'badge-success'],
                    ['Avg active hours', `${Math.round((filteredUsers.reduce((sum, item) => sum + item.activeHours, 0) || orgUsers.reduce((sum, item) => sum + item.activeHours, 0)) / Math.max(1, filteredUsers.length || orgUsers.length))}h`, Clock3, 'badge-warning'],
                  ].map(([label, value, Icon, badge]) => (
                    <div key={label} className="flex items-center justify-between p-3 rounded-lg bg-surface-50 dark:bg-surface-950 border border-surface-100 dark:border-surface-800">
                      <div className="flex items-center gap-2 text-sm text-surface-700">
                        <Icon size={15} className="text-primary-600" />
                        {label}
                      </div>
                      <span className={`badge ${badge}`}>{value}</span>
                    </div>
                  ))}
                </div>
                <button className="btn-ghost w-full justify-center mt-4" onClick={() => setError('Unable to reach live analytics API. Showing cached dummy analytics instead.')}>
                  Test error state
                </button>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  )
}
