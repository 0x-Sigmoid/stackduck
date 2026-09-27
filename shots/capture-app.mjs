// Multi-route screenshot pass. Reuses the device-emulation approach from
// capture.mjs (CDP emulation, not --window-size, which fakes mobile overflow).
//
// Usage:
//   node shots/capture-app.mjs <outDir> [--mobile] [--full] [--auth] name=path [name=path ...]
//   --auth  seeds a refresh token into localStorage before app scripts run
//           (the API stub must accept it) so signed-in routes can render.
import puppeteer from 'puppeteer-core'
import { mkdirSync } from 'node:fs'

const args = process.argv.slice(2)
const outDir = args[0]
const mobile = args.includes('--mobile')
const full = args.includes('--full')
const auth = args.includes('--auth')
const routes = args
  .slice(1)
  .filter((a) => !a.startsWith('--'))
  .map((a) => {
    const i = a.indexOf('=')
    return { name: a.slice(0, i), path: a.slice(i + 1) }
  })

const BASE = process.env.BASE ?? 'http://localhost:5173'
const REFRESH = process.env.REFRESH_TOKEN ?? 'stub-refresh-token'

mkdirSync(outDir, { recursive: true })

const viewport = mobile
  ? { width: 390, height: 844, deviceScaleFactor: 2, isMobile: true, hasTouch: true }
  : { width: 1440, height: 900, deviceScaleFactor: 1, isMobile: false, hasTouch: false }

const browser = await puppeteer.launch({
  executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe',
  headless: true,
  args: ['--hide-scrollbars'],
})

const report = []
for (const route of routes) {
  const page = await browser.newPage()
  await page.emulate({
    viewport,
    userAgent: mobile
      ? 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1'
      : undefined,
  })
  page.on('console', (m) => {
    if (m.type() === 'error') report.push(`  console.error on ${route.path}: ${m.text().slice(0, 160)}`)
  })
  if (auth) {
    await page.evaluateOnNewDocument((token) => {
      localStorage.setItem('stackduck:refresh', token)
    }, REFRESH)
  }
  const url = `${BASE}${route.path}`
  try {
    await page.goto(url, { waitUntil: 'networkidle0', timeout: 30000 })
  } catch (e) {
    report.push(`  goto failed for ${route.path}: ${e.message.slice(0, 120)}`)
  }
  await new Promise((r) => setTimeout(r, 1600))
  const file = `${outDir}/${route.name}${mobile ? '-mobile' : ''}.png`
  await page.screenshot({ path: file, fullPage: full })
  // Capture the visible heading so the report shows what actually rendered.
  const heading = await page.evaluate(() => {
    const h = document.querySelector('h1, h2, [role="dialog"] h2')
    return h ? h.textContent?.trim().slice(0, 90) : '(no heading)'
  })
  const overflow = await page.evaluate(() => ({
    w: window.innerWidth,
    scrollW: document.documentElement.scrollWidth,
  }))
  report.push(`  ${route.name}  ${route.path}  -> "${heading}"  (${overflow.w}/${overflow.scrollW})`)
  await page.close()
}

await browser.close()
console.log(`saved ${routes.length} shot(s) to ${outDir}${mobile ? ' [mobile 390x844]' : ' [desktop 1440x900]'}`)
console.log(report.join('\n'))
