# Console Architecture

## Data Flow

- UI/session state: `stores/*`（Zustand）
- Server state: `domains/*`（TanStack Query）
- Page orchestration: `pages/*`

## Layer Contract（当前约定）

- `pages/*` 负责页面编排，不直接承载大段数据访问逻辑
- `domains/*` 负责 query/mutation、缓存键、失效策略
- `stores/*` 仅保存 UI 与会话状态，不作为服务端实体真源

## Current Exceptions

当前代码仍有少量历史例外直接调用 `services/apiClient`（分布在 `pages/*` 与 `features/*`），后续可继续下沉到 `domains/*`：

- `src/pages/settings/components/SettingsSystemProxyCard/index.tsx`
- `src/features/common/whistleImport/WhistleImportModal.tsx`

## Query Strategy

- 高频数据：短 stale time + 轮询/主动刷新
- 配置数据：较长 stale time + 手动 invalidate
- 写操作后：按 domain key 根进行失效

## Error & Telemetry

- API 错误归一化：`services/apiErrors.ts`
- API 指标：`services/apiMetrics.ts`
- Query 重试与默认策略：`lib/query/queryClient.ts`
