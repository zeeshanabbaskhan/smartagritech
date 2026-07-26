import { useState, useEffect, useRef } from 'react'
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend, AreaChart, Area, BarChart, Bar, Cell, PieChart, Pie, RadialBarChart, RadialBar } from 'recharts'
import {
  Layers, LayoutGrid, Plus, Trash2, Copy, Settings, Sliders, Calendar, ArrowUpRight,
  GripVertical, Eye, EyeOff, RotateCcw, Lock, Download, Upload, HelpCircle, X, Check,
  Save, Pencil, Trash, Play, AlertCircle, Database, ChevronRight, TrendingUp, Cpu, Bell
} from 'lucide-react'
import { Skeleton } from 'boneyard-js/react'
import { useAuth } from '../../context/AuthContext'

// Pre-seeded default metrics
const DEFAULT_METRICS = [
  { id: 'energy_consumption', label: 'Energy Consumption', unit: 'kW', base: 415.48, color: '#F5A623', formula: 'default' },
  { id: 'live_voltage', label: 'Live Voltage', unit: 'V', base: 230.15, color: '#2563EB', formula: 'default' },
  { id: 'power_factor', label: 'Power Factor', unit: '', base: 0.92, color: '#16A34A', formula: 'default' },
  { id: 'active_alarms', label: 'Active Alarms', unit: 'Alarms', base: 2, color: '#DC2626', formula: 'default' },
  { id: 'online_devices', label: 'Online Devices', unit: 'Devices', base: 45, color: '#8B5CF6', formula: 'default' },
  { id: 'carbon_emissions', label: 'Carbon Emissions', unit: 'kg CO₂', base: 148.6, color: '#06B6D4', formula: 'default' }
]

// Pre-seeded starter widgets
const STARTER_WIDGETS = {
  energy: [
    { id: 'w-1', label: 'Total Energy Consumption', type: 'stat', w: 3, h: 140, metric: 'energy_consumption', color: '#F5A623', description: 'Real-time active load power consumption' },
    { id: 'w-2', label: 'Solar Generation Stat', type: 'stat', w: 3, h: 140, metric: 'online_devices', color: '#16A34A', description: 'Online solar inverter nodes count' },
    { id: 'w-3', label: 'Active Critical Alarms', type: 'stat', w: 3, h: 140, metric: 'active_alarms', color: '#DC2626', description: 'Unacknowledged system event alarms' },
    { id: 'w-4', label: 'Power Factor Efficiency', type: 'stat', w: 3, h: 140, metric: 'power_factor', color: '#2563EB', description: 'Current power factor coefficient' },
    { id: 'w-5', label: 'Active Energy Load Trend', type: 'area', w: 8, h: 320, metric: 'energy_consumption', color: '#F5A623', description: 'Logged power levels in kW over 24 hours' },
    { id: 'w-6', label: 'Load Contribution Breakdown', type: 'pie', w: 4, h: 320, metric: 'carbon_emissions', color: '#8B5CF6', description: 'Percentage contribution of system loads' },
    { id: 'w-7', label: 'Telemetry Alarm Log', type: 'table', w: 12, h: 260, metric: 'active_alarms', color: '#DC2626', description: 'Recent gateway and device fault notifications' }
  ],
  building: [
    { id: 'w-b1', label: 'HQ Tower Consumption', type: 'line', w: 6, h: 280, metric: 'energy_consumption', color: '#2563EB', description: 'HQ building power logging trend' },
    { id: 'w-b2', label: 'Plant Generation', type: 'area', w: 6, h: 280, metric: 'online_devices', color: '#16A34A', description: 'Manufacturing plant active solar index' },
    { id: 'w-b3', label: 'Facility Load Comparison', type: 'bar', w: 12, h: 320, metric: 'energy_consumption', color: '#F5A623', description: 'Discrete load metrics side-by-side' }
  ],
  health: [
    { id: 'w-h1', label: 'Gateway Alarm Count', type: 'stat', w: 4, h: 140, metric: 'active_alarms', color: '#DC2626', description: 'Total system alarms' },
    { id: 'w-h2', label: 'Connected Smart Meters', type: 'stat', w: 4, h: 140, metric: 'online_devices', color: '#16A34A', description: 'Gateway connection status' },
    { id: 'w-h3', label: 'Power Factor Alert Index', type: 'gauge', w: 4, h: 140, metric: 'power_factor', color: '#8B5CF6', description: 'Load factor status' },
    { id: 'w-h4', label: 'Active System Faults Log', type: 'table', w: 12, h: 300, metric: 'active_alarms', color: '#DC2626', description: 'Gateway and terminal system logs' }
  ]
}

