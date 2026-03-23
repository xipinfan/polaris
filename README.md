# Polaris

Polaris 是一个面向本地开发联调的 API 工作台。

它把几件原本分散的事情整合成了一个本地服务：

- 代理并捕获请求
- 保存、重放和调试请求
- 管理 Mock 规则
- 通过 MCP 把这些能力提供给 AI 工具

Polaris 的目标很简单：

安装一次，启动一个本地服务，然后让 Web Console、浏览器扩展和 AI 工具都连接到它。

进一步阅读：

- [MCP 接入说明](/E:/code/polaris/docs/mcp.md)
- [Web Console 使用说明](/E:/code/polaris/docs/console.md)
- [浏览器扩展使用说明](/E:/code/polaris/docs/extension.md)
- [开发说明](/E:/code/polaris/docs/development.md)
- [E2E 与视觉测试](/E:/code/polaris/docs/e2e-testing.md)

## 适合谁

如果你正在做下面这些事情，Polaris 会比较适合：

- 本地联调前后端接口
- 需要快速抓取和重放请求
- 需要维护自己的 Mock 数据
- 想把请求调试能力接给 Gemini CLI、Cursor、Cline 或其他 MCP 客户端

## 核心能力

- 本地代理服务
- Web Console
- 浏览器扩展
- 标准 MCP Streamable HTTP
- MCP stdio 兼容入口
- 端口占用时自动切换到可用端口
- 本地用户级数据目录，不把个人调试数据写进 Git

## 快速开始

### 1. 安装依赖

```bash
pnpm install
```

### 2. 构建项目

```bash
pnpm build
```

### 3. 启动 Polaris

```bash
pnpm polaris:start
```

查看运行状态：

```bash
pnpm polaris:status
```

停止服务：

```bash
pnpm polaris:stop
```

## 使用 Web Console

开发模式下启动 Console：

```bash
pnpm dev
```

然后访问：

