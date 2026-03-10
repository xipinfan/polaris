# MCP 接入

这份文档介绍如何把 Polaris 接入到支持 MCP 的 AI 工具中。

Polaris 当前提供两种 MCP 接入方式：

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
node packages/cli/dist/bin.js mcp-url
```

默认情况下，MCP 地址通常是：

```text
http://127.0.0.1:9002/mcp
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

## 当前 MCP 能力

Polaris 对 MCP 开放的能力主要包括：

- 查询最近请求
- 查询请求详情
- 查询已保存请求
- 获取已保存请求详情
- 重放请求
- 手动发起请求
- 创建 Mock 规则
- 启用或停用 Mock 规则
- 查询代理规则
- 读取代理模式

此外还提供资源读取能力，用于读取：

- 最近请求
- 已保存请求
- Mock 规则
- 代理模式
- 代理规则

## 端口说明

Polaris 默认优先使用 `9002` 作为 MCP 端口。

如果 `9002` 被占用，会自动切换到新的可用端口。你不需要手动改代码，但需要通过 `pnpm polaris:status` 获取实际地址。

## 常见问题

### 为什么我连不上 `9002`

可能原因：

- Polaris 没有启动
- `9002` 被占用后，MCP 自动切换到了别的端口

先执行：

```bash
pnpm polaris:status
```

确认当前真实的 MCP 地址。

### 什么时候用 HTTP，什么时候用 stdio

可以按下面理解：

- 想把 Polaris 当作一个常驻本地服务来用：优先用 HTTP
- AI 工具只能配置一条命令：用 stdio

### stdio 和 HTTP 的能力一样吗

当前两者共用同一套业务层能力，核心工具和资源是一致的，区别主要在接入方式。
