/** Shared device list filter helpers (admin + org). */

export const DEVICE_STATUS_OPTIONS = ['Online', 'Offline', 'Alarm', 'Not Configured']

export const deviceStatusBadgeClass = (status) => {
  switch (status) {
    case 'Online':
      return 'badge-success'
    case 'Offline':
      return 'badge-danger'
    case 'Alarm':
      return 'badge-danger'
    case 'Not Configured':
      return 'badge-warning'
    default:
      return 'badge-neutral'
  }
}

/** Compare an ISO/date value against an optional inclusive YYYY-MM-DD range. */
export function matchesDateRange(iso, from, to) {
  if (!from && !to) return true
  if (!iso) return false
  const day = String(iso).slice(0, 10)
  if (!/^\d{4}-\d{2}-\d{2}$/.test(day)) return false
  if (from && day < from) return false
  if (to && day > to) return false
  return true
}

/**
 * Status filter matching portal options.
 * Alarm / Not Configured also match derived states when the API only has ONLINE/OFFLINE.
 */
export function matchesDeviceStatus(row, status) {
  if (!status) return true
  if (row.status === status) return true
  const raw = String(row.statusRaw ?? row._raw?.status ?? '').toUpperCase()
  if (status === 'Online') return raw === 'ONLINE'
  if (status === 'Offline') return raw === 'OFFLINE'
  if (status === 'Alarm') return raw === 'ALARM'
  if (status === 'Not Configured') {
    if (raw === 'NOT_CONFIGURED') return true
    const neverSeen = !row._raw?.lastDataReceivedAt && !row.lastSeenRaw
    return neverSeen && raw !== 'ONLINE'
  }
  return false
}

export function matchesDeviceDates(row, createdFrom, createdTo, modifiedFrom, modifiedTo) {
  const created = row.createdAtRaw ?? row._raw?.createdAt ?? row.createdAt
  const updated = row.updatedAtRaw ?? row._raw?.updatedAt ?? row.updatedAt
  return (
    matchesDateRange(created, createdFrom, createdTo) &&
    matchesDateRange(updated, modifiedFrom, modifiedTo)
  )
}
