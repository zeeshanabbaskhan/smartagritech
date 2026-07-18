/**
 * Convert all docs/*.md files to styled PDFs in docs/pdf/
 * Renders Mermaid diagrams via mermaid.js in Chromium.
 */
const fs = require('fs')
const path = require('path')
const { marked } = require('marked')
const puppeteer = require('puppeteer')

const DOCS_DIR = __dirname
const OUT_DIR = path.join(DOCS_DIR, 'pdf')

const CSS = `
  @page { margin: 18mm 16mm; }
  :root {
    --text: #1a1a1a;
    --muted: #555;
    --border: #d0d7de;
    --code-bg: #f6f8fa;
    --accent: #0b6e4f;
    --table-head: #eef6f2;
  }
  * { box-sizing: border-box; }
  body {
    font-family: "Segoe UI", Calibri, "Helvetica Neue", Arial, sans-serif;
    font-size: 11pt;
    line-height: 1.55;
    color: var(--text);
    max-width: 100%;
  }
  h1 {
    font-size: 22pt;
    color: var(--accent);
    border-bottom: 3px solid var(--accent);
    padding-bottom: 8px;
    margin-top: 0;
    page-break-after: avoid;
  }
  h2 {
    font-size: 15pt;
    color: var(--accent);
    border-bottom: 1px solid var(--border);
    padding-bottom: 4px;
    margin-top: 28px;
    page-break-after: avoid;
  }
  h3 {
    font-size: 12.5pt;
    color: #1f4e3d;
    margin-top: 20px;
    page-break-after: avoid;
  }
  h4 { font-size: 11.5pt; margin-top: 16px; page-break-after: avoid; }
  p, li { orphans: 3; widows: 3; }
  a { color: #0969da; text-decoration: none; }
  blockquote {
    border-left: 4px solid var(--accent);
    margin: 12px 0;
    padding: 6px 14px;
    color: var(--muted);
    background: #f8faf9;
  }
  code {
    font-family: Consolas, "Courier New", monospace;
    font-size: 9.5pt;
    background: var(--code-bg);
    padding: 1px 5px;
    border-radius: 3px;
    border: 1px solid #eaeef2;
  }
  pre {
    background: var(--code-bg);
    border: 1px solid var(--border);
    border-radius: 6px;
    padding: 12px 14px;
    overflow-x: auto;
    font-size: 8.5pt;
    line-height: 1.4;
    page-break-inside: avoid;
  }
  pre code { border: none; padding: 0; background: transparent; }
  table {
    border-collapse: collapse;
    width: 100%;
    margin: 12px 0 18px;
    font-size: 9.5pt;
    page-break-inside: auto;
  }
  thead { display: table-header-group; }
  th, td {
    border: 1px solid var(--border);
    padding: 6px 8px;
    text-align: left;
    vertical-align: top;
  }
  th {
    background: var(--table-head);
    font-weight: 600;
    color: #163a2e;
  }
  tr { page-break-inside: avoid; }
  tr:nth-child(even) td { background: #fafbfc; }
  hr {
    border: none;
    border-top: 1px solid var(--border);
    margin: 24px 0;
  }
  img, svg { max-width: 100%; }
  .mermaid {
    text-align: center;
    margin: 16px 0;
    page-break-inside: avoid;
    background: #fafcfa;
    border: 1px solid #e6eee9;
    border-radius: 8px;
    padding: 12px;
  }
  .cover-meta {
    color: var(--muted);
    font-size: 10pt;
    margin-bottom: 24px;
  }
`

