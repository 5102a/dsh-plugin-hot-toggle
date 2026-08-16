/**
 * dsh-plugin-hot-toggle — host half.
 *
 * Hot-toggle any installed plugin from the Web settings page: stop or start a
 * Cordis Loader entry in-process (no DSH restart) and persist the change to
 * the profile patch layer ($DSH_HOME/profiles/<profile>/cordis.patch.yml),
 * which the official HMR watcher applies hot on save.
 *
 * Pure plugin: only public seams (`loader`, `webServer`, `dshHomePath`), zero
 * DSH core changes. The webServer seam is injected dynamically so the plugin
 * loads harmlessly on surfaces without it (e.g. the TUI/headless).
 *
 * API (same-origin JSON over the webServer carrier):
 *   GET  /plugin-hot-toggle/api/list         -> { entries: [...] }
 *   POST /plugin-hot-toggle/api/setEnabled   { entryId, enabled } -> result
 * @module dsh-plugin-hot-toggle
 */

import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'
import { readFileSync, readdirSync, writeFileSync } from 'node:fs'

export const name = 'dsh-plugin-hot-toggle'

/** Hard dependency: the Cordis Loader service (root, every surface has it). */
export const inject = ['loader']

/** Fiber state number -> readable phase (mirrors @deepseek-ai/cordis FiberState). */
const PHASE = { 0: 'pending', 1: 'loading', 2: 'active', 3: 'failed', 4: null, 5: 'unloading' }

/**
 * System-core entries that must never be toggled: disabling them would tear
 * down the loader tree, HMR, timers, the dynamic-plugin host, or the web
 * carrier itself.
 */
const CORE_NAMES = [
  'cordis:include',
  'cordis:group',
  '@deepseek-ai/cordis-plugin-loader',
  '@deepseek-ai/cordis-plugin-include',
  '@deepseek-ai/cordis-plugin-hmr',
  '@deepseek-ai/cordis-plugin-group',
  '@deepseek-ai/cordis-plugin-timer',
  '@deepseek-ai/dsh-cordis-host-runner',
  '@deepseek-ai/dsh-cordis-client-runner',
]

function isProtected(entry) {
  if (entry.id === 'include') return true
  const moduleName = String(entry.options.name || '')
  return CORE_NAMES.includes(moduleName)
}

/** Fine-grained type classification from the module specifier. */
function classifyType(raw) {
  const short = raw.indexOf('@deepseek-ai/') === 0 ? raw.slice('@deepseek-ai/'.length) : raw
  if (raw.indexOf('cordis:') === 0 || /^cordis-plugin-/.test(short)) return 'builtin'
  if (/^(dsh-client-|dsh-client-web|dsh-web)/.test(short)) return 'client'
  if (/^dsh-llm/.test(short)) return 'llm'
  if (/^dsh-tool-/.test(short)) return 'tool'
  if (/^(dsh-session|dsh-storage|dsh-spill|dsh-attachment|dsh-message)/.test(short)) return 'session'
  if (/^(dsh-sandbox|dsh-bash|dsh-pwsh|dsh-shell|dsh-subprocess|dsh-terminal|dsh-code-runtime|dsh-fs)/.test(short)) return 'sandbox'
  if (/^(dsh-agent|dsh-persona|dsh-system-prompt|dsh-goal|dsh-plan|dsh-compaction|dsh-token-meter|dsh-time-context|dsh-tmux-context|dsh-repeat-tool|dsh-output-retention)/.test(short)) return 'agent'
  if (/^(dsh-host-|dsh-settings|dsh-credentials|dsh-permission|dsh-jobs|dsh-subagent|dsh-workflow|dsh-skill|dsh-command|dsh-api|dsh-typert|dsh-user|dsh-approval|dsh-workspace|dsh-directory|dsh-launch|dsh-scope|dsh-home|dsh-cmdline|dsh-native|dsh-brand|dsh-schedule)/.test(short)) return 'service'
  return 'other'
}

