---
name: dsh-plugin-hot-toggle
description: Develop, build, test, and publish the dsh-plugin-hot-toggle DeepSeek Harness plugin — a Web settings tab that hot-toggles installed Cordis Loader plugins. Use this skill whenever working in the dsh-plugin-hot-toggle repository: editing the Node half (index.js), the Web half (src/client.js → lib/client.js build chain), running or extending the node:test suite, releasing to npm/GitHub, regenerating the UI screenshot, or keeping the bilingual READMEs in sync.
---

# dsh-plugin-hot-toggle Development SOP

Standard operating procedures for the **dsh-plugin-hot-toggle** repository. Follow these exactly so builds stay reproducible, the shipped bundle stays fresh, and releases stay clean.

## Repository map

```
dsh-plugin-hot-toggle/
├── package.json         # dsh.bundle + dsh.client declarations, peerDeps, exports, scripts
├── index.d.ts           # Host half type declarations (PluginEntry / SetEnabledResponse)
├── index.js             # Node half: loader list/toggle + webServer HTTP API (ESM, zero runtime deps)
├── cordis.patch.yml     # bundle layer: inserts the plugin row
├── src/client.js        # Web half SOURCE (CommonJS module, require('react'), module.exports)
├── lib/client.js        # Web half BUILD ARTIFACT — generated, NEVER edit by hand
├── scripts/build.mjs    # zero-dependency bundle builder (src/client.js → lib/client.js)
├── scripts/screenshot.mjs     # headless-Chrome UI screenshot via CDP (zero deps)
├── scripts/verify-render.mjs  # verify the 启停管理 tab actually rendered
├── scripts/debug-dom.mjs      # DOM/slot debugging helper
├── tests/patch.test.js  # node:test unit suite (buildPatchContent)
├── README.md / README.zh.md   # bilingual docs — keep both in sync
└── .github/workflows/ci.yml   # 3-OS × Node 18/20/22 matrix
```

## Golden rules

1. **Never edit `lib/client.js` by hand.** Edit `src/client.js`, run `node scripts/build.mjs`, and commit the regenerated artifact.
2. **Zero runtime dependencies.** `index.js` imports only `node:` built-ins; the tests import only the package itself. Do not add dependencies unless there is no Node-builtin alternative.
3. **Bilingual docs.** Any README change lands in BOTH `README.md` (English) and `README.zh.md` (中文). Section headings stay parallel.
4. **No local-machine data.** No user paths, usernames, credentials, or machine-specific strings in committed files. (git identity may appear only as the public repository metadata in package.json/README.)
5. **Before every commit:** `npm run check` (build + tests) and confirm the working tree contains only intended changes.

## Development loop (editing code)

### Edit the Web half (UI)

1. Edit `src/client.js` (React via `require('react')`, `React.createElement` only — no JSX).
2. Regenerate the bundle: `node scripts/build.mjs` (or `npm run build`).
3. Syntax-check the artifact: extract the `factory: (require) => { ... }` body and `new Function(...)` it (see the verify pattern in scripts/verify-render.mjs).
4. The running DSH instance serves the new bundle via client-modules incremental rebuild — verify with `Invoke-WebRequest http://127.0.0.1:3080/plugins/dsh-plugin-hot-toggle/client.js` (GitHub UI notes: `scripts/screenshot.mjs` and `scripts/verify-render.mjs` are dev-only and not shipped).

### Edit the Node half (Host API)

1. Edit `index.js` (ESM). It exposes: `name`, `inject: ['loader']`, `apply(ctx)`, and pure `buildPatchContent(content, entryId, enabled)`.
2. Syntax-check: `node --check index.js`.
3. Runtime-verify the API against a live DSH:
   - `GET http://127.0.0.1:3080/plugin-hot-toggle/api/list` → `{ entries: [...] }`
   - `POST http://127.0.0.1:3080/plugin-hot-toggle/api/setEnabled` with `Origin` header matching the host → hot toggle + persist
