// In-process metrics (P-50) — expose via GET /metrics for Prometheus scraping.

const counters = {
  http_requests_total: {},
  ingest_total: 0,
  ingest_errors_total: 0,
  ingest_queued_total: 0,
  anomaly_checks_total: 0,
  emails_sent_total: 0,
  emails_failed_total: 0,
}

const inc = (name, labels = {}) => {
  if (name === 'http_requests_total') {
    const key = `${labels.method || 'GET'}:${labels.route || 'unknown'}:${labels.status || '200'}`
    counters.http_requests_total[key] = (counters.http_requests_total[key] || 0) + 1
    return
  }
  if (counters[name] != null) counters[name] += 1
}

const prometheusText = () => {
  const lines = [
    '# HELP ingest_total Total ingest payloads processed',
    '# TYPE ingest_total counter',
    `ingest_total ${counters.ingest_total}`,
    '# HELP ingest_errors_total Total ingest failures',
    '# TYPE ingest_errors_total counter',
    `ingest_errors_total ${counters.ingest_errors_total}`,
    '# HELP ingest_queued_total Total ingest payloads queued',
    '# TYPE ingest_queued_total counter',
    `ingest_queued_total ${counters.ingest_queued_total}`,
    '# HELP anomaly_checks_total Total anomaly detection runs',
    '# TYPE anomaly_checks_total counter',
    `anomaly_checks_total ${counters.anomaly_checks_total}`,
    '# HELP emails_sent_total Total alarm emails sent',
    '# TYPE emails_sent_total counter',
    `emails_sent_total ${counters.emails_sent_total}`,
    '# HELP emails_failed_total Total alarm email failures',
    '# TYPE emails_failed_total counter',
    `emails_failed_total ${counters.emails_failed_total}`,
  ]
  for (const [key, val] of Object.entries(counters.http_requests_total)) {
    const [method, route, status] = key.split(':')
    lines.push(`http_requests_total{method="${method}",route="${route}",status="${status}"} ${val}`)
  }
  return lines.join('\n') + '\n'
}

module.exports = { inc, prometheusText }
