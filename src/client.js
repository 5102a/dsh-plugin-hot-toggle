/**
 * dsh-plugin-hot-toggle — client half source (Web).
 *
 * This is the SOURCE of the shipped bundle. scripts/build.mjs wraps it into
 * the window.__ModuleLoader__.load({ id, factory }) carrier that the DSH web
 * shell executes; the built artifact lives at lib/client.js. Do not edit
 * lib/client.js directly — edit this file and run `npm run build`.
 *
 * The bundle factory receives a CommonJS `require`, so this source uses
 * require('react') and module.exports (the same shape the build wraps).
 */
const React = require('react')

const inject = ['slots']
const API = '/plugin-hot-toggle/api'

/** Same-origin JSON helper against the host HTTP API. */
function fetchJson(path, init) {
  return fetch(API + path, {
    headers: { 'content-type': 'application/json' },
    ...init,
  }).then((res) => res.json())
}

function shortName(moduleName) {
  const name = String(moduleName || '')
  const base = name.indexOf('@') === 0 && name.indexOf('/') !== -1 ? name.slice(name.indexOf('/') + 1) : name
  return base.replace(/^cordis:/, '').replace(/^cordis-plugin-/, '').replace(/^dsh-(?:host-|client-)?/, '')
}

const PHASE_TEXT = {
  pending: '等待依赖',
  loading: '加载中',
  active: '已挂载',
  failed: '挂载失败',
  unloading: '卸载中',
}

const CATEGORY_META = {
  core: { label: '核心' },
  official: { label: '官方' },
  community: { label: '非官方' },
}

const TYPE_ORDER = ['builtin', 'client', 'llm', 'tool', 'session', 'sandbox', 'agent', 'service', 'other']
const TYPE_LABELS = {
  builtin: '内置框架',
  client: '客户端 UI',
  llm: '模型与推理',
  tool: '工具集',
  session: '会话与存储',
  sandbox: '沙箱与执行',
  agent: '代理与规划',
  service: '服务与集成',
  other: '其他',
}

