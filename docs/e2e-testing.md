# E2E 与视觉测试

当前使用 Playwright，覆盖：

- Console 交互与视觉回归
- Extension Popup 交互与视觉回归

## 安装浏览器

```bash
corepack pnpm test:e2e:install
```

## 常用命令

```bash
corepack pnpm test:e2e
corepack pnpm test:e2e:baseline
corepack pnpm test:e2e:update
corepack pnpm test:e2e:ui
```

## 单页视觉检查

```bash
corepack pnpm test:e2e:page -- --page home
corepack pnpm test:e2e:page:baseline -- --page settings
```

支持页面 key：

- `home`
- `traffic`
- `proxy-forward`
- `mock`
- `debug`
- `settings`
- `popup`

## 当前实现细节

- E2E 启动 `node scripts/dev/start.mjs`（Core + Console）
- 扩展测试会在 global setup 先构建 `apps/extension/dist`
- Console baseURL 固定为 `http://127.0.0.1:5173`
- 测试内用于发现 Core API 端口的扫描区间当前是 `9001-9100`

