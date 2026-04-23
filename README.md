# Polaris

Polaris 是一个本地接口工作台，包含三部分：

- Core（本地代理与接口能力）
- Web Console（主工作台）
- Browser Extension（浏览器快捷控制面板）

## 快速开始

1. 安装依赖

```bash
corepack pnpm install
```

2. `polaris` 命令来源（两种方式）

- 方式 A：全局安装 CLI

```bash
npm i -g polaris-workbench
```

- 方式 B：在仓库内使用 pnpm 脚本（无需全局安装）
  - 启动：`corepack pnpm polaris:start`
  - 状态：`corepack pnpm polaris:status`
  - 停止：`corepack pnpm polaris:stop`

3. 开发模式（Core + Console）

```bash
corepack pnpm dev
```

4. 产品链路启动（CLI）

```bash
corepack pnpm polaris:start
corepack pnpm polaris:status
```

## 常用命令

```bash
corepack pnpm dev
corepack pnpm dev:core
corepack pnpm dev:console
corepack pnpm dev:extension
corepack pnpm dev:mcp

corepack pnpm build
corepack pnpm typecheck

corepack pnpm test:e2e
corepack pnpm test:e2e:page -- --page home
```

## Console 页面（当前实现）

- `/` 首页
- `/traffic` 实时请求
- `/proxy-forward` 代理转发
- `/mock` Mock 与已保存请求管理
- `/debug` 调试请求
- `/settings` 设置

说明：历史路径 `/requests` 与 `/rules` 当前会重定向到 `/mock`。

## MCP 接入（当前实现）

- 全量入口：`/mcp`
- 分能力入口：`/mcp/request`、`/mcp/mock`、`/mcp/proxy`、`/mcp/ops`
- stdio：`polaris mcp-stdio`（可用 `--pack request|mock|proxy|ops`）

## 文档导航

- [Web Console 使用说明](./docs/console.md)
- [浏览器扩展使用说明](./docs/extension.md)
- [MCP 接入说明](./docs/mcp.md)
- [开发说明](./docs/development.md)
- [E2E 与视觉测试](./docs/e2e-testing.md)

## 历史文档说明

`docs/prd/*`、`docs/prompts/*`、`docs/structural/*`、`docs/superpowers/plans/*` 为历史规划资料，不作为当前实现事实源。请以上述使用/开发文档和代码为准。