const CSS = [
  '.hpt-section{width:100%;max-width:760px;display:flex;flex-direction:column;gap:12px;color:var(--dsw-alias-label-primary);font-size:13px}',
  '.hpt-toolbar{display:flex;align-items:center;gap:10px;flex-wrap:wrap}',
  '.hpt-search{position:relative;flex:1;min-width:200px;max-width:320px;display:flex;align-items:center}',
  '.hpt-search input{width:100%;height:34px;border:1px solid var(--dsw-alias-border-l2);background:var(--dsw-alias-bg-layer-1);color:var(--dsw-alias-label-primary);font:inherit;border-radius:8px;outline:none;padding:0 12px;font-size:13px}',
  '.hpt-search input:focus-visible{border-color:var(--dsw-alias-brand-primary)}',
  '.hpt-refresh{border:1px solid var(--dsw-alias-border-l2);background:var(--dsw-alias-bg-layer-1);color:var(--dsw-alias-label-primary);font:inherit;cursor:pointer;border-radius:8px;padding:6px 12px}',
  '.hpt-refresh:hover{border-color:var(--dsw-alias-brand-primary)}',
  '.hpt-meta{color:var(--dsw-alias-label-secondary);font-size:12px}',
  '.hpt-error{color:var(--dsw-alias-state-error-primary);font-size:13px}',
  '.hpt-chips{display:flex;flex-wrap:wrap;gap:6px;align-items:center}',
  '.hpt-chip-label{color:var(--dsw-alias-label-secondary);font-size:12px;margin-right:2px}',
  '.hpt-chip{border:1px solid var(--dsw-alias-border-l2);background:var(--dsw-alias-bg-layer-1);color:var(--dsw-alias-label-secondary);font:inherit;cursor:pointer;border-radius:999px;padding:3px 11px;font-size:12px;line-height:1.5}',
  '.hpt-chip:hover:not([data-active=true]){border-color:var(--dsw-alias-brand-primary)}',
  '.hpt-chip[data-active=true]{border-color:var(--dsw-alias-brand-primary);color:var(--dsw-alias-brand-primary);background:color-mix(in srgb, var(--dsw-alias-brand-primary) 10%, transparent)}',
  '.hpt-list{display:flex;flex-direction:column;gap:8px;margin:0;padding:0;list-style:none}',
  '.hpt-card{display:flex;align-items:center;justify-content:space-between;gap:12px;border:1px solid var(--dsw-alias-border-l2);background:var(--dsw-alias-bg-layer-1);border-radius:10px;padding:10px 14px}',
  '.hpt-cardMain{min-width:0;display:flex;flex-direction:column;gap:4px}',
  '.hpt-cardTitle{display:flex;align-items:center;gap:8px}',
  '.hpt-cardTitle strong{font-size:13px;font-weight:600;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}',
  '.hpt-tag{border:1px solid var(--dsw-alias-border-l2);color:var(--dsw-alias-label-secondary);border-radius:4px;padding:1px 6px;font-size:11px;white-space:nowrap}',
  '.hpt-tag[data-category=core]{border-color:var(--dsw-alias-state-error-primary);color:var(--dsw-alias-state-error-primary)}',
  '.hpt-tag[data-category=community]{border-color:var(--dsw-alias-state-warn-primary);color:var(--dsw-alias-state-warn-primary)}',
  '.hpt-tag[data-category=official]{border-color:var(--dsw-alias-state-success-primary);color:var(--dsw-alias-state-success-primary)}',
  '.hpt-cardSub{display:flex;align-items:center;gap:8px;color:var(--dsw-alias-label-secondary);font-size:12px}',
  '.hpt-cardSub code{font-size:11px;color:var(--dsw-alias-label-secondary)}',
  '.hpt-dot{width:8px;height:8px;border-radius:50%;background:var(--dsw-alias-label-secondary);flex:none}',
  '.hpt-dot[data-phase=active]{background:var(--dsw-alias-state-success-primary)}',
  '.hpt-dot[data-phase=failed]{background:var(--dsw-alias-state-error-primary)}',
  '.hpt-dot[data-phase=pending],.hpt-dot[data-phase=loading],.hpt-dot[data-phase=unloading]{background:var(--dsw-alias-state-warn-primary)}',
  '.hpt-toggle{border:1px solid var(--dsw-alias-border-l2);background:var(--dsw-alias-bg-layer-1);color:var(--dsw-alias-label-primary);font:inherit;cursor:pointer;border-radius:8px;padding:6px 14px;flex:none}',
  '.hpt-toggle:hover:not(:disabled){border-color:var(--dsw-alias-brand-primary)}',
  '.hpt-toggle:disabled{opacity:.45;cursor:not-allowed}',
  '.hpt-toggle[data-enabled=true]{border-color:var(--dsw-alias-state-success-primary);color:var(--dsw-alias-state-success-primary)}',
].join('')

function statusText(entry) {
  if (!entry.enabled) return '已停用'
  if (entry.fiberPhase === null) return '未挂载'
  return PHASE_TEXT[entry.fiberPhase] || entry.fiberPhase
}

