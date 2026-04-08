# Polaris MCP Low-Context Usage

## 排查 mock 不生效

1. `list_mock_rules`
2. `get_mock_rule_detail({ id, view: "diagnostic", requestId })`
3. 仅在仍然缺信息时再用 `view: "preview"` 或 `view: "full"`

## 小改动 patch mock

```json
{
  "id": "mock-rule-id",
  "patch": {
    "enabled": true,
    "method": "POST"
  }
}
```

## 从请求或模板创建 mock

```json
{
  "name": "wxhb_mainPage mock",
  "requestId": "captured-request-id",
  "patch": {
    "enabled": true
  }
}
```

```json
{
  "name": "json_ok mock",
  "template": "json_ok",
  "patch": {
    "url": "https://polaris.local/template"
  }
}
```
