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
 *
 * i18n: dictionaries are registered through the official DSH `locale`
 * service (namespace `pluginHotToggle`), so the tab follows the user's
 * language preference (zh/en) like every other settings surface.
 */
const React = require('react')

const inject = ['slots', 'locale']
const API = '/plugin-hot-toggle/api'
const NS = 'pluginHotToggle'

/** Simplified Chinese dictionary — key source of truth. */
const zh = {
  tab: '启停管理',
  loading: '正在读取插件…',
  error: '暂时无法读取插件。',
  search: '搜索插件',
  refresh: '刷新',
  count: '{n} / {total} 个插件',
  empty: '没有匹配的插件。',
  state: '状态',
  stateAll: '全部',
  stateEnabled: '已启用',
  stateDisabled: '已停用',
  source: '来源',
  sourceOfficial: '官方',
  sourceCore: '核心',
  sourceCommunity: '非官方',
  type: '类型',
  sort: '排序',
  sortRecent: '最近安装优先',
  sortName: '按名称',
  coreTag: '系统核心',
  phasePending: '等待依赖',
  phaseLoading: '加载中',
  phaseActive: '已挂载',
  phaseFailed: '挂载失败',
  phaseUnloading: '卸载中',
  phaseUnobserved: '未挂载',
  phaseStopped: '已停用',
  toggleOn: '停用',
  toggleOff: '启用',
  toggling: '处理中…',
  typeBuiltin: '内置框架',
  typeClient: '客户端 UI',
  typeLlm: '模型与推理',
  typeTool: '工具集',
  typeSession: '会话与存储',
  typeSandbox: '沙箱与执行',
  typeAgent: '代理与规划',
  typeService: '服务与集成',
  typeOther: '其他',
}

/** English dictionary checked against the Chinese key set. */
const en = {
  tab: 'Plugin Toggle',
  loading: 'Reading plugins…',
  error: 'Plugins are temporarily unavailable.',
  search: 'Search plugins',
  refresh: 'Refresh',
  count: '{n} / {total} plugins',
  empty: 'No matching plugins.',
  state: 'State',
  stateAll: 'All',
  stateEnabled: 'Enabled',
  stateDisabled: 'Disabled',
  source: 'Source',
  sourceOfficial: 'Official',
  sourceCore: 'Core',
  sourceCommunity: 'Community',
  type: 'Type',
  sort: 'Sort',
  sortRecent: 'Recent first',
  sortName: 'By name',
  coreTag: 'System core',
  phasePending: 'Waiting for deps',
  phaseLoading: 'Loading',
  phaseActive: 'Active',
  phaseFailed: 'Failed',
  phaseUnloading: 'Unloading',
  phaseUnobserved: 'Not mounted',
  phaseStopped: 'Disabled',
  toggleOn: 'Disable',
  toggleOff: 'Enable',
  toggling: 'Working…',
  typeBuiltin: 'Builtin',
  typeClient: 'Client UI',
  typeLlm: 'LLM',
  typeTool: 'Tools',
  typeSession: 'Session & Storage',
  typeSandbox: 'Sandbox & Exec',
  typeAgent: 'Agent & Planning',
  typeService: 'Services & Integration',
  typeOther: 'Other',
}

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

/** Phase text from the bound translate function. */
function phaseText(t, phase) {
  switch (phase) {
    case 'pending': return t('phasePending')
    case 'loading': return t('phaseLoading')
    case 'active': return t('phaseActive')
    case 'failed': return t('phaseFailed')
    case 'unloading': return t('phaseUnloading')
    default: return t('phaseUnobserved')
  }
}

function statusText(t, entry) {
  if (!entry.enabled) return t('phaseStopped')
  if (entry.fiberPhase === null) return t('phaseUnobserved')
  return phaseText(t, entry.fiberPhase)
}

const TYPE_ORDER = ['builtin', 'client', 'llm', 'tool', 'session', 'sandbox', 'agent', 'service', 'other']
const TYPE_KEYS = {
  builtin: 'typeBuiltin',
  client: 'typeClient',
  llm: 'typeLlm',
  tool: 'typeTool',
  session: 'typeSession',
  sandbox: 'typeSandbox',
  agent: 'typeAgent',
  service: 'typeService',
  other: 'typeOther',
}

