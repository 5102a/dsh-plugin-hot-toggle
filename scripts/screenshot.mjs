/**
 * Drive headless Chrome via CDP to open the 启停管理 tab and capture a
 * screenshot. Uses only Node built-ins (fetch + WebSocket).
 *
 * Usage: node scripts/screenshot.mjs <out.png> [--viewport 1440,900]
 */
import { spawn } from 'node:child_process'
import { writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

const CHROME = process.env.CHROME_PATH || 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe'
const TARGET = 'http://127.0.0.1:3080/'
const PORT = 9333

const args = process.argv.slice(2)
const out = args[0] || 'docs/screenshot.png'
const viewport = (args.find((a) => a.startsWith('--viewport=')) || '').split('=')[1] || '1440,900'
const [vw, vh] = viewport.split(',').map(Number)

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
      if (msg.error) reject(new Error(msg.error.message))
      else resolve(msg.result)
    } else if (msg.method) {
      const list = events.get(msg.method)
      if (list) for (const fn of list) fn(msg.params)
    }
  }
  const ready = new Promise((resolve, reject) => {
    ws.onopen = resolve
    ws.onerror = reject
  })
  return {
    ready,
    call(method, params = {}) {
      const callId = ++id
      return new Promise((resolve, reject) => {
        pending.set(callId, { resolve, reject })
        ws.send(JSON.stringify({ id: callId, method, params }))
      })
    },
    on(method, fn) {
      if (!events.has(method)) events.set(method, [])
      events.get(method).push(fn)
    },
    close() { ws.close() },
  }
}

async function wait(ms) { return new Promise((r) => setTimeout(r, ms)) }

async function evalJs(client, expression) {
  const res = await client.call('Runtime.evaluate', {
    expression,
    returnByValue: true,
    awaitPromise: true,
  })
  if (res.exceptionDetails) throw new Error('eval failed: ' + JSON.stringify(res.exceptionDetails))
  return res.result.value
}

/** Click an element whose exact trimmed text matches, scoped to the settings panel when open. */
async function clickByText(client, text) {
  const found = await evalJs(client, `(() => {
    const nodes = [...document.querySelectorAll('button, [role="button"], a, [tabindex], [role="tab"]')]
    const node = nodes.find((n) => n.textContent && n.textContent.trim() === ${JSON.stringify(text)})
    if (!node) return false
    node.click()
    return true
  })()`)
  if (!found) throw new Error('click target not found: ' + text)
  await wait(500)
}