/** Locate the profile patch file from the root include's config path. */
function patchFilePath(ctx) {
  const include = ctx.loader.resolve('include')
  const configPath = include?.options?.config?.path
  if (typeof configPath !== 'string') throw new Error('cannot resolve profile config path')
  const configFile = fileURLToPath(new URL(configPath))
  return join(dirname(configFile), 'cordis.patch.yml')
}

/**
 * Minimal, comment-preserving patch-file editing: turns `[]` into a block
 * list, updates the entry's `disabled:` line when present, or appends a new
 * patch row. Toggling enabled=true writes disabled: false explicitly so a
 * bundle-layer disable is overridden by the user layer.
 */
export function buildPatchContent(content, entryId, enabled) {
  const dis = enabled ? 'false' : 'true'
  const entryLine = '- id: ' + entryId
  if (!content.trim()) return entryLine + '\n  disabled: ' + dis + '\n'
  const arr = content.match(/^[ \t]*\[\s*\][ \t]*$/m)
  if (arr) {
    const indent = arr[0].match(/^[ \t]*/)[0]
    return content.slice(0, arr.index) + indent + entryLine + '\n' + indent + '  disabled: ' + dis + '\n' + content.slice(arr.index + arr[0].length)
  }
  const lines = content.split('\n')
  let start = -1
  let base = ''
  for (let i = 0; i < lines.length; i++) {
    const match = lines[i].match(/^([ \t]*)- id:\s*([^\s]+)\s*$/)
    if (!match) continue
    if (match[2] === entryId) {
      start = i
      base = match[1]
      break
    }
  }
  if (start === -1) {
    return content.replace(/[ \t]*\n?$/, '\n') + entryLine + '\n  disabled: ' + dis + '\n'
  }
  let end = lines.length
  for (let i = start + 1; i < lines.length; i++) {
    const match = lines[i].match(/^([ \t]*)- /)
    if (match && match[1].length <= base.length) {
      end = i
      break
    }
  }
  let disIdx = -1
  for (let i = start + 1; i < end; i++) {
    if (/^[ \t]*disabled:/.test(lines[i])) {
      disIdx = i
      break
    }
  }
  const pad = base + '  '
  if (disIdx !== -1) {
    lines[disIdx] = pad + 'disabled: ' + dis
  } else {
    lines.splice(start + 1, 0, pad + 'disabled: ' + dis)
  }
  return lines.join('\n')
}

/** Read the JSON request body (capped). */
async function readBody(req, maxBytes = 64 * 1024) {
  const chunks = []
  let total = 0
  for await (const chunk of req) {
    total += chunk.length
    if (total > maxBytes) throw new Error('body too large')
    chunks.push(chunk)
  }
  if (chunks.length === 0) return {}
  try {
    return JSON.parse(Buffer.concat(chunks).toString('utf8'))
  } catch {
    throw new Error('invalid JSON body')
  }
}

/** Send a JSON response. */
function sendJson(res, status, body) {
  const text = JSON.stringify(body)
  res.writeHead(status, { 'content-type': 'application/json; charset=utf-8' })
  res.end(text)
}

/**
 * Same-origin guard for mutating requests: require a JSON content type and an
 * Origin header whose host matches the request host, so a cross-site script
 * cannot construct the toggle body.
 */
function sameOriginGuard(req, body) {
  const contentType = String(req.headers['content-type'] ?? '').split(';')[0].trim().toLowerCase()
  if (contentType !== 'application/json') return { code: 'ERR_CONTENT_TYPE', message: 'Request must be application/json' }
  const host = String(req.headers.host ?? '')
  const origin = String(req.headers.origin ?? '')
  if (origin === '') return { code: 'ERR_ORIGIN_MISSING', message: 'Missing Origin header — rejected (update must come from the Web UI)' }
  let originHost = ''
  try {
    originHost = new URL(origin).host
  } catch {
    return { code: 'ERR_ORIGIN_INVALID', message: 'Invalid Origin header' }
  }
  if (originHost !== host) return { code: 'ERR_ORIGIN_MISMATCH', message: 'Origin does not match Host — rejected' }
  return null
}

