# dsh-plugin-hot-toggle

在 DeepSeek Harness Web 设置页的「插件 → 启停管理」标签页中，对所有已安装插件**一键热启用/停用**——点击立即生效，无需重启 DSH，状态自动持久化。

[English](./README.md) | 中文文档

<p align="center">
  <a href="https://github.com/topics/dsh-plugin"><img alt="dsh-plugin topic" src="https://img.shields.io/badge/topic-dsh--plugin-1f6feb?style=flat-square&logo=github"></a>
  <a href="https://www.npmjs.com/package/dsh-plugin-hot-toggle"><img alt="npm" src="https://img.shields.io/npm/v/dsh-plugin-hot-toggle?style=flat-square"></a>
  <a href="https://github.com/5102a/dsh-plugin-hot-toggle/actions"><img alt="CI" src="https://img.shields.io/github/actions/workflow/status/5102a/dsh-plugin-hot-toggle/ci.yml?style=flat-square"></a>
  <a href="./LICENSE"><img alt="License: MIT" src="https://img.shields.io/badge/license-MIT-blue.svg?style=flat-square"></a>
</p>

## 功能特性

![启停管理界面](./docs/screenshot.png)

- **热启停**：调用 Cordis Loader 官方 `Entry.update({ disabled })`——停用即 dispose 插件 fiber，启用即重新 import 启动，进程内立即生效，无需重启 DSH。
- **持久化**：启停状态写入当前 profile 的用户 patch 层（`$DSH_HOME/profiles/<profile>/cordis.patch.yml`），由官方 HMR watcher 保存即热应用，**重启后保持**。
- **安全保护**：`include`、`cordis:*`、loader/hmr/timer、动态插件宿主等系统核心条目禁止启停（标红「系统核心」）。
- **多维筛选**（可叠加）：
  - 状态：全部 / 已启用 / 已停用
  - 来源：全部 / 官方 / 核心 / 非官方（非官方 = `$DSH_HOME/plugins` 下存在同名目录）
  - 类型：内置框架 / 客户端 UI / 模型与推理 / 工具集 / 会话与存储 / 沙箱与执行 / 代理与规划 / 服务与集成 / 其他
  - 搜索 + 计数显示（过滤数 / 总数）
- **排序**：最近安装优先（非官方插件在前）或按名称。

## 安装

### 从本地 checkout（开发）

```sh
dsh plugin --profile web add ./dsh-plugin-hot-toggle
```

### 从 npm（发布后）

```sh
dsh plugin --profile web add dsh-plugin-hot-toggle
```

### 从 git（发布后）

```sh
dsh plugin --profile web add github:5102a/dsh-plugin-hot-toggle
```

安装后启动 DSH（或由 HMR 热应用），打开 **设置 → 插件 → 启停管理** 即可使用。

## 跨平台支持

插件支持 **Windows、macOS、Linux** 三大平台（与 DeepSeek Harness 官方支持范围一致）。

| 关注点 | 保证 |
| --- | --- |
| Node half | 所有文件系统路径均通过 `node:path`（`join`/`dirname`）与 `fileURLToPath`，无硬编码分隔符 |
| 持久化 | patch 层写入使用 `readFileSync`/`writeFileSync(…, 'utf8')`，路径由 Loader include 推导 |
| HTTP API | `/plugin-hot-toggle/api/*` 是 URL 路由，与平台无关 |
| Web half | 纯浏览器 `fetch` + React，无 `process.platform`/`navigator.platform` 分支 |
| 构建 | `scripts/build.mjs` 通过 `import.meta.url` + `fileURLToPath` + `join` 解析路径 |
| 开发工具 | Chrome/Edge 发现支持 `CHROME_PATH`/`CHROME_BIN` 环境变量或跨平台候选列表；`DSH_URL` 可覆盖目标地址 |
| CI | GitHub Actions 矩阵：**ubuntu + windows + macos** × Node 18/20/22 |

## 工作原理

```
┌─────────────────────────────┐         ┌──────────────────────────────┐
│  Web (client half)          │  fetch  │  Node (host half)             │
│  settings.plugins.tab       │ ──────► │  /plugin-hot-toggle/api/*     │
│  「启停管理」tab             │  JSON   │  ┌──────────────────────────┐ │
│  - 列表 + 筛选 + 排序        │ ◄────── │  │ ctx.loader.entries()     │ │
│  - 启停按钮                 │         │  │ entry.update({disabled}) │ │
└─────────────────────────────┘         │  │ → fiber dispose / start  │ │
                                        │  └──────────────────────────┘ │
                                        │  ┌──────────────────────────┐ │
                                        │  │ 持久化：写 cordis.patch  │ │
                                        │  │ .yml → HMR 热应用        │ │
                                        │  └──────────────────────────┘ │
                                        └──────────────────────────────┘
```

- **Node half** 只使用公开 seam（`loader`、`webServer`、`dshHomePath`），零 DSH 核心改动；`webServer` 动态注入，TUI/headless 表面不会 pending。
- **Web half** 通过同源 HTTP API 与 Node half 通信；写操作带 same-origin 校验（缺 Origin / 跨域拒绝 403）。
- **Client bundle** 由 `src/client.js` 经零依赖构建脚本生成（`node scripts/build.mjs`），构建产物提交进仓库，git/npm 安装无需构建权限。

## 目录结构

```
dsh-plugin-hot-toggle/
├── package.json         # dsh.bundle 声明 + peerDependencies + exports
├── index.d.ts           # Host half 类型声明
├── index.js             # Node half：Loader 列表/启停 + webServer HTTP API
├── cordis.patch.yml     # bundle 层：插入自身插件行
├── src/client.js        # Web half 源码（React）
├── lib/client.js        # Web half 构建产物（生成，勿手改）
├── scripts/build.mjs    # 零依赖 client bundle 构建
├── scripts/screenshot.mjs   # headless-Chrome 截图（CDP，零依赖）
├── scripts/verify-render.mjs # 验证「启停管理」标签页已渲染
├── scripts/debug-dom.mjs    # DOM/slot 调试辅助
├── tests/patch.test.js  # 单元测试（node:test）
└── .github/workflows/ci.yml  # CI：构建 + 产物新鲜度检查 + 测试
```

## API

| Method | Path | Body | Returns |
| --- | --- | --- | --- |
| GET | `/plugin-hot-toggle/api/list` | — | `{ entries: PluginEntry[] }` |
| POST | `/plugin-hot-toggle/api/setEnabled` | `{ entryId, enabled }` | `SetEnabledResponse` |

`PluginEntry` / `SetEnabledResponse` 见 [index.d.ts](./index.d.ts)。

## 开发

```sh
npm run build   # 由 src/client.js 生成 lib/client.js
npm test        # node:test 单元测试
npm run check   # build + test 一步到位
```

## 发布

```sh
npm run check && npm run build
npm publish
```

> 包名 `dsh-plugin-hot-toggle` 发布前已用 `npm view` 确认可用。

> **关于 peer 依赖警告**：本包声明了 `@deepseek-ai/cordis` 与 `react` 作为 peer 依赖（与官方 `@deepseek-ai/*` 插件相同的模式）。DSH 通过 profile 的 flat fallback 从自身安装目录解析这些依赖，因此 `dsh plugin add` 时出现 "unmet peer" 警告属于预期且无害。

## 许可证

MIT — 见 [LICENSE](./LICENSE)。