async function main() {
  const chrome = spawn(CHROME, [
    '--headless=new',
    '--disable-gpu',
    '--no-sandbox',
    `--remote-debugging-port=${PORT}`,
    '--user-data-dir=' + join(tmpdir(), 'dsh-shot-profile'),
    `--window-size=${vw},${vh}`,
    'about:blank',
  ], { stdio: 'ignore' })

  let version
  for (let i = 0; i < 40; i++) {
    try {
      version = await (await fetch(`http://127.0.0.1:${PORT}/json/version`)).json()
      break
    } catch { await wait(250) }
  }
  if (!version) throw new Error('chrome debugging endpoint not reachable')

  const tab = await (await fetch(`http://127.0.0.1:${PORT}/json/new?about:blank`, { method: 'PUT' })).json()
  const client = cdp(tab.webSocketDebuggerUrl)
  await client.ready

  await client.call('Page.enable')
  await client.call('Runtime.enable')
  await client.call('Emulation.setDeviceMetricsOverride', {
    width: vw, height: vh, deviceScaleFactor: 1, mobile: false,
  })

  await client.call('Page.navigate', { url: TARGET })
  await wait(5000) // SPA boot

  // 1. Open settings via the sidebar.settings slot — use real mouse events so
  //    React's synthetic event system sees a genuine click.
  const step1 = await evalJs(client, `(() => {
    const el = document.querySelector('[data-slot="sidebar.settings"] button, [data-slot="sidebar.settings"] [role="button"]')
    if (!el) return { ok: false, why: 'no settings button' }
    const r = el.getBoundingClientRect()
    return { ok: true, x: r.left + r.width / 2, y: r.top + r.height / 2 }
  })()`)
  console.log('step1 (open settings):', JSON.stringify(step1))
  if (step1.ok) {
    await client.call('Input.dispatchMouseEvent', { type: 'mousePressed', x: step1.x, y: step1.y, button: 'left', clickCount: 1 })
    await client.call('Input.dispatchMouseEvent', { type: 'mouseReleased', x: step1.x, y: step1.y, button: 'left', clickCount: 1 })
  } else {
    // fallback: try clicking by text with real mouse
    const pos = await evalJs(client, `(() => {
      const nodes = [...document.querySelectorAll('button, [role="button"], a, [tabindex]')]
      const node = nodes.find((n) => n.textContent && n.textContent.trim() === '设置')
      if (!node) return null
      const r = node.getBoundingClientRect()
      return { x: r.left + r.width / 2, y: r.top + r.height / 2 }
    })()`)
    if (pos) {
      await client.call('Input.dispatchMouseEvent', { type: 'mousePressed', x: pos.x, y: pos.y, button: 'left', clickCount: 1 })
      await client.call('Input.dispatchMouseEvent', { type: 'mouseReleased', x: pos.x, y: pos.y, button: 'left', clickCount: 1 })
    }
  }
  await wait(1200)

  // Confirm the settings panel opened: settings.section should now be populated.
  const opened = await evalJs(client, `(() => {
    const sections = [...document.querySelectorAll('[data-slot="settings.section"]')]
    const text = sections.map((s) => (s.textContent || '').trim()).join(' ')
    return { found: sections.length > 0, text: text.slice(0, 200) }
  })()`)
  console.log('settings panel:', JSON.stringify(opened))

  // 2. Click the Plugins section entry in the settings nav (real mouse).
  const step2 = await evalJs(client, `(() => {
    const nodes = [...document.querySelectorAll('button, [role="button"], [role="tab"], a, [tabindex]')]
    const node = nodes.find((n) => n.textContent && n.textContent.trim() === '插件')
    if (!node) return { ok: false, why: 'no 插件 entry' }
    const r = node.getBoundingClientRect()
    return { ok: true, x: r.left + r.width / 2, y: r.top + r.height / 2 }
  })()`)
  console.log('step2 (open plugins):', JSON.stringify(step2))
  if (step2.ok) {
    await client.call('Input.dispatchMouseEvent', { type: 'mousePressed', x: step2.x, y: step2.y, button: 'left', clickCount: 1 })
    await client.call('Input.dispatchMouseEvent', { type: 'mouseReleased', x: step2.x, y: step2.y, button: 'left', clickCount: 1 })
  }
  await wait(1000)

  // 3. Click the 启停管理 tab (real mouse).
  const step3 = await evalJs(client, `(() => {
    const nodes = [...document.querySelectorAll('button, [role="button"], [role="tab"], a, [tabindex]')]
    const node = nodes.find((n) => n.textContent && n.textContent.trim() === '启停管理')
    if (!node) return { ok: false, why: 'no 启停管理 tab' }
    const r = node.getBoundingClientRect()
    return { ok: true, x: r.left + r.width / 2, y: r.top + r.height / 2 }
  })()`)
  console.log('step3 (open 启停管理):', JSON.stringify(step3))
  if (step3.ok) {
    await client.call('Input.dispatchMouseEvent', { type: 'mousePressed', x: step3.x, y: step3.y, button: 'left', clickCount: 1 })
    await client.call('Input.dispatchMouseEvent', { type: 'mouseReleased', x: step3.x, y: step3.y, button: 'left', clickCount: 1 })
  }
  await wait(1500)

  // Verify the tab content rendered.
  const verified = await evalJs(client, `(() => {
    const text = document.body ? document.body.innerText : ''
    return {
      hasPower: text.includes('已启用') && text.includes('已停用'),
      hasSource: text.includes('非官方'),
      hasSort: text.includes('最近安装优先'),
      hasCount: text.includes('个插件'),
    }
  })()`)
  console.log('page verification:', JSON.stringify(verified))

  const shot = await client.call('Page.captureScreenshot', { format: 'png', fromSurface: true })
  writeFileSync(out, Buffer.from(shot.data, 'base64'))
  console.log('screenshot written:', out)

  client.close()
  chrome.kill()
}

main().catch((e) => { console.error(e); process.exit(1) })
