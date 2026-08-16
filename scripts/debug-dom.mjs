/**
 * Debug DSH web DOM: dump slot markers and clickable text to find the exact
 * navigation path to the 启停管理 tab.
 * Usage: node scripts/debug-dom.mjs
 */
import { spawn } from 'node:child_process'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

const CHROME = process.env.CHROME_PATH || 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe'
const PORT = 9334

function cdp(wsUrl) {
  const ws = new WebSocket(wsUrl)
  let id = 0
  const pending = new Map()
  const events = new Map()
  ws.onmessage = (ev) => {
    const msg = JSON.parse(ev.data)
    if (msg.id && pending.has(msg.id)) {
      const { resolve, reject } = pending.get(msg.id)
      pending.delete(msg.id)
      msg.error ? reject(new Error(msg.error.message)) : resolve(msg.result)
    } else if (msg.method) {
      for (const fn of events.get(msg.method) || []) fn(msg.params)
    }
  }
  const ready = new Promise((resolve, reject) => { ws.onopen = resolve; ws.onerror = reject })
  return {
    ready,
    call(method, params = {}) {
      const callId = ++id
      return new Promise((resolve, reject) => {
        pending.set(callId, { resolve, reject })
        ws.send(JSON.stringify({ id: callId, method, params }))
      })
    },
    close() { ws.close() },
  }
}
const wait = (ms) => new Promise((r) => setTimeout(r, ms))

async function main() {
  const chrome = spawn(CHROME, [
    '--headless=new', '--disable-gpu', '--no-sandbox',
    `--remote-debugging-port=${PORT}`,
    '--user-data-dir=' + join(tmpdir(), 'dsh-debug-profile'),
    '--window-size=1440,900', 'about:blank',
  ], { stdio: 'ignore' })

  let tab
  for (let i = 0; i < 40; i++) {
    try {
      tab = await (await fetch(`http://127.0.0.1:${PORT}/json/new?about:blank`, { method: 'PUT' })).json()
      break
    } catch { await wait(250) }
  }
  if (!tab) throw new Error('no tab')
  const client = cdp(tab.webSocketDebuggerUrl)
  await client.ready
  await client.call('Page.enable')
  await client.call('Runtime.enable')
  await client.call('Page.navigate', { url: 'http://127.0.0.1:3080/' })
  await wait(5000)

  const dump = await client.call('Runtime.evaluate', {
    expression: `(() => {
      // open settings first
      const trig = document.querySelector('[data-slot="settings.trigger"], [data-slot="sidebar.settings"]')
      if (trig) trig.click()
      return 'clicked'
    })()`,
    returnByValue: true,
  })
  await new Promise((r) => setTimeout(r, 1200))
  const dump2 = await client.call('Runtime.evaluate', {
    expression: `(() => {
      const out = { settingsHTML: '', footerHTML: '' }
      const st = document.querySelector('[data-slot="sidebar.settings"]')
      if (st) out.settingsHTML = st.outerHTML.slice(0, 1200)
      const ft = document.querySelector('[data-slot="sidebar.footer.action"]')
      if (ft) out.footerHTML = ft.outerHTML.slice(0, 800)
      return out
    })()`,
    returnByValue: true,
  })
  console.log('=== sidebar.settings HTML ===')
  console.log(dump2.result.value.settingsHTML)
  console.log('=== sidebar.footer.action HTML ===')
  console.log(dump2.result.value.footerHTML)

  client.close()
  chrome.kill()
}
main().catch((e) => { console.error(e); process.exit(1) })
