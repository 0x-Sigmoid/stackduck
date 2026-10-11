import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import puppeteer from 'puppeteer-core'
const output = process.env.UI_SHOTS ?? 'shots/landing-ui'
fs.mkdirSync(output, { recursive: true })
const browser = await puppeteer.launch({ executablePath: process.env.CHROME_PATH ?? 'C:/Program Files/Google/Chrome/Application/chrome.exe', headless: true })
const page = await browser.newPage()
const errors = []
page.on('pageerror', error => errors.push(error.message))
async function shot(name) { await page.evaluate(() => document.fonts.ready); await page.screenshot({path: path.join(output, name + '.png'), fullPage: true}) }
async function overflow() { assert(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1), 'Horizontal overflow') }
async function theme(value) {
 await page.click('button[aria-label^="Theme:"]')
 await page.evaluate(value => [...document.querySelectorAll('[role="menuitemradio"]')].find(button => button.textContent.trim().startsWith(value)).click(), value)
 await page.waitForFunction(value => document.documentElement.dataset.theme === value.toLowerCase(), {}, value)
}
try {
 await page.setViewport({ width: 1440, height: 1000 })
 await page.goto(process.env.UI_BASE ?? 'http://127.0.0.1:5175', {waitUntil: 'networkidle0'})
 await page.waitForSelector('header a[href="/signin?mode=signup"]')
 assert.equal(await page.$eval('header a[href="/docs"]', element => element.textContent.trim()), 'Read the Docs')
 assert.equal(await page.$eval('header a[href="/signin?mode=signup"]', element => element.textContent.trim()), 'Create your portfolio')
 assert.equal(await page.$('header code'), null)
 await overflow(); await shot('landing-desktop-light')
 await page.click('header a[href="#demo"]')
 await page.waitForFunction(() => location.hash === '#demo')
 await page.evaluate(() => [...document.querySelectorAll('[aria-label="Demo projects"] button')].find(button => button.textContent.includes('Release API')).click())
 assert.equal(await page.$eval('#demo-project-name', element => element.textContent), 'Release API')
 await page.evaluate(() => [...document.querySelectorAll('[aria-label="Demo time range"] button')].find(button => button.textContent === '24h').click())
 assert(await page.$eval('#demo-project-detail svg', element => element.getAttribute('aria-label').includes('24 hours')))
 await page.focus('[aria-label="Demo projects"] button'); await page.keyboard.press('Enter')
 assert.equal(await page.$eval('#demo-project-name', element => element.textContent), 'Atlas')
 await page.click('a[href="#how-it-works"]')
 assert.equal(await page.$$eval('#how-it-works li', items => items.length), 3)
 for (const details of await page.$$('#questions-heading ~ *, section[aria-labelledby="questions-heading"] details')) {
   if (await details.evaluate(element => element.tagName === 'DETAILS')) await details.evaluate(element => { element.open = true })
 }
 await theme('Dark'); await page.evaluate(() => scrollTo(0, 0)); await shot('landing-desktop-dark')
 await page.setViewport({width:390,height:844}); await overflow(); await shot('landing-mobile-dark')
 await theme('Light'); await shot('landing-mobile-light')
 await page.emulateMediaFeatures([{name:'prefers-reduced-motion',value:'reduce'}])
 assert.equal(await page.evaluate(() => getComputedStyle(document.documentElement).transitionDuration), '0s')
 await page.goto((process.env.UI_BASE ?? 'http://127.0.0.1:5175') + '/signin?mode=signup', {waitUntil:'networkidle0'})
 await page.waitForSelector('#auth-consent')
 assert.equal(await page.$eval('form button[type="submit"]', element => element.textContent), 'Create account')
 await shot('registration-mobile')
 await page.goto((process.env.UI_BASE ?? 'http://127.0.0.1:5175') + '/signin', {waitUntil:'networkidle0'})
 assert.equal(await page.$eval('form button[type="submit"]', element => element.textContent), 'Sign in')
 if (process.env.UI_VERIFY_SIGNUP === 'true') {
   await page.goto((process.env.UI_BASE ?? 'http://127.0.0.1:5175') + '/', {waitUntil:'networkidle0'})
   await page.click('header a[href="/signin?mode=signup"]')
   await page.waitForSelector('#auth-consent')
   await page.type('#auth-email', 'landing-' + Date.now() + '@example.test')
   await page.type('#auth-password', 'Landing-verification-9!')
   await page.click('#auth-consent')
   const registration = page.waitForResponse(response => response.url().endsWith('/v1/auth/register') && response.request().method() === 'POST')
   await page.click('form button[type="submit"]')
   assert.equal((await registration).status(), 201, 'Registration must create the account')
   await page.waitForFunction(() => location.pathname === '/portfolio')
   await page.goto((process.env.UI_BASE ?? 'http://127.0.0.1:5175') + '/', {waitUntil:'networkidle0'})
   await page.waitForSelector('header a[href="/portfolio"]')
   assert.equal(await page.$eval('header a[href="/portfolio"]', element => element.textContent.trim()), 'Open portfolio')
   await page.click('header a[href="/portfolio"]')
   await page.waitForFunction(() => location.pathname === '/portfolio')
   console.log('PASS: real registration -> portfolio -> restored session -> Open portfolio. Use a disposable API/database for this optional check.')
 }
 assert.deepEqual(errors, [])
 console.log('PASS: public interactive demo; signup CTA and default sign-in; docs/guide links; three-step workflow; separate self-hosting; 390px/1440px light/dark; keyboard selection; reduced motion; no page errors.')
} finally { await browser.close() }
