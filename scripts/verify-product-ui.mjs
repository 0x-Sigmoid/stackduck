import fs from 'node:fs'
import path from 'node:path'
import crypto from 'node:crypto'
import assert from 'node:assert/strict'
import puppeteer from 'puppeteer-core'

assert.equal(process.env.UI_DISPOSABLE_API, 'true', 'Run only against a disposable test API; set UI_DISPOSABLE_API=true.')
const apiBase = process.env.UI_API_BASE ?? 'http://127.0.0.1:3001'
const uiBase = process.env.UI_BASE ?? 'http://127.0.0.1:5173'
const output = process.env.UI_SHOTS ?? 'shots/product-ui'
fs.mkdirSync(output, { recursive: true })
let token
async function request(route, method = 'GET', payload) {
  const response = await fetch(apiBase + route, { method, headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: 'Bearer ' + token } : {}) }, ...(payload === undefined ? {} : { body: JSON.stringify(payload) }) })
  const body = await response.json()
  assert(response.ok, method + ' ' + route + ': ' + response.status + ' ' + JSON.stringify(body))
  return body
}
const user = await request('/v1/auth/register', 'POST', { email: 'ui-' + crypto.randomUUID() + '@example.com', password: crypto.randomBytes(16).toString('hex'), consent: true, displayName: 'Taylor' })
token = user.accessToken
const projects = []
for (const [name, environment, stackTags] of [
  ['Atlas', 'production', ['Next.js', 'Supabase']],
  ['Storefront', 'production', ['Stripe', 'React']],
  ['Release pipeline', 'production', ['GitHub Actions']],
  ['Sandbox', 'development', ['Webhook']],
  ['Research notebook', 'development', ['Python']],
  ['Community', 'production', ['Firebase']],
]) {
  projects.push((await request('/v1/projects', 'POST', { name, environment, stackTags, description: name === 'Atlas' ? 'Health and growth across your core product.' : undefined })).project)
}
async function connect(project) {
  return request('/v1/projects/' + project.id + '/connectors/generic-webhook', 'POST', {})
}
async function ingest(connector, events, invalid = false) {
  const body = JSON.stringify(events)
  const timestamp = String(Math.floor(Date.now() / 1000))
  const signature = crypto.createHmac('sha256', connector.signingSecret).update(timestamp + '.' + body).digest('hex')
  const response = await fetch(apiBase + '/v1/ingest/' + connector.connector.id, { method: 'POST', body, headers: { 'Content-Type': 'application/json', 'X-Stackduck-Timestamp': timestamp, 'X-Stackduck-Signature': invalid ? '0'.repeat(64) : signature } })
  assert.equal(response.status, invalid ? 401 : 202)
}
for (const index of [0, 1, 2, 3, 5]) {
  const connector = await connect(projects[index])
  if (index === 3) continue
  const events = []
  for (let sample = 0; sample < 28; sample++) {
    const timestamp = new Date(Date.now() - (27 - sample) * 6 * 3600000 - 60000).toISOString()
    events.push({ metricType: 'user_metrics', key: 'active_users', value: 2400 + sample * 43 + Math.round(Math.sin(sample) * 70), timestamp, aggregation: 'last' })
    events.push({ metricType: 'revenue_metrics', key: 'mrr', value: 12850 + sample * 120, timestamp, aggregation: 'last', metadata: { currency: 'usd' } })
    events.push({ metricType: 'error_metrics', key: 'error_count', value: 5 + Math.round(Math.abs(Math.sin(sample)) * 9), timestamp })
  }
  await ingest(connector, events)
  if (index === 2) await ingest(connector, [events[0]], true)
}
await request('/v1/projects/' + projects[0].id + '/alerts', 'POST', { metricType: 'error_metrics', key: 'error_count', condition: 'above', threshold: 100000, windowMinutes: 15, channel: 'email', channelTarget: 'ui@example.com' })
const discovered = await request('/v1/projects/' + projects[0].id + '/metrics/metric-keys')
assert.equal(discovered.keys.find(key => key.key === 'mrr').currency, 'usd')
const browser = await puppeteer.launch({ executablePath: process.env.CHROME_PATH ?? 'C:/Program Files/Google/Chrome/Application/chrome.exe', headless: true })
const page = await browser.newPage()
const errors = []
page.on('pageerror', error => errors.push(error.message))
await page.evaluateOnNewDocument(refresh => {
  if (!localStorage.getItem('stackduck:refresh')) localStorage.setItem('stackduck:refresh', refresh)
  localStorage.setItem('stackduck-theme', 'light')
}, user.refreshToken)
async function go(route) {
  await page.goto(uiBase + route, { waitUntil: 'networkidle0' })
}
async function screenshot(name) {
  await page.evaluate(() => document.fonts.ready)
  await page.screenshot({ path: path.join(output, name + '.png'), fullPage: true })
}
async function overflow() {
  await page.waitForFunction(() => document.documentElement.scrollWidth <= innerWidth + 1)
  assert(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1), 'Horizontal viewport overflow')
}
async function theme(value) {
  await page.click('button[aria-label^="Theme:"]')
  await page.evaluate(value => [...document.querySelectorAll('[role="menuitemradio"]')].find(button => button.textContent.trim().startsWith(value))?.click(), value)
  await page.waitForFunction(value => document.documentElement.dataset.theme === value.toLowerCase(), {}, value)
}
try {
  await page.setViewport({ width: 1440, height: 1000, deviceScaleFactor: 1 })
  await go('/portfolio')
  await page.waitForSelector('.project-card')
  assert.equal(await page.$$eval('.project-card', cards => new Set(cards.map(card => Math.round(card.getBoundingClientRect().height))).size), 1)
  await overflow(); await screenshot('portfolio-desktop-light')
  await page.focus('button[aria-label="Actions for Atlas"]')
  await page.keyboard.press('ArrowDown')
  await page.waitForSelector('[role="menuitem"]')
  assert(await page.evaluate(() => document.activeElement.getAttribute('role') === 'menuitem'))
  await page.keyboard.press('Escape')
  assert(await page.evaluate(() => document.activeElement.getAttribute('aria-label') === 'Actions for Atlas'))
  await theme('Dark'); await screenshot('portfolio-desktop-dark')
  await page.setViewport({ width: 390, height: 844, deviceScaleFactor: 1 })
  await overflow(); await screenshot('portfolio-mobile-dark')
  await theme('Light'); await screenshot('portfolio-mobile-light')
  await page.setViewport({ width: 1440, height: 1000, deviceScaleFactor: 1 })
  await go('/projects/' + projects[0].id)
  await page.waitForSelector('.chart-panel svg')
  assert(await page.evaluate(() => document.querySelector('#tab-overview').getAttribute('aria-selected') === 'true'))
  assert(await page.evaluate(() => document.querySelector('#panel-sources').hidden))
  assert(await page.evaluate(() => document.querySelector('#panel-overview').textContent.includes('$16,090.00')))
  await overflow(); await screenshot('overview-desktop-light')
  await page.focus('#tab-overview'); await page.keyboard.press('ArrowRight')
  await page.waitForFunction(() => !document.querySelector('#panel-sources').hidden)
  assert(await page.evaluate(() => document.activeElement.id === 'tab-sources'))
  await page.keyboard.press('End')
  await page.waitForFunction(() => !document.querySelector('#panel-details').hidden)
  await page.click('#tab-alerts')
  await page.waitForSelector('#panel-alerts button')
  await overflow(); await screenshot('alerts-desktop-light')
  await page.click('#tab-overview')
  await page.waitForSelector('.chart-panel svg')
  await theme('Dark'); await screenshot('overview-desktop-dark')
  await page.setViewport({ width: 390, height: 844, deviceScaleFactor: 1 })
  await overflow(); await screenshot('overview-mobile-dark')
  await theme('Light'); await screenshot('overview-mobile-light')
  for (const tab of ['sources', 'alerts', 'details']) {
    await page.click('#tab-' + tab); await overflow(); await screenshot(tab + '-mobile-light')
  }
  await page.focus('button[aria-label="Project actions"]')
  await page.keyboard.press('ArrowDown'); await page.keyboard.press('End'); await page.keyboard.press('Enter')
  await page.waitForSelector('[role="dialog"]')
  assert(await page.evaluate(() => document.activeElement.tagName === 'INPUT'))
  await page.keyboard.press('Tab'); await page.keyboard.press('Tab')
  assert(await page.evaluate(() => document.querySelector('[role="dialog"]').contains(document.activeElement)))
  await page.keyboard.press('Escape')
  assert(await page.evaluate(() => !document.querySelector('[role="dialog"]')))
  assert(await page.evaluate(() => document.activeElement.getAttribute('aria-label') === 'Project actions'))
  await page.click('#tab-alerts')
  await page.evaluate(() => [...document.querySelectorAll('#panel-alerts button')].find(button => button.textContent === 'Edit').click())
  await page.focus('#panel-alerts form input[type="number"]')
  await page.keyboard.down('Control'); await page.keyboard.press('KeyA'); await page.keyboard.up('Control'); await page.keyboard.type('100001')
  const savedRule = page.waitForResponse(response => response.url().includes('/alerts/') && response.request().method() === 'PATCH')
  await page.evaluate(() => [...document.querySelectorAll('#panel-alerts form button')].find(button => button.textContent === 'Save changes').click())
  assert((await savedRule).ok())
  assert.equal((await request('/v1/projects/' + projects[0].id + '/alerts')).rules[0].threshold, 100001)
  await page.click('#tab-details')
  await page.evaluate(() => [...document.querySelectorAll('#panel-details dt')].find(label => label.textContent === 'Description').parentElement.querySelector('button').click())
  await page.focus('#panel-details textarea'); await page.keyboard.down('Control'); await page.keyboard.press('KeyA'); await page.keyboard.up('Control'); await page.keyboard.type('Verified monitoring overview.')
  const savedDetails = page.waitForResponse(response => response.url().endsWith('/projects/' + projects[0].id) && response.request().method() === 'PATCH')
  await page.evaluate(() => document.querySelector('#panel-details textarea').closest('dd').querySelector('button').click())
  assert((await savedDetails).ok())
  assert.equal((await request('/v1/projects/' + projects[0].id)).project.description, 'Verified monitoring overview.')
  await go('/projects/' + projects[3].id)
  assert(await page.evaluate(() => document.querySelector('#panel-overview').textContent.includes('Waiting for first sync')))
  await screenshot('waiting-first-sync')
  await go('/projects/' + projects[4].id)
  assert(await page.evaluate(() => document.querySelector('#panel-overview').textContent.includes('Start monitoring this project')))
  await screenshot('unconnected')
  await page.evaluate(() => [...document.querySelectorAll('#panel-overview button')].find(button => button.textContent.includes('Manage data sources')).click())
  await page.evaluate(() => [...document.querySelectorAll('#panel-sources button')].find(button => button.textContent.includes('Generic Webhook')).click())
  const connected = page.waitForResponse(response => response.url().includes('/connectors/generic-webhook') && response.request().method() === 'POST')
  await page.evaluate(() => [...document.querySelectorAll('#panel-sources button')].find(button => button.textContent.includes('Generate URL + secret')).click())
  const connector = await (await connected).json()
  assert.equal((await request('/v1/projects/' + projects[4].id + '/connectors')).connectors.length, 1)
  await ingest(connector, [{ metricType: 'custom', key: 'latency_ms', value: 120, timestamp: new Date(Date.now() - 14 * 86400000).toISOString() }])
  await page.click('#tab-overview')
  await page.waitForSelector('button[aria-label="Refresh project"]', { visible: true })
  await page.click('button[aria-label="Refresh project"]')
  await page.waitForFunction(() => document.querySelector('#panel-overview').textContent.includes('No data in this range'))
  await screenshot('no-data-in-range')
  await page.evaluate(() => [...document.querySelectorAll('.segmented-control button')].find(button => button.textContent === '30d').click())
  await page.waitForSelector('.chart-panel svg')

  let failChart = true
  await page.setRequestInterception(true)
  page.on('request', request => {
    if (request.url().includes('/metrics?') && failChart) request.respond({ status: 503, contentType: 'application/json', body: '{"error":{"code":"unavailable","message":"Deliberate verification failure"}}' })
    else request.continue()
  })
  await go('/projects/' + projects[0].id)
  await page.waitForSelector('.chart-empty [role="alert"], .chart-empty[role="alert"]')
  await screenshot('chart-failure')
  failChart = false
  await page.evaluate(() => [...document.querySelectorAll('button')].filter(button => button.textContent === 'Retry chart').forEach(button => button.click()))
  await page.waitForSelector('.chart-panel svg')
  await page.emulateMediaFeatures([{ name: 'prefers-reduced-motion', value: 'reduce' }])
  assert(await page.evaluate(() => matchMedia('(prefers-reduced-motion: reduce)').matches))
  await page.click('#tab-sources')
  await page.click('button[aria-label^="Theme:"]'); await page.keyboard.press('End'); await page.keyboard.press('Escape')
  await page.click('button[aria-label^="Account menu"]'); await page.keyboard.press('End'); await page.keyboard.press('Escape')
  assert.deepEqual(errors, [])
  console.log('PASS: live signed ingestion → API currency/metrics → portfolio and monitoring UI; equal card heights; 390px/1440px light/dark; tabs; keyboard menus; removal focus trap/restore; waiting/unconnected; failed chart retry; source connection; alert and metadata saves; empty-range recovery; reduced motion; no page errors.')
} finally {
  await browser.close()
}
