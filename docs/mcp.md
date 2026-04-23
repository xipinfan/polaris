# MCP 接入说明

## 启动并获取地址

```bash
polaris start
polaris mcp-url
```

默认通常是 `http://127.0.0.1:19602/mcp`，但以本机实际输出为准。

## 入口模型（当前实现）

- 全量入口：`/mcp`
- 分能力入口：
  - `/mcp/request`
  - `/mcp/mock`
  - `/mcp/proxy`
  - `/mcp/ops`

## 选择建议

### 只做请求相关

使用 `/mcp/request`。

### 需要 mock / 代理 / HTTPS 排障

使用 `/mcp`（全量），或同时接入对应 pack（`mock/proxy/ops`）。

注意：`get_workspace_snapshot`、`setup_https` 属于 `ops`，不在 `request` pack 内。

## stdio 方式

```bash
polaris mcp-stdio
polaris mcp-stdio --pack request
polaris mcp-stdio --pack mock
polaris mcp-stdio --pack proxy
polaris mcp-stdio --pack ops
```

## 工具分层（概念）

- 合并工具（SDK MCP 主路径）：`query_* / mutate_*` 等
- legacy 原子工具（兼容路径）：`list_requests`、`list_proxy_rules` 等

## legacy `/invoke` 与标准 MCP 的区别

- 标准 MCP：返回 `structuredContent + content`
- legacy `/invoke/:tool`：返回 `{ data: ... }`

推荐优先使用标准 MCP；`/invoke` 主要用于兼容旧脚本。