const CATEGORY_KEYS = {
  core: 'sourceCore',
  official: 'sourceOfficial',
  community: 'sourceCommunity',
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

function PluginToggleTab(props) {
  const t = props.t || ((key) => key)
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
          setState((prev) => ({ ...prev, error: (res && res.error) || 'failed' }))
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
  const typesPresent = TYPE_ORDER.filter((tt) => byCategory.some((e) => e.type === tt))
  const countText = t('count').replace('{n}', String(filtered.length)).replace('{total}', String(state.entries.length))

  return React.createElement('div', { className: 'hpt-section', 'aria-busy': state.status === 'loading' },
    React.createElement('div', { className: 'hpt-toolbar' },
      React.createElement('label', { className: 'hpt-search' },
        React.createElement('input', { type: 'search', value: query, placeholder: t('search'), 'aria-label': t('search'), onChange: (event) => setQuery(event.currentTarget.value) })
      ),
      React.createElement('button', { type: 'button', className: 'hpt-refresh', onClick: load }, t('refresh')),
      state.status === 'ready' ? React.createElement('span', { className: 'hpt-meta' }, countText) : null
    ),
    state.error ? React.createElement('p', { className: 'hpt-error', role: 'alert' }, state.error) : null,
    state.status === 'loading' ? React.createElement('p', { className: 'hpt-meta' }, t('loading')) : null,
    state.status === 'ready' ? React.createElement('div', { className: 'hpt-chips' },
      React.createElement('span', { className: 'hpt-chip-label' }, t('state')),
      React.createElement('button', { type: 'button', className: 'hpt-chip', 'data-active': power === 'all' ? 'true' : 'false', onClick: () => setPower('all') }, t('stateAll')),
      React.createElement('button', { type: 'button', className: 'hpt-chip', 'data-active': power === 'enabled' ? 'true' : 'false', onClick: () => setPower('enabled') }, t('stateEnabled')),
      React.createElement('button', { type: 'button', className: 'hpt-chip', 'data-active': power === 'disabled' ? 'true' : 'false', onClick: () => setPower('disabled') }, t('stateDisabled'))
    ) : null,
    state.status === 'ready' ? React.createElement('div', { className: 'hpt-chips' },
      React.createElement('span', { className: 'hpt-chip-label' }, t('source')),
      React.createElement('button', { type: 'button', className: 'hpt-chip', 'data-active': category === 'all' ? 'true' : 'false', onClick: () => setCategory('all') }, t('stateAll')),
      React.createElement('button', { type: 'button', className: 'hpt-chip', 'data-active': category === 'official' ? 'true' : 'false', onClick: () => { setCategory('official'); setType('all') } }, t('sourceOfficial')),
      React.createElement('button', { type: 'button', className: 'hpt-chip', 'data-active': category === 'core' ? 'true' : 'false', onClick: () => { setCategory('core'); setType('all') } }, t('sourceCore')),
      React.createElement('button', { type: 'button', className: 'hpt-chip', 'data-active': category === 'community' ? 'true' : 'false', onClick: () => { setCategory('community'); setType('all') } }, t('sourceCommunity'))
    ) : null,
    state.status === 'ready' && typesPresent.length > 0 ? React.createElement('div', { className: 'hpt-chips' },
      React.createElement('span', { className: 'hpt-chip-label' }, t('type')),
      React.createElement('button', { type: 'button', className: 'hpt-chip', 'data-active': type === 'all' ? 'true' : 'false', onClick: () => setType('all') }, t('stateAll')),
      typesPresent.map((tt) => React.createElement('button', { key: tt, type: 'button', className: 'hpt-chip', 'data-active': type === tt ? 'true' : 'false', onClick: () => setType(tt) }, t(TYPE_KEYS[tt] || 'typeOther')))
    ) : null,
    state.status === 'ready' ? React.createElement('div', { className: 'hpt-chips' },
      React.createElement('span', { className: 'hpt-chip-label' }, t('sort')),
      React.createElement('button', { type: 'button', className: 'hpt-chip', 'data-active': sortMode === 'recent' ? 'true' : 'false', onClick: () => setSortMode('recent') }, t('sortRecent')),
      React.createElement('button', { type: 'button', className: 'hpt-chip', 'data-active': sortMode === 'name' ? 'true' : 'false', onClick: () => setSortMode('name') }, t('sortName'))
    ) : null,
    state.status === 'ready' && filtered.length === 0 ? React.createElement('p', { className: 'hpt-meta' }, t('empty')) : null,
    state.status === 'ready' && filtered.length > 0 ? React.createElement('ul', { className: 'hpt-list' },
      filtered.map((entry) => React.createElement('li', { key: entry.entryId, className: 'hpt-card' },
        React.createElement('div', { className: 'hpt-cardMain' },
          React.createElement('div', { className: 'hpt-cardTitle' },
            React.createElement('strong', { title: entry.moduleName }, shortName(entry.moduleName)),
            entry.protected ? React.createElement('span', { className: 'hpt-tag', 'data-category': 'core' }, t('coreTag')) : null,
            entry.category && entry.category !== 'core' ? React.createElement('span', { className: 'hpt-tag', 'data-category': entry.category }, t(CATEGORY_KEYS[entry.category] || 'sourceCommunity')) : null,
            entry.type && entry.type !== 'other' ? React.createElement('span', { className: 'hpt-tag' }, t(TYPE_KEYS[entry.type] || 'typeOther')) : null
          ),
          React.createElement('div', { className: 'hpt-cardSub' },
            React.createElement('span', { className: 'hpt-dot', 'data-phase': entry.enabled ? (entry.fiberPhase || 'unobserved') : 'off' }),
            React.createElement('span', null, statusText(t, entry)),
            React.createElement('code', null, entry.entryId)
          )
        ),
        React.createElement('button', {
          type: 'button',
          className: 'hpt-toggle',
          'data-enabled': entry.enabled ? 'true' : 'false',
          disabled: entry.protected || busy === entry.entryId,
          onClick: () => toggle(entry),
        }, busy === entry.entryId ? t('toggling') : (entry.enabled ? t('toggleOn') : t('toggleOff')))
      ))
    ) : null
  )
}

function apply(ctx) {
  // Register dictionaries so the tab follows the user's language preference.
  ctx.effect(() => ctx.locale.register(NS, { zh, en }), 'dsh-plugin-hot-toggle: dictionaries')
  const t = ctx.locale.bind(NS)

  // The `locale: NS` declaration puts the typed `t` standard seat on the
  // component props (per the slot system contract), so PluginToggleTab
  // receives props.t without an explicit inject.
  ctx.effect(() => ctx.slots.inject('settings.plugins.tab', () => ctx.slots.register({
    name: 'settings.plugins.tab',
    id: 'hot-toggle',
    order: 20,
    label: () => t('tab'),
    locale: NS,
  }, PluginToggleTab)))
}

module.exports = { inject, apply, zh, en }
