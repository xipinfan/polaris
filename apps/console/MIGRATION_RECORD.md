# Migration Record

## 2026-03-14
- Added TanStack Query foundations and domain-layer data flows.
- Migrated `proxy-forward`, `traffic`, `mock`, `home`, `settings`, `debug` away from page-level api calls.
- Unified local persistence API under `lib/persistence`.
- Added Zustand stores for UI/session state only.
- Added router-level lazy loading and manual chunk split strategy.
- Added API error normalization and request telemetry helpers.
- Added lint guardrails and test baseline for domains/stores/core flows.
