# dsh-plugin-hot-toggle

在 DeepSeek Harness Web 设置页的「插件 → 启停管理」标签页中，对所有已安装插件**一键热启用/停用**——点击立即生效，无需重启 DSH。

Hot-toggle any installed plugin from the Web settings page (Plugins → 启停管理): stop or start a Loader entry in-process with instant effect and no DSH restart.

## 功能特性

- **热启停**：调用 Cordis Loader 官方 `Entry.update({ disabled })`，停用即 dispose 插件 fiber，启用即重新 import 启动，进程内立即生效。
- **持久化**：启停状态写入当前 profile 的用户 patch 层（`$DSH_HOME/profiles/<profile>/cordis.patch.yml`），由官方 HMR watcher 保存即热应用，**重启后保持**。
- **来源过滤**：官方 / 核心 / 非官方（非官方 = `$DSH_HOME/plugins` 下存在同名目录，如 `dsh-memory-evolve`）。
- **类型过滤**：内置框架 / 客户端 UI / 模型与推理 / 工具集 / 会话与存储 / 沙箱与执行 / 代理与规划 / 服务与集成 / 其他。
- **排序**：最近安装优先（非官方插件在前）或按名称。
- **安全保护**：`include`、`cordis:*`、loader/hmr/timer、动态插件宿主等系统核心条目禁止启停（标红「系统核心」）。

## 安装

```sh
# 在插件仓库目录内，将 checkout 安装进 web profile
dsh plugin --profile web add ./dsh-plugin-hot-toggle
```

安装后启动 DSH（或由 HMR 热应用），打开 **设置 → 插件 → 启停管理** 即可使用。

## 结构

```
dsh-plugin-hot-toggle/
├── package.json         # dsh.bundle 声明（cordis.patch.yml）
├── cordis.patch.yml     # bundle 层：插入自身插件行
├── index.js             # Node half：Loader 列表/启停 + webServer HTTP API
└── lib/client.js        # Web half：启停管理 tab（ModuleLoader bundle）
```

- Node half 只使用公开 seam（`loader`、`webServer`、`dshHomePath`），零 DSH 核心改动；`webServer` 动态注入，TUI/headless 表面不会 pending。
- Web half 通过同源 HTTP API（`/plugin-hot-toggle/api`）与 Node half 通信；写操作带 same-origin 校验。

## API

| Method | Path | Body | Returns |
| --- | --- | --- | --- |
| GET | `/plugin-hot-toggle/api/list` | — | `{ entries: [{ entryId, moduleName, enabled, fiberPhase, protected, category, type, community, sortKey }] }` |
| POST | `/plugin-hot-toggle/api/setEnabled` | `{ entryId, enabled }` | `{ ok, entryId, enabled, fiberPhase, persisted, persistError }` |

## License

MIT
