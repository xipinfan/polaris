# 开发说明

## 安装依赖

```bash
corepack pnpm install
```

## 本地开发

### Core + Console

```bash
corepack pnpm dev
```

### 仅 Core

```bash
corepack pnpm dev:core
```

### 仅 Console

```bash
corepack pnpm dev:console
```

### 仅 Extension

```bash
corepack pnpm dev:extension
```

### stdio MCP

```bash
corepack pnpm mcp
corepack pnpm dev:mcp
```

## 构建与检查

```bash
corepack pnpm build
corepack pnpm typecheck
corepack pnpm test:smoke
```

## E2E

```bash
corepack pnpm test:e2e:install
corepack pnpm test:e2e
```

## CLI 产品链路验证

```bash
corepack pnpm polaris:start
corepack pnpm polaris:status
corepack pnpm polaris:stop
```

## 端口与环境变量

默认优先端口：

- `POLARIS_PROXY_PORT` 默认 `19600`
- `POLARIS_API_PORT` 默认 `19601`
- `POLARIS_MCP_PORT` 默认 `19602`

端口被占用时会自动回退到可用端口。

其他常用变量：

- `POLARIS_HOME`
- `POLARIS_MCP_ENABLED`
- `POLARIS_PROXY_MODE`
- `POLARIS_MCP_START_PROXY`

