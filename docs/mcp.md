# MCP 接入说明

这份文档说明如何把 Polaris 接入到支持 MCP 的 AI 工具。

Polaris 当前支持两种 MCP 入口：

- Streamable HTTP
- stdio

如果你的目标是“先启动 Polaris 服务，再让多个 AI 工具共享连接”，优先使用 Streamable HTTP。

## 推荐方式：Streamable HTTP

### 1. 启动 Polaris

```bash
pnpm polaris:start
```

### 2. 查看当前 MCP 地址

```bash
pnpm polaris:status
```

或者：

```bash
node packages/cli/dist/bin.cjs mcp-url
```

默认情况下，MCP 地址通常是：

```text
http://127.0.0.1:19602/mcp
```

如果默认端口被占用，Polaris 会自动切换到新的可用端口，因此请以实际输出为准。

### 3. 在 AI 工具中配置 MCP

把上一步得到的地址填到你的 MCP 客户端中即可。

适合这种模式的工具：

- 支持 HTTP MCP 的桌面工具
- 支持连接本地服务的 Agent 工具
- 希望多个工具共享同一个 Polaris 实例的场景

## 兼容方式：stdio

如果你的 MCP 客户端不支持 HTTP，只支持通过命令拉起 MCP Server，可以使用 stdio。

启动命令：

```bash
pnpm mcp
```

开发模式：

```bash
pnpm dev:mcp
```

这种方式更适合：

- 只能配置命令的 MCP 客户端
- 本地开发和协议调试

## Pack 能力包接入

Polaris 同时支持全量能力接入与按 pack（能力包）接入。

### 全量入口

- `http://127.0.0.1:<mcpPort>/mcp`

### 按 pack 过滤的入口

- `http://127.0.0.1:<mcpPort>/mcp/mock`
- `http://127.0.0.1:<mcpPort>/mcp/proxy`
- `http://127.0.0.1:<mcpPort>/mcp/request`
- `http://127.0.0.1:<mcpPort>/mcp/ops`

支持的 pack 别名：

- `mock`
- `proxy`
- `request`
- `ops`

## Legacy MCP HTTP（兼容模式）

如果你接的是旧客户端，还可以使用兼容接口：

- `GET /packs`
- `GET /packs/:pack/tools`
- `GET /tools?pack=mock`
- `GET /resources?pack=request`
- `POST /invoke/:tool?pack=proxy`

未知 pack 会返回结构化错误。

## stdio MCP

可以使用工作区脚本：

```bash
pnpm mcp
pnpm dev:mcp
```

也可以直接使用 CLI：

```bash
node packages/cli/dist/bin.cjs mcp-stdio
node packages/cli/dist/bin.cjs mcp-stdio --pack mock
```

`--pack` 支持：

- `mock`
- `proxy`
- `request`
- `ops`

## Pack 定义

### `mock_pack.v1`

- Mock 规则生命周期管理
- 活动分组管理

### `proxy_pack.v1`

- 代理模式管理
- Host 规则管理
- 代理决策预览

### `request_pack.v1`

- 抓包与保存请求查询
- 运行与回放请求
- 清理请求

### `ops_pack.v1`

- 健康状态查询
- 运行配置查询
- 证书就绪性查询

## 推荐接入策略

- 对 AI Agent 默认使用 pack 接入，降低工具选择负担与上下文开销
- 保留全量 `/mcp` 入口用于管理与调试
- 保留兼容入口用于旧客户端接入
