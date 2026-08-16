---
name: dsh-plugin-hot-toggle
description: Develop, build, test, and publish the dsh-plugin-hot-toggle DeepSeek Harness plugin — a Web settings tab that hot-toggles installed Cordis Loader plugins. Use this skill whenever working in the dsh-plugin-hot-toggle repository: editing the Node half (index.js), the Web half (src/client.js → lib/client.js build chain), running or extending the node:test suite, releasing to npm/GitHub, regenerating the UI screenshot, or keeping the bilingual READMEs in sync. 开发、构建、测试并发布 dsh-plugin-hot-toggle 插件（DSH 设置页热启停已安装 Cordis 插件）。在本仓库内工作时使用：编辑 Node half（index.js）、Web half（src/client.js → lib/client.js 构建链）、运行/扩展 node:test 测试、发布到 npm/GitHub、重新生成 UI 截图，或同步双语 README。
---

# dsh-plugin-hot-toggle Development SOP / 开发标准作业流程

Standard operating procedures for the **dsh-plugin-hot-toggle** repository. Follow these exactly so builds stay reproducible, the shipped bundle stays fresh, and releases stay clean. 本仓库的标准作业流程，严格遵循以确保构建可复现、发布包保持最新、发布干净。

## Repository map / 仓库结构

```
dsh-plugin-hot-toggle/
├── package.json         # dsh.bundle + dsh.client declarations, peerDeps, exports, scripts
├── index.d.ts           # Host half type declarations (PluginEntry / SetEnabledResponse / ErrorCode)
├── index.js             # Node half: loader list/toggle + webServer HTTP API (ESM, zero runtime deps)
├── cordis.patch.yml     # bundle layer: inserts the plugin row
├── src/client.js        # Web half SOURCE (CommonJS, require('react'), zh/en locale dictionaries)
├── lib/client.js        # Web half BUILD ARTIFACT — generated, NEVER edit by hand
├── scripts/build.mjs    # zero-dependency bundle builder (src/client.js → lib/client.js)
├── scripts/screenshot.mjs     # headless-Chrome UI screenshot via CDP (zero deps)
├── scripts/verify-render.mjs  # verify the 启停管理 tab actually rendered
├── scripts/debug-dom.mjs      # DOM/slot debugging helper
├── tests/patch.test.js  # node:test unit suite (buildPatchContent)
├── README.md / README.zh.md   # bilingual docs — keep both in sync
└── .github/workflows/   # ci.yml (3-OS × Node 18/20/22) + release.yml (tag-triggered)
```

## Golden rules / 铁律

1. **Never edit `lib/client.js` by hand.** Edit `src/client.js`, run `node scripts/build.mjs`, and commit the regenerated artifact. 禁止手改 `lib/client.js`，只改 `src/client.js` 后构建并提交产物。
2. **Zero runtime dependencies.** `index.js` imports only `node:` built-ins; the tests import only the package itself. 保持零运行时依赖（只用 Node 内置模块）。
3. **Bilingual docs.** Any README change lands in BOTH `README.md` (English) and `README.zh.md` (中文). 文档改动必须同步中英两个 README。
4. **No local-machine data.** No user paths, usernames, credentials, or machine-specific strings in committed files. 不提交本机路径、用户名、凭据等机器特有信息。
5. **Every UI string is localized.** All user-facing text goes through the `t()` translate function (namespace `pluginHotToggle`); error responses carry a structured `code` the UI maps to `t()`. 所有用户可见文本走 `t()` 翻译；接口错误用结构化 `code` 由 UI 本地化。
6. **Before every commit:** `npm run check` (build + tests) and confirm the working tree contains only intended changes. 每次提交前运行 `npm run check` 并确认改动范围。

## Development loop / 开发循环

### Edit the Web half / 修改 Web half（UI）

1. Edit `src/client.js` (React via `require('react')`, `React.createElement` only — no JSX). 编辑 `src/client.js`（只用 React.createElement，不用 JSX）。
2. Regenerate the bundle: `node scripts/build.mjs` (or `npm run build`). 重新生成 bundle。
3. Syntax-check the artifact: extract the `factory: (require) => { ... }` body and `new Function(...)` it. 用 `new Function` 校验 bundle factory 语法。
4. New UI strings: add keys to BOTH `zh` and `en` dictionaries (balanced). 新增 UI 文本必须同时加入 zh/en 字典（键集平衡）。
5. The running DSH serves the new bundle via client-modules incremental rebuild — verify with `Invoke-WebRequest http://127.0.0.1:3080/plugins/dsh-plugin-hot-toggle/client.js`. 运行中的 DSH 通过 client-modules 增量重建服务新 bundle，可验证。

### Edit the Node half / 修改 Node half（Host API）

1. Edit `index.js` (ESM). It exposes: `name`, `inject: ['loader']`, `apply(ctx)`, and pure `buildPatchContent(content, entryId, enabled)`. 编辑 `index.js`（ESM）。
2. Syntax-check: `node --check index.js`. 语法检查。
3. Runtime-verify the API against a live DSH: `GET /plugin-hot-toggle/api/list`, `POST /plugin-hot-toggle/api/setEnabled` (with `Origin` header). 对运行中的 DSH 实测 API。
4. Errors: return `{ ok:false, code, error }` — `code` is a stable ErrorCode the UI localizes; `error` is the English fallback. 错误统一返回结构化 `{ ok:false, code, error }`。
5. Unit-test the pure function: `node --test tests/patch.test.js`. 单测纯函数。

