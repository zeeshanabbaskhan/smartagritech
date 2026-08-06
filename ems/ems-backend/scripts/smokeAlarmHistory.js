/**
 * Smoke-test Data Center / alarm-history APIs.
 * Usage: node scripts/smokeAlarmHistory.js [baseUrl]
 * Default baseUrl: http://localhost:5001
 */
const BASE = (process.argv[2] || 'http://localhost:5001').replace(/\/$/, '')

async function req(method, path, { token, body, raw } = {}) {
  const headers = { Accept: raw ? 'text/csv' : 'application/json' }
  if (token) headers.Authorization = `Bearer ${token}`
  if (body != null) headers['Content-Type'] = 'application/json'
  const res = await fetch(`${BASE}${path}`, {
    method,
    headers,
    body: body != null ? JSON.stringify(body) : undefined,
  })
  const text = await res.text()
  let data
  try { data = JSON.parse(text) } catch { data = text }
  return { status: res.status, ok: res.ok, data, headers: res.headers }
}

function pass(name, detail = '') {
  console.log(`PASS  ${name}${detail ? ` — ${detail}` : ''}`)
}
function fail(name, detail = '') {
  console.error(`FAIL  ${name}${detail ? ` — ${detail}` : ''}`)
}

async function main() {
  let failures = 0
  const mark = (ok, name, detail) => {
    if (ok) pass(name, detail)
    else { fail(name, detail); failures += 1 }
  }

  const health = await req('GET', '/health')
  mark(health.ok, 'GET /health', `status=${health.status}`)

  const login = await req('POST', '/api/auth/login', {
    body: { email: 'superadmin@ems.com', password: 'Admin@123456' },
  })
  const token = login.data?.token || login.data?.data?.token
  mark(login.ok && !!token, 'POST /api/auth/login', `status=${login.status}`)
  if (!token) {
    console.error('Cannot continue without token')
    process.exit(1)
  }

  const alarms = await req('GET', '/api/alarm-history/variable-alarms?limit=20', { token })
  const alarmRows = Array.isArray(alarms.data?.data) ? alarms.data.data : []
  mark(alarms.ok && alarmRows.length > 0, 'GET /api/alarm-history/variable-alarms', `status=${alarms.status} count=${alarmRows.length} total=${alarms.data?.total}`)
  if (alarmRows[0]) {
    const row = alarmRows[0]
    mark(!!row.variableName && row.deviceId, 'variable-alarm row shape', `variable=${row.variableName} device=${row.device?.name || row.deviceId}`)
  }

  const filtered = await req('GET', '/api/alarm-history/variable-alarms?alarmState=ACTIVE&processState=UNPROCESSED&limit=10', { token })
  mark(filtered.ok, 'GET variable-alarms filtered by state', `status=${filtered.status} count=${(filtered.data?.data || []).length}`)

  const links = await req('GET', '/api/alarm-history/linkage-records?limit=20', { token })
  const linkRows = Array.isArray(links.data?.data) ? links.data.data : []
  mark(links.ok && linkRows.length > 0, 'GET /api/alarm-history/linkage-records', `status=${links.status} count=${linkRows.length} total=${links.data?.total}`)
  if (linkRows[0]) {
    const row = linkRows[0]
    mark(!!(row.triggerName || row.watchedVariableName) && !!row.device, 'linkage row includes device/trigger', `trigger=${row.triggerName} device=${row.device?.name}`)
  }

  const csvAlarms = await req('GET', '/api/alarm-history/variable-alarms/csv', { token, raw: true })
  mark(csvAlarms.ok && typeof csvAlarms.data === 'string' && csvAlarms.data.includes('variableName'), 'GET variable-alarms/csv', `status=${csvAlarms.status} bytes=${String(csvAlarms.data).length}`)

  const csvLinks = await req('GET', '/api/alarm-history/linkage-records/csv', { token, raw: true })
  mark(csvLinks.ok && typeof csvLinks.data === 'string' && csvLinks.data.includes('triggerName'), 'GET linkage-records/csv', `status=${csvLinks.status} bytes=${String(csvLinks.data).length}`)

  const active = alarmRows.find((a) => a.alarmState === 'ACTIVE' || a.processState === 'UNPROCESSED') || alarmRows[0]
  if (active) {
    const processed = await req('PATCH', `/api/alarm-history/variable-alarms/${active.id}/process`, { token })
    const updated = processed.data?.data
    mark(
      processed.ok && updated?.processState === 'PROCESSED' && updated?.alarmState === 'RESOLVED',
      'PATCH variable-alarms/:id/process',
      `status=${processed.status} alarmState=${updated?.alarmState} processState=${updated?.processState}`,
    )
  } else {
    mark(false, 'PATCH variable-alarms/:id/process', 'no alarm row to process')
  }

  // Create a disposable alarm row via prisma-less approach: clone fields from an existing row through list,
  // then batch-delete one id. Prefer deleting a freshly processed row if we have ids.
  const disposableId = active?.id
  if (disposableId) {
    const del = await req('DELETE', '/api/alarm-history/variable-alarms', {
      token,
      body: { ids: [disposableId] },
    })
    mark(del.ok && (del.data?.deleted ?? 0) >= 1, 'DELETE /api/alarm-history/variable-alarms (batch)', `status=${del.status} deleted=${del.data?.deleted}`)
  }

  const linkId = linkRows[0]?.id
  if (linkId) {
    const delL = await req('DELETE', '/api/alarm-history/linkage-records', {
      token,
      body: { ids: [linkId] },
    })
    mark(delL.ok && (delL.data?.deleted ?? 0) >= 1, 'DELETE /api/alarm-history/linkage-records (batch)', `status=${delL.status} deleted=${delL.data?.deleted}`)
  }

  const devices = await req('GET', '/api/devices?limit=5', { token })
  const deviceId = devices.data?.data?.[0]?.id
  mark(devices.ok && !!deviceId, 'GET /api/devices (for historical)', `status=${devices.status}`)

  if (deviceId) {
    const hist = await req('GET', `/api/sensor-data/history?deviceId=${deviceId}&variableName=VoltageA&startDate=2020-01-01&endDate=2099-12-31&limit=5`, { token })
    mark(hist.ok, 'GET /api/sensor-data/history', `status=${hist.status} count=${hist.data?.count ?? (hist.data?.data || []).length}`)
  }

  console.log(`\n${failures === 0 ? 'ALL PASSED' : `${failures} FAILED`}`)
  process.exit(failures === 0 ? 0 : 1)
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
