import { useState, useEffect, useRef, useMemo } from 'react'
import { Bell, ChevronDown, ChevronUp, ChevronLeft, ChevronRight, LogOut, User, Settings, Search, Sun, Moon, Menu, X, Undo2 } from 'lucide-react'
import { useAuth } from '../../context/AuthContext'
import { useTheme } from '../../context/ThemeContext'
import { useNavigate, useLocation } from 'react-router-dom'
import emsApi, { list } from '../../api/emsApi'
import { mapNotification } from '../../utils/mappers'
import { useToast } from '../../context/ToastContext'

const highlightMatch = (text, search) => {
  if (!search || !text) return text
  const parts = String(text).split(new RegExp(`(${search.replace(/[-\/\\^$*+?.()|[\]{}]/g, '\\$&')})`, 'gi'))
  return (
    <span>
      {parts.map((part, i) =>
        part.toLowerCase() === search.toLowerCase()
          ? <mark key={i} className="bg-amber-200 dark:bg-amber-900/40 text-amber-950 dark:text-amber-100 px-0.5 rounded">{part}</mark>
          : part
      )}
    </span>
  )
}

export default function Topbar({ title, onMenuClick }) {
  const { user, logout, impersonation, stopImpersonation } = useAuth()
  const { showToast } = useToast()
  const { theme, toggleTheme } = useTheme()
  const navigate = useNavigate()
  const location = useLocation()
  const [exitingImpersonation, setExitingImpersonation] = useState(false)
  const [dropOpen, setDropOpen] = useState(false)
  const [notifOpen, setNotifOpen] = useState(false)
  const [searchOpen, setSearchOpen] = useState(false)
  const [query, setQuery] = useState('')
  const [searchTab, setSearchTab] = useState('All')
  const [mobileSearchOpen, setMobileSearchOpen] = useState(false)
  const [catalog, setCatalog] = useState([])
  const [activeHighlightIndex, setActiveHighlightIndex] = useState(-1)
  const [highlightCount, setHighlightCount] = useState(0)

  const dropRef = useRef(null)
  const notifRef = useRef(null)
  const searchRef = useRef(null)
  const searchInputRef = useRef(null)
  
  const [notifications, setNotifications] = useState([])
  const [unreadCount, setUnreadCount] = useState(0)

  useEffect(() => {
    if (!user) return
    emsApi.getNotifications({ limit: 5 })
      .then((res) => {
        setNotifications(list(res).map(mapNotification))
        setUnreadCount(res?.unreadCount ?? list(res).filter((n) => !n.read).length)
      })
      .catch(() => { setNotifications([]); setUnreadCount(0) })
  }, [user?.id])

  // Build an entity search catalog from live APIs (orgs/users/devices/gateways)
  useEffect(() => {
    if (!user?.role) return
    let alive = true
    const role = user.role
    const base = role === 'admin' ? '/admin' : role === 'org' ? '/org' : '/user'
    const jobs = []
    if (role === 'admin') {
      jobs.push(
        emsApi.getOrganizations({ limit: 100 }).then((res) => list(res).map((o) => ({ title: `${o.name} (Org)`, path: `${base}/organizations`, category: 'Organizations' }))).catch(() => []),
        emsApi.getUsers({ limit: 100 }).then((res) => list(res).map((u) => ({ title: `${u.fullName ?? u.name ?? u.email} (User)`, path: `${base}/users`, category: 'Users' }))).catch(() => []),
      )
    }
    if (role === 'admin' || role === 'org') {
      jobs.push(
        emsApi.getDevices({ limit: 100 }).then((res) => list(res).map((d) => ({ title: `${d.name} (Device)`, path: `${base}/devices`, category: 'Devices' }))).catch(() => []),
      )
    }
    if (role === 'admin') {
      jobs.push(
        emsApi.getGateways({ limit: 100 }).then((res) => list(res).map((g) => ({ title: `${g.name} (Gateway)`, path: `${base}/gateways`, category: 'Gateways' }))).catch(() => []),
      )
    }
    Promise.all(jobs).then((parts) => { if (alive) setCatalog(parts.flat()) })
    return () => { alive = false }
  }, [user?.role])

  const unread = notifications.filter((n) => !n.read).slice(0, 5)
  const displayNotifs = unread.length ? unread : notifications.slice(0, 5)

  const handleSearchKeyDown = (e) => {
    if (e.key !== 'Enter') return
    e.preventDefault()
    setSearchOpen(false)
    setMobileSearchOpen(false)
    const params = new URLSearchParams(location.search)
    if (query.trim()) params.set('highlight', query.trim())
    else params.delete('highlight')
    const searchStr = params.toString()
    navigate({ pathname: location.pathname, search: searchStr ? `?${searchStr}` : '' }, { replace: true })
  }

  const handleLogout = async () => { await logout(); navigate('/login') }

  const handleExitImpersonation = async () => {
    setExitingImpersonation(true)
    try {
      await stopImpersonation()
      showToast('Returned to Super Admin', 'success')
      navigate('/admin')
    } catch (e) {
      showToast(e.message || 'Could not restore admin session', 'error')
      navigate('/login')
    } finally {
      setExitingImpersonation(false)
    }
  }

  const markAllRead = async () => {
    try {
      await emsApi.markAllNotificationsRead()
      setNotifications((prev) => prev.map((n) => ({ ...n, read: true })))
      setUnreadCount(0)
    } catch (_) {}
  }

  // Keyboard shortcut Ctrl+K / Cmd+K
  useEffect(() => {
    const handleKeyDown = (e) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'k') {
        e.preventDefault()
        searchInputRef.current?.focus()
        setSearchOpen(true)
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [])

  // Click outside listener
  useEffect(() => {
    function handleClickOutside(event) {
      if (dropRef.current && !dropRef.current.contains(event.target)) {
        setDropOpen(false)
      }
      if (notifRef.current && !notifRef.current.contains(event.target)) {
        setNotifOpen(false)
      }
      if (searchRef.current && !searchRef.current.contains(event.target)) {
        setSearchOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  // Close dropdowns on route changes & sync query from URL highlight param
  useEffect(() => {
    setDropOpen(false)
    setNotifOpen(false)
    setSearchOpen(false)
    setMobileSearchOpen(false)
    const params = new URLSearchParams(location.search)
    const hl = params.get('highlight')
    setQuery(hl || '')
    setSearchTab('All')
  }, [location.pathname, location.search])

  // Sync back to URL when query cleared
  useEffect(() => {
    if (query === '') {
      const params = new URLSearchParams(location.search)
      if (params.has('highlight')) {
        params.delete('highlight')
        const searchStr = params.toString()
        navigate({ pathname: location.pathname, search: searchStr ? `?${searchStr}` : '' }, { replace: true })
      }
    }
  }, [query, location.pathname, location.search, navigate])

  // Map breadcrumb based on URL
  const pathParts = location.pathname.split('/').filter(Boolean)
  const breadcrumbText = pathParts.join(' / ')

  // Role badge styles
  const roleBadges = {
    admin: <span className="badge badge-danger">ADMIN</span>,
    org:   <span className="badge badge-info">ORG</span>,
    user:  <span className="badge badge-success">USER</span>,
  }

  // Severity color dot mapping
  const severityColors = {
    danger:  'bg-danger-600',
    warning: 'bg-primary-500',
    info:    'bg-info-600',
  }

  const getSearchItems = () => {
    if (!user?.role) return []
    
    const pageItems = {
      admin: [
        { title: 'Dashboard Home', path: '/admin', category: 'Pages' },
        { title: 'Custom Dashboards', path: '/admin/custom-dashboard', category: 'Pages' },
        { title: 'Manage Organizations', path: '/admin/organizations', category: 'Pages' },
        { title: 'Manage Users', path: '/admin/users', category: 'Pages' },
        { title: 'Manage Gateways', path: '/admin/gateways', category: 'Pages' },
        { title: 'Manage Devices', path: '/admin/devices', category: 'Pages' },
        { title: 'Device Templates', path: '/admin/device-templates', category: 'Pages' },
        { title: 'Access Groups', path: '/admin/access-groups', category: 'Pages' },
        { title: 'Device Groups', path: '/admin/device-groups', category: 'Pages' },
        { title: 'Manage Icons', path: '/admin/icons', category: 'Pages' },
        { title: 'Manage Products', path: '/admin/products', category: 'Pages' },
        { title: 'Data Center', path: '/admin/data-center', category: 'Pages' },
        { title: 'Historical Data', path: '/admin/historical-data', category: 'Pages' },
        { title: 'Variable Alarm Records', path: '/admin/variable-alarms', category: 'Pages' },
        { title: 'Linkage Records', path: '/admin/linkage-records', category: 'Pages' },
        { title: 'Template Triggers', path: '/admin/template-triggers', category: 'Pages' },
        { title: 'Alarm Settings', path: '/admin/alarm-settings', category: 'Pages' },
        { title: 'Alarm Contacts', path: '/admin/alarm-contacts', category: 'Pages' },
        { title: 'Device Timestamps', path: '/admin/device-timestamps', category: 'Pages' },
        { title: 'Schedule Tasks', path: '/admin/schedule-tasks', category: 'Pages' },
        { title: 'Theme Settings', path: '/admin/theme-settings', category: 'Pages' },
        { title: 'Platform Settings', path: '/admin/settings', category: 'Pages' },
      ],
      org: [
        { title: 'Dashboard Home', path: '/org', category: 'Pages' },
        { title: 'Custom Dashboards', path: '/org/custom-dashboard', category: 'Pages' },
        { title: 'My Devices', path: '/org/devices', category: 'Pages' },
        { title: 'Access Groups', path: '/org/access-groups', category: 'Pages' },
        { title: 'Device Groups', path: '/org/device-groups', category: 'Pages' },
        { title: 'Voltage Imbalance', path: '/org/ai-analytics/voltage-imbalance', category: 'Pages' },
        { title: 'Current Imbalance', path: '/org/ai-analytics/current-imbalance', category: 'Pages' },
        { title: 'Power Factor', path: '/org/ai-analytics/power-factor', category: 'Pages' },
        { title: 'Energy Consumption', path: '/org/ai-analytics/energy-consumption', category: 'Pages' },
        { title: 'Anomalies', path: '/org/ai-analytics/anomalies', category: 'Pages' },
        { title: 'Historical Data', path: '/org/historical-data', category: 'Pages' },
        { title: 'Template Triggers', path: '/org/template-triggers', category: 'Pages' },
        { title: 'Alarm Settings', path: '/org/alarm-settings', category: 'Pages' },
        { title: 'Alarm Contacts', path: '/org/alarm-contacts', category: 'Pages' },
        { title: 'Schedule Tasks', path: '/org/schedule-tasks', category: 'Pages' },
        { title: 'Settings', path: '/org/settings', category: 'Pages' },
      ],
      user: [
        { title: 'My Dashboard', path: '/user', category: 'Pages' },
        { title: 'Dashboard Detail', path: '/user/detail', category: 'Pages' },
        { title: 'Custom Dashboards', path: '/user/custom-dashboard', category: 'Pages' },
        { title: 'Subscription Info', path: '/user/subscription', category: 'Pages' },
        { title: 'Products Catalogue', path: '/user/products', category: 'Pages' },
        { title: 'Task Schedule', path: '/user/schedule', category: 'Pages' },
        { title: 'Slab Rates & Tariff', path: '/user/slab-rates', category: 'Pages' },
        { title: 'Interval History', path: '/user/interval-history', category: 'Pages' },
        { title: 'Alarm Templates', path: '/user/alarm-template', category: 'Pages' },
        { title: 'Notifications Center', path: '/user/notifications', category: 'Pages' },
        { title: 'AI Analytics Insights', path: '/user/ai-analytics', category: 'Pages' },
        { title: 'Voltage Imbalance Diagnostic', path: '/user/voltage-imbalance', category: 'Pages' },
        { title: 'Current Imbalance Diagnostic', path: '/user/current-imbalance', category: 'Pages' },
        { title: 'Power Factor Analytics', path: '/user/power-factor', category: 'Pages' },
        { title: 'Energy Consumption Logs', path: '/user/energy-consumption', category: 'Pages' },
        { title: 'System Anomalies List', path: '/user/anomalies', category: 'Pages' },
      ]
    }

    const items = [...(pageItems[user.role] ?? [])]
    return items
  }

  const searchItems = useMemo(() => [...getSearchItems(), ...catalog], [user?.role, catalog])

  const SEARCH_TABS = useMemo(() => {
    const tabs = ['All', 'Pages']
    if (user?.role === 'admin') { tabs.push('Organizations', 'Users') }
    if (user?.role === 'admin' || user?.role === 'org') { tabs.push('Devices') }
    if (user?.role === 'admin') { tabs.push('Gateways') }
    return tabs
  }, [user?.role])

  const tabFiltered = searchTab === 'All' ? searchItems : searchItems.filter((i) => i.category === searchTab)
  const searchResults = query
    ? tabFiltered.filter(item =>
        item.title.toLowerCase().includes(query.toLowerCase()) ||
        item.category.toLowerCase().includes(query.toLowerCase())
      )
    : tabFiltered.slice(0, 6)

  const searchCategories = Array.from(new Set(searchResults.map(r => r.category)))

  const matchingPaths = useMemo(() => {
    if (!query.trim()) return []
    const paths = new Set()
    searchResults.forEach((r) => { if (r.path?.startsWith('/')) paths.add(r.path.split('?')[0]) })
    return Array.from(paths)
  }, [searchResults, query])

  const currentPathIndex = matchingPaths.indexOf(location.pathname)

  // Count highlight <mark> elements on route/search changes
  useEffect(() => {
    const timer = setTimeout(() => {
      const marks = document.querySelectorAll('mark')
      setHighlightCount(marks.length)
      setActiveHighlightIndex(marks.length > 0 ? 0 : -1)
    }, 400)
    return () => clearTimeout(timer)
  }, [location.pathname, location.search, query])

  const navigateHighlight = (direction) => {
    const marks = document.querySelectorAll('mark')
    if (marks.length === 0) return
    const nextIndex = direction === 'next'
      ? (activeHighlightIndex + 1) % marks.length
      : (activeHighlightIndex - 1 + marks.length) % marks.length
    setActiveHighlightIndex(nextIndex)
    marks.forEach((mark, i) => {
      if (i === nextIndex) {
        mark.classList.add('active-highlight')
        mark.scrollIntoView({ behavior: 'smooth', block: 'center' })
      } else {
        mark.classList.remove('active-highlight')
      }
    })
  }

  const placeholderText = searchTab === 'All' ? 'Search anything...' : `Search in ${searchTab}...`

  return (
    <>
    <div className="sticky top-0 z-40">
    {impersonation?.active && (
      <div className="bg-amber-500 text-amber-950 px-3 sm:px-6 py-2 flex flex-wrap items-center justify-between gap-2 text-xs font-semibold">
        <span>
          Viewing as <strong>{user?.organization?.name || user?.name}</strong>
          {user?.organization?.name && user?.name ? ` (${user.name})` : user?.email ? ` (${user.email})` : ''}
          {impersonation.adminName ? ` — signed in from ${impersonation.adminName}` : ''}
        </span>
        <button
          type="button"
          className="inline-flex items-center gap-1.5 bg-amber-950/15 hover:bg-amber-950/25 px-2.5 py-1 rounded-md font-bold"
          onClick={handleExitImpersonation}
          disabled={exitingImpersonation}
        >
          <Undo2 size={13} />
          {exitingImpersonation ? 'Returning…' : 'Return to Super Admin'}
        </button>
      </div>
    )}
    <header className="h-14 bg-white dark:bg-surface-900 border-b border-surface-200 dark:border-surface-800 flex items-center justify-between px-3 sm:px-6 shadow-sm select-none transition-colors duration-200">
      {/* Left: Hamburger (mobile) + Title & Breadcrumbs */}
      <div className="min-w-0 flex items-center gap-2 sm:gap-3">
        {/* Hamburger — mobile only */}
        <button
          type="button"
          onClick={onMenuClick}
          className="md:hidden p-2 -ml-1 text-surface-500 hover:text-surface-900 dark:hover:text-surface-100 rounded-lg hover:bg-surface-100 dark:hover:bg-surface-800 transition-colors"
        >
          <Menu size={20} />
        </button>
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <h1 className="text-sm font-bold text-surface-900 dark:text-surface-100 tracking-tight leading-none truncate max-w-[120px] sm:max-w-none">{title}</h1>
            <span className="hidden sm:inline">{user?.role && roleBadges[user.role]}</span>
          </div>
          <p className="breadcrumb text-[10px] text-surface-400 mt-0.5 tracking-wider uppercase font-semibold hidden sm:block">
            {breadcrumbText || 'EMS'}
          </p>
        </div>
      </div>

      {/* Toolbar actions */}
      <div className="flex items-center gap-1 sm:gap-4">
        {/* Mobile search toggle */}
        <button
          type="button"
          className="md:hidden btn-ghost p-2 text-surface-500 hover:text-surface-900 dark:hover:text-surface-100 rounded-full"
          onClick={() => { setMobileSearchOpen(o => !o); setDropOpen(false); setNotifOpen(false) }}
        >
          {mobileSearchOpen ? <X size={16} /> : <Search size={16} />}
        </button>

        {/* Global Search Bar */}
        <div className="hidden md:flex items-center gap-2">
        <div className="relative w-64" ref={searchRef}>
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-surface-400" />
          <input
            className="input pl-9 pr-12 py-1.5 text-xs bg-surface-50 dark:bg-surface-950 border-surface-200 dark:border-surface-800 focus:bg-white focus:dark:bg-surface-900 w-full"
            placeholder={placeholderText}
            value={query}
            onChange={e => setQuery(e.target.value)}
            onKeyDown={handleSearchKeyDown}
            onFocus={() => { setSearchOpen(true); setDropOpen(false); setNotifOpen(false); }}
            ref={searchInputRef}
          />
          <span className="absolute right-2.5 top-1/2 -translate-y-1/2 text-[9px] font-bold text-surface-700 dark:text-surface-200 bg-surface-200 dark:bg-surface-800 px-1.5 py-0.5 rounded border border-surface-300 dark:border-surface-700 pointer-events-none">
            Ctrl+K
          </span>

          {/* Search Dropdown Modal */}
          {searchOpen && (
            <div className="absolute right-0 top-full mt-2 w-[380px] bg-white dark:bg-surface-900 border border-surface-200 dark:border-surface-800 rounded-xl shadow-floating z-50 py-2 animate-modal-entry max-h-80 overflow-y-auto">
              {/* Category Filter Tabs */}
              <div className="flex items-center gap-1 px-3 pb-2 mb-2 border-b border-surface-100 dark:border-surface-800 overflow-x-auto scrollbar-none">
                {SEARCH_TABS.map(tab => (
                  <button
                    key={tab}
                    type="button"
                    onClick={() => setSearchTab(tab)}
                    className={searchTab === tab ? 'filter-chip-active !px-2.5 !py-1 !text-[10px] uppercase tracking-wider' : 'filter-chip !px-2.5 !py-1 !text-[10px] uppercase tracking-wider'}
                  >
                    {tab}
                  </button>
                ))}
              </div>

              {searchResults.length === 0 ? (
                <div className="px-4 py-3 text-center text-xs text-surface-400">
                  No results found in {searchTab} matching "{query}"
                </div>
              ) : (
                searchCategories.map(cat => (
                  <div key={cat} className="px-2 mb-2 last:mb-0">
                    <h5 className="text-[9px] font-bold text-surface-400 uppercase tracking-wider px-2 py-1">{cat}</h5>
                    <div className="space-y-0.5">
                      {searchResults.filter(r => r.category === cat).map(r => (
                        <button
                          type="button"
                          key={r.title + r.path}
                          onClick={() => {
                            const dest = query.trim() ? `${r.path}?highlight=${encodeURIComponent(query.trim())}` : r.path
                            navigate(dest)
                            setSearchOpen(false)
                          }}
                          className="w-full text-left px-3 py-1.5 text-xs text-surface-700 dark:text-surface-300 hover:bg-surface-50 dark:hover:bg-surface-800 hover:text-surface-950 dark:hover:text-surface-100 rounded-lg font-medium flex items-center justify-between cursor-pointer"
                        >
                          <span>{highlightMatch(r.title, query)}</span>
                          <span className="text-[9px] text-surface-700 dark:text-surface-200 bg-surface-200 dark:bg-surface-700 px-1 py-0.5 rounded uppercase font-semibold scale-90">Go</span>
                        </button>
                      ))}
                    </div>
                  </div>
                ))
              )}
            </div>
          )}
        </div>

        {/* Multi-Page Results Navigation Arrows */}
        {matchingPaths.length > 1 && (
          <div className="flex items-center gap-1 bg-surface-100 dark:bg-surface-800 border border-surface-200 dark:border-surface-700 px-1.5 py-0.5 rounded-lg select-none">
            <button
              type="button"
              onClick={() => {
                const prevIdx = (currentPathIndex - 1 + matchingPaths.length) % matchingPaths.length
                navigate(`${matchingPaths[prevIdx]}?highlight=${encodeURIComponent(query.trim())}`)
              }}
              className="p-1 hover:bg-surface-200 dark:hover:bg-surface-700 rounded transition-colors text-surface-500 hover:text-surface-800 dark:hover:text-surface-200 cursor-pointer"
              title="Previous Page with Results"
            >
              <ChevronLeft size={13} />
            </button>
            <span className="text-[9px] font-black uppercase text-surface-500 dark:text-surface-400 tracking-wider">
              {currentPathIndex >= 0 ? currentPathIndex + 1 : '?'}/{matchingPaths.length}
            </span>
            <button
              type="button"
              onClick={() => {
                const nextIdx = (currentPathIndex + 1) % matchingPaths.length
                navigate(`${matchingPaths[nextIdx]}?highlight=${encodeURIComponent(query.trim())}`)
              }}
              className="p-1 hover:bg-surface-200 dark:hover:bg-surface-700 rounded transition-colors text-surface-500 hover:text-surface-800 dark:hover:text-surface-200 cursor-pointer"
              title="Next Page with Results"
            >
              <ChevronRight size={13} />
            </button>
          </div>
        )}

        {/* Find in Page / Scroll Highlight Navigation Arrows */}
        {query.trim() && highlightCount > 0 && (
          <div className="flex items-center gap-1 bg-surface-100 dark:bg-surface-800 border border-surface-200 dark:border-surface-700 px-1.5 py-0.5 rounded-lg select-none">
            <button
              type="button"
              onClick={() => navigateHighlight('prev')}
              className="p-1 hover:bg-surface-200 dark:hover:bg-surface-700 rounded transition-colors text-surface-500 hover:text-surface-800 dark:hover:text-surface-200 cursor-pointer"
              title="Previous Highlight on Page"
            >
              <ChevronUp size={13} />
            </button>
            <span className="text-[9px] font-black uppercase text-surface-500 dark:text-surface-400 tracking-wider">
              {activeHighlightIndex + 1}/{highlightCount}
            </span>
            <button
              type="button"
              onClick={() => navigateHighlight('next')}
              className="p-1 hover:bg-surface-200 dark:hover:bg-surface-700 rounded transition-colors text-surface-500 hover:text-surface-800 dark:hover:text-surface-200 cursor-pointer"
              title="Next Highlight on Page"
            >
              <ChevronDown size={13} />
            </button>
          </div>
        )}
        </div>

        {/* Theme Toggler */}
        <button
          type="button"
          onClick={toggleTheme}
          className="btn-ghost p-2 text-surface-600 dark:text-surface-400 hover:text-surface-900 dark:hover:text-surface-100 rounded-full"
          title={`Switch to ${theme === 'light' ? 'Dark' : 'Light'} Mode`}
        >
          {theme === 'light' ? <Moon size={16} /> : <Sun size={16} />}
        </button>

        {/* Notifications Dropdown */}
        <div className="relative" ref={notifRef}>
          <button
            type="button"
            className="btn-ghost p-2 relative text-surface-600 dark:text-surface-400 hover:text-surface-900 dark:hover:text-surface-100 rounded-full"
            onClick={() => { setNotifOpen(o => !o); setDropOpen(false) }}
          >
            <Bell size={16} />
            {unreadCount > 0 && (
              <span className="absolute top-1 right-1 w-2 h-2 bg-primary-500 rounded-full" />
            )}
          </button>
          {notifOpen && (
            <div className="absolute right-0 top-full mt-2 w-[calc(100vw-2rem)] sm:w-80 max-w-sm bg-white dark:bg-surface-900 border border-surface-200 dark:border-surface-800 rounded-xl shadow-floating z-50 animate-modal-entry">
              <div className="flex items-center justify-between px-4 py-3 border-b border-surface-100 dark:border-surface-800">
                <p className="text-sm font-bold text-surface-900 dark:text-surface-100">Notifications</p>
                <button type="button" className="text-xs text-primary-600 hover:text-primary-700 font-bold" onClick={markAllRead}>
                  Mark all as read
                </button>
              </div>
              <div className="max-h-72 overflow-y-auto divide-y divide-surface-100 dark:divide-surface-800">
                {displayNotifs.length === 0 ? (
                  <div className="px-4 py-6 text-center text-xs text-surface-400">No notifications</div>
                ) : displayNotifs.map(n => (
                  <div key={n.id} className="px-4 py-3 hover:bg-surface-50 dark:hover:bg-surface-800 flex items-start gap-2.5 cursor-pointer">
                    <span className={`w-1.5 h-1.5 rounded-full mt-1.5 flex-shrink-0 ${severityColors[n.severity] || 'bg-surface-400'}`} />
                    <div className="min-w-0">
                      <p className="text-xs font-semibold text-surface-800 dark:text-surface-200 leading-tight">{n.title}</p>
                      <p className="text-xs text-surface-400 mt-0.5 truncate">{n.message}</p>
                      <p className="text-[10px] text-surface-400 mt-1 font-semibold">{n.time}</p>
                    </div>
                  </div>
                ))}
              </div>
              <div className="px-4 py-2.5 border-t border-surface-100 dark:border-surface-800 text-center bg-surface-50 dark:bg-surface-950 rounded-b-xl">
                <button
                  type="button"
                  onClick={() => navigate(user?.role === 'user' ? '/user/notifications' : '#')}
                  className="text-xs text-primary-600 hover:text-primary-700 font-bold"
                >
                  View all notifications
                </button>
              </div>
            </div>
          )}
        </div>

        {/* User Profile avatar dropdown */}
        <div className="relative" ref={dropRef}>
          <button
            type="button"
            className="flex items-center gap-2 btn-ghost px-2 py-1.5 rounded-lg text-surface-700 dark:text-surface-300"
            onClick={() => { setDropOpen(o => !o); setNotifOpen(false) }}
          >
            <div className="w-7 h-7 rounded-full bg-primary-500/15 border border-primary-500/30 flex items-center justify-center flex-shrink-0 text-primary-600 font-bold">
              {user?.name?.[0] ?? 'U'}
            </div>
            <ChevronDown size={13} className="text-surface-400" />
          </button>

          {dropOpen && (
            <div className="absolute right-0 top-full mt-2 w-52 bg-white dark:bg-surface-900 border border-surface-200 dark:border-surface-800 rounded-xl shadow-floating z-50 py-1 animate-modal-entry">
              {/* User Header */}
              <div className="px-4 py-3 border-b border-surface-100 dark:border-surface-800">
                <p className="text-xs font-bold text-surface-800 dark:text-surface-200 leading-none">{user?.name}</p>
                {user?.organization?.name && (
                  <p className="text-[10px] font-semibold text-info-600 mt-1 truncate">{user.organization.name}</p>
                )}
                <p className="text-[10px] text-surface-400 mt-1 truncate">{user?.email}</p>
              </div>
              {/* Menu items */}
              <button
                type="button"
                onClick={() => navigate(user?.role === 'admin' ? '/admin/settings' : user?.role === 'org' ? '/org/settings' : '/user/subscription')}
                className="w-full flex items-center gap-2.5 px-4 py-2.5 text-xs text-surface-600 dark:text-surface-400 hover:bg-surface-50 dark:hover:bg-surface-800 hover:text-surface-900 dark:hover:text-surface-200 font-semibold"
              >
                <User size={14} /> Profile
              </button>
              <button
                type="button"
                onClick={() => navigate(user?.role === 'admin' ? '/admin/settings' : user?.role === 'org' ? '/org/settings' : '/user/notifications')}
                className="w-full flex items-center gap-2.5 px-4 py-2.5 text-xs text-surface-600 dark:text-surface-400 hover:bg-surface-50 dark:hover:bg-surface-800 hover:text-surface-900 dark:hover:text-surface-200 font-semibold"
              >
                <Settings size={14} /> Settings
              </button>
              <div className="border-t border-surface-100 dark:border-surface-800 my-1" />
              <button
                type="button"
                onClick={handleLogout}
                className="w-full flex items-center gap-2.5 px-4 py-2.5 text-xs text-danger-600 hover:bg-danger-50 dark:hover:bg-danger-950/20 font-bold"
              >
                <LogOut size={14} /> Sign out
              </button>
            </div>
          )}
        </div>
      </div>
    </header>
    </div>

    {/* Mobile search panel — slides in below header */}
    {mobileSearchOpen && (
      <div className="md:hidden bg-white dark:bg-surface-900 border-b border-surface-200 dark:border-surface-800 px-4 py-3 z-20 shadow-sm" ref={searchRef}>
        <div className="relative">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-surface-400" />
          <input
            className="input pl-9 py-2 text-xs bg-surface-50 dark:bg-surface-950 border-surface-200 dark:border-surface-800 focus:bg-white focus:dark:bg-surface-900 w-full"
            placeholder="Search anything..."
            value={query}
            onChange={e => setQuery(e.target.value)}
            onKeyDown={handleSearchKeyDown}
            onFocus={() => setSearchOpen(true)}
            ref={searchInputRef}
            autoFocus
          />
        </div>
        {searchOpen && query && (
          <div className="mt-2 bg-white dark:bg-surface-900 border border-surface-200 dark:border-surface-800 rounded-xl shadow-floating py-2 max-h-64 overflow-y-auto animate-modal-entry">
            {searchResults.length === 0 ? (
              <div className="px-4 py-3 text-center text-xs text-surface-400">No results matching "{query}"</div>
            ) : searchCategories.map(cat => (
              <div key={cat} className="px-2 mb-2 last:mb-0">
                <h5 className="text-[9px] font-bold text-surface-400 uppercase tracking-wider px-2 py-1">{cat}</h5>
                <div className="space-y-0.5">
                  {searchResults.filter(r => r.category === cat).map(r => (
                    <button
                      type="button"
                      key={r.title + r.path}
                      onClick={() => {
                        const dest = query.trim() ? `${r.path}?highlight=${encodeURIComponent(query.trim())}` : r.path
                        navigate(dest); setSearchOpen(false); setMobileSearchOpen(false)
                      }}
                      className="w-full text-left px-3 py-1.5 text-xs text-surface-700 dark:text-surface-300 hover:bg-surface-50 dark:hover:bg-surface-800 hover:text-surface-950 dark:hover:text-surface-100 rounded-lg font-medium flex items-center justify-between cursor-pointer"
                    >
                      <span>{highlightMatch(r.title, query)}</span>
                      <span className="text-[9px] text-surface-700 dark:text-surface-200 bg-surface-200 dark:bg-surface-700 px-1 py-0.5 rounded uppercase font-semibold">Go</span>
                    </button>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    )}
  </>
  )
}
