# Polaris

Polaris is a local API workbench for request proxying, capture, replay, mocking, proxy rules, Web Console, browser extension, and MCP integration.

它把请求代理、抓包调试、Mock 管理、规则转发、Web Console、浏览器扩展和 MCP 接入整合成一个本地服务，目标是：

- 安装一次
- 启动一个本地服务
- 让浏览器、手机、AI 工具都连接到同一个 Polaris 工作台

进一步阅读：

- [MCP 接入说明](/E:/code/polaris/docs/mcp.md)
- [Web Console 使用说明](/E:/code/polaris/docs/console.md)
- [浏览器扩展使用说明](/E:/code/polaris/docs/extension.md)
- [开发说明](/E:/code/polaris/docs/development.md)
- [E2E 与视觉测试](/E:/code/polaris/docs/e2e-testing.md)

## 核心能力

- 本地代理服务
- 实时请求捕获、保存、重放与调试
- Mock 规则与分组管理
- 代理规则与转发能力
- Web Console
- 浏览器扩展
- Streamable HTTP MCP
- stdio MCP 兼容入口
- 局域网 / 手机代理接入

## 适合谁

如果你正在做下面这些事情，Polaris 会比较适合：

- 本地联调前后端接口
- 需要快速抓取和重放请求
- 需要维护自己的 Mock 数据
- 需要把请求调试能力接给 Cursor、Cline、Gemini CLI 等 MCP 客户端
- 需要让同一局域网下的手机接入本机代理做调试

## 安装使用

### 1. 全局安装

推荐直接通过 npm 全局安装已发布包：

```bash
npm i -g polaris-workbench
```

安装后会提供全局命令：

```bash
polaris
```

### 2. 启动服务

启动 Polaris：

```bash
polaris start
```

查看运行状态：

```bash
polaris status
```

停止服务：

```bash
polaris stop
```

查看 Console 地址：

```bash
polaris console-url
```

查看 MCP 地址：

```bash
polaris mcp-url
```

查看浏览器扩展产物目录：

```bash
polaris extension-path
```

### 3. 默认端口

Polaris 默认优先使用：

- 代理端口：`19600`
- API / Console 端口：`19601`
- MCP 端口：`19602`
- Console 开发端口：`5173`

如果端口被占用，Polaris 会自动切换到下一个可用端口。

### 4. Web Console

生产态启动后，Console 由 Polaris Core 直接托管。

默认访问地址：

- [http://127.0.0.1:19601](http://127.0.0.1:19601)

主要页面：

- `/` 首页总览
- `/traffic` 实时请求
- `/requests` 已保存请求
- `/mock` Mock 管理
- `/debug` 手动调试
- `/settings` 服务状态与配置

详细说明见：

- [Web Console 使用说明](/E:/code/polaris/docs/console.md)

### 5. 浏览器扩展

全局包会同时附带浏览器扩展产物，但浏览器安全模型不允许通过 npm 自动安装扩展。

你可以先获取扩展目录：

```bash
polaris extension-path
```

然后在 Chrome / Edge 中加载该目录。

扩展当前支持：

- 查看 Core 是否在线
- 切换代理模式
- 将当前站点加入或移出规则
- 打开 Console 和设置页

详细说明见：

- [浏览器扩展使用说明](/E:/code/polaris/docs/extension.md)

### 6. MCP 接入

Polaris 可以把抓包、Mock、代理规则、运行状态这些能力通过 MCP 暴露给 AI 工具。

如果你是第一次接入，可以先记住这条原则：

- 支持 HTTP MCP 的工具：优先填写 Polaris 提供的 MCP URL
- 只支持命令启动 MCP 的工具：使用 `polaris mcp-stdio`

#### 最简单的连接方式

1. 先启动 Polaris：

```bash
polaris start
```

2. 查看当前 MCP 地址：

```bash
polaris mcp-url
```

3. 把输出地址填到你的 MCP 客户端里

默认情况下会是：

```text
http://127.0.0.1:19602/mcp
```

#### 方式一：Streamable HTTP MCP（推荐）

这是最推荐的方式，适合大多数支持 MCP URL 的工具。

全量能力入口：

- `http://127.0.0.1:19602/mcp`

按能力包访问：

- `http://127.0.0.1:19602/mcp/mock`
- `http://127.0.0.1:19602/mcp/proxy`
- `http://127.0.0.1:19602/mcp/request`
- `http://127.0.0.1:19602/mcp/ops`

建议：

- 只想让 AI 处理请求调试：接 `/mcp/request`
- 只想让 AI 管理 Mock：接 `/mcp/mock`
- 想让 AI 看全部能力：接 `/mcp`

#### 方式二：stdio MCP

如果你的工具不支持填 URL，只支持通过命令启动 MCP 服务，就使用 stdio。

直接启动：

```bash
polaris mcp-stdio
```

按 pack 启动：

```bash
polaris mcp-stdio --pack request
```

`--pack` 可选值：`mock | proxy | request | ops`

#### 手动写配置时怎么连

很多 MCP 客户端都需要手动编辑配置文件。你可以直接参考下面几种模板。

#### 配置示例 1：连接全量 HTTP MCP

适合想一次暴露全部 Polaris 能力的场景。

```json
{
  "mcpServers": {
    "polaris": {
      "transport": "http",
      "url": "http://127.0.0.1:19602/mcp"
    }
  }
}
```

#### 配置示例 2：只连接请求调试能力

适合希望减少工具数量、让模型更聚焦的场景。

```json
{
  "mcpServers": {
    "polaris-request": {
      "transport": "http",
      "url": "http://127.0.0.1:19602/mcp/request"
    }
  }
}
```

#### 配置示例 3：同时拆分多个能力包

适合支持多个 MCP Server 的客户端。

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
    },
    "polaris-ops": {
      "transport": "http",
      "url": "http://127.0.0.1:19602/mcp/ops"
    }
  }
}
```

#### 配置示例 4：stdio 方式

适合只能通过命令启动 MCP 的工具。

```json
{
  "mcpServers": {
    "polaris-workbench": {
      "command": "polaris",
      "args": ["mcp-stdio", "--pack", "request"],
      "env": {
        "POLARIS_MCP_START_PROXY": "false"
      }
    }
  }
}
```

#### 配置示例 5：stdio 全量能力

如果你不想按 pack 限制，也可以直接暴露全部能力。

```json
{
  "mcpServers": {
    "polaris-all": {
      "command": "polaris",
      "args": ["mcp-stdio"],
      "env": {
        "POLARIS_MCP_START_PROXY": "false"
      }
    }
  }
}
```

说明：

- 如果你的客户端不认识 `transport: "http"`，通常只需要保留它要求的 URL 字段即可
- 如果当前端口不是默认值，请先运行 `polaris mcp-url`，然后把示例里的 URL 替换成你的实际地址
- 推荐优先接按 pack 的入口，能减少模型可见工具数量

详细说明见：

- [MCP 接入说明](/E:/code/polaris/docs/mcp.md)

### 7. 手机 / 局域网代理

Polaris 支持让同一局域网下的手机连接到本机代理。

大致流程：

1. 启动 Polaris
2. 在 Console 设置页查看当前 `LAN IP` 和代理端口
3. 在手机 Wi-Fi 里手动配置 HTTP 代理
4. 用手机浏览器访问 `http://polaris.local`
5. 下载并安装 Polaris 根证书

