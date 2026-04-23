# Polaris Console 架构现状（2026-04-23）

本文档替代早期“整改建议稿”，以当前代码实现为准。

## 当前技术栈

- React 19 + TypeScript + Vite
- React Router 7
- TanStack Query 5
- Zustand 5
- Ant Design 6
- CSS Modules / Less Modules

## 当前目录分层

- `app/`：入口、路由、布局
- `pages/`：页面编排层
- `domains/`：服务端状态 query/mutation
- `features/`：跨页面可复用业务组件
- `services/`：基础服务能力（api client、发现、错误、指标）
- `stores/`：UI 与会话状态
- `lib/`：query/persistence/errors 等基础设施

## 当前路由

- `/`
- `/traffic`
- `/proxy-forward`
- `/mock`
- `/debug`
- `/settings`

历史 `/requests`、`/rules` 重定向到 `/mock`。

## 现状结论

- 已完成 Query + Store 的主线分层
- 仍存在少量 page 子树组件直连 `apiClient` 的历史例外（见 `apps/console/ARCHITECTURE.md`）
- ESLint 已启用 hooks、复杂度、行数、页面层导入限制等规则

## 后续建议（非阻塞）

1. 清理 page 子树直连 `apiClient` 的历史例外
2. 继续细化大页面内职责拆分
3. 收敛跨层调用，保持 domain 作为数据访问主入口

