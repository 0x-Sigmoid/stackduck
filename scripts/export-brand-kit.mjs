import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import assert from 'node:assert/strict'
import puppeteer from 'puppeteer-core'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const out = path.join(root, 'output', 'brand-kit')
fs.mkdirSync(out, { recursive: true })
const read = file => fs.readFileSync(path.join(root, file))
const data = (buffer, type) => `data:${type};base64,${buffer.toString('base64')}`
const mark = data(read('public/logo.svg'), 'image/svg+xml')
const font = data(read('node_modules/@fontsource/open-runde/files/open-runde-latin-600-normal.woff2'), 'font/woff2')
const fontRegular = data(read('node_modules/@fontsource/open-runde/files/open-runde-latin-400-normal.woff2'), 'font/woff2')
const assets = []
const palette = { navy: '#151b31', paper: '#f2f2f2', mint: '#A8DCC4', amber: '#F5BA67' }
const css = `
@font-face{font-family:Runde;src:url('${font}');font-weight:600}
@font-face{font-family:Runde;src:url('${fontRegular}');font-weight:400}
*{box-sizing:border-box}html,body{margin:0;width:100%;height:100%}
body{font-family:Runde,sans-serif;color:#151b31;background:transparent}
.canvas{position:relative;overflow:hidden;width:100vw;height:100vh;background:#f2f2f2}
.dark{background:#151b31;color:#f2f2f2}.brand{display:flex;align-items:center;gap:16px;font-weight:600;letter-spacing:-1px}
.brand img{flex-shrink:0}.eyebrow{font-size:17px;font-weight:600;letter-spacing:2px;text-transform:uppercase}
h1{margin:0;font-weight:600;line-height:1.06;letter-spacing:-3px}p{margin:0;line-height:1.45}
.muted{color:#667085}.dark .muted{color:#b1bbcc}.rule{height:1px;background:#d5d9df}.dark .rule{background:#35405a}
.pill{display:inline-flex;align-items:center;gap:10px;padding:10px 16px;border:1px solid #d3d9d9;border-radius:99px;font-size:17px}
.pill:before{content:'';width:8px;height:8px;background:#5d9f83;border-radius:50%}
.dark .pill{border-color:#44534f}.dark .pill:before{background:#A8DCC4}
.card{border:1px solid #dce1e3;border-radius:22px;background:white;overflow:hidden;color:#151b31;box-shadow:0 18px 70px #151b310c}
.card-head{padding:24px 28px;display:flex;align-items:center;justify-content:space-between;background:#fafbfa;border-bottom:1px solid #e4e7e9}
.card-row{display:flex;align-items:center;gap:18px;padding:26px 28px;border-bottom:1px solid #e4e7e9}
.card-row:last-child{border-bottom:0}.source{display:grid;place-items:center;width:52px;height:52px;border:1px solid #e4e7e9;border-radius:12px;background:white;flex-shrink:0}.source img{width:30px;height:30px}
.status{margin-left:auto;display:flex;align-items:center;gap:8px;font-size:15px;white-space:nowrap}.dot{width:8px;height:8px;border-radius:50%;background:#459d78}.attention .dot{background:#d99c37}
.row-name{font-size:19px;font-weight:600}.row-info{font-size:14px;color:#667085;margin-top:5px}.sample{font-size:13px;color:#667085}
.footer{position:absolute;font-size:16px;color:#667085}.dark .footer{color:#b1bbcc}
`
const brand = (size = 52) => `<div class="brand" style="font-size:${size * .65}px"><img src="${mark}" width="${size}" height="${size}" alt="">Stackduck</div>`
const heroMark = (size, x, y) => `<img src="${mark}" width="${size}" height="${size}" style="position:absolute;left:${x}px;top:${y}px" alt="">`
const source = name => data(read(`public/integrations/${name}.svg`), 'image/svg+xml')
const demo = () => `<div class="card"><div class="card-head"><strong style="font-size:19px">Portfolio overview</strong><span class="sample">Example data</span></div>${[
  ['vercel', 'Northstar', 'Deployment ready', 'Healthy'],
  ['stripe', 'Launchpad', '$2,480 revenue', 'Healthy'],
  ['sentry', 'Relay API', '12 recent errors', 'Attention'],
].map(([icon, name, metric, status]) => `<div class="card-row"><div class="source"><img src="${source(icon)}" alt=""></div><div><p class="row-name">${name}</p><p class="row-info">${metric}</p></div><span class="status ${status === 'Attention' ? 'attention' : ''}"><i class="dot"></i>${status}</span></div>`).join('')}</div>`
const doc = content => `<!doctype html><html lang="en"><meta charset="utf-8"><title>Stackduck brand asset</title><style>${css}</style><body>${content}</body></html>`
const browser = await puppeteer.launch({ executablePath: process.env.CHROME_PATH ?? 'C:/Program Files/Google/Chrome/Application/chrome.exe', headless: true })
const page = await browser.newPage()