4. Unit-test the pure function: `node --test tests/patch.test.js`.

## Testing SOP

- Run: `npm test` (node:test, zero deps).
- Add cases to `tests/patch.test.js` for any change to `buildPatchContent` (empty content, `[]` replacement with comments preserved, existing-line update, append, explicit `disabled: false`, block structure).
- Full gate: `npm run check` (= build + test).

## Publishing SOP

1. **Preflight:**
   - `npm run check`
   - `npm pack --dry-run` → expect exactly 8 files: LICENSE, README.md, README.zh.md, cordis.patch.yml, index.d.ts, index.js, lib/client.js, package.json.
   - `npm publish --dry-run` → public access, no errors.
2. **Name availability** (first release only): `npm view dsh-plugin-hot-toggle` → 404 means free.
3. **Tag + push:**
   ```sh
   git tag v0.1.0
   git push origin master --tags
   ```
4. **Publish:**
   ```sh
   npm publish
   ```
5. **Verify the published artifact installs** (fresh profile, no pollution):
   ```sh
   dsh plugin --profile hot-toggle-test add ./dsh-plugin-hot-toggle-<ver>.tgz
   dsh --profile hot-toggle-test --dump-config   # expect a "# == dsh-plugin-hot-toggle" layer
   dsh plugin --profile hot-toggle-test remove dsh-plugin-hot-toggle
   # then delete the test profile dir
   ```
6. **GitHub topics** (after repo push): add `dsh-plugin` so the package appears under <https://github.com/topics/dsh-plugin> — via repo Topics UI or `gh repo edit <owner>/dsh-plugin-hot-toggle --add-topic dsh-plugin`.

### Known release notes

- `dsh plugin add` may print an "unmet peer" warning for `@deepseek-ai/cordis` / `react`. This is expected: DSH resolves them from its own install via the profile flat fallback (same as official `@deepseek-ai/*` plugins). Document it, do not chase it.

## Screenshot SOP (README image)

The UI screenshot (`docs/screenshot.png`) is captured from a **live DSH** via headless Chrome CDP:

1. Start DSH with the plugin installed; confirm `GET /plugin-hot-toggle/api/list` returns 200.
2. `node scripts/screenshot.mjs docs/screenshot.png` — navigates Settings → Plugins → 启停管理 with real mouse events.
3. Verify the capture: `node scripts/verify-render.mjs` must report `hptClasses > 0`, `toggles == <entry count>`, and a `N / N 个插件` meta line.
4. `CHROME_PATH` / `DSH_URL` env vars override Chrome discovery and the target origin.

## Installation paths (users)

| Source | Command |
| --- | --- |
| Local checkout | `dsh plugin --profile web add ./dsh-plugin-hot-toggle` |
| npm (published) | `dsh plugin --profile web add dsh-plugin-hot-toggle` |
| git (published) | `dsh plugin --profile web add github:<owner>/dsh-plugin-hot-toggle` |
| tarball | `dsh plugin --profile web add ./dsh-plugin-hot-toggle-<ver>.tgz` |

All three platforms (Windows/macOS/Linux) are supported; CI covers the matrix.

## Troubleshooting

- **Bundle looks stale in the browser**: rebuild (`npm run build`), confirm client-modules served the new bytes, then hard-refresh the page (F5). The web boot graph is generated at process start; plugin bundle *content* changes are picked up incrementally, but a fresh page load is required to execute the new bundle.
- **Plugin row missing after DSH restart**: the profile `cordis.patch.yml` / `package.json` may have been reset by a launcher script (a known local environment hazard). Re-run `dsh plugin --profile web add <source>` and re-add the hot-load insert if needed.
- **`Entry.update` threw**: check the entry id (nested ids use `include:` prefix), whether the entry is system-core (`isProtected`), and the loader state via the list API.
- **CI fails on Windows**: the matrix uses `node scripts/build.mjs` and `npm test` directly (no dependency install); verify the failing step reproduces locally with `npm run check`.
