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

## 更新已保存请求

标准 MCP 使用 `mutate_request(op="update")` 更新已保存请求。其输入字段按 `UpdateSavedRequestInput` 契约处理；legacy 兼容路径使用 `/invoke/update_saved_request`，内部字段语义一致，但返回外层不同。

示例：

```json
{
  "op": "update",
  "id": "saved-123",
  "name": "登录接口 - 带分页",
  "query": {
    "page": 1,
    "debug": true,
    "roles": ["admin", "tester"],
    "obsolete": null
  },
  "headers": {
    "x-trace": 9001,
    "x-old": null
  }
}
```

归一化规则：

- `headers` / `query` 的 `number`、`boolean` 会转为字符串后保存。
- `headers` / `query` 的 `null` 表示删除对应 key，不会保存为 `null`。
- `query` 数组会用逗号拼接为单个字符串，例如 `["admin", "tester"]` 保存为 `"admin,tester"`。
- 第一阶段不支持严格多值 query 语义；如果数组元素本身包含逗号，读取时无法还原原始多值边界。
- `headers` / `query` 的对象值会被拒绝，并返回字段路径错误。

如果把抓包请求 id 当作已保存请求 id 去 update，会返回 `REQUEST_ID_NOT_SAVED`。应先调用 `mutate_request(op="save", requestId="抓包请求 id")`，再用返回的 saved request id 更新。
