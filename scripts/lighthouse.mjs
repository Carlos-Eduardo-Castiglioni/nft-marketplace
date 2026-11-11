/**
 * Auditoria Lighthouse do build de produção.
 *   npm run build && npm run lighthouse
 * Sobe o `vite preview`, audita as rotas principais (mobile e desktop) e
 * falha se alguma categoria ficar abaixo do mínimo.
 */
import { spawn } from 'node:child_process'
import { writeFileSync, mkdirSync } from 'node:fs'
import lighthouse from 'lighthouse'
import * as chromeLauncher from 'chrome-launcher'

const PORT = 4174
const BASE = `http://localhost:${PORT}`
const ROUTES = ['/', '/nft/emerald-ape-042', '/cart', '/login']
// Mobile usa a simulação "Slow 4G + CPU 4x" do Lighthouse; a latência artificial
// do backend simulado (250 ms por requisição) também entra na conta.
const MIN = {
  mobile: { performance: 0.8, accessibility: 0.95, 'best-practices': 0.9, seo: 0.9 },
  desktop: { performance: 0.9, accessibility: 0.95, 'best-practices': 0.9, seo: 0.9 },
}
const chromePath = process.env.CHROME_PATH ?? '/opt/pw-browsers/chromium'

const server = spawn('npx', ['vite', 'preview', '--port', String(PORT), '--strictPort'], { stdio: 'ignore' })
const waitFor = async () => {
  for (let i = 0; i < 60; i++) {
    try {
      if ((await fetch(BASE)).ok) return
    } catch {}
    await new Promise((r) => setTimeout(r, 500))
  }
  throw new Error('preview não subiu')
}

let failed = false
const rows = []
try {
  await waitFor()
  const chrome = await chromeLauncher.launch({ chromePath, chromeFlags: ['--headless=new', '--no-sandbox'] })
  mkdirSync('lighthouse-report', { recursive: true })
  for (const formFactor of ['mobile', 'desktop']) {
    for (const route of ROUTES) {
      const config =
        formFactor === 'desktop'
          ? {
              extends: 'lighthouse:default',
              settings: {
                formFactor: 'desktop',
                screenEmulation: { mobile: false, width: 1350, height: 940, deviceScaleFactor: 1, disabled: false },
                throttling: { rttMs: 40, throughputKbps: 10 * 1024, cpuSlowdownMultiplier: 1, requestLatencyMs: 0, downloadThroughputKbps: 0, uploadThroughputKbps: 0 },
              },
            }
          : { extends: 'lighthouse:default' }
      const result = await lighthouse(`${BASE}${route}`, { port: chrome.port, output: 'html', logLevel: 'error' }, config)
      const lhr = result.lhr
      const scores = Object.fromEntries(Object.entries(lhr.categories).map(([k, v]) => [k, v.score]))
      const metrics = {
        LCP: lhr.audits['largest-contentful-paint'].displayValue,
        CLS: lhr.audits['cumulative-layout-shift'].displayValue,
        TBT: lhr.audits['total-blocking-time'].displayValue,
      }
      rows.push({ formFactor, route, ...Object.fromEntries(Object.entries(scores).map(([k, v]) => [k, Math.round(v * 100)])), ...metrics })
      for (const [k, min] of Object.entries(MIN[formFactor])) if ((scores[k] ?? 0) < min) failed = true
      writeFileSync(`lighthouse-report/${formFactor}${route.replace(/\//g, '_') || '_home'}.html`, result.report)
    }
  }
  await chrome.kill()
} finally {
  server.kill()
}
console.table(rows)
writeFileSync('lighthouse-report/summary.json', JSON.stringify(rows, null, 2))
if (failed) {
  console.error('Lighthouse abaixo do mínimo:', MIN)
  process.exit(1)
}