说明：

- 只有代理端口会对局域网开放
- API / MCP 仍保持回环地址访问，避免控制面暴露到局域网

### 8. 本地数据目录

Polaris 默认把运行数据写到当前用户自己的本地目录，而不是仓库内。

默认位置：

- Windows：`%LOCALAPPDATA%\\Polaris`
- macOS：`~/Library/Application Support/Polaris`
- Linux：`~/.local/state/polaris` 或 `$XDG_STATE_HOME/polaris`

这意味着：

- 每个人可以有自己的 Mock 数据
- 本地证书和私钥不会进入 Git
- 请求记录和运行状态不会污染仓库

## 开发

### 1. 安装依赖

```bash
corepack pnpm install
```

### 2. 常用开发命令

启动 Core + Console：

```bash
corepack pnpm dev
```

只启动 Core：

```bash
corepack pnpm dev:core
```

只启动 Console：

```bash
corepack pnpm dev:console
```

启动 stdio MCP：

```bash
corepack pnpm dev:mcp
```

### 3. 构建

构建整个工作区：

```bash
corepack pnpm build
```

只构建最终发布包：

```bash
corepack pnpm --filter polaris-workbench build
```

这个构建会：

- 打包 CLI
- 打包 Core runtime
- 构建 Console
- 构建浏览器扩展
- 将最终产物聚合到 `packages/cli/dist`

### 4. 类型检查与测试

类型检查：

```bash
corepack pnpm typecheck
```

Smoke 检查：

```bash
corepack pnpm test:smoke
```

E2E：

```bash
corepack pnpm test:e2e
```

### 5. 本地发布验证

生成发布包：

```bash
corepack pnpm --dir packages/cli pack --pack-destination ../temp/pack
```

全局安装本地 tarball：

```bash
npm i -g .\packages\temp\pack\polaris-workbench-0.1.0.tgz
```

### 6. 正式发布

进入发布包目录：

```bash
cd packages/cli
```

发布前建议确认：

```bash
npm whoami
npm config get registry
npm pkg get name version
```

正式发布：

```bash
npm publish
```

如果账号开启了发布 2FA，需要使用 OTP 或带 bypass 2FA 的 token。

## 常见问题

### 为什么 Polaris 没有使用默认端口

这是正常行为。

如果默认端口被占用，Polaris 会自动切换到新的可用端口。你可以通过下面的命令查看当前实际端口：

```bash
polaris status
```

### 为什么 Console 连不上 Core

优先检查：

- Polaris 服务是否已启动
- `polaris status` 输出的健康检查地址是否可访问
- 当前 Console 地址是否来自 `polaris console-url`

### 为什么扩展显示 Core 离线

优先检查：

- Polaris 是否正在运行
- 扩展是否使用了 `polaris extension-path` 对应的最新构建产物
- 当前 Core API 地址是否可访问

### 为什么 MCP 客户端连接失败

优先检查：

- 你接的是 HTTP MCP 还是 stdio
- Polaris 是否已经启动
- MCP 地址是否来自 `polaris mcp-url` 或 `polaris status`
- 如果是 stdio，是否正确传入了 `--pack`
