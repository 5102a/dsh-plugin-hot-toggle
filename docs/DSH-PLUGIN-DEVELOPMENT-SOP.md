---
name: dsh-plugin-development
description: Develop, debug, and publish DeepSeek Harness (DSH) plugins end-to-end — from a fast dynamic-plugin prototype to a releasable open-source bundle. Use this skill for ANY DSH plugin task: choosing dynamic vs bundled plugin, building the Node half (webServer HTTP API) and Web half (settings slots, i18n), zero-dependency build/test, local install verification, and the fully automated release pipeline (git tag → CI → GitHub Release → npm via OIDC). 开发、调试并发布 DeepSeek Harness（DSH）插件的端到端流程——从快速动态插件原型到可发布的开源 bundle。任何 DSH 插件任务都适用：选择动态/正式插件形态、构建 Node half（webServer HTTP API）与 Web half（设置页 slot、多语言）、零依赖构建/测试、本地安装验证、以及全自动发布流水线（git tag → CI → GitHub Release → npm OIDC 发布）。
---

# DSH Plugin Development SOP / DSH 插件开发标准作业流程

A complete, battle-tested workflow distilled from shipping [dsh-plugin-hot-toggle](https://github.com/5102a/dsh-plugin-hot-toggle). Follow these phases in order; each phase has a concrete exit criterion. 完整实战流程（源自 dsh-plugin-hot-toggle 的发布实践），按阶段推进，每阶段有明确的完成标准。

## Phase 0 — Understand the two plugin forms / 理解两种插件形态

| Form / 形态 | When / 何时用 | Runtime / 运行时 | Communication / 通信 |
| --- | --- | --- | --- |
| **Dynamic plugin / 动态插件** | Fast prototype, in-session experiments, UI iteration before committing to a package. 快速原型、会话内实验、发布前迭代 UI | Process-local, dies on DSH restart. 进程级，重启即失 | `harness.handle` (Host) ↔ `host.call` (Client), `styles.insert` builtin. 沙箱专用 |
| **Bundled plugin / 正式插件** | Anything to ship/publish open-source. 任何要发布开源的插件 | Standard npm package via `dsh plugin add`. 标准 npm 包 | `webServer` HTTP API (Host) ↔ `fetch` (Client), i18n via `locale` service. 正式通道 |

**Rule / 铁律**: prototype as dynamic, ship as bundled. Never try to open-source a dynamic plugin as-is — it has no `webServer`, no `dsh.bundle`, and no locale wiring. 动态原型、正式发布，二者代码形态不同，必须迁移。

## Phase 1 — Dynamic prototype / 动态插件原型

1. Load the `cordis-plugin-development` skill and `cordis_inspect_list` to read Host/Client services and Slots. 加载 cordis-plugin-development 技能，查询 Host/Client 服务与 Slot。
2. `cordis_define` (kind:new, 3-6 letter idPrefix) with host+client code; `cordis_run` it. 定义并运行。
3. Host: `harness.handle('list'|'setEnabled', ...)`; read `ctx.get('loader')` for plugin entries, `entry.update({disabled})` for hot toggle. Host 用 harness.handle，loader 服务操作插件条目。
4. Client: register `settings.plugins.tab` (list slot, fresh `id`, `order: 20`, `label`). UI with `React.createElement` only (no JSX). 客户端注册设置页插件 tab。
5. **Exit**: UI works, toggle works, approve/deny flow understood. 完成标准：UI 与启停可用。

## Phase 2 — Scaffold the bundle / 搭建正式插件包

```
my-plugin/
├── package.json         # dsh.bundle + dsh.client + peerDeps + exports + scripts
├── index.d.ts           # Host half type declarations
├── index.js             # Node half (ESM, zero runtime deps)
├── cordis.patch.yml     # bundle layer: insert self
├── src/client.js        # Web half SOURCE (CommonJS: require('react'), module.exports)
├── lib/client.js        # Web half BUILD ARTIFACT — generated, never edit by hand
├── scripts/build.mjs    # zero-dep bundle builder
├── tests/               # node:test unit suite
├── README.md + README.zh.md   # bilingual docs
├── .dsh/skills/<name>/SKILL.md # project skill (optional)
└── .github/workflows/   # ci.yml + release.yml
```

### package.json essentials / 关键字段

```json
{
  "name": "dsh-plugin-hot-toggle",
  "version": "0.1.0",
  "type": "module",
  "main": "./index.js",
  "types": "./index.d.ts",
  "exports": { ".": { "types": "./index.d.ts", "default": "./index.js" }, "./client": "./lib/client.js", "./package.json": "./package.json" },
  "files": ["index.js", "index.d.ts", "lib/client.js", "cordis.patch.yml", "README.md", "README.zh.md", "docs/*.png", "LICENSE"],
  "scripts": { "build": "node scripts/build.mjs", "prepare": "node scripts/build.mjs", "test": "node --test", "check": "node scripts/build.mjs && node --test" },
  "license": "MIT",
  "publishConfig": { "access": "public" },
  "dsh": { "bundle": { "patch": "./cordis.patch.yml" }, "client": { "platform": "web" } },
  "peerDependencies": { "@deepseek-ai/cordis": "^4.0.1", "react": "^18.2.0" }
}
```

- **Name**: `dsh-<name>` (kebab-case). 包名 dsh- 前缀小写连字符。
- **Zero runtime deps**: `index.js` imports only `node:` built-ins; tests import only the package. 保持零运行时依赖。
- **`node --test`** (no glob) is cross-platform; `node --test tests/*.test.js` breaks on Windows npm. 测试脚本用 `node --test` 默认发现（glob 在 Windows npm 下不展开）。
- **`prepare`** runs on git-install builds; commit `lib/client.js` so git/npm installs need no build permission. 提交构建产物，避免 git 安装需要构建授权。

## Phase 3 — Node half / Node 半实现

- `export const name`, `export const inject = ['loader']`, `export function apply(ctx)`. 导出 name/inject/apply。
- **webServer is injected dynamically** (`ctx.inject(['webServer'], ...)`) so TUI/headless never pend. webServer 动态注入，headless 不挂起。
- HTTP API pattern (same-origin JSON): 同源 JSON API 模式：
  ```
  GET  /<pkg>/api/list          → { entries: [...] }
  POST /<pkg>/api/setEnabled    { entryId, enabled } → result
  ```
- Read plugin state: `for (const e of ctx.loader.entries())` skipping `e.options.group`. 遍历 loader 条目。
- Hot toggle: `await entry.update({ disabled: !enabled })` — in-process, no restart. 热启停核心调用。
- **Persistence**: write `- id: <bareId>` + `disabled: true|false` into `$DSH_HOME/profiles/<profile>/cordis.patch.yml` (path derived from the include's `config.path`); the official HMR watcher hot-applies on save. 持久化写用户 patch 层，HMR 热应用。
- **Protect system-core entries** (`include`, `cordis:*`, loader/hmr/timer, dynamic-plugin host runners) from being toggled. 保护系统核心条目。
- **Errors**: return structured `{ ok:false, code, error }` — `code` is a stable ErrorCode the UI localizes; `error` is the English fallback. 错误用结构化 code + 英文 fallback。
- **Same-origin guard** on writes: require `application/json` content-type and matching `Origin` header (403 otherwise). 写操作校验同源。
- Pure functions (e.g. `buildPatchContent`) must be exported for unit tests. 纯函数导出以便单测。

## Phase 4 — Web half / Web 半实现

- Source is **CommonJS** (`require('react')`, `module.exports = { inject, apply }`); `scripts/build.mjs` wraps it into `window.__ModuleLoader__.load({ id, factory })`. 源码 CJS，构建脚本包装成 ModuleLoader bundle。
- `inject = ['slots', 'locale']`; register slot with `locale: NS` so the component gets the typed `t` seat per the slot contract. 注入 slots+locale，slot 声明 locale 以获取 t 翻译函数。
- **i18n**: `ctx.locale.register(NS, { zh, en })` with balanced key sets; all UI text through `t()`. 注册 zh/en 双语字典，所有文本走 t()。
- All styling via `--dsw-alias-*` theme tokens; scoped `<style>` injected in `useEffect`. 用主题 token，样式局部注入。
- **Exit**: `npm run check` passes; `node --check index.js` passes; bundle factory body parses via `new Function`. 完成标准：check/语法全部通过。

## Phase 5 — Tests / 测试

- `tests/patch.test.js` with `node:test` + `node:assert/strict`; cover pure-function edge cases (empty content, `[]` replacement preserving comments, line update, append, explicit `disabled: false`, block structure). 单测覆盖纯函数边界情况。
- Full gate: `npm run check` (= build + test). 总闸。

## Phase 6 — Local install verification / 本地安装验证

```sh
dsh plugin --profile web add ./dsh-plugin-hot-toggle     # dev checkout
dsh --profile <tmp> --dump-config                        # confirm the layer composes
dsh plugin --profile <tmp> add ./pkg-<ver>.tgz           # tarball install smoke test
```

- Verify `GET http://127.0.0.1:3080/<pkg>/api/list` returns 200 with entries. 验证 API。
- The running DSH serves the new client bundle via client-modules incremental rebuild; **hard-refresh the browser (F5)** to load it. 运行中 DSH 增量服务新 bundle，浏览器需硬刷新。
- Note: profile `package.json` may be reset by launcher scripts on restart — re-run `dsh plugin add` if the row disappears. 注意启动脚本可能重置 profile。

## Phase 7 — Docs & assets / 文档与素材

- **Bilingual README**: `README.md` (English) + `README.zh.md` (中文), parallel sections, language switcher at top; every doc change lands in BOTH. 双语 README 同步。
- **Screenshots per locale**: `docs/screenshot-en.png` + `docs/screenshot-zh.png`; capture via headless Chrome CDP (real mouse events) and verify with a render-check script. 按语言分别截图并验证。
- **Social preview**: 1280×640 image at `.github/social-preview.png` — GitHub auto-detects it for the repo card, topic pages, and share links. 社交预览图放 .github/ 自动识别。
- **GitHub topics**: set `dsh-plugin` (+ `deepseek-harness`, `dsh`, `cordis`, feature tags) so the repo appears under <https://github.com/topics/dsh-plugin>. 设置 topics 进入主题索引。
- **No local-machine data**: no user paths, usernames, credentials in committed files. 不提交本机信息。

## Phase 8 — CI / 持续集成

`.github/workflows/ci.yml`: 3-OS × Node 18/20/22 matrix:
- `defaults.run.shell: bash` (Windows runners default to PowerShell — bash syntax breaks without this). Windows runner 默认 PowerShell，必须指定 bash。
- `node scripts/build.mjs` then `git diff --exit-code -- lib/client.js` to enforce artifact freshness. 校验构建产物新鲜度。
- `npm test` — no dependency install step (build+tests are zero-dep). 零依赖，无需 install。

## Phase 9 — Automated release / 自动化发布

`.github/workflows/release.yml` (trigger: `v*` tags):

```
permissions: { contents: write, id-token: write }
steps: checkout → setup-node(22, NO registry-url) → upgrade npm → build/verify → tests
     → npm version sync to tag → npm pack → sha256sum → npm publish --provenance (OIDC) → GitHub Release
```

**Release = `git tag` + push. Everything else is automatic.** 发布 = 打 tag 推送，其余全自动。

```sh
npm version 0.1.5 --no-git-tag-version
git commit -am "chore: release v0.1.5"
git tag v0.1.5
git push origin master --tags
```

### OIDC trusted publishing gotchas / OIDC 发布的坑（重要）

1. **npm >= 11.5.1 required** — Node 22 ships npm 10.x; run `npm install -g npm@latest` in the workflow. npm 需 ≥11.5.1（Node 22 自带 10.x，先升级）。
2. **Never set `NODE_AUTH_TOKEN`** (even empty) — npm then skips OIDC and demands a legacy token (ENEEDAUTH). 不要设置 NODE_AUTH_TOKEN（空值也不行）。
3. **No `registry-url` in setup-node** — it writes an `_authToken` line to .npmrc and breaks OIDC detection. setup-node 不要传 registry-url。
4. **One-time setup**: `npm trust github <pkg> --file release.yml --repository <owner>/<repo> --allow-publish` (needs 2FA OTP once). 一次性配置 trusted publisher。
5. **Provenance**: `npm publish --provenance` attaches SLSA supply-chain attestation automatically. 发布带供应链证明。

## Phase 10 — Publish-day checklist / 发布日检查单

- [ ] `npm run check` green. 
- [ ] `npm pack --dry-run` shows exactly the intended files (READMEs + screenshots included). 
- [ ] Bump version, commit, tag, push.
- [ ] Watch CI (3-OS) and Release workflow to green.
- [ ] `npm view <pkg> version` confirms the new version (registry replication takes ~30s). 
- [ ] GitHub Release has tarball + SHA256SUMS.
- [ ] Smoke-install from npm in a temp profile.

## Troubleshooting / 排障速查

| Symptom / 现象 | Fix / 修复 |
| --- | --- |
| Windows CI fails with bash syntax | Add `defaults.run.shell: bash`. |
| `Could not find tests\*.test.js` | Use `node --test` (no glob). |
| npm publish ENEEDAUTH in CI | Remove NODE_AUTH_TOKEN / registry-url; upgrade npm ≥11.5.1. |
| OTP required on account ops | Account 2FA is `auth-and-writes`; use `--otp=<recovery-code>` or browser flow. |
| Bundle stale in browser | Rebuild, hard-refresh (F5); client-modules serves new bytes incrementally. |
| Plugin row missing after restart | Launcher script reset profile; re-run `dsh plugin add`. |
| Chinese garbled in terminal/API | Terminal display encoding; ensure files written UTF-8; use Node (not PowerShell) for UTF-8 API calls. |
| `Entry.update` threw | Check nested id (`include:` prefix), `isProtected`, loader state via list API. |
| Locale not switching | Client `inject` includes `locale`; slot registers `locale: NS`. |
| Setting a GitHub field with Chinese via PowerShell mangles it | Use Node `fetch` (UTF-8 safe), not PowerShell `Invoke-RestMethod`. |

## Security reminders / 安全提醒

- npm recovery codes are one-time and sensitive — never share; rotate after any exposure. 恢复码一次性且敏感，暴露即轮换。
- Prefer OIDC trusted publishing over long-lived tokens (npm is deprecating bypass-2FA tokens; direct publish dies ~Jan 2027). 优先 OIDC，npm 正弃用 bypass-2FA token。
- No credentials, tokens, or local paths in committed files. 提交内容不含凭据与本机路径。
