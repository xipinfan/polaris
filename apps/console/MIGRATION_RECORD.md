# Migration Record

## 2026-03-14

- 引入 TanStack Query 域层（`domains/*`）
- `proxy-forward`、`traffic`、`mock`、`home`、`settings`、`debug` 完成主要数据流迁移
- 持久化统一到 `lib/persistence`
- UI/session 状态统一到 Zustand store
- 路由采用懒加载
- 增加 API 错误归一化与请求指标基础能力

## 2026-04-23（文档对齐）

- 当前 Console 可用主路由：`/`、`/traffic`、`/proxy-forward`、`/mock`、`/debug`、`/settings`
- 历史路径 `/requests`、`/rules` 改为重定向到 `/mock`
- MCP 相关文档改为 pack-aware 说明（request/mock/proxy/ops）

