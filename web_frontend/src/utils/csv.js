/** Client-side CSV export helper for "Download Data" buttons across admin pages. */
export function toCsv(header, rows) {
  return [header, ...rows]
    .map((row) => row.map((v) => `"${String(v ?? '').replace(/"/g, '""')}"`).join(','))
    .join('\n')
}

export function downloadCsv(filename, header, rows) {
  // UTF-8 BOM helps Excel open the file with the correct encoding.
  const csv = `\uFEFF${toCsv(header, rows)}`
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  a.click()
  URL.revokeObjectURL(url)
}
