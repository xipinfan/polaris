# Polaris Monorepo（当前实现快照）

## 顶层结构

```text
apps/
  core/
  console/
  extension/
packages/
  shared-types/
  shared-contracts/
  shared-utils/
  mcp-contracts/
  extension-sdk/
docs/
scripts/
configs/
```

## apps 说明

### `apps/core`

- 本地代理与抓包
- 请求保存与重放
- Mock 规则管理
- 代理规则管理
- MCP（streamable HTTP / SSE / legacy invoke）

`src/modules` 当前主要包含：

- `requests`
- `mock`
- `proxy`
- `mcp`
- `storage`
- `extensions`
- `whistle-import`

### `apps/console`

当前页面能力：

- 首页 `/`
- 实时请求 `/traffic`
- 代理转发 `/proxy-forward`
- Mock 与请求资产 `/mock`
- 调试 `/debug`
- 设置 `/settings`

说明：历史独立“已保存请求页”已并入 `/mock` 工作区；`/requests` 为兼容重定向。

### `apps/extension`

- Popup 代理模式切换
- 当前站点规则快捷开关
- 打开 Console / 设置 / 证书设置
- 与 Core 自动端口发现与同步

## packages 说明

### `shared-types`

跨端业务对象类型。

### `shared-contracts`

Core API 请求/响应契约。

### `mcp-contracts`

MCP 工具、资源、pack 注册与别名解析。

### `shared-utils`

跨包通用工具。

### `extension-sdk`

扩展能力预留与类型约定。

## MCP Pack（当前）

- `request`
- `mock`
- `proxy`
- `ops`

对应 HTTP 入口：`/mcp/request`、`/mcp/mock`、`/mcp/proxy`、`/mcp/ops`，全量入口为 `/mcp`。