function renderHtml(md, title) {
  const renderer = new marked.Renderer()
  const originalCode = renderer.code.bind(renderer)
  renderer.code = function (code, infostring, escaped) {
    // marked v9+ may pass a token object
    if (typeof code === 'object' && code !== null) {
      const token = code
      const lang = (token.lang || '').trim().split(/\s+/)[0]
      if (lang === 'mermaid') {
        return `<div class="mermaid">${token.text}</div>`
      }
      return originalCode(token)
    }
    const lang = (infostring || '').trim().split(/\s+/)[0]
    if (lang === 'mermaid') {
      return `<div class="mermaid">${code}</div>`
    }
    return originalCode(code, infostring, escaped)
  }

  const body = marked.parse(md, { renderer, gfm: true, breaks: false })
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <title>${title}</title>
  <style>${CSS}</style>
  <script src="https://cdn.jsdelivr.net/npm/mermaid@10/dist/mermaid.min.js"></script>
</head>
<body>
  <p class="cover-meta">Smart AgriTech EMS Documentation</p>
  ${body}
  <script>
    mermaid.initialize({
      startOnLoad: true,
      theme: 'neutral',
      securityLevel: 'loose',
      flowchart: { useMaxWidth: true, htmlLabels: true },
      sequence: { useMaxWidth: true }
    });
  </script>
</body>
</html>`
}

async function convertFile(browser, mdPath, outName) {
  const base = outName || path.basename(mdPath, '.md')
  const outPdf = path.join(OUT_DIR, `${base}.pdf`)
  const md = fs.readFileSync(mdPath, 'utf8')
  const title = base === 'README'
    ? 'Documentation Index'
    : base === 'OPTIMIZATION_GUIDE'
      ? 'Optimization Guide'
      : base.replace(/^\d+-/, '').replace(/-/g, ' ')
  const html = renderHtml(md, title)
  const tmpHtml = path.join(OUT_DIR, `${base}.tmp.html`)
  fs.writeFileSync(tmpHtml, html, 'utf8')

  const page = await browser.newPage()
  try {
    const fileUrl = 'file:///' + tmpHtml.replace(/\\/g, '/')
    await page.goto(fileUrl, { waitUntil: 'networkidle0', timeout: 180000 })

    await page.waitForFunction(
      () => {
        const nodes = document.querySelectorAll('.mermaid')
        if (!nodes.length) return true
        return [...nodes].every(
          (n) => n.querySelector('svg') || n.getAttribute('data-processed') === 'true'
        )
      },
      { timeout: 120000 }
    ).catch(() => console.warn(`  (mermaid wait timed out for ${base})`))

    await new Promise((r) => setTimeout(r, 500))

    await page.pdf({
      path: outPdf,
      format: 'A4',
      printBackground: true,
      margin: { top: '18mm', right: '14mm', bottom: '18mm', left: '14mm' },
      displayHeaderFooter: true,
      headerTemplate: `
        <div style="font-size:8px;width:100%;padding:0 16mm;color:#666;font-family:Segoe UI,sans-serif;">
          <span>Smart AgriTech EMS Documentation</span>
        </div>`,
      footerTemplate: `
        <div style="font-size:8px;width:100%;padding:0 16mm;color:#666;font-family:Segoe UI,sans-serif;display:flex;justify-content:space-between;">
          <span>${base}.pdf</span>
          <span><span class="pageNumber"></span> / <span class="totalPages"></span></span>
        </div>`,
    })

    const sizeKb = Math.round(fs.statSync(outPdf).size / 1024)
    console.log(`✓ ${base}.pdf (${sizeKb} KB)`)
  } finally {
    await page.close()
    if (fs.existsSync(tmpHtml)) fs.unlinkSync(tmpHtml)
  }
}

async function main() {
  if (!fs.existsSync(OUT_DIR)) fs.mkdirSync(OUT_DIR, { recursive: true })

  const files = fs
    .readdirSync(DOCS_DIR)
    .filter((f) => f.endsWith('.md'))
    .sort((a, b) => {
      if (a === 'README.md') return -1
      if (b === 'README.md') return 1
      return a.localeCompare(b)
    })
    .map((f) => ({ path: path.join(DOCS_DIR, f) }))

  const optimizationGuide = path.join(DOCS_DIR, '..', 'OPTIMIZATION_GUIDE.md')
  if (fs.existsSync(optimizationGuide)) {
    files.push({ path: optimizationGuide, outName: 'OPTIMIZATION_GUIDE' })
  }

  console.log(`Converting ${files.length} markdown files → docs/pdf/\n`)

  const chromeCandidates = [
    process.env.PUPPETEER_EXECUTABLE_PATH,
    'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
    'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe',
    process.env.LOCALAPPDATA && path.join(process.env.LOCALAPPDATA, 'Google\\Chrome\\Application\\chrome.exe'),
    'C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe',
  ].filter(Boolean)

  const executablePath = chromeCandidates.find((p) => fs.existsSync(p))
  if (!executablePath) {
    throw new Error('No Chrome/Edge found. Install Chrome or set PUPPETEER_EXECUTABLE_PATH.')
  }
  console.log(`Using browser: ${executablePath}\n`)

  const browser = await puppeteer.launch({
    headless: 'new',
    executablePath,
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--allow-file-access-from-files'],
  })

  try {
    for (const file of files) {
      await convertFile(browser, file.path, file.outName)
    }
  } finally {
    await browser.close()
  }

  console.log(`\nDone. PDFs saved in docs/pdf/`)
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
