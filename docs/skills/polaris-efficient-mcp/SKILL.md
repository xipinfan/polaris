---
name: polaris-efficient-mcp
description: Default low-context workflow for using Polaris MCP
---

1. Start with `list_requests`, `list_saved_requests`, `list_mock_rules`, or summary-only resources.
2. When you need one item, call the matching `get_*_detail` tool with the default summary view first.
3. Use `view="diagnostic"` only for mock troubleshooting, and include `requestId` whenever you have one.
4. Use `view="preview"` before `view="full"` when investigating payloads.
5. Prefer `update_mock_rule` with `patch` or `operations`.
6. Prefer `create_mock_rule` with `requestId` or `template` plus `patch`.
7. After a write receipt, do not re-read the full object unless you need one specific omitted field.
8. When the payload is deep or noisy, prefer `view="shape"` first to understand structure before reading raw values.
9. Use `view="diagnostic"` only when you are explaining why a mock did or did not match; include `requestId` whenever possible.
10. Treat short `content` text as a display policy, not as evidence that the server returned little data; always check `structuredContent.result`.
11. Prefer `jsonPath` or `responsePath` plus `includePaths` / `excludePaths` to narrow large response bodies instead of jumping straight to `view="full"`.
