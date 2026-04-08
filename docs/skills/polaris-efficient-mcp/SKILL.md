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
