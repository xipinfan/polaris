# 开发说明

这份文档面向 Polaris 的开发者和贡献者，介绍当前推荐的本地开发链路。

## 常用命令

安装依赖：

```bash
pnpm install
```

全量构建：

```bash
pnpm build
```

全量类型检查：

```bash
pnpm typecheck
```

Smoke 检查：

```bash
pnpm test:smoke
```

## 本地开发模式

### 同时启动 Core 和 Console

```bash
pnpm dev
```

这会启动：

- Core
- Console

### 只启动 Core

```bash
pnpm dev:core
```

### 只启动 Console

```bash
pnpm dev:console
```

### 启动 stdio MCP

```bash
pnpm mcp
```

watch 模式：

```bash
pnpm dev:mcp
```

## 推荐调试链路

### 1. 服务调试

如果你要调 Polaris 本身的行为，优先使用：

```bash
pnpm dev
```

这适合调试：

- Core API
- Console 页面
- 请求链路
- Mock 规则

### 2. 产品流调试

如果你要验证“常驻服务 + MCP 接入”链路，优先使用：

```bash
pnpm polaris:start
pnpm polaris:status
```

这适合调试：

- 端口分配
- 守护进程启动
- MCP HTTP 地址
- AI 工具接入

## 端口策略

Polaris 默认优先使用：

- `9000` 代理端口
- `9001` API 端口
- `9002` MCP 端口
- `5173` Console 开发端口

如果端口已被占用，服务会自动切换到可用端口。

当前策略已经覆盖：

- Core 自动换端口
- Console 自动发现 Core API
- 浏览器扩展自动发现 Core API

因此开发时不需要为了一个端口冲突就手工改很多配置。

## 本地数据

运行数据默认写入用户目录，而不是仓库。

这样做的主要原因：

- 每个人可以维护自己的 Mock 数据
- 本地证书和私钥不应该进 Git
- 请求记录和运行状态不应该污染工作区

可以通过下面的环境变量覆盖数据目录：

```text
POLARIS_HOME
```

## 环境变量

当前常用环境变量：

- `POLARIS_PROXY_PORT`
- `POLARIS_API_PORT`
- `POLARIS_MCP_PORT`
- `POLARIS_MCP_ENABLED`
- `POLARIS_PROXY_MODE`
- `POLARIS_HOME`
- `POLARIS_MCP_START_PROXY`

说明：

- 端口变量是首选端口，不保证一定固定
- `POLARIS_MCP_START_PROXY=false` 适合 stdio 调试时禁用代理启动

## 文档边界

根 README 主要面向使用者和接入者。

这份文档则更适合在下面这些场景中阅读：

- 参与开发 Polaris
- 调试本地开发链路
- 理解当前运行方式和命令入口