/** Project one loader entry into the client-facing view. */
function view(entry, sortKey, userPlugins) {
  const moduleName = String(entry.options.name || entry.id)
  const short = moduleName.indexOf('@deepseek-ai/') === 0 ? moduleName.slice('@deepseek-ai/'.length) : moduleName
  const protectedEntry = isProtected(entry)
  const community = userPlugins.includes(short) || userPlugins.includes(moduleName)
  const category = protectedEntry ? 'core' : (moduleName.indexOf('@deepseek-ai/') === 0 && !community ? 'official' : 'community')
  return {
    entryId: entry.id,
    moduleName,
    enabled: !entry.disabled,
    fiberPhase: entry.fiber === undefined ? null : (PHASE[entry.fiber.state] ?? null),
    protected: protectedEntry,
    category,
    type: classifyType(moduleName),
    community,
    sortKey,
  }
}

/** User-installed plugin directories under $DSH_HOME/plugins. */
function listUserPlugins(ctx) {
  const home = ctx.get('dshHomePath')
  if (typeof home !== 'string') return []
  try {
    return readdirSync(join(home, 'plugins'), { withFileTypes: true })
      .filter((d) => d.isDirectory())
      .map((d) => d.name)
  } catch {
    return []
  }
}

export function apply(ctx) {
  // Web-only seam, injected dynamically so headless/TUI surfaces never pend.
  ctx.inject(['webServer'], (webCtx) => {
    webCtx.effect(() => webCtx.webServer.register({
      kind: 'prefix',
      path: '/plugin-hot-toggle/api',
      handler: async (req, res) => {
        const url = new URL(req.url ?? '/', 'http://localhost')
        const pathname = url.pathname
        try {
          if (req.method === 'GET' && pathname === '/plugin-hot-toggle/api/list') {
            const entries = []
            let sortKey = 0
            const userPlugins = listUserPlugins(ctx)
            for (const entry of ctx.loader.entries()) {
              if (entry.options.group) continue
              entries.push(view(entry, sortKey, userPlugins))
              sortKey += 1
            }
            sendJson(res, 200, { entries })
            return
          }
          if (req.method === 'POST' && pathname === '/plugin-hot-toggle/api/setEnabled') {
            const body = await readBody(req)
            const guard = sameOriginGuard(req, body)
            if (guard) {
              sendJson(res, 403, { ok: false, code: guard.code, error: guard.message })
              return
            }
            const entryId = String(body?.entryId ?? '')
            const enabled = Boolean(body?.enabled)
            if (!entryId) {
              sendJson(res, 400, { ok: false, code: 'ERR_MISSING_ENTRY_ID', error: 'missing entryId' })
              return
            }
            const entry = ctx.loader.resolve(entryId)
            if (isProtected(entry)) {
              sendJson(res, 403, { ok: false, code: 'ERR_PROTECTED', error: `entry ${entryId} is a system-core plugin and cannot be toggled` })
              return
            }
            await entry.update({ disabled: !enabled })
            let persisted = false
            let persistError = null
            try {
              const patchFile = patchFilePath(ctx)
              const bareId = entry.id.includes(':') ? entry.id.slice(entry.id.lastIndexOf(':') + 1) : entry.id
              let content = ''
              try {
                content = readFileSync(patchFile, 'utf8')
              } catch {
                content = ''
              }
              writeFileSync(patchFile, buildPatchContent(content, bareId, enabled), 'utf8')
              persisted = true
            } catch (error) {
              persistError = error instanceof Error ? error.message : String(error)
            }
            sendJson(res, 200, {
              ok: true,
              entryId: entry.id,
              enabled: !entry.disabled,
              fiberPhase: entry.fiber === undefined ? null : (PHASE[entry.fiber.state] ?? null),
              persisted,
              persistError,
            })
            return
          }
          sendJson(res, 404, { ok: false, code: 'ERR_NOT_FOUND', error: 'not found' })
        } catch (error) {
          sendJson(res, 500, { ok: false, code: 'ERR_INTERNAL', error: error instanceof Error ? error.message : String(error) })
        }
      },
    }))
  })
}