- [http://127.0.0.1:5173](http://127.0.0.1:5173)

主要页面：

- `/` 首页总览
- `/traffic` 实时请求
- `/requests` 已保存请求
- `/mock` Mock 管理
- `/debug` 手动调试
- `/settings` 服务状态与配置

详细说明见：

- [Web Console 使用说明](/E:/code/polaris/docs/console.md)

## 接入 MCP

Polaris 目前支持两种 MCP 接入方式。

### 方式一：连接本地 HTTP MCP

这是更推荐的方式，适合“先启动 Polaris，再让 AI 工具连接到它”的场景。

默认地址：

```text
http://127.0.0.1:19602/mcp
```

如果你不确定当前实际地址，可以执行：

```bash
pnpm polaris:status
```

或者：

```bash
node packages/cli/dist/bin.js mcp-url
```

然后把输出地址填到你的 MCP 客户端里。

详细说明见：

- [MCP 接入说明](/E:/code/polaris/docs/mcp.md)

### 方式二：使用 stdio

如果你的工具只支持 stdio，可以使用：

```bash
pnpm mcp
```

开发调试模式：

```bash
pnpm dev:mcp
```

## 默认端口

Polaris 默认优先使用：

- 代理端口：`19600`
- API 端口：`19601`
- MCP 端口：`19602`
- Console 开发端口：`5173`

如果端口被占用，Polaris 会自动切换到下一个可用端口。

例如：

- API 可能从 `19601` 切到 `19604`
- MCP 可能从 `19602` 切到 `19605`

当前 Console 和浏览器扩展都已经支持自动发现 Core API 端口。

## 浏览器扩展

构建扩展：

```bash
pnpm --filter @polaris/extension build
```

在 Chrome 或 Edge 中加载：

- [apps/extension/dist](/E:/code/polaris/apps/extension/dist)

扩展弹窗当前支持：

- 查看 Core 是否在线
- 切换代理模式
- 将当前站点加入或移出规则
- 打开 Console 和设置页

详细说明见：

- [浏览器扩展使用说明](/E:/code/polaris/docs/extension.md)

## 本地数据目录

Polaris 默认把运行数据写到当前用户自己的本地目录，而不是仓库内。

默认位置：

- Windows：`%LOCALAPPDATA%\\Polaris`
- macOS：`~/Library/Application Support/Polaris`
- Linux：`~/.local/state/polaris` 或 `$XDG_STATE_HOME/polaris`

这意味着：

- 每个人可以有自己的 Mock 数据
- 本地证书和私钥不会进入 Git
- 请求记录和运行状态不会污染仓库

## 常用命令

启动本地服务：

```bash
pnpm polaris:start
```

停止本地服务：

```bash
pnpm polaris:stop
```

查看状态：

```bash
pnpm polaris:status
```

同时启动 Core 和 Console：

```bash
pnpm dev
```

只启动 Core：

```bash
pnpm dev:core
```

只启动 Console：

```bash
pnpm dev:console
```

启动 stdio MCP：

```bash
pnpm mcp
```

执行类型检查：

```bash
pnpm typecheck
```

执行构建：

```bash
pnpm build
```

执行 smoke 检查：

```bash
pnpm test:smoke
```

更详细的本地开发说明见：

- [开发说明](/E:/code/polaris/docs/development.md)

## 常见问题

### 为什么 Polaris 没有使用默认端口

这是正常行为。

如果默认端口被占用，Polaris 会自动切换到新的可用端口。你可以用下面的命令查看当前实际端口：

```bash
pnpm polaris:status
```

### 为什么 Console 连不上 Core

优先检查：

- Polaris 服务是否已启动
- `pnpm polaris:status` 输出的健康检查地址是否可访问
- Console 是否正常打开

### 为什么扩展显示 Core 离线

优先检查：

- Polaris 是否正在运行
- 扩展是否使用了最新构建产物
- 当前 Core API 地址是否可访问

### 为什么 MCP 客户端连接失败

优先检查：

- 你接的是 HTTP MCP 还是 stdio
- Polaris 是否已经启动
- MCP 地址是否来自 `pnpm polaris:status`

## 说明

这份 README 主要面向使用者和接入者，重点说明：

- Polaris 是什么
- 如何启动
- 如何接入 MCP
- 如何开始使用

更细的实现细节和开发背景，适合继续拆到单独文档中维护。

---

## MCP 接入（2026 更新）

Polaris 现在同时支持两种 MCP 暴露方式：全量能力接入与按 pack（能力包）接入。

### 1）启动 Polaris 并获取 MCP 地址

```bash
pnpm polaris:start
pnpm polaris:status
node packages/cli/dist/bin.js mcp-url
```

默认 MCP 地址（若未发生端口回退）：

```text
http://127.0.0.1:19602/mcp
```

### 2）Streamable HTTP MCP

- 全量工具/资源：
  - `http://127.0.0.1:<mcpPort>/mcp`
- 按 pack 过滤的工具/资源：
  - `http://127.0.0.1:<mcpPort>/mcp/mock`
  - `http://127.0.0.1:<mcpPort>/mcp/proxy`
  - `http://127.0.0.1:<mcpPort>/mcp/request`
  - `http://127.0.0.1:<mcpPort>/mcp/ops`

支持的 pack 别名：`mock`、`proxy`、`request`、`ops`。

### 3）Legacy MCP HTTP（兼容模式）

- 查看所有 pack：
  - `GET /packs`
- 查看某个 pack 的工具：
  - `GET /packs/:pack/tools`
- 通过 pack 过滤工具/资源：
  - `GET /tools?pack=mock`
  - `GET /resources?pack=request`
- 按 pack 约束执行工具：
  - `POST /invoke/:tool?pack=proxy`

未知 pack 会返回结构化错误：

```json
{
  "error": {
    "code": "UNKNOWN_PACK",
    "message": "Unknown MCP pack: <pack>",
    "retryable": false
  }
}
```

### 4）stdio MCP

使用工作区脚本：

```bash
pnpm mcp
pnpm dev:mcp
```

或直接使用 CLI：

```bash
node packages/cli/dist/bin.js mcp-stdio
node packages/cli/dist/bin.js mcp-stdio --pack mock
```

`--pack` 支持：`mock | proxy | request | ops`。

### 5）Pack 定义

- `mock_pack.v1`
  - Mock 规则生命周期管理 + 活动分组管理
- `proxy_pack.v1`
  - 代理模式管理 + Host 规则管理 + 代理决策预览
- `request_pack.v1`
  - 抓包/保存请求查询 + 运行/回放 + 清理请求
- `ops_pack.v1`
  - 健康状态/运行配置/证书就绪性查询

### 6）推荐接入策略

- 对 AI Agent 默认使用 pack 接入，降低工具选择负担与上下文开销。
- 保留全量 `/mcp` 入口用于管理与调试。
- 保留 legacy 入口用于旧客户端兼容。

### 7）CLI/AI 工具配置示例

下面给出通用 MCP 客户端常见的两种配置方式。不同工具字段名可能不同，但核心是 `url`（HTTP）或 `command + args`（stdio）。

#### A. 连接 Streamable HTTP MCP（推荐）

先确认当前 MCP 地址：

```bash
pnpm polaris:status
```

通用示例（按 pack 连接，推荐）：

```json
{
  "mcpServers": {
    "polaris-request": {
      "transport": "http",
      "url": "http://127.0.0.1:19602/mcp/request"
    },
    "polaris-mock": {
      "transport": "http",
      "url": "http://127.0.0.1:19602/mcp/mock"
    }
  }
}
```

如果你希望一个连接暴露全部能力：

```json
{
  "mcpServers": {
    "polaris-all": {
      "transport": "http",
      "url": "http://127.0.0.1:19602/mcp"
    }
  }
}
```

#### B. 连接 stdio MCP（仅当工具不支持 HTTP MCP）

如果你是通过 `npm i -g polaris` 安装，优先使用全局命令：

```json
{
  "mcpServers": {
    "polaris-proxy": {
      "command": "polaris",
      "args": [
        "mcp-stdio",
        "--pack",
        "proxy"
      ],
      "env": {
        "POLARIS_MCP_START_PROXY": "false"
      }
    }
  }
}
```

如果不想全局安装，也可以使用 `npx`：

```json
{
  "mcpServers": {
    "polaris-proxy": {
      "command": "npx",
      "args": [
        "-y",
        "polaris",
        "mcp-stdio",
        "--pack",
        "proxy"
      ],
      "env": {
        "POLARIS_MCP_START_PROXY": "false"
      }
    }
  }
}
```

说明：

- `--pack` 可选值：`mock | proxy | request | ops`。
- `POLARIS_MCP_START_PROXY` 默认建议为 `false`，避免 stdio 进程额外占用本地代理端口。
- 如果你确实希望 stdio 进程同时拉起本地代理，可显式改为 `true`。
- 只有在“本地仓库开发模式”下，才建议使用 `node packages/cli/dist/bin.js ...` 这种路径方式。

#### C. 多工具拆分建议

对支持多个 MCP server 的 AI 工具，建议按职责拆分：

- 代码/调试助手：接 `request + mock`
- 网络问题排查助手：接 `proxy + ops`
- 管理员助手：接 `all` 或 `ops`

这样可以减少模型可见工具数量，降低工具选择错误和上下文负担。

#### D. 其他可用接入方案

- Streamable HTTP（推荐）
  - 适合长期稳定接入与多工具共享
  - 地址示例：`http://127.0.0.1:19602/mcp/request`
- stdio（兼容）
  - 适合仅支持命令启动 MCP 的工具
  - 推荐用全局 `polaris mcp-stdio --pack <pack>`
- Legacy HTTP（兼容旧客户端）
  - 使用 `/tools`、`/resources`、`/invoke/:tool` 接口
  - 适合尚未完整支持 Streamable MCP 的集成


