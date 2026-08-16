// Verify the 启停管理 tab rendered in headless Chrome.
import { spawn } from 'node:child_process'
import { existsSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

const CHROME = process.env.CHROME_PATH || process.env.CHROME_BIN || [
  'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
  'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe',
  'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe',
  '/usr/bin/google-chrome',
  '/usr/bin/chromium',
  '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
].find((p) => { try { return existsSync(p) } catch { return false } })
const PORT = 9336
// DSH web origin to verify (official default; override with $DSH_URL).
const TARGET = process.env.DSH_URL || 'http://127.0.0.1:3080/'

function cdp(wsUrl) {
  const ws = new WebSocket(wsUrl)
  let id = 0
  const pending = new Map()
  ws.onmessage = (ev) => {
    const msg = JSON.parse(ev.data)
    if (msg.id && pending.has(msg.id)) {
      const { resolve, reject } = pending.get(msg.id)
      pending.delete(msg.id)
      msg.error ? reject(new Error(msg.error.message)) : resolve(msg.result)
    }
  }
  const ready = new Promise((res, rej) => { ws.onopen = res; ws.onerror = rej })
  return {
    ready,
    call(method, params = {}) {
      const cid = ++id
      return new Promise((resolve, reject) => {
        pending.set(cid, { resolve, reject })
        ws.send(JSON.stringify({ id: cid, method, params }))
      })
    },
    close() { ws.close() },
  }
}
const wait = (ms) => new Promise((r) => setTimeout(r, ms))

async function click(client, expr) {
  const pos = await client.call('Runtime.evaluate', { expression: expr, returnByValue: true })
  const p = pos.result.value
  if (p && p.ok) {
    await client.call('Input.dispatchMouseEvent', { type: 'mousePressed', x: p.x, y: p.y, button: 'left', clickCount: 1 })
    await client.call('Input.dispatchMouseEvent', { type: 'mouseReleased', x: p.x, y: p.y, button: 'left', clickCount: 1 })
    await wait(1000)
  }
  return p
}

const chrome = spawn(CHROME, [
  '--headless=new', '--disable-gpu', '--no-sandbox',
  `--remote-debugging-port=${PORT}`,
  '--user-data-dir=' + join(tmpdir(), 'dsh-verify-profile'),
  '--window-size=1440,900', 'about:blank',
], { stdio: 'ignore' })

try {
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
  await client.call('Page.navigate', { url: TARGET })
  await wait(5000)

  await click(client, `(() => { const el = document.querySelector('[data-slot="sidebar.settings"] button'); if (!el) return {ok:false}; const r = el.getBoundingClientRect(); return {ok:true,x:r.left+r.width/2,y:r.top+r.height/2} })()`)
  await click(client, `(() => { const n = [...document.querySelectorAll('button,[role="button"],[role="tab"],a,[tabindex]')].find(n=>n.textContent&&n.textContent.trim()==='插件'); if(!n)return{ok:false}; const r=n.getBoundingClientRect(); return {ok:true,x:r.left+r.width/2,y:r.top+r.height/2} })()`)
  await click(client, `(() => { const n = [...document.querySelectorAll('button,[role="button"],[role="tab"],a,[tabindex]')].find(n=>n.textContent&&n.textContent.trim()==='启停管理'); if(!n)return{ok:false}; const r=n.getBoundingClientRect(); return {ok:true,x:r.left+r.width/2,y:r.top+r.height/2} })()`)

  const verify = await client.call('Runtime.evaluate', {
    expression: `(() => ({
      hptClasses: document.querySelectorAll('[class*="hpt-"]').length,
      toggles: [...document.querySelectorAll('button')].filter(b => b.textContent === '停用' || b.textContent === '启用').length,
      coreTags: [...document.querySelectorAll('*')].filter(e => e.textContent === '系统核心').length,
      metaText: (document.body.innerText.match(/\\d+ \\/ \\d+ 个插件/) || ['none'])[0],
    }))()`,
    returnByValue: true,
  })
  console.log('RENDERED:', JSON.stringify(verify.result.value))
  client.close()
} finally {
  chrome.kill()
}
