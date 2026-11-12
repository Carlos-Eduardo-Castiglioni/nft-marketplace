/**
 * Auditoria Lighthouse do build de produção.
 *   npm run build && npm run lighthouse
 *
 * - Sobe o `vite preview` (build otimizado, cenário padrão dos mocks).
 * - Audita cada rota em perfil mobile e desktop, RUNS vezes cada.
 * - Salva o relatório HTML e JSON de cada medição em `lighthouse-report/runs/`.
 * - Gera `lighthouse-report/summary.json` e `summary.md` com a MEDIANA de cada
 *   categoria e de LCP/CLS/TBT, e `environment.json` com versões e condições.
 * - Encerra com código 1 se a mediana de alguma categoria ficar abaixo do mínimo.
 */
import { spawn } from 'node:child_process'
import { writeFileSync, mkdirSync, readFileSync, rmSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import os from 'node:os'
import lighthouse from 'lighthouse'
import * as chromeLauncher from 'chrome-launcher'
import { chromium } from '@playwright/test'

const PORT = 4174
const BASE = `http://localhost:${PORT}`
const RUNS = Number(process.env.LH_RUNS ?? 3)
// Início e detalhe são as páginas exigidas; carrinho e login entram como referência.
const ROUTES = ['/', '/nft/emerald-ape-042', '/cart', '/login']
const REQUIRED_ROUTES = new Set(['/', '/nft/emerald-ape-042'])
const CATEGORIES = ['performance', 'accessibility', 'best-practices', 'seo']
// Metas do desafio. A performance mobile tem uma tolerância documentada em
// ARCHITECTURE.md (seção "Performance e Lighthouse"); o gate do CI usa estes mínimos.
const TARGET = { performance: 90, accessibility: 95, 'best-practices': 95, seo: 90 }
const MIN = {
  mobile: { ...TARGET, performance: 50 },
  desktop: TARGET,
}

const DESKTOP_SETTINGS = {
  formFactor: 'desktop',
  screenEmulation: { mobile: false, width: 1350, height: 940, deviceScaleFactor: 1, disabled: false },
  throttling: { rttMs: 40, throughputKbps: 10 * 1024, cpuSlowdownMultiplier: 1, requestLatencyMs: 0, downloadThroughputKbps: 0, uploadThroughputKbps: 0 },
}
const configFor = (formFactor) =>
  formFactor === 'desktop' ? { extends: 'lighthouse:default', settings: DESKTOP_SETTINGS } : { extends: 'lighthouse:default' }

const chromePath = process.env.CHROME_PATH ?? chromium.executablePath()
const pkgVersion = (name) =>
  JSON.parse(readFileSync(fileURLToPath(new URL(`../node_modules/${name}/package.json`, import.meta.url)), 'utf8')).version

const median = (values) => {
  const sorted = [...values].sort((a, b) => a - b)
  const mid = Math.floor(sorted.length / 2)
  return sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2
}
const slug = (route) => (route === '/' ? 'home' : route.replace(/^\//, '').replace(/\//g, '_'))

const viteCli = fileURLToPath(new URL('../node_modules/vite/bin/vite.js', import.meta.url))
const server = spawn(process.execPath, [viteCli, 'preview', '--port', String(PORT), '--strictPort'], { stdio: 'ignore' })
let serverError
server.on('error', (error) => {
  serverError = error
})
const waitFor = async () => {
  for (let i = 0; i < 60; i++) {
    if (serverError) throw new Error('não foi possível iniciar o preview do Vite', { cause: serverError })
    if (server.exitCode !== null) throw new Error(`preview do Vite encerrou com código ${server.exitCode}`)
    try {
      if ((await fetch(BASE)).ok) return
    } catch {
      /* ainda subindo */
    }
    await new Promise((r) => setTimeout(r, 500))
  }
  throw new Error('preview não subiu')
}

let failed = false
const summary = []
let chrome
let lighthouseVersion
let userAgent
try {
  await waitFor()
  rmSync('lighthouse-report', { recursive: true, force: true })
  mkdirSync('lighthouse-report/runs', { recursive: true })
  chrome = await chromeLauncher.launch({ chromePath, chromeFlags: ['--headless=new', '--no-sandbox'] })
  for (const formFactor of ['mobile', 'desktop']) {
    for (const route of ROUTES) {
      const runs = []
      for (let run = 1; run <= RUNS; run++) {
        const result = await lighthouse(
          `${BASE}${route}`,
          { port: chrome.port, output: ['html', 'json'], logLevel: 'error' },
          configFor(formFactor),
        )
        const { lhr } = result
        lighthouseVersion = lhr.lighthouseVersion
        userAgent = lhr.environment.hostUserAgent
        const base = `lighthouse-report/runs/${formFactor}_${slug(route)}_run${run}`
        writeFileSync(`${base}.html`, result.report[0])
        writeFileSync(`${base}.json`, result.report[1])
        runs.push({
          ...Object.fromEntries(CATEGORIES.map((c) => [c, Math.round((lhr.categories[c]?.score ?? 0) * 100)])),
          LCP: lhr.audits['largest-contentful-paint'].numericValue,
          CLS: lhr.audits['cumulative-layout-shift'].numericValue,
          TBT: lhr.audits['total-blocking-time'].numericValue,
        })
        console.log(`${formFactor} ${route} #${run}:`, runs.at(-1))
      }
      const row = {
        formFactor,
        route,
        required: REQUIRED_ROUTES.has(route),
        runs: RUNS,
        ...Object.fromEntries(CATEGORIES.map((c) => [c, median(runs.map((r) => r[c]))])),
        LCP_ms: Math.round(median(runs.map((r) => r.LCP))),
        CLS: Number(median(runs.map((r) => r.CLS)).toFixed(3)),
        TBT_ms: Math.round(median(runs.map((r) => r.TBT))),
        samples: runs,
      }
      summary.push(row)
      for (const [k, min] of Object.entries(MIN[formFactor])) if (row[k] < min) failed = true
    }
  }
} finally {
  if (chrome) await chrome.kill()
  if (server.exitCode === null && server.signalCode === null) server.kill()
}

const environment = {
  date: new Date().toISOString(),
  runsPerPageAndProfile: RUNS,
  aggregation: 'mediana',
  target: BASE,
  build: 'vite build (produção) servido por vite preview; mocks MSW no cenário padrão',
  tools: {
    lighthouse: lighthouseVersion,
    'chrome-launcher': pkgVersion('chrome-launcher'),
    playwright: pkgVersion('@playwright/test'),
    vite: pkgVersion('vite'),
    node: process.version,
    chrome: userAgent,
  },
  machine: { os: `${os.type()} ${os.release()}`, arch: os.arch(), cpu: os.cpus()[0]?.model, cores: os.cpus().length, memoryGB: Math.round(os.totalmem() / 2 ** 30) },
  profiles: {
    mobile: 'padrão do Lighthouse: Moto G Power emulado, Slow 4G simulado (150 ms RTT, 1,6 Mbps), CPU 4x mais lenta',
    desktop: '1350×940, 40 ms RTT, 10 Mbps, sem desaceleração de CPU',
  },
  targets: TARGET,
  gate: MIN,
}

writeFileSync('lighthouse-report/summary.json', JSON.stringify(summary, null, 2))
writeFileSync('lighthouse-report/environment.json', JSON.stringify(environment, null, 2))

const md = [
  `# Lighthouse — mediana de ${RUNS} medições`,
  '',
  `Gerado em ${environment.date} · Lighthouse ${lighthouseVersion} · ${userAgent} · Node ${process.version} · ${environment.machine.os}`,
  '',
  '| Perfil | Rota | Performance | Accessibility | Best Practices | SEO | LCP | CLS | TBT |',
  '|---|---|---|---|---|---|---|---|---|',
  ...summary.map(
    (r) =>
      `| ${r.formFactor} | \`${r.route}\`${r.required ? '' : ' (extra)'} | ${r.performance} | ${r.accessibility} | ${r['best-practices']} | ${r.seo} | ${(r.LCP_ms / 1000).toFixed(1)} s | ${r.CLS} | ${r.TBT_ms} ms |`,
  ),
  '',
  `Metas: Performance ≥ ${TARGET.performance}, Accessibility ≥ ${TARGET.accessibility}, Best Practices ≥ ${TARGET['best-practices']}, SEO ≥ ${TARGET.seo}.`,
  'Relatórios individuais (HTML e JSON) em `runs/`. Condições de execução em `environment.json`.',
  '',
].join('\n')
writeFileSync('lighthouse-report/summary.md', md)

console.table(summary.map((r) => Object.fromEntries(Object.entries(r).filter(([k]) => k !== 'samples'))))
if (failed) {
  console.error('Lighthouse abaixo do mínimo:', MIN)
  process.exit(1)
}