async function exportAsset(name, width, height, content, usage, transparent = false) {
  await page.setViewport({ width, height, deviceScaleFactor: 1 })
  const html = doc(content)
  fs.writeFileSync(path.join(out, `${name}.html`), html)
  await page.setContent(html, { waitUntil: 'load' })
  await page.evaluate(() => document.fonts.ready)
  assert(await page.evaluate(() => [...document.images].every(image => image.complete && image.naturalWidth > 0)), `Images loaded: ${name}`)
  await page.screenshot({ path: path.join(out, `${name}.png`), omitBackground: transparent })
  const png = fs.readFileSync(path.join(out, `${name}.png`))
  assert.equal(png.readUInt32BE(16), width)
  assert.equal(png.readUInt32BE(20), height)
  assets.push({ name, width, height, usage, transparent, bytes: png.length })
  console.log(`${name}: ${width} x ${height}`)
}

try {
  for (const size of [256, 512, 1024, 2048]) await exportAsset(`logo-${size}`, size, size, `<img src="${mark}" width="${size}" height="${size}" alt="Stackduck">`, 'App mark; transparent corners.', true)
  for (const dark of [false, true]) await exportAsset(`wordmark-${dark ? 'on-dark' : 'on-light'}`, 1600, 400,
    `<div style="display:flex;align-items:center;justify-content:center;height:400px;color:${dark ? palette.paper : palette.navy}">${brand(240)}</div>`, `Transparent lockup for ${dark ? 'dark' : 'light'} backgrounds.`, true)
  for (const size of [400, 1024]) await exportAsset(`profile-${size}`, size, size,
    `<div class="canvas dark" style="display:grid;place-items:center"><img src="${mark}" width="${size * .7}" height="${size * .7}" alt="Stackduck"></div>`, 'Profile avatar with room for circular cropping.')

  for (const dark of [false, true]) await exportAsset(`x-cover-${dark ? 'dark' : 'light'}`, 1500, 500,
    `<div class="canvas ${dark ? 'dark' : ''}"><div style="position:absolute;left:340px;top:68px">${brand(52)}<h1 style="font-size:58px;margin-top:38px">Your whole stack.<br>One clear view.</h1><p class="muted" style="font-size:22px;margin-top:20px">Health, usage, errors, and revenue.</p></div>${heroMark(230, 1120, 132)}<div style="position:absolute;left:340px;bottom:47px" class="pill">Less switching. More building.</div></div>`, 'X header; copy avoids the lower-left profile overlap.')
  await exportAsset('linkedin-cover', 1584, 396,
    `<div class="canvas"><div style="position:absolute;left:380px;top:65px">${brand(46)}<h1 style="font-size:51px;margin-top:26px">Your whole stack. One clear view.</h1><p class="muted" style="font-size:21px;margin-top:18px">Project health, usage, errors, and revenue — together.</p></div>${heroMark(165, 1305, 100)}</div>`, 'LinkedIn personal background; 1584 x 396. Company pages use a different crop.')
  await exportAsset('facebook-cover', 1640, 624,
    `<div class="canvas"><div style="position:absolute;left:300px;top:100px">${brand(64)}<h1 style="font-size:67px;margin-top:44px">Less switching.<br>More building.</h1><p class="muted" style="font-size:25px;margin-top:28px">Your project portfolio, in one calm place.</p></div>${heroMark(260, 1120, 175)}</div>`, 'Facebook cover canvas; preview platform cropping before applying.')
  await exportAsset('youtube-cover', 2560, 1440,
    `<div class="canvas dark"><div style="position:absolute;width:1450px;height:340px;left:555px;top:550px;display:flex;align-items:center;gap:80px"><img src="${mark}" width="245" height="245" alt=""><div>${brand(50)}<h1 style="font-size:70px;margin-top:25px">Your whole stack.<br>One clear view.</h1><p class="muted" style="font-size:26px;margin-top:22px">Less switching. More building.</p></div></div><div style="position:absolute;left:280px;top:1060px;width:2000px;height:2px;background:#33413d"></div><div style="position:absolute;left:800px;top:1240px;width:960px;height:8px;border-radius:4px;background:#A8DCC4;opacity:.4"></div></div>`, 'YouTube channel banner. Essential content stays inside the centered 1546 x 423 safe area.')

  for (const [name, width, height, dark] of [['social-preview', 1200, 630, false], ['launch-landscape', 1600, 900, true], ['press-cover', 1600, 900, false]]) {
    const scale = width / 1200
    await exportAsset(name, width, height,
      `<div class="canvas ${dark ? 'dark' : ''}"><div style="position:absolute;inset:0;transform:scale(${scale});transform-origin:top left;width:1200px;height:${height / scale}px"><div style="position:absolute;left:70px;top:65px">${brand(52)}</div><div style="position:absolute;left:70px;top:198px;width:450px"><p class="eyebrow muted">Built for your portfolio</p><h1 style="font-size:65px;margin-top:22px">Less switching.<br>More building.</h1><p class="muted" style="font-size:22px;margin-top:28px;max-width:410px">Health, usage, errors, and revenue.<br>One clear view of your stack.</p></div><div style="position:absolute;left:590px;top:195px;width:540px">${demo()}</div><div class="footer" style="left:70px;bottom:48px">Designed and built by 0xSigmoid</div><div class="footer" style="right:70px;bottom:48px">stackduck.app</div></div></div>`, name === 'social-preview' ? 'Link preview / Open Graph; sample portfolio illustration.' : 'Launch post / press artwork; sample portfolio illustration.')
  }
  await exportAsset('launch-square', 1080, 1080,
    `<div class="canvas"><div style="position:absolute;left:80px;top:76px">${brand(64)}</div><div style="position:absolute;left:80px;top:210px"><h1 style="font-size:86px">Your whole stack.<br>One clear view.</h1><p class="muted" style="font-size:26px;margin-top:30px">Less switching. More building.</p></div><div style="position:absolute;left:80px;top:510px;width:920px">${demo()}</div><div class="footer" style="left:80px;bottom:65px;font-size:20px">Designed and built by 0xSigmoid</div><div class="footer" style="right:80px;bottom:65px;font-size:24px;font-weight:600;color:#151b31">stackduck.app</div></div>`, 'Square feed post for Instagram, LinkedIn, X, or community announcements.')
  await exportAsset('launch-portrait', 1080, 1350,
    `<div class="canvas dark"><div style="position:absolute;left:80px;top:90px">${brand(70)}</div><div style="position:absolute;left:80px;top:290px"><p class="eyebrow muted">Meet Stackduck</p><h1 style="font-size:92px;margin-top:28px">Less switching.<br>More building.</h1><p class="muted" style="font-size:28px;margin-top:38px">Keep your project portfolio in view.</p></div><div style="position:absolute;left:80px;top:680px;width:920px">${demo()}</div><div class="footer" style="left:80px;bottom:95px;font-size:22px">Health · Usage · Errors · Revenue</div><div class="footer" style="right:80px;bottom:95px;font-size:26px;font-weight:600;color:#f2f2f2">stackduck.app</div></div>`, 'Portrait 4:5 feed post.')
  await exportAsset('launch-story', 1080, 1920,
    `<div class="canvas"><div style="position:absolute;left:90px;top:270px">${brand(76)}</div><div style="position:absolute;left:90px;top:465px"><p class="eyebrow muted">One calm place for your projects</p><h1 style="font-size:92px;margin-top:38px">Your whole stack.<br>One clear view.</h1><p class="muted" style="font-size:29px;margin-top:42px">Health, usage, errors, and revenue.<br>Less switching. More building.</p></div><div style="position:absolute;left:90px;top:930px;width:900px">${demo()}</div><div style="position:absolute;left:90px;top:1495px" class="pill">Explore Stackduck</div><p class="footer" style="left:90px;top:1580px;font-size:22px">stackduck.app</p></div>`, '9:16 story / vertical promotion; key content avoids top and bottom UI bands.')

  fs.writeFileSync(path.join(out, 'manifest.json'), JSON.stringify({ brand: 'Stackduck', palette, assets }, null, 2))
  fs.copyFileSync(path.join(root, 'public/logo.svg'), path.join(out, 'logo.svg'))
  fs.copyFileSync(path.join(root, 'public/integrations/LICENSE.md'), path.join(out, 'integration-marks-CC0.md'))
  fs.copyFileSync(path.join(root, 'public/integrations/README.md'), path.join(out, 'integration-marks-sources.md'))
  fs.copyFileSync(path.join(root, 'node_modules/@fontsource/open-runde/LICENSE'), path.join(out, 'font-license.txt'))
  const gallery = `<!doctype html><html lang="en"><meta charset="utf-8"><title>Stackduck promotional kit</title><style>body{font:16px system-ui;background:#e9eceb;color:#151b31;margin:40px}h1{font-size:36px}section{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:24px}article{background:white;padding:18px;border-radius:16px}img{width:100%;height:230px;object-fit:contain;background:repeating-conic-gradient(#e1e4e4 0% 25%,#f4f5f5 0% 50%) 50%/20px 20px}a{color:#151b31}p{font-size:13px;color:#667085}</style><h1>Stackduck / promotional kit</h1><p>Logo exports, platform covers, and launch artwork. PNG + editable HTML sources.</p><section>${assets.map(asset => `<article><a href="${asset.name}.png"><img src="${data(fs.readFileSync(path.join(out, asset.name + '.png')), 'image/png')}" alt="${asset.name}" style="${asset.name === 'wordmark-on-dark' ? 'background:#151b31' : ''}"></a><h3>${asset.name}</h3><p>${asset.width} × ${asset.height} · ${asset.transparent ? 'Transparent' : 'Opaque'}</p><p>${asset.usage}</p><a href="${asset.name}.html">Editable source</a></article>`).join('')}</section></html>`
  fs.writeFileSync(path.join(out, 'index.html'), gallery)
  await page.setViewport({ width: 1600, height: 1000, deviceScaleFactor: 1 })
  await page.setContent(gallery, { waitUntil: 'load' })
  await page.screenshot({ path: path.join(out, 'kit-preview.png'), fullPage: true })
  fs.writeFileSync(path.join(out, 'README.md'), `# Stackduck promotional kit\n\nOpen index.html to browse all exports. Every PNG has an editable, self-contained HTML source with embedded fonts and artwork. Rebuild from the repository with: node scripts/export-brand-kit.mjs\n\n## Assets\n\n| File | Dimensions | Use |\n| --- | --- | --- |\n${assets.map(a => `| ${a.name}.png | ${a.width} × ${a.height} | ${a.usage} |`).join('\n')}\n\n## Brand\n\nUse logo-1024.png for most app and product placements; logo-2048.png is the largest export. The navy tile has transparent rounded corners. Use profile-400.png for X, or profile-1024.png as a reusable profile master. Wordmark PNGs are transparent; choose on-light or on-dark to match the destination background. Keep the mark proportions intact and leave space around it.\n\nNavy: #151b31. Paper: #f2f2f2. Mint: #A8DCC4. Amber: #F5BA67. Typeface: Open Runde (license included).\n\nAll illustrated portfolio values are explicitly labeled example data. Copy intentionally makes no pricing, availability, performance, or real-time guarantees. These assets were created locally and have not been published or uploaded.\n\n## Platform references\n\n- X recommends 1500 × 500 headers and 400 × 400 profile photos: https://help.x.com/en/managing-your-account/common-issues-when-uploading-profile-photo\n- LinkedIn personal background guidance (1584 × 396): https://nonprofit.linkedin.com/blog/2022/04/one-way-to-improve-your-linkedin-profile-as-a-nonprofit-pro\n- YouTube recommends 2560 × 1440: https://support.google.com/youtube/answer/12950272?hl=en ; safe-area guidance: https://support.google.com/youtube/answer/10456525?hl=en-GB\n- Facebook and generic feed/story canvases are supplied as reusable layouts; inspect each platform's upload preview for current cropping. A LinkedIn personal cover is not a company-page cover.\n\nYouTube essential artwork fits the centered 1546 × 423 band. Headers keep text away from the lower-left avatar area. Story copy is inset away from top and bottom overlays. Platform previews can still crop differently on different devices.\n\n## Suggested launch copy\n\nMeet Stackduck: one clear view of your project health, usage, errors, and revenue. Connect your existing stack and spend less time touring admin panels. Explore Stackduck: https://stackduck.app · Source: https://github.com/0x-Sigmoid/stackduck\n\nShort bio: One calm place for your project portfolio. Health, usage, errors, and revenue — together. Built by 0xSigmoid.\n\nDeveloper: https://x.com/0x_Sigmoid · https://t.me/xSigmoid · talk2sigmoid@gmail.com\n`)
} finally {
  await browser.close()
}