function PluginToggleTab() {
  const [state, setState] = React.useState({ status: 'loading', entries: [], error: null })
  const [busy, setBusy] = React.useState(null)
  const [query, setQuery] = React.useState('')
  const [category, setCategory] = React.useState('all')
  const [type, setType] = React.useState('all')
  const [power, setPower] = React.useState('all')
  const [sortMode, setSortMode] = React.useState('recent')

  // Scoped stylesheet, removed with the tab.
  React.useEffect(() => {
    const style = document.createElement('style')
    style.setAttribute('data-plugin-css', 'dsh-plugin-hot-toggle/tab')
    style.textContent = CSS
    document.head.appendChild(style)
    return () => style.remove()
  }, [])

  const load = () => {
    setState((prev) => ({ ...prev, status: 'loading', error: null }))
    fetchJson('/list').then(
      (res) => setState({ status: 'ready', entries: (res && res.entries) || [], error: null }),
      (err) => setState({ status: 'error', entries: [], error: String((err && err.message) || err) })
    )
  }

  React.useEffect(() => { load() }, [])

  const toggle = (entry) => {
    if (busy !== null) return
    setBusy(entry.entryId)
    fetchJson('/setEnabled', {
      method: 'POST',
      body: JSON.stringify({ entryId: entry.entryId, enabled: !entry.enabled }),
    }).then(
      (res) => {
        if (!res || !res.ok) {
          setState((prev) => ({ ...prev, error: (res && res.error) || '操作失败' }))
        } else {
          setState((prev) => ({
            ...prev,
            entries: prev.entries.map((e) => e.entryId === res.entryId ? { ...e, enabled: res.enabled, fiberPhase: res.fiberPhase } : e),
          }))
        }
        setBusy(null)
      },
      (err) => {
        setState((prev) => ({ ...prev, error: String((err && err.message) || err) }))
        setBusy(null)
      }
    )
  }

  const normalized = query.trim().toLocaleLowerCase()
  const byCategory = state.entries.filter((e) => category === 'all' || e.category === category)
  const byType = byCategory.filter((e) => type === 'all' || e.type === type)
  const byPower = byType.filter((e) => power === 'all' || (power === 'enabled' ? e.enabled : !e.enabled))
  const filtered = byPower
    .filter((e) => normalized.length === 0 || e.moduleName.toLocaleLowerCase().indexOf(normalized) !== -1 || e.entryId.toLocaleLowerCase().indexOf(normalized) !== -1)
    .slice()
    .sort((a, b) => {
      if (sortMode === 'name') return a.moduleName.toLocaleLowerCase() < b.moduleName.toLocaleLowerCase() ? -1 : a.moduleName.toLocaleLowerCase() > b.moduleName.toLocaleLowerCase() ? 1 : 0
      if (a.community !== b.community) return a.community ? -1 : 1
      return a.sortKey - b.sortKey
    })
  const typesPresent = TYPE_ORDER.filter((t) => byCategory.some((e) => e.type === t))

  return React.createElement('div', { className: 'hpt-section', 'aria-busy': state.status === 'loading' },
    React.createElement('div', { className: 'hpt-toolbar' },
      React.createElement('label', { className: 'hpt-search' },
        React.createElement('input', { type: 'search', value: query, placeholder: '搜索插件', 'aria-label': '搜索插件', onChange: (event) => setQuery(event.currentTarget.value) })
      ),
      React.createElement('button', { type: 'button', className: 'hpt-refresh', onClick: load }, '刷新'),
      state.status === 'ready' ? React.createElement('span', { className: 'hpt-meta' }, filtered.length + ' / ' + state.entries.length + ' 个插件') : null
    ),
    state.error ? React.createElement('p', { className: 'hpt-error', role: 'alert' }, state.error) : null,
    state.status === 'loading' ? React.createElement('p', { className: 'hpt-meta' }, '正在读取插件…') : null,
    state.status === 'ready' ? React.createElement('div', { className: 'hpt-chips' },
      React.createElement('span', { className: 'hpt-chip-label' }, '状态'),
      React.createElement('button', { type: 'button', className: 'hpt-chip', 'data-active': power === 'all' ? 'true' : 'false', onClick: () => setPower('all') }, '全部'),
      React.createElement('button', { type: 'button', className: 'hpt-chip', 'data-active': power === 'enabled' ? 'true' : 'false', onClick: () => setPower('enabled') }, '已启用'),
      React.createElement('button', { type: 'button', className: 'hpt-chip', 'data-active': power === 'disabled' ? 'true' : 'false', onClick: () => setPower('disabled') }, '已停用')
    ) : null,
    state.status === 'ready' ? React.createElement('div', { className: 'hpt-chips' },
      React.createElement('span', { className: 'hpt-chip-label' }, '来源'),
      React.createElement('button', { type: 'button', className: 'hpt-chip', 'data-active': category === 'all' ? 'true' : 'false', onClick: () => setCategory('all') }, '全部'),
      React.createElement('button', { type: 'button', className: 'hpt-chip', 'data-active': category === 'official' ? 'true' : 'false', onClick: () => { setCategory('official'); setType('all') } }, '官方'),
      React.createElement('button', { type: 'button', className: 'hpt-chip', 'data-active': category === 'core' ? 'true' : 'false', onClick: () => { setCategory('core'); setType('all') } }, '核心'),
      React.createElement('button', { type: 'button', className: 'hpt-chip', 'data-active': category === 'community' ? 'true' : 'false', onClick: () => { setCategory('community'); setType('all') } }, '非官方')
    ) : null,
    state.status === 'ready' && typesPresent.length > 0 ? React.createElement('div', { className: 'hpt-chips' },
      React.createElement('span', { className: 'hpt-chip-label' }, '类型'),
      React.createElement('button', { type: 'button', className: 'hpt-chip', 'data-active': type === 'all' ? 'true' : 'false', onClick: () => setType('all') }, '全部'),
      typesPresent.map((t) => React.createElement('button', { key: t, type: 'button', className: 'hpt-chip', 'data-active': type === t ? 'true' : 'false', onClick: () => setType(t) }, TYPE_LABELS[t] || t))
    ) : null,
    state.status === 'ready' ? React.createElement('div', { className: 'hpt-chips' },
      React.createElement('span', { className: 'hpt-chip-label' }, '排序'),
      React.createElement('button', { type: 'button', className: 'hpt-chip', 'data-active': sortMode === 'recent' ? 'true' : 'false', onClick: () => setSortMode('recent') }, '最近安装优先'),
      React.createElement('button', { type: 'button', className: 'hpt-chip', 'data-active': sortMode === 'name' ? 'true' : 'false', onClick: () => setSortMode('name') }, '按名称')
    ) : null,
    state.status === 'ready' && filtered.length === 0 ? React.createElement('p', { className: 'hpt-meta' }, '没有匹配的插件。') : null,
    state.status === 'ready' && filtered.length > 0 ? React.createElement('ul', { className: 'hpt-list' },
      filtered.map((entry) => React.createElement('li', { key: entry.entryId, className: 'hpt-card' },
        React.createElement('div', { className: 'hpt-cardMain' },
          React.createElement('div', { className: 'hpt-cardTitle' },
            React.createElement('strong', { title: entry.moduleName }, shortName(entry.moduleName)),
            entry.protected ? React.createElement('span', { className: 'hpt-tag', 'data-category': 'core' }, '系统核心') : null,
            entry.category && entry.category !== 'core' ? React.createElement('span', { className: 'hpt-tag', 'data-category': entry.category }, (CATEGORY_META[entry.category] || {}).label || entry.category) : null,
            entry.type && entry.type !== 'other' ? React.createElement('span', { className: 'hpt-tag' }, TYPE_LABELS[entry.type] || entry.type) : null
          ),
          React.createElement('div', { className: 'hpt-cardSub' },
            React.createElement('span', { className: 'hpt-dot', 'data-phase': entry.enabled ? (entry.fiberPhase || 'unobserved') : 'off' }),
            React.createElement('span', null, statusText(entry)),
            React.createElement('code', null, entry.entryId)
          )
        ),
        React.createElement('button', {
          type: 'button',
          className: 'hpt-toggle',
          'data-enabled': entry.enabled ? 'true' : 'false',
          disabled: entry.protected || busy === entry.entryId,
          onClick: () => toggle(entry),
        }, busy === entry.entryId ? '处理中…' : (entry.enabled ? '停用' : '启用'))
      ))
    ) : null
  )
}

function apply(ctx) {
  ctx.effect(() => ctx.slots.inject('settings.plugins.tab', () => ctx.slots.register({
    name: 'settings.plugins.tab',
    id: 'hot-toggle',
    order: 20,
    label: () => '启停管理',
  }, PluginToggleTab)))
}

module.exports = { inject, apply }
