# State Guidelines

## Zustand Scope (Allowed)
- drawer/modal visibility
- selected item id
- filters/sort/pagination
- temporary editing context
- per-user UI preference

## Zustand Scope (Forbidden)
- server entity primary data (`requests`, `rules`, `settings` payloads)
- any API response considered source of truth

## Persistence Policy
- persist only UI preference whitelist
- include `version` + `migrate` in persisted stores
- session-only state should stay in non-persisted store slices

## Selector Rules
- always read store via narrow selectors
- avoid object-wide subscription
- prefer small independent slices over one large nested object

## Query + Store Collaboration
- Query data drives business rendering.
- Store state drives view mode and interaction context.
- Mutations update server, then invalidate query keys.
