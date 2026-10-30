import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import PageState, { useFetch } from '../../components/ui/PageState'
import { useToast } from '../../context/ToastContext'
import { useAuth } from '../../context/AuthContext'
import emsApi, { one, list } from '../../api/emsApi'
import { mapDevice } from '../../utils/mappers'
import { validateThresholdRule } from '../../utils/thresholdUtils'
import ExecutiveLimitsConfig from '../../components/controller/ExecutiveLimitsConfig'
import PowerFlowSourcesConfig from '../../components/controller/PowerFlowSourcesConfig'
import SitesConfig from '../../components/controller/SitesConfig'
import TariffsSavingsConfig from '../../components/controller/TariffsSavingsConfig'
import Modal from '../../components/ui/Modal'
import ErrorBoundary from '../../components/ui/ErrorBoundary'
import {
  SlidersHorizontal,
  Zap,
  Building2,
  DollarSign,
  Save,
  RotateCcw,
  AlertTriangle,
  ArrowLeft,
  CheckCircle2,
  Clock,
  Layers,
} from 'lucide-react'

export default function OrgControllerPage() {
  const { user } = useAuth()
  const { showToast } = useToast()

  const [activeTab, setActiveTab] = useState('executive-limits') // 'executive-limits' | 'sources' | 'sites' | 'tariffs'
  const [liveDevices, setLiveDevices] = useState([])
  const [conflictModalOpen, setConflictModalOpen] = useState(false)
  const [conflictMessage, setConflictMessage] = useState('')
  const [saving, setSaving] = useState(false)
  const [isDirty, setIsDirty] = useState(false)

  // Local editable state
  const [localLimits, setLocalLimits] = useState({})
  const [localSources, setLocalSources] = useState([])
  const [localSites, setLocalSites] = useState([])
  const [localSavings, setLocalSavings] = useState({})
  const [currentVersion, setCurrentVersion] = useState(1)
  const [lastUpdatedAt, setLastUpdatedAt] = useState(null)

  // 1. Fetch initial Power Flow configuration
  const { data: configData, loading, error, reload } = useFetch(async () => {
    const res = await emsApi.getPowerFlow()
    const payload = one(res) || {}
    return payload
  }, [])

  // Sync server data into local state when configData loads
  useEffect(() => {
    if (!configData) return
    setLocalLimits(configData.executiveLimits || {})
    setLocalSources(Array.isArray(configData.sources) ? configData.sources : [])
    setLocalSites(Array.isArray(configData.sites) ? configData.sites : [])
    setLocalSavings(configData.savings || {})
    setCurrentVersion(configData.version || 1)
    setLastUpdatedAt(configData.updatedAt || null)
    setIsDirty(false)
  }, [configData])

  // 2. Load devices with their slaves
  useEffect(() => {
    emsApi.getDevices({ limit: 100, withMetrics: true })
      .then((res) => setLiveDevices(list(res).map(mapDevice)))
      .catch(() => {})
  }, [])

  // Change handlers with dirty tracking
  const handleLimitsChange = (newLimits) => {
    setLocalLimits(newLimits)
    setIsDirty(true)
  }

  const handleSourcesChange = (newSources) => {
    setLocalSources(newSources)
    setIsDirty(true)
  }

  const handleSitesChange = (newSites, updatedSources) => {
    setLocalSites(newSites)
    if (updatedSources) setLocalSources(updatedSources)
    setIsDirty(true)
  }

  const handleSavingsChange = (newSavings) => {
    setLocalSavings(newSavings)
    setIsDirty(true)
  }

  // Validate all active threshold rules before dispatching save
  const validateAllRules = () => {
    if (localLimits?.thresholds) {
      for (const [key, conf] of Object.entries(localLimits.thresholds)) {
        const err = validateThresholdRule(key, conf)
        if (err) return err
      }
    }
    if (localLimits?.sourceThresholds) {
      for (const [sourceId, conf] of Object.entries(localLimits.sourceThresholds)) {
        const err = validateThresholdRule(`source-${sourceId}`, conf)
        if (err) return err
      }
    }
    if (localLimits?.totalThresholds) {
      for (const [totalId, conf] of Object.entries(localLimits.totalThresholds)) {
        const err = validateThresholdRule(`total-${totalId}`, conf)
        if (err) return err
      }
    }
    if (localLimits?.slaveThresholds) {
      for (const [slaveId, conf] of Object.entries(localLimits.slaveThresholds)) {
        const err = validateThresholdRule(`slave-${slaveId}`, conf)
        if (err) return err
      }
    }
    return null
  }

  // 3. Atomic optimistic concurrency save
  const handleSaveAll = async () => {
    const validationError = validateAllRules()
    if (validationError) {
      showToast(validationError, 'error')
      return
    }

    setSaving(true)
    try {
      // Sanitize slaveThresholds: strictly keep only slaves belonging to this organization's live devices
      const validSlaveIds = new Set(
        liveDevices.flatMap((d) => {
          const slvs = d.slaves || d.configSlaves || d._raw?.configSlaves || []
          return slvs.map((s) => s.id)
        })
      )

      const sanitizedLimits = { ...localLimits }
      if (localLimits?.slaveThresholds && validSlaveIds.size > 0) {
        const sanitizedSlaveThresholds = {}
        for (const [slaveId, conf] of Object.entries(localLimits.slaveThresholds)) {
          if (validSlaveIds.has(slaveId)) {
            sanitizedSlaveThresholds[slaveId] = conf
          }
        }
        sanitizedLimits.slaveThresholds = sanitizedSlaveThresholds
      }

      const res = await emsApi.updatePowerFlow({
        sources: localSources,
        sites: localSites,
        savings: localSavings,
        executiveLimits: sanitizedLimits,
        expectedVersion: currentVersion,
      })

      const updated = one(res) || {}
      showToast('Configuration saved successfully', 'success')
      setIsDirty(false)

      if (updated.version) setCurrentVersion(updated.version)
      if (updated.updatedAt) setLastUpdatedAt(updated.updatedAt)
      if (updated.sources) setLocalSources(updated.sources)
      if (updated.sites) setLocalSites(updated.sites)
      if (updated.executiveLimits) setLocalLimits(updated.executiveLimits)
      if (updated.savings) setLocalSavings(updated.savings)
    } catch (err) {
      // Catch HTTP 409 Conflict
      if (err.status === 409 || err.response?.status === 409 || /conflict/i.test(err.message)) {
        setConflictMessage(
          err.message || 'Another administrator updated this configuration. Please reload the latest state before saving.'
        )
        setConflictModalOpen(true)
      } else {
        showToast(err.message || 'Failed to save configuration', 'error')
      }
    } finally {
      setSaving(false)
    }
  }

  const handleConflictReload = async () => {
    setConflictModalOpen(false)
    await reload()
    showToast('Loaded latest configuration from server', 'info')
  }

  const formatRelativeTime = (isoDate) => {
    if (!isoDate) return 'Initial'
    const ts = new Date(isoDate).getTime()
    if (!Number.isFinite(ts)) return 'Recently'
    const diffMin = Math.floor((Date.now() - ts) / 60000)
    if (diffMin < 1) return 'Just now'
    if (diffMin < 60) return `${diffMin}m ago`
    const diffHours = Math.floor(diffMin / 60)
    if (diffHours < 24) return `${diffHours}h ago`
    return new Date(isoDate).toLocaleDateString()
  }

  const TABS = [
    { id: 'executive-limits', label: 'Executive Limits', icon: SlidersHorizontal },
    { id: 'sources', label: 'Energy Sources', icon: Zap },
    { id: 'sites', label: 'Factory Sites', icon: Building2 },
    { id: 'tariffs', label: 'Tariffs & Baselines', icon: DollarSign },
  ]

  return (
    <PageState loading={loading} error={error} onRetry={reload}>
      <div className="space-y-6">
        {/* Top Header Bar */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-4 border-b border-surface-200 dark:border-surface-800">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <Link
                to="/org"
                className="text-xs text-surface-400 hover:text-primary-600 flex items-center gap-1 font-semibold transition-colors"
              >
                <ArrowLeft size={13} /> Return to Dashboard
              </Link>
            </div>
            <h1 className="text-xl sm:text-2xl font-black text-surface-900 dark:text-surface-100 flex items-center gap-2">
              <SlidersHorizontal size={22} className="text-primary-600" />
              EMS Central Controller
            </h1>
            <p className="text-xs text-surface-500 dark:text-surface-400 mt-0.5">
              Single authoritative control hub for Executive Dashboard alarm thresholds, power sources, sites, and tariffs.
            </p>
          </div>

          <div className="flex items-center gap-3 flex-wrap">
            {/* Version & Status Badge */}
            <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-surface-100 dark:bg-surface-800/60 text-xs font-mono">
              <span className="text-surface-500 font-bold">Ver:</span>
              <span className="font-bold text-surface-800 dark:text-surface-200">v{currentVersion}</span>
              <span className="text-surface-300 dark:text-surface-700">|</span>
              <span className="text-surface-400 flex items-center gap-1">
                <Clock size={11} /> {formatRelativeTime(lastUpdatedAt)}
              </span>
            </div>

            {isDirty && (
              <span className="badge badge-warning text-[10px] py-1 px-2.5 font-bold animate-pulse">
                Unsaved Changes
              </span>
            )}

            <button
              type="button"
              disabled={!isDirty || saving}
              onClick={handleSaveAll}
              className="btn-primary py-2 px-4 text-xs font-bold flex items-center gap-2 shadow-sm"
            >
              <Save size={14} />
              {saving ? 'Saving...' : 'Save Configuration'}
            </button>
          </div>
        </div>

        {/* Tab Navigation */}
        <div className="flex items-center gap-1 border-b border-surface-200 dark:border-surface-800 overflow-x-auto pb-px">
          {TABS.map((tab) => {
            const Icon = tab.icon
            const isActive = activeTab === tab.id
            return (
              <button
                key={tab.id}
                type="button"
                onClick={() => setActiveTab(tab.id)}
                className={`flex items-center gap-2 px-4 py-2.5 text-xs font-bold border-b-2 transition-all whitespace-nowrap ${
                  isActive
                    ? 'border-primary-600 text-primary-600 dark:text-primary-400 bg-primary-50/30 dark:bg-primary-950/20 rounded-t-lg'
                    : 'border-transparent text-surface-500 hover:text-surface-800 dark:hover:text-surface-200 hover:bg-surface-50 dark:hover:bg-surface-800/40'
                }`}
              >
                <Icon size={15} />
                {tab.label}
              </button>
            )
          })}
        </div>

        {/* Active Tab View */}
        <div className="bg-surface-50/30 dark:bg-surface-950/20 p-1 sm:p-2 rounded-2xl">
          <ErrorBoundary title="Failed to render EMS Controller Tab">
            {activeTab === 'executive-limits' && (
              <ExecutiveLimitsConfig
                executiveLimits={localLimits}
                onChange={handleLimitsChange}
                devices={liveDevices}
                sources={localSources}
                sites={localSites}
              />
            )}

            {activeTab === 'sources' && (
              <PowerFlowSourcesConfig
                sources={localSources}
                sites={localSites}
                devices={liveDevices}
                onChange={handleSourcesChange}
              />
            )}

            {activeTab === 'sites' && (
              <SitesConfig
                sites={localSites}
                sources={localSources}
                onChange={handleSitesChange}
              />
            )}

            {activeTab === 'tariffs' && (
              <TariffsSavingsConfig
                savings={localSavings}
                onChange={handleSavingsChange}
              />
            )}
          </ErrorBoundary>
        </div>
      </div>

      {/* Atomic Concurrency Conflict Dialog */}
      <Modal
        open={conflictModalOpen}
        onClose={() => setConflictModalOpen(false)}
        size="sm"
        title="Configuration Conflict"
        footer={
          <>
            <button
              type="button"
              className="btn-secondary"
              onClick={() => setConflictModalOpen(false)}
            >
              Cancel
            </button>
            <button
              type="button"
              className="btn-primary flex items-center gap-1.5"
              onClick={handleConflictReload}
            >
              <RotateCcw size={14} /> Reload Latest
            </button>
          </>
        }
      >
        <div className="space-y-3">
          <div className="p-3 rounded-lg bg-amber-50 dark:bg-amber-950/40 border border-amber-300 dark:border-amber-800/80 text-amber-900 dark:text-amber-300 text-xs flex items-start gap-2.5">
            <AlertTriangle size={18} className="flex-shrink-0 mt-0.5 text-amber-600" />
            <div>
              <p className="font-bold">Concurrency Check Failed (HTTP 409)</p>
              <p className="mt-1">{conflictMessage}</p>
            </div>
          </div>
          <p className="text-xs text-surface-500">
            To prevent overwriting updates made by other operators, please reload the latest authoritative configuration from the database.
          </p>
        </div>
      </Modal>
    </PageState>
  )
}
