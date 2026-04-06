# 开发说明

这份文档是写给 Polaris 的开发者和贡献者的。

如果你只是想安装并使用 Polaris，不需要先看这份文档。  
更适合先看：

- [README](/E:/code/polaris/README.md)
- [Web Console 使用说明](/E:/code/polaris/docs/console.md)
- [浏览器扩展使用说明](/E:/code/polaris/docs/extension.md)
- [MCP 接入说明](/E:/code/polaris/docs/mcp.md)

---

## 这份文档解决什么问题

它主要回答下面这些开发问题：

- 如何在本地跑起来整个项目
- 如何只启动某一个子应用
- 如何做构建、类型检查和测试
- 端口冲突时为什么通常不用手改配置
- 运行数据默认写到哪里

---

## 先安装依赖

```bash
corepack pnpm install
```

---

## 最常用的开发命令

### 同时启动 Core 和 Console

```bash
corepack pnpm dev
```

适合：

- 联调核心链路
- 改 Console 页面
- 调请求捕获和 Mock 行为

### 只启动 Core

```bash
corepack pnpm dev:core
```

适合：

- 调 API
- 调代理
- 调 MCP

### 只启动 Console

```bash
corepack pnpm dev:console
```

适合：

- 只改前端页面
- 只看 Console 样式和交互

### 启动 stdio MCP

```bash
corepack pnpm mcp
```

Watch 模式：

```bash
corepack pnpm dev:mcp
```

---

## 常用检查命令

全量构建：

```bash
corepack pnpm build
```

全量类型检查：

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

---

## 如果你要验证“像真实用户一样使用”

除了开发模式，也建议跑一下产品链路：

启动：

```bash
corepack pnpm polaris:start
```

查看状态：

```bash
corepack pnpm polaris:status
```

这种方式更接近最终用户实际使用场景，适合验证：

- 守护进程是否正常
- 端口是否自动分配
- Console 地址是否可访问
- MCP 地址是否正确
- 扩展产物是否可用

---

## 端口策略

Polaris 默认优先尝试：

- 代理端口：`19600`
- API 端口：`19601`
- MCP 端口：`19602`
- Console 开发端口：`5173`

如果端口被占用，服务会自动切换到新的可用端口。

当前项目已经把这件事尽量做成“自动发现”：

- Core 会自动换端口
- Console 会自动发现 Core API
- 浏览器扩展也会自动发现 Core API

所以在大多数情况下，开发时不用为了端口冲突去手动改一堆配置。

---

## 本地数据放在哪里

Polaris 默认把运行数据写到用户本地目录，不写到仓库里。

这样做的好处是：

- Mock 数据不会污染 Git
- 证书和私钥不会误提交
- 请求记录不会堆在工作区里

可以通过下面这个环境变量覆盖：

```text
POLARIS_HOME
```

---

## 常见环境变量

- `POLARIS_PROXY_PORT`
- `POLARIS_API_PORT`
- `POLARIS_MCP_PORT`
- `POLARIS_MCP_ENABLED`
- `POLARIS_PROXY_MODE`
- `POLARIS_HOME`
- `POLARIS_MCP_START_PROXY`

补充说明：

- 这些端口变量表示“优先尝试的端口”，不是绝对固定值
- `POLARIS_MCP_START_PROXY=false` 比较适合单独调 stdio MCP

---

## 什么时候看哪份文档

如果你在做这些事，建议对应看：

- 改产品使用说明：先看 [README](/E:/code/polaris/README.md)
- 改 Console 交互：看 [Web Console 使用说明](/E:/code/polaris/docs/console.md)
- 改浏览器入口：看 [浏览器扩展使用说明](/E:/code/polaris/docs/extension.md)
- 改 AI 接入：看 [MCP 接入说明](/E:/code/polaris/docs/mcp.md)
- 改测试：看 [E2E 与视觉测试](/E:/code/polaris/docs/e2e-testing.md)
