# Console Architecture

## Data Flow
- UI session state: `stores/*` (Zustand)
- Server state: `domains/*` (TanStack Query)
- Rendering/orchestration: `pages/*`

## Layer Contract
- `pages/*` can compose domain hooks and store selectors.
- `pages/*` should not call `services/apiClient` directly.
- `domains/*` own request composition, cache key design, invalidation, retry semantics.
- `stores/*` only keep UI/session context, never server entity source of truth.

## Query Strategy
- high frequency feeds: short stale window + interval refresh
- configuration data: long stale window + manual invalidate
- mutation side effects: invalidate by domain key roots

## Error & Observability
- API errors are normalized by `services/apiErrors.ts`
- API request quality metrics are tracked in `services/apiMetrics.ts`
- query retry telemetry is emitted from `lib/query/queryClient.ts`

## Extension Path
New features should be added in three layers:
1. `domains/<feature>` for query/mutation
2. `stores/*` for new UI/session state if needed
3. `pages/<feature>` + components for composition only