## Testing SOP / 测试流程

- Run: `npm test` (`node --test` — default discovery, cross-platform). 运行 `npm test`（默认发现测试，跨平台）。
- Add cases to `tests/patch.test.js` for any change to `buildPatchContent`. 修改 `buildPatchContent` 时必须补测试。
- Full gate: `npm run check` (= build + test). 总闸 `npm run check`。

## Publishing SOP / 发布流程

1. **Preflight:** `npm run check`; `npm pack --dry-run` → expect exactly 10 files (LICENSE, README.md, README.zh.md, cordis.patch.yml, index.d.ts, index.js, lib/client.js, docs/screenshot-en.png, docs/screenshot-zh.png, package.json). 预检：check + pack 期望恰好 10 个文件（含两张多语言截图）。
2. **Name availability** (first release only): `npm view dsh-plugin-hot-toggle` → 404 means free. 首次发布前确认包名空闲。
3. **Tag + push:**
   ```sh
   git tag v0.1.2
   git push origin master --tags   # triggers CI + Release workflow
   ```
4. **Publish npm** (requires 2FA OTP — recovery code or browser security key):
   ```sh
   npm publish --otp=<recovery-code>
   ```
5. **Verify** the published artifact installs in a fresh profile (`dsh plugin --profile verify add ...` then `dsh --profile verify --dump-config`). 用临时 profile 验证发布产物可安装。
6. **GitHub topics:** keep `dsh-plugin` (+ related) set so the repo appears under <https://github.com/topics/dsh-plugin>. 保持 topics 包含 `dsh-plugin`。

### Known release notes / 已知发布要点

- `dsh plugin add` may print an "unmet peer" warning for `@deepseek-ai/cordis` / `react`. Expected: DSH resolves them from its own install (flat fallback), same as official plugins. `dsh plugin add` 可能提示 peer 依赖警告，属预期（与官方插件一致）。
- npm publish requires 2FA (`auth-and-writes`). Use a recovery code (`--otp`) or the browser security-key flow. npm 发布需 2FA，可用恢复码或浏览器安全密钥。
- Recovery codes are one-time and sensitive — never share; rotate them after any exposure. 恢复码一次性且敏感，切勿分享；暴露后立即轮换。

## Screenshot SOP / 截图流程（README 图）

1. Start DSH with the plugin installed; confirm `GET /plugin-hot-toggle/api/list` returns 200. 启动带插件的 DSH。
2. `node scripts/screenshot.mjs docs/screenshot-zh.png` — navigates Settings → Plugins → 启停管理 with real mouse events; capture per locale (zh/en) as needed. 用 CDP 真实鼠标事件导航并截图；按语言（zh/en）分别产出 `docs/screenshot-zh.png` / `docs/screenshot-en.png`。
3. Verify: `node scripts/verify-render.mjs` must report `hptClasses > 0`, `toggles == <entry count>`, and a `N / N 个插件` meta line. 验证截图内容。
4. `CHROME_PATH` / `DSH_URL` env vars override Chrome discovery and the target origin. 环境变量可覆盖 Chrome 路径与目标地址。

## Installation paths / 安装方式

| Source / 来源 | Command / 命令 |
| --- | --- |
| Local checkout / 本地 | `dsh plugin --profile web add ./dsh-plugin-hot-toggle` |
| npm (published) | `dsh plugin --profile web add dsh-plugin-hot-toggle` |
| git (published) | `dsh plugin --profile web add github:<owner>/dsh-plugin-hot-toggle` |
| tarball | `dsh plugin --profile web add ./dsh-plugin-hot-toggle-<ver>.tgz` |

All three platforms (Windows/macOS/Linux) are supported; CI covers the matrix. 三平台全支持，CI 覆盖矩阵。

## Troubleshooting / 排障

- **Bundle looks stale in the browser**: rebuild (`npm run build`), confirm client-modules served new bytes, hard-refresh (F5). bundle 陈旧：重建并硬刷新页面。
- **Plugin row missing after DSH restart**: profile `cordis.patch.yml` / `package.json` may have been reset by a launcher script. Re-run `dsh plugin --profile web add <source>`. 重启后插件行丢失：可能是启动脚本重置了 profile，重新 add。
- **`Entry.update` threw**: check the entry id (nested ids use `include:` prefix), whether the entry is system-core (`isProtected`), and the loader state via the list API. 检查条目 id（嵌套带 `include:` 前缀）、是否核心条目、loader 状态。
- **CI fails on Windows**: the matrix uses `bash` shell (`defaults.run.shell: bash`) and `node --test` (no shell glob); verify locally with `npm run check`. Windows CI 失败：确认 bash shell 与 node --test 无 glob 依赖。
- **Locale not switching**: ensure the client half declares `inject: ['slots', 'locale']` and the slot registration sets `locale: NS`; the `t` seat then follows the user preference. 语言不切换：确认 client inject 含 locale 且 slot 声明 locale。
