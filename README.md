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
http://127.0.0.1:9002/mcp
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

- 代理端口：`9000`
- API 端口：`9001`
- MCP 端口：`9002`
- Console 开发端口：`5173`

如果端口被占用，Polaris 会自动切换到下一个可用端口。

例如：

- API 可能从 `9001` 切到 `9004`
- MCP 可能从 `9002` 切到 `9005`

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
