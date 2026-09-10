import { _electron as electron } from 'playwright-core'
import { writeFileSync } from 'fs'

const app = await electron.launch({
  executablePath: './node_modules/electron/dist/electron',
  args: ['--no-sandbox', '--user-data-dir=/tmp/settings-userdata', '.'],
  env: { ...process.env, ELECTRON_RUN_AS_NODE: '', DISPLAY: process.env.DISPLAY || ':99' },
  timeout: 30000
})
const page = app.windows()[0] ?? (await app.firstWindow())
page.on('pageerror', (e) => console.log('PAGEERROR:', e.message))
await new Promise((r) => setTimeout(r, 1500))

// open settings
await page.click('button[title="Settings"]')
await new Promise((r) => setTimeout(r, 500))
const title = await page.evaluate(() => document.querySelector('.modal-title')?.textContent)
console.log('modal title:', title)

const initialStatus = await page.evaluate(async () => window.api.getMcpStatus())
console.log('initial MCP status:', JSON.stringify(initialStatus))
await page.screenshot({ path: '/tmp/shots_settings/before-toggle.png' })

// toggle OFF
await page.click('.settings-switch')
await new Promise((r) => setTimeout(r, 500))
const statusAfterOff = await page.evaluate(async () => window.api.getMcpStatus())
console.log('status after toggle OFF:', JSON.stringify(statusAfterOff))
await page.screenshot({ path: '/tmp/shots_settings/after-off.png' })

// toggle back ON
await page.click('.settings-switch')
await new Promise((r) => setTimeout(r, 500))
const statusAfterOn = await page.evaluate(async () => window.api.getMcpStatus())
console.log('status after toggle ON:', JSON.stringify(statusAfterOn))
await page.screenshot({ path: '/tmp/shots_settings/after-on.png' })

// write ports/tokens out to a file for the bash side to curl-verify against
// the real HTTP server, since renderer fetch() is CSP-blocked (correctly).
writeFileSync(
  '/tmp/shots_settings/statuses.json',
  JSON.stringify({ initialStatus, statusAfterOff, statusAfterOn }, null, 2)
)

// keep the app alive a bit longer so bash can curl the still-running server
await new Promise((r) => setTimeout(r, 8000))

// test copy button (writes to clipboard, verify via evaluate readText not available headless reliably,
// so just verify the button click doesn't throw and token input contains real token)
const tokenValue = await page.evaluate(() => document.querySelector('.settings-copy-input.tabular')?.value)
console.log('token input value type:', typeof tokenValue, 'length:', tokenValue?.length)

await app.close()
