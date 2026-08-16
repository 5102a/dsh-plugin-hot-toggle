/**
 * dsh-plugin-hot-toggle — host half type declarations.
 */

/** Fiber phase projection (mirrors @deepseek-ai/cordis FiberState). */
export type FiberPhase = 'pending' | 'loading' | 'active' | 'failed' | 'unloading' | null

/** Source category of a plugin entry. */
export type EntryCategory = 'core' | 'official' | 'community'

/** Fine-grained type classification of a plugin entry. */
export type EntryType = 'builtin' | 'client' | 'llm' | 'tool' | 'session' | 'sandbox' | 'agent' | 'service' | 'other'

/** One plugin entry as projected by the list API. */
export interface PluginEntry {
  /** Loader entry id (may be nested, e.g. `include:session`). */
  entryId: string
  /** Module specifier of the entry. */
  moduleName: string
  /** Whether the entry is currently enabled (not disabled). */
  enabled: boolean
  /** Cordis fiber phase; null when the entry has no fiber (e.g. stopped). */
  fiberPhase: FiberPhase
  /** System-core entries cannot be toggled. */
  protected: boolean
  /** Source category. */
  category: EntryCategory
  /** Fine-grained type. */
  type: EntryType
  /** Whether the plugin is user-installed under $DSH_HOME/plugins. */
  community: boolean
  /** Loader iteration order, for recent-first sorting. */
  sortKey: number
}

/** GET /plugin-hot-toggle/api/list response body. */
export interface PluginListResponse {
  entries: PluginEntry[]
}

/** POST /plugin-hot-toggle/api/setEnabled response body. */
export interface SetEnabledResponse {
  ok: boolean
  entryId: string
  enabled: boolean
  fiberPhase: FiberPhase
  /** Whether the toggle was persisted to the profile patch layer. */
  persisted: boolean
  /** Persistence failure message, when persisted is false. */
  persistError: string | null
  /** Rejection reason, when ok is false. */
  error?: string
}

/**
 * Pure patch-file editor: merges one entry's `disabled` flag into the profile
 * patch layer text, preserving comments. Exported for tests and tooling.
 */
export function buildPatchContent(content: string, entryId: string, enabled: boolean): string

/** Cordis plugin identity. */
export const name: 'dsh-plugin-hot-toggle'

/** Services the host half requires. */
export const inject: ['loader']

/** Cordis plugin apply. */
export function apply(ctx: import('@deepseek-ai/cordis').Context): void