export default function UserCustomDashboard() {
  const { user } = useAuth()
  const [isLoading, setIsLoading] = useState(true)
  const [dashboards, setDashboards] = useState([])
  const [activeDashboardId, setActiveDashboardId] = useState(null)
  const [isEditing, setIsEditing] = useState(false)
  const [draggedIndex, setDraggedIndex] = useState(null)
  
  // Custom virtual database columns/metrics
  const [customMetrics, setCustomMetrics] = useState([])

  // Dashboard variables
  const [selectedLocation, setSelectedLocation] = useState('Delicia Warehouse')
  const [timeRange, setTimeRange] = useState('Last 24 Hours')
  const [refreshRate, setRefreshRate] = useState('Off')
  const [isRefreshing, setIsRefreshing] = useState(false)
  const [metricMultiplier, setMetricMultiplier] = useState(1.0)

  // Modals state
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false)
  const [newDashName, setNewDashName] = useState('')
  const [selectedTemplate, setSelectedTemplate] = useState('blank') // 'blank' | 'energy' | 'building' | 'health'

  // Add Widget Modal
  const [isWidgetModalOpen, setIsWidgetModalOpen] = useState(false)
  const [selectedWidgetForConfig, setSelectedWidgetForConfig] = useState(null) // for editing existing widget
  const [widgetTitle, setWidgetTitle] = useState('')
  const [widgetType, setWidgetType] = useState('line') // line | area | bar | pie | gauge | stat | table
  const [widgetMetric, setWidgetMetric] = useState('energy_consumption')
  const [widgetColor, setWidgetColor] = useState('#F5A623')
  const [widgetDesc, setWidgetDesc] = useState('')

  // New Column Creation panel inside widget modal
  const [showAddColumn, setShowAddColumn] = useState(false)
  const [newColId, setNewColId] = useState('')
  const [newColLabel, setNewColLabel] = useState('')
  const [newColUnit, setNewColUnit] = useState('')
  const [newColBase, setNewColBase] = useState('')
  const [newColFormula, setNewColFormula] = useState('power * 1.0')

  // Retrieve data from LocalStorage
  useEffect(() => {
    const userEmail = user?.email || 'user'
    const savedDashboards = localStorage.getItem(`ems_custom_dashboards_${userEmail}`)
    const savedColumns = localStorage.getItem(`ems_custom_db_columns_${userEmail}`)
    
    if (savedDashboards) {
      try {
        const parsed = JSON.parse(savedDashboards)
        setDashboards(parsed)
        if (parsed.length > 0) {
          setActiveDashboardId(parsed[0].id)
        }
      } catch (e) {
        console.error(e)
      }
    }
    
    if (savedColumns) {
      try {
        setCustomMetrics(JSON.parse(savedColumns))
      } catch (e) {
        console.error(e)
      }
    }

    const timer = setTimeout(() => {
      setIsLoading(false)
    }, 800)
    return () => clearTimeout(timer)
  }, [user])

  // Save dashboards utility
  const saveDashboards = (newDashs) => {
    setDashboards(newDashs)
    const userEmail = user?.email || 'user'
    localStorage.setItem(`ems_custom_dashboards_${userEmail}`, JSON.stringify(newDashs))
  }

  // Save custom database columns utility
  const saveCustomColumns = (newCols) => {
    setCustomMetrics(newCols)
    const userEmail = user?.email || 'user'
    localStorage.setItem(`ems_custom_db_columns_${userEmail}`, JSON.stringify(newCols))
  }

  // Variables Bar refreshment
  useEffect(() => {
    if (refreshRate === 'Off') return
    const ms = refreshRate === '10s' ? 10000 : (refreshRate === '30s' ? 30000 : 60000)
    const interval = setInterval(() => {
      setIsRefreshing(true)
      setTimeout(() => {
        setIsRefreshing(false)
        setMetricMultiplier(m => m * (0.95 + Math.random() * 0.1))
      }, 300)
    }, ms)
    return () => clearInterval(interval)
  }, [refreshRate])

  // Get active dashboard object
  const activeDashboard = dashboards.find(d => d.id === activeDashboardId)

  // Combined list of metrics (predefined + custom database columns)
  const allMetrics = [...DEFAULT_METRICS, ...customMetrics]

  // Mock Telemetry Generator
  const generateTelemetryData = (metricId, location, time) => {
    const metric = allMetrics.find(m => m.id === metricId)
    if (!metric) return []
    
    // Seeded random based on metricId + location + time parameters
    const seedString = `${metricId}-${location}-${time}`
    let hash = 0
    for (let i = 0; i < seedString.length; i++) {
      hash = seedString.charCodeAt(i) + ((hash << 5) - hash)
    }
    const seedRandom = () => {
      const x = Math.sin(hash++) * 10000
      return x - Math.floor(x)
    }

    const count = 12
    const data = []
    const baseValue = metric.base * metricMultiplier
    
    for (let i = 0; i < count; i++) {
      const timeLabel = `${i * 2}:00`
      let val = baseValue
      
      // Calculate custom formula if it exists
      if (metric.formula && metric.formula !== 'default') {
        // Simple evaluator: parse multiplier or basic mathematical scaling
        const match = metric.formula.match(/[\d.]+/)
        const scalar = match ? parseFloat(match[0]) : 1.0
        val = baseValue * scalar
      }

      // Add variation
      const variance = 0.85 + seedRandom() * 0.3
      data.push({
        time: timeLabel,
        value: parseFloat((val * variance).toFixed(2))
      })
    }
    return data
  }

  // Handle New Dashboard Creation
  const handleCreateDashboard = () => {
    const name = newDashName.trim() || `Dashboard ${dashboards.length + 1}`
    let widgets = []
    
    if (selectedTemplate !== 'blank') {
      widgets = STARTER_WIDGETS[selectedTemplate] || []
    }
    
    const newDash = {
      id: `dash-${Date.now()}`,
      name: name,
      template: selectedTemplate,
      widgets: widgets
    }
    
    const updated = [...dashboards, newDash]
    saveDashboards(updated)
    setActiveDashboardId(newDash.id)
    setIsCreateModalOpen(false)
    setNewDashName('')
    setSelectedTemplate('blank')
  }

  // Handle Delete Dashboard
  const handleDeleteDashboard = () => {
    if (!activeDashboardId) return
    if (!confirm('Are you sure you want to delete this custom dashboard?')) return
    const updated = dashboards.filter(d => d.id !== activeDashboardId)
    saveDashboards(updated)
    if (updated.length > 0) {
      setActiveDashboardId(updated[0].id)
    } else {
      setActiveDashboardId(null)
    }
  }

  // Handle Duplicate Dashboard
  const handleDuplicateDashboard = () => {
    if (!activeDashboard) return
    const copy = {
      ...activeDashboard,
      id: `dash-${Date.now()}`,
      name: `${activeDashboard.name} (Copy)`,
      widgets: activeDashboard.widgets.map(w => ({
        ...w,
        id: `w-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`
      }))
    }
    const updated = [...dashboards, copy]
    saveDashboards(updated)
    setActiveDashboardId(copy.id)
  }

  // Handle Drag and Drop reordering
  const handleDragStart = (e, index) => {
    if (!isEditing) return
    setDraggedIndex(index)
    e.dataTransfer.effectAllowed = 'move'
  }

  const handleDragOver = (e, index) => {
    if (draggedIndex === null || draggedIndex === index || !isEditing) return
    e.preventDefault()
    const newList = [...activeDashboard.widgets]
    const draggedItem = newList[draggedIndex]
    newList.splice(draggedIndex, 1)
    newList.splice(index, 0, draggedItem)
    
    const updated = dashboards.map(d => d.id === activeDashboardId ? { ...d, widgets: newList } : d)
    setDashboards(updated)
    setDraggedIndex(index)
  }

  const handleDragEnd = () => {
    setDraggedIndex(null)
    saveDashboards(dashboards)
  }

  // Freeform resizing via mouse drag
  const handleResizeStart = (e, widgetId, startW, startH) => {
    if (!isEditing) return
    e.preventDefault()
    e.stopPropagation()

    const startX = e.clientX
    const startY = e.clientY
    
    const onMouseMove = (moveEvent) => {
      const deltaX = moveEvent.clientX - startX
      const deltaY = moveEvent.clientY - startY
      
      // Screen grid dimensions: 1 column is roughly 1/12 of viewport container width
      const gridContainer = document.getElementById('custom-grid-container')
      const colWidth = gridContainer ? gridContainer.clientWidth / 12 : 80
      
      const colDelta = Math.round(deltaX / colWidth)
      // Height matches vertical pixel drag directly
      const newW = Math.max(1, Math.min(12, startW + colDelta))
      const newH = Math.max(100, Math.min(800, startH + deltaY))

      // Update state in real-time
      const updatedWidgets = activeDashboard.widgets.map(w => 
        w.id === widgetId ? { ...w, w: newW, h: newH } : w
      )
      const updatedDashboards = dashboards.map(d => 
        d.id === activeDashboardId ? { ...d, widgets: updatedWidgets } : d
      )
      setDashboards(updatedDashboards)
    }

    const onMouseUp = () => {
      document.removeEventListener('mousemove', onMouseMove)
      document.removeEventListener('mouseup', onMouseUp)
      saveDashboards(dashboards)
    }

    document.addEventListener('mousemove', onMouseMove)
    document.addEventListener('mouseup', onMouseUp)
  }

  // Add virtual database column/field dynamically from the frontend
  const handleCreateDatabaseColumn = () => {
    const colId = newColId.trim().toLowerCase().replace(/[^a-z0-9_]/g, '')
    const label = newColLabel.trim()
    const base = parseFloat(newColBase)
    
    if (!colId || !label || isNaN(base)) {
      alert('Please fill out all column definition fields with valid entries.')
      return
    }

    if (allMetrics.some(m => m.id === colId)) {
      alert('A database column with this identifier already exists.')
      return
    }

    const newCol = {
      id: colId,
      label: label,
      unit: newColUnit.trim() || 'Units',
      base: base,
      color: '#06B6D4',
      formula: newColFormula.trim()
    }

    const updated = [...customMetrics, newCol]
    saveCustomColumns(updated)
    setWidgetMetric(colId)
    setShowAddColumn(false)
    setNewColId('')
    setNewColLabel('')
    setNewColUnit('')
    setNewColBase('')
    setNewColFormula('power * 1.0')
  }

  // Open Modal to Add Widget
  const handleOpenAddWidget = () => {
    setSelectedWidgetForConfig(null)
    setWidgetTitle('New Telemetry Panel')
    setWidgetType('line')
    setWidgetMetric('energy_consumption')
    setWidgetColor('#F5A623')
    setWidgetDesc('')
    setIsWidgetModalOpen(true)
  }

  // Open Modal to Configure/Edit Widget
  const handleOpenConfigWidget = (widget) => {
    setSelectedWidgetForConfig(widget)
    setWidgetTitle(widget.label)
    setWidgetType(widget.type)
    setWidgetMetric(widget.metric)
    setWidgetColor(widget.color || '#F5A623')
    setWidgetDesc(widget.description || '')
    setIsWidgetModalOpen(true)
  }

  // Add / Save Widget handler
  const handleSaveWidget = () => {
    if (!widgetTitle.trim()) {
      alert('Please enter a widget title.')
      return
    }

    const newWidget = {
      id: selectedWidgetForConfig ? selectedWidgetForConfig.id : `w-${Date.now()}`,
      label: widgetTitle.trim(),
      type: widgetType,
      metric: widgetMetric,
      color: widgetColor,
      description: widgetDesc.trim(),
      w: selectedWidgetForConfig ? selectedWidgetForConfig.w : 4,
      h: selectedWidgetForConfig ? selectedWidgetForConfig.h : 240
    }

    let updatedWidgets = []
    if (selectedWidgetForConfig) {
      // Modify existing
      updatedWidgets = activeDashboard.widgets.map(w => 
        w.id === selectedWidgetForConfig.id ? newWidget : w
      )
    } else {
      // Create new
      updatedWidgets = [...activeDashboard.widgets, newWidget]
    }

    const updatedDashboards = dashboards.map(d => 
      d.id === activeDashboardId ? { ...d, widgets: updatedWidgets } : d
    )
    saveDashboards(updatedDashboards)
    setIsWidgetModalOpen(false)
    setSelectedWidgetForConfig(null)
  }

  // Delete widget panel
  const handleDeleteWidget = (widgetId) => {
    if (!confirm('Remove this panel from your dashboard?')) return
    const updatedWidgets = activeDashboard.widgets.filter(w => w.id !== widgetId)
    const updatedDashboards = dashboards.map(d => 
      d.id === activeDashboardId ? { ...d, widgets: updatedWidgets } : d
    )
    saveDashboards(updatedDashboards)
  }

  // Duplicate widget panel
  const handleDuplicateWidget = (widget) => {
    const copy = {
      ...widget,
      id: `w-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      label: `${widget.label} (Copy)`
    }
    const updatedWidgets = [...activeDashboard.widgets, copy]
    const updatedDashboards = dashboards.map(d => 
      d.id === activeDashboardId ? { ...d, widgets: updatedWidgets } : d
    )
    saveDashboards(updatedDashboards)
  }

  // JSON Config Manager: Export Layout
  const handleExportConfig = () => {
    if (!activeDashboard) return
    const blob = new Blob([JSON.stringify(activeDashboard, null, 2)], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `${activeDashboard.name.toLowerCase().replace(/\s+/g, '_')}_config.json`
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    URL.revokeObjectURL(url)
  }

  // JSON Config Manager: Import Layout
  const handleImportConfig = (e) => {
    const file = e.target.files?.[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = (event) => {
      try {
        const parsed = JSON.parse(event.target.result)
        if (parsed && typeof parsed === 'object' && parsed.widgets) {
          const importedDash = {
            ...parsed,
            id: `dash-${Date.now()}`,
            name: `${parsed.name} (Imported)`
          }
          const updated = [...dashboards, importedDash]
          saveDashboards(updated)
          setActiveDashboardId(importedDash.id)
          alert('Custom dashboard config imported successfully!')
        } else {
          alert('Invalid file format. Ensure the JSON represents a custom dashboard.')
        }
      } catch (err) {
        alert('Failed to parse JSON file.')
      }
    }
    reader.readAsText(file)
  }

  // Rendering chart wrapper logic
  const renderChart = (w) => {
    const telemetry = generateTelemetryData(w.metric, selectedLocation, timeRange)
    const metricInfo = allMetrics.find(m => m.id === w.metric)
    const unitLabel = metricInfo ? metricInfo.unit : ''
    
    if (w.type === 'stat') {
      const latestValue = telemetry.length > 0 ? telemetry[telemetry.length - 1].value : 0
      return (
        <div className="flex flex-col justify-center h-full pt-1">
          <div className="flex items-baseline gap-1 text-surface-900 dark:text-surface-50 font-black" style={{ fontSize: w.h > 150 ? '2.25rem' : '1.75rem' }}>
            {latestValue.toLocaleString()}
            {unitLabel && <span className="text-xs font-bold text-surface-400 ml-1">{unitLabel}</span>}
          </div>
          {w.description && <p className="text-[10.5px] text-surface-400 font-semibold leading-relaxed mt-1">{w.description}</p>}
        </div>
      )
    }

    if (w.type === 'table') {
      return (
        <div className="w-full h-full overflow-y-auto pr-1">
          <table className="w-full text-left text-xs font-semibold border-collapse">
            <thead>
              <tr className="border-b border-surface-200 dark:border-surface-800 text-[10px] text-surface-400 uppercase font-black">
                <th className="py-2">Time</th>
                <th className="py-2 text-right">Value ({unitLabel || 'Raw'})</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-surface-100 dark:divide-surface-850">
              {telemetry.slice(0, 6).map((pt, i) => (
                <tr key={i} className="hover:bg-surface-50 dark:hover:bg-surface-850">
                  <td className="py-2.5 font-bold text-surface-500">{pt.time}</td>
                  <td className="py-2.5 text-right font-mono font-black text-surface-800 dark:text-surface-100">{pt.value}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )
    }

    if (w.type === 'gauge') {
      const latest = telemetry.length > 0 ? telemetry[telemetry.length - 1].value : 0
      const baseMax = metricInfo ? metricInfo.base * 1.5 : 100
      
      const gaugeData = [
        { name: 'value', value: latest, fill: w.color || '#F5A623' }
      ]

      return (
        <div className="relative w-full h-full flex items-center justify-center">
          <ResponsiveContainer width="100%" height="100%">
            <RadialBarChart
              cx="50%"
              cy="50%"
              innerRadius="75%"
              outerRadius="100%"
              barSize={12}
              data={gaugeData}
              startAngle={180}
              endAngle={0}
            >
              <RadialBar
                minAngle={15}
                background={{ fill: 'rgba(156,163,175,0.15)' }}
                clockWise
                dataKey="value"
              />
            </RadialBarChart>
          </ResponsiveContainer>
          <div className="absolute inset-0 flex flex-col items-center justify-center pt-8">
            <span className="text-xl font-black text-surface-900 dark:text-surface-50 leading-none">{latest}</span>
            <span className="text-[9px] font-bold text-surface-400 mt-1 uppercase tracking-wider">{unitLabel || 'Metric'}</span>
          </div>
        </div>
      )
    }

    if (w.type === 'pie') {
      const latestValue = telemetry.length > 0 ? telemetry[telemetry.length - 1].value : 0
      const remainder = Math.max(0, (metricInfo ? metricInfo.base * 2.2 : 1000) - latestValue)
      const pieData = [
        { name: 'Primary Load', value: latestValue, fill: w.color || '#F5A623' },
        { name: 'Other Active Loads', value: remainder, fill: 'rgba(156, 163, 175, 0.15)' }
      ]

      return (
        <div className="w-full h-full">
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie
                data={pieData}
                dataKey="value"
                cx="50%"
                cy="50%"
                innerRadius={w.h > 240 ? 55 : 40}
                outerRadius={w.h > 240 ? 75 : 55}
                paddingAngle={3}
              />
              <Tooltip />
            </PieChart>
          </ResponsiveContainer>
        </div>
      )
    }

    return (
      <div className="w-full h-full">
        <ResponsiveContainer width="100%" height="100%">
          {w.type === 'area' ? (
            <AreaChart data={telemetry} margin={{ top: 5, right: 5, left: -22, bottom: 0 }}>
              <defs>
                <linearGradient id={`grad-${w.id}`} x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor={w.color || '#F5A623'} stopOpacity={0.4} />
                  <stop offset="95%" stopColor={w.color || '#F5A623'} stopOpacity={0.0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="rgba(156,163,175,0.08)" />
              <XAxis dataKey="time" tick={{ fontSize: 9, fontWeight: 700, fill: '#9AA09A' }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fontSize: 9, fontWeight: 700, fill: '#9AA09A' }} axisLine={false} tickLine={false} />
              <Tooltip
                contentStyle={{
                  backgroundColor: 'var(--panel)',
                  borderColor: 'var(--border)',
                  fontSize: 11,
                  borderRadius: 8,
                  boxShadow: 'var(--shadow-card)'
                }}
              />
              <Area type="monotone" dataKey="value" stroke={w.color || '#F5A623'} strokeWidth={2} fillOpacity={1} fill={`url(#grad-${w.id})`} />
            </AreaChart>
          ) : w.type === 'bar' ? (
            <BarChart data={telemetry} margin={{ top: 5, right: 5, left: -22, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="rgba(156,163,175,0.08)" />
              <XAxis dataKey="time" tick={{ fontSize: 9, fontWeight: 700, fill: '#9AA09A' }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fontSize: 9, fontWeight: 700, fill: '#9AA09A' }} axisLine={false} tickLine={false} />
              <Tooltip
                contentStyle={{
                  backgroundColor: 'var(--panel)',
                  borderColor: 'var(--border)',
                  fontSize: 11,
                  borderRadius: 8,
                  boxShadow: 'var(--shadow-card)'
                }}
              />
              <Bar dataKey="value" fill={w.color || '#F5A623'} radius={[4, 4, 0, 0]} />
            </BarChart>
          ) : (
            <LineChart data={telemetry} margin={{ top: 5, right: 5, left: -22, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="rgba(156,163,175,0.08)" />
              <XAxis dataKey="time" tick={{ fontSize: 9, fontWeight: 700, fill: '#9AA09A' }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fontSize: 9, fontWeight: 700, fill: '#9AA09A' }} axisLine={false} tickLine={false} />
              <Tooltip
                contentStyle={{
                  backgroundColor: 'var(--panel)',
                  borderColor: 'var(--border)',
                  fontSize: 11,
                  borderRadius: 8,
                  boxShadow: 'var(--shadow-card)'
                }}
              />
              <Line type="monotone" dataKey="value" stroke={w.color || '#F5A623'} strokeWidth={2.4} dot={false} activeDot={{ r: 4 }} />
            </LineChart>
          )}
        </ResponsiveContainer>
      </div>
    )
  }

  return (
    <Skeleton name="user-custom-dashboard" loading={isLoading} transition={300}>
      <div className="space-y-6">
        
        {/* Custom Dashboard Header Variables Bar */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white dark:bg-surface-900 p-4 border border-surface-200 dark:border-surface-800 rounded-xl shadow-sm">
          <div className="flex items-center gap-3">
            <LayoutGrid className="text-primary-500" size={20} />
            <div>
              {activeDashboard ? (
                <div className="flex items-center gap-2">
                  <h2 className="text-base font-black text-surface-900 dark:text-surface-50">{activeDashboard.name}</h2>
                  <span className="text-[10px] bg-primary-100 dark:bg-primary-950/40 text-primary-700 dark:text-primary-400 font-extrabold px-1.5 py-0.5 rounded">CUSTOM</span>
                </div>
              ) : (
                <h2 className="text-base font-black text-surface-900 dark:text-surface-50">Custom Dashboards Builder</h2>
              )}
              <div className="crumbs text-[10.5px] text-surface-400 font-semibold flex items-center gap-1.5 mt-0.5">
                <span>User Workspace</span>
                <ChevronRight size={11} />
                <span className="text-primary-600 dark:text-primary-400 font-bold">Grafana Editor Mode</span>
              </div>
            </div>
          </div>

          {/* Quick Dashboard Select Switcher */}
          <div className="flex items-center gap-2 flex-wrap">
            <select
              value={activeDashboardId || ''}
              onChange={(e) => setActiveDashboardId(e.target.value || null)}
              className="bg-surface-50 dark:bg-surface-850 border border-surface-200 dark:border-surface-700 rounded-lg px-2.5 py-1.5 text-xs font-bold text-surface-700 dark:text-surface-200 focus:outline-none focus:ring-1 focus:ring-primary-500 cursor-pointer"
            >
              {dashboards.length === 0 ? (
                <option value="">No dashboards yet</option>
              ) : (
                dashboards.map(d => (
                  <option key={d.id} value={d.id}>{d.name}</option>
                ))
              )}
            </select>
            <button
              type="button"
              onClick={() => setIsCreateModalOpen(true)}
              className="btn-primary py-1.5 px-3 text-xs font-bold flex items-center gap-1.5 rounded-lg"
            >
              <Plus size={14} /> New Dashboard
            </button>
          </div>
        </div>

        {/* Grafana-style top variables bar */}
        {activeDashboard && (
          <div className="flex items-center gap-4 bg-surface-50 dark:bg-surface-850 border border-surface-200 dark:border-surface-800 rounded-xl px-4 py-2.5 flex-wrap">
            <div className="flex items-center gap-1.5">
              <span className="text-[10px] font-bold text-surface-400 uppercase tracking-wider">Location:</span>
              <select
                value={selectedLocation}
                onChange={(e) => setSelectedLocation(e.target.value)}
                className="bg-white dark:bg-surface-800 border border-surface-200 dark:border-surface-700 rounded px-2 py-0.5 text-xs font-bold text-surface-700 dark:text-surface-300"
              >
                <option value="Delicia Warehouse">Delicia Warehouse</option>
                <option value="Lahore Depot">Lahore Depot</option>
                <option value="Islamabad Hub">Islamabad Hub</option>
              </select>
            </div>

            <div className="flex items-center gap-1.5">
              <span className="text-[10px] font-bold text-surface-400 uppercase tracking-wider">Time Range:</span>
              <select
                value={timeRange}
                onChange={(e) => setTimeRange(e.target.value)}
                className="bg-white dark:bg-surface-800 border border-surface-200 dark:border-surface-700 rounded px-2 py-0.5 text-xs font-bold text-surface-700 dark:text-surface-300"
              >
                <option value="Last 5 Minutes">Last 5 Minutes</option>
                <option value="Last 1 Hour">Last 1 Hour</option>
                <option value="Last 24 Hours">Last 24 Hours</option>
                <option value="Last 7 Days">Last 7 Days</option>
              </select>
            </div>

            <div className="flex items-center gap-1.5">
              <span className="text-[10px] font-bold text-surface-400 uppercase tracking-wider">Refresh:</span>
              <select
                value={refreshRate}
                onChange={(e) => setRefreshRate(e.target.value)}
                className="bg-white dark:bg-surface-800 border border-surface-200 dark:border-surface-700 rounded px-2 py-0.5 text-xs font-bold text-surface-700 dark:text-surface-300"
              >
                <option value="Off">Off</option>
                <option value="10s">10s</option>
                <option value="30s">30s</option>
                <option value="1m">1m</option>
              </select>
            </div>

            {/* Dashboard configuration options */}
            <div className="ml-auto flex items-center gap-2">
              <button
                type="button"
                onClick={handleDuplicateDashboard}
                className="p-1.5 rounded hover:bg-surface-100 dark:hover:bg-surface-800 text-surface-500 hover:text-surface-700 dark:hover:text-surface-300"
                title="Duplicate Dashboard"
              >
                <Copy size={14} />
              </button>
              <button
                type="button"
                onClick={handleExportConfig}
                className="p-1.5 rounded hover:bg-surface-100 dark:hover:bg-surface-800 text-surface-500 hover:text-surface-700 dark:hover:text-surface-300"
                title="Export JSON Config"
              >
                <Download size={14} />
              </button>
              <label className="p-1.5 rounded hover:bg-surface-100 dark:hover:bg-surface-800 text-surface-500 hover:text-surface-700 dark:hover:text-surface-300 cursor-pointer" title="Import JSON Config">
                <Upload size={14} />
                <input type="file" onChange={handleImportConfig} accept=".json" className="hidden" />
              </label>
              <button
                type="button"
                onClick={handleDeleteDashboard}
                className="p-1.5 rounded hover:bg-danger-100 dark:hover:bg-danger-950/20 text-danger-600 hover:text-danger-700"
                title="Delete Dashboard"
              >
                <Trash2 size={14} />
              </button>
              <div className="h-4 w-px bg-surface-200 dark:bg-surface-750 mx-1"></div>
              <button
                type="button"
                onClick={() => setIsEditing(!isEditing)}
                className={`flex items-center gap-1.5 px-3 py-1 text-xs font-black rounded-lg transition-colors border ${
                  isEditing
                    ? 'bg-primary-500 border-primary-500 text-[#1a1300] shadow'
                    : 'bg-white dark:bg-surface-800 border-surface-200 dark:border-surface-700 text-surface-700 dark:text-surface-300'
                }`}
              >
                <Settings size={13} className={isEditing ? 'animate-spin' : ''} />
                {isEditing ? 'Close Editing' : 'Edit Layout'}
              </button>
            </div>
          </div>
        )}

        {/* Edit Banner alert */}
        {isEditing && activeDashboard && (
          <div className="bg-primary-50 dark:bg-primary-950/20 border border-primary-200 dark:border-primary-900 rounded-lg p-3 text-xs text-primary-800 dark:text-primary-300 flex items-center justify-between gap-4">
            <div className="flex items-center gap-2">
              <span className="font-bold">Dashboard Editor:</span>
              <span>Drag cards by `⠿` handle to reorder. Drag the bottom-right handle `⤨` to stretch width/height. Click "+ Add Panel" to insert a new visual telemetry card.</span>
            </div>
            <button
              type="button"
              onClick={handleOpenAddWidget}
              className="btn-primary py-1 px-2.5 text-[10px] font-black rounded-md flex items-center gap-1"
            >
              <Plus size={11} /> Add Panel
            </button>
          </div>
        )}

        {/* Dashboard Grid Container */}
        {activeDashboard ? (
          activeDashboard.widgets.length === 0 ? (
            <div className="card p-12 text-center border-dashed border-surface-300 dark:border-surface-700 rounded-xl bg-white dark:bg-surface-900">
              <Sliders size={36} className="mx-auto text-surface-300 dark:text-surface-700 mb-3" />
              <h3 className="text-sm font-bold text-surface-800 dark:text-surface-200">This custom dashboard is empty</h3>
              <p className="text-xs text-surface-400 mt-1 max-w-sm mx-auto">Click the "Edit Layout" switch at the top, then press "+ Add Panel" to populate metrics from your database.</p>
              <button
                type="button"
                onClick={() => setIsEditing(true)}
                className="btn-primary mt-4 py-1.5 px-3 text-xs font-bold rounded-lg"
              >
                Activate Editor
              </button>
            </div>
          ) : (
            <div
              id="custom-grid-container"
              className="grid grid-cols-1 lg:grid-cols-12 gap-6"
            >
              {activeDashboard.widgets.map((w, idx) => {
                const colSpan = w.w === 12 ? 'lg:col-span-12' : w.w === 6 ? 'lg:col-span-6' : w.w === 4 ? 'lg:col-span-4' : w.w === 3 ? 'lg:col-span-3' : `lg:col-span-${w.w}`
                
                return (
                  <div
                    key={w.id}
                    className={`${colSpan} flex flex-col transition-shadow duration-150 relative ${
                      isEditing ? 'border border-dashed border-primary-300/60 dark:border-primary-700/60 p-1 bg-surface-50/10 dark:bg-surface-800/10 rounded-xl shadow-sm' : ''
                    }`}
                    style={{ height: w.h ? `${w.h}px` : '240px' }}
                    draggable={isEditing}
                    onDragStart={(e) => handleDragStart(e, idx)}
                    onDragOver={(e) => handleDragOver(e, idx)}
                    onDragEnd={handleDragEnd}
                  >
                    
                    {/* Header edit controls */}
                    {isEditing && (
                      <div className="flex items-center justify-between bg-primary-50 dark:bg-primary-950/20 px-2.5 py-1.5 rounded-t-lg border-b border-primary-100 dark:border-primary-900/50 text-[10px] font-bold text-surface-500">
                        <div className="flex items-center gap-1.5 cursor-grab active:cursor-grabbing">
                          <GripVertical size={12} />
                          <span className="text-surface-700 dark:text-surface-300 truncate max-w-[130px]">{w.label}</span>
                        </div>
                        <div className="flex items-center gap-1.5">
                          <button
                            type="button"
                            onClick={() => handleOpenConfigWidget(w)}
                            className="p-0.5 rounded hover:bg-primary-100 dark:hover:bg-primary-900/40 text-surface-600"
                            title="Configure Panel Settings"
                          >
                            <Settings size={12} />
                          </button>
                          <button
                            type="button"
                            onClick={() => handleDuplicateWidget(w)}
                            className="p-0.5 rounded hover:bg-primary-100 dark:hover:bg-primary-900/40 text-surface-600"
                            title="Duplicate Panel"
                          >
                            <Copy size={12} />
                          </button>
                          <button
                            type="button"
                            onClick={() => handleDeleteWidget(w.id)}
                            className="p-0.5 rounded hover:bg-danger-100 dark:hover:bg-danger-950/20 text-danger-600"
                            title="Delete Panel"
                          >
                            <Trash2 size={12} />
                          </button>
                        </div>
                      </div>
                    )}

                    {/* Dashboard Panel Card Body */}
                    <div className="card flex-1 p-4 bg-white dark:bg-surface-900 border border-surface-200 dark:border-surface-800 rounded-xl shadow-sm flex flex-col justify-between overflow-hidden">
                      <div className="mb-2">
                        <div className="flex items-center justify-between">
                          <h3 className="text-xs font-black text-surface-850 dark:text-surface-150 uppercase tracking-wider">{w.label}</h3>
                          <span
                            className="text-[9px] font-black uppercase px-1 py-0.5 rounded"
                            style={{ color: w.color || '#F5A623', backgroundColor: `${w.color}15` || 'rgba(245,166,35,0.1)' }}
                          >
                            {w.type}
                          </span>
                        </div>
                      </div>
                      
                      {/* Telemetry graphic body */}
                      <div className="flex-1 min-h-0">
                        {renderChart(w)}
                      </div>
                    </div>

                    {/* Resizing mouse corner handle */}
                    {isEditing && (
                      <div
                        className="absolute bottom-1.5 right-1.5 w-4 h-4 cursor-se-resize flex items-end justify-end text-surface-400 hover:text-primary-500 transition-colors z-20"
                        onMouseDown={(e) => handleResizeStart(e, w.id, w.w, w.h || 240)}
                        title="Drag to resize panel"
                      >
                        <svg width="8" height="8" viewBox="0 0 8 8" className="fill-current">
                          <path d="M6 0 L8 0 L8 8 L0 8 L0 6 L4 6 L4 4 L6 4 Z" />
                        </svg>
                      </div>
                    )}

                  </div>
                )
              })}
            </div>
          )
        ) : (
          /* Blank dashboards welcome screen */
          <div className="card p-12 text-center rounded-xl bg-white dark:bg-surface-900 shadow-md max-w-2xl mx-auto my-6 border border-surface-200 dark:border-surface-800">
            <Layers className="mx-auto text-primary-500 mb-4" size={48} />
            <h2 className="text-lg font-black text-surface-900 dark:text-surface-50">No custom dashboards yet</h2>
            <p className="text-xs text-surface-400 mt-2 leading-relaxed max-w-md mx-auto">
              Build a fully customizable, Grafana-style view of your energy data. Pick your widgets, define custom database metrics, and stretch layouts to align with your building configurations.
            </p>
            <div className="flex justify-center gap-3 mt-6">
              <button
                type="button"
                onClick={() => setIsCreateModalOpen(true)}
                className="btn-primary py-2 px-4 text-xs font-bold rounded-lg shadow-sm"
              >
                + Create Your First Dashboard
              </button>
            </div>
          </div>
        )}

      </div>

      {/* ── Modal 1: Create Custom Dashboard ── */}
      {isCreateModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-surface-950/40 backdrop-blur-sm">
          <div className="bg-white dark:bg-surface-900 border border-surface-200 dark:border-surface-800 rounded-xl shadow-2xl w-full max-w-lg overflow-hidden">
            <div className="flex items-center justify-between p-4 border-b border-surface-200 dark:border-surface-800 bg-surface-50 dark:bg-surface-950/20">
              <h3 className="text-sm font-bold text-surface-900 dark:text-surface-100">Create New Dashboard</h3>
              <button
                type="button"
                onClick={() => setIsCreateModalOpen(false)}
                className="p-1 rounded hover:bg-surface-100 dark:hover:bg-surface-800 text-surface-400"
              >
                <X size={16} />
              </button>
            </div>
            
            <div className="p-5 space-y-4">
              <div>
                <label className="block text-xs font-bold text-surface-500 mb-1.5 uppercase tracking-wider">Dashboard Name</label>
                <input
                  type="text"
                  placeholder="e.g. Building A — Facilities Overview"
                  value={newDashName}
                  onChange={(e) => setNewDashName(e.target.value)}
                  className="w-full bg-surface-50 dark:bg-surface-850 border border-surface-200 dark:border-surface-700 rounded-lg px-3 py-2 text-xs font-bold text-surface-800 dark:text-surface-100 focus:outline-none focus:ring-1 focus:ring-primary-500"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-surface-500 mb-2 uppercase tracking-wider">Start From a Template</label>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {[
                    { id: 'blank', label: 'Blank Dashboard', desc: 'Start from scratch and add your own widgets', widgets: '0 WIDGETS' },
                    { id: 'energy', label: 'Energy Overview', desc: 'Consumption trend, cost, power factor and live stats', widgets: '8 WIDGETS' },
                    { id: 'building', label: 'Building-wise Comparison', desc: 'Compare energy & cost across buildings and floors', widgets: '4 WIDGETS' },
                    { id: 'health', label: 'Alarms & System Health', desc: 'Monitor devices online, alarms and power quality', widgets: '5 WIDGETS' }
                  ].map(t => (
                    <button
                      key={t.id}
                      type="button"
                      onClick={() => setSelectedTemplate(t.id)}
                      className={`text-left p-3 rounded-lg border text-xs transition-colors flex flex-col justify-between h-28 ${
                        selectedTemplate === t.id
                          ? 'border-primary-500 bg-primary-50/10 dark:bg-primary-950/10'
                          : 'border-surface-200 dark:border-surface-800 hover:border-surface-400'
                      }`}
                    >
                      <div>
                        <div className="font-bold text-surface-800 dark:text-surface-200">{t.label}</div>
                        <p className="text-[10px] text-surface-400 mt-1 leading-snug">{t.desc}</p>
                      </div>
                      <span className="text-[9px] font-black text-primary-600 dark:text-primary-400 mt-2 block">{t.widgets}</span>
                    </button>
                  ))}
                </div>
              </div>
            </div>

            <div className="p-4 border-t border-surface-200 dark:border-surface-800 bg-surface-50 dark:bg-surface-950/20 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setIsCreateModalOpen(false)}
                className="btn-primary bg-transparent border-surface-200 dark:border-surface-700 text-surface-500 hover:text-surface-700"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleCreateDashboard}
                className="btn-primary py-2 px-4 text-xs font-bold rounded-lg shadow-sm"
              >
                Create Dashboard
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Modal 2: Add / Edit Widget Panel ── */}
      {isWidgetModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-surface-950/40 backdrop-blur-sm overflow-y-auto">
          <div className="bg-white dark:bg-surface-900 border border-surface-200 dark:border-surface-800 rounded-xl shadow-2xl w-full max-w-lg my-8">
            <div className="flex items-center justify-between p-4 border-b border-surface-200 dark:border-surface-800 bg-surface-50 dark:bg-surface-950/20">
              <h3 className="text-sm font-bold text-surface-900 dark:text-surface-100">
                {selectedWidgetForConfig ? 'Configure Widget Panel' : 'Add Widget Panel'}
              </h3>
              <button
                type="button"
                onClick={() => setIsWidgetModalOpen(false)}
                className="p-1 rounded hover:bg-surface-100 dark:hover:bg-surface-800 text-surface-400"
              >
                <X size={16} />
              </button>
            </div>

            <div className="p-5 space-y-4 max-h-[70vh] overflow-y-auto">
              
              {/* Title input */}
              <div>
                <label className="block text-xs font-bold text-surface-500 mb-1.5 uppercase tracking-wider">Widget Title</label>
                <input
                  type="text"
                  placeholder="e.g. Total Load Phase A"
                  value={widgetTitle}
                  onChange={(e) => setWidgetTitle(e.target.value)}
                  className="w-full bg-surface-50 dark:bg-surface-850 border border-surface-200 dark:border-surface-700 rounded-lg px-3 py-2 text-xs font-bold text-surface-800 dark:text-surface-100 focus:outline-none focus:ring-1 focus:ring-primary-500"
                />
              </div>

              {/* Visualization selection */}
              <div>
                <label className="block text-xs font-bold text-surface-500 mb-2 uppercase tracking-wider">Visualization Type</label>
                <div className="grid grid-cols-4 gap-2">
                  {[
                    { id: 'line', label: 'Line Chart' },
                    { id: 'area', label: 'Area Chart' },
                    { id: 'bar', label: 'Bar Chart' },
                    { id: 'pie', label: 'Pie/Donut' },
                    { id: 'gauge', label: 'Radial Gauge' },
                    { id: 'stat', label: 'Stat Card' },
                    { id: 'table', label: 'Data Table' }
                  ].map(viz => (
                    <button
                      key={viz.id}
                      type="button"
                      onClick={() => setWidgetType(viz.id)}
                      className={`py-2 px-1 text-center rounded-lg border text-[10px] font-bold transition-colors ${
                        widgetType === viz.id
                          ? 'border-primary-500 bg-primary-50/10 dark:bg-primary-950/10 text-primary-600 dark:text-primary-400'
                          : 'border-surface-200 dark:border-surface-800 text-surface-500 hover:border-surface-400'
                      }`}
                    >
                      {viz.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Data metric selection & custom column manipulation */}
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label className="block text-xs font-bold text-surface-500 uppercase tracking-wider">Telemetry Database Source</label>
                  <button
                    type="button"
                    onClick={() => setShowAddColumn(!showAddColumn)}
                    className="text-[10px] text-primary-600 hover:underline font-black flex items-center gap-1"
                  >
                    <Database size={10} /> {showAddColumn ? 'Hide Database Creator' : '+ Add Database Column'}
                  </button>
                </div>

                {!showAddColumn ? (
                  <select
                    value={widgetMetric}
                    onChange={(e) => setWidgetMetric(e.target.value)}
                    className="w-full bg-surface-50 dark:bg-surface-850 border border-surface-200 dark:border-surface-700 rounded-lg px-3 py-2 text-xs font-bold text-surface-800 dark:text-surface-100 focus:outline-none focus:ring-1 focus:ring-primary-500 cursor-pointer"
                  >
                    {allMetrics.map(m => (
                      <option key={m.id} value={m.id}>
                        {m.label} ({m.unit || 'Raw'}) {m.formula !== 'default' ? '[Virtual]' : ''}
                      </option>
                    ))}
                  </select>
                ) : (
                  /* Dynamic database column creator pane */
                  <div className="border border-surface-200 dark:border-surface-800 bg-surface-50 dark:bg-surface-950/20 p-4 rounded-lg space-y-3 mt-2">
                    <div className="flex items-center gap-1.5 text-primary-500 text-xs font-bold">
                      <Database size={13} />
                      <span>Dynamically Manipulate Database Schema</span>
                    </div>
                    
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="block text-[9px] font-extrabold text-surface-400">Column ID (Unique key)</label>
                        <input
                          type="text"
                          placeholder="e.g. solar_savings"
                          value={newColId}
                          onChange={(e) => setNewColId(e.target.value)}
                          className="w-full bg-white dark:bg-surface-850 border border-surface-200 dark:border-surface-700 rounded px-2 py-1 text-xs"
                        />
                      </div>
                      <div>
                        <label className="block text-[9px] font-extrabold text-surface-400">Column Label (Display)</label>
                        <input
                          type="text"
                          placeholder="e.g. Solar Savings"
                          value={newColLabel}
                          onChange={(e) => setNewColLabel(e.target.value)}
                          className="w-full bg-white dark:bg-surface-850 border border-surface-200 dark:border-surface-700 rounded px-2 py-1 text-xs"
                        />
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="block text-[9px] font-extrabold text-surface-400">Telemetry Unit prefix</label>
                        <input
                          type="text"
                          placeholder="e.g. kW, V, Alarms"
                          value={newColUnit}
                          onChange={(e) => setNewColUnit(e.target.value)}
                          className="w-full bg-white dark:bg-surface-850 border border-surface-200 dark:border-surface-700 rounded px-2 py-1 text-xs"
                        />
                      </div>
                      <div>
                        <label className="block text-[9px] font-extrabold text-surface-400">Initial Mock Base Value</label>
                        <input
                          type="number"
                          placeholder="e.g. 150"
                          value={newColBase}
                          onChange={(e) => setNewColBase(e.target.value)}
                          className="w-full bg-white dark:bg-surface-850 border border-surface-200 dark:border-surface-700 rounded px-2 py-1 text-xs"
                        />
                      </div>
                    </div>

                    <div>
                      <label className="block text-[9px] font-extrabold text-surface-400">Compute Formula Expression</label>
                      <input
                        type="text"
                        placeholder="e.g. power * 0.85"
                        value={newColFormula}
                        onChange={(e) => setNewColFormula(e.target.value)}
                        className="w-full bg-white dark:bg-surface-850 border border-surface-200 dark:border-surface-700 rounded px-2 py-1 text-xs font-mono"
                      />
                    </div>

                    <div className="flex justify-end gap-2 pt-1">
                      <button
                        type="button"
                        onClick={() => setShowAddColumn(false)}
                        className="px-2 py-1 text-[10px] text-surface-500 font-bold hover:underline"
                      >
                        Cancel
                      </button>
                      <button
                        type="button"
                        onClick={handleCreateDatabaseColumn}
                        className="btn-primary py-1 px-3 text-[10px] font-black rounded"
                      >
                        Apply Column to DB
                      </button>
                    </div>
                  </div>
                )}
              </div>

              {/* Color swatches */}
              <div>
                <label className="block text-xs font-bold text-surface-500 mb-2 uppercase tracking-wider">Color Theme Accent</label>
                <div className="flex items-center gap-2">
                  {['#F5A623', '#2563EB', '#16A34A', '#DC2626', '#1E293B'].map(c => (
                    <button
                      key={c}
                      type="button"
                      onClick={() => setWidgetColor(c)}
                      className={`w-6 h-6 rounded-full border-2 transition-transform ${
                        widgetColor === c ? 'border-primary-500 scale-110' : 'border-transparent'
                      }`}
                      style={{ backgroundColor: c }}
                    />
                  ))}
                </div>
              </div>

              {/* Description */}
              <div>
                <label className="block text-xs font-bold text-surface-500 mb-1.5 uppercase tracking-wider">Widget Description</label>
                <textarea
                  value={widgetDesc}
                  onChange={(e) => setWidgetDesc(e.target.value)}
                  placeholder="e.g. Power contribution factor inside ground production floor weaving units"
                  className="w-full bg-surface-50 dark:bg-surface-850 border border-surface-200 dark:border-surface-700 rounded-lg px-3 py-2 text-xs font-bold text-surface-800 dark:text-surface-100 h-16 focus:outline-none focus:ring-1 focus:ring-primary-500 resize-none"
                />
              </div>

            </div>

            <div className="p-4 border-t border-surface-200 dark:border-surface-800 bg-surface-50 dark:bg-surface-950/20 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setIsWidgetModalOpen(false)}
                className="btn-primary bg-transparent border-surface-200 dark:border-surface-700 text-surface-500 hover:text-surface-700"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleSaveWidget}
                className="btn-primary py-2 px-4 text-xs font-bold rounded-lg shadow-sm"
              >
                {selectedWidgetForConfig ? 'Save Changes' : 'Add to Dashboard'}
              </button>
            </div>
          </div>
        </div>
      )}

    </Skeleton>
  )
}
