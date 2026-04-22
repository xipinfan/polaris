# Polaris MCP Low-Context Usage

## 排查 mock 不生效

1. `query_mock({ action: "list" })`
2. `query_mock({ action: "detail", id, view: "diagnostic", requestId })`
3. 仅在仍然缺信息时再用 `view: "preview"` 或 `view: "full"`

## 小改动 patch mock

```json
{
  "op": "update",
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
  "op": "create",
  "name": "wxhb_mainPage mock",
  "requestId": "captured-request-id",
  "patch": {
    "enabled": true
  }
}
```

```json
{
  "op": "create",
  "name": "json_ok mock",
  "template": "json_ok",
  "patch": {
    "url": "https://polaris.local/template"
  }
}
```

## 排查代理转发

1. `query_proxy({ action: "decision", host })`
2. 如果要看规则细节，调用 `query_proxy({ action: "list" })` 或 `query_proxy({ action: "detail", ruleId })`
3. 需要调整时，调用 `mutate_proxy({ op: "upsert", ... })`

## HTTPS 抓包配置

1. `setup_https({ action: "verify" })`
2. 若证书未信任：`setup_https({ action: "install_guide" })`
3. 修复后再次 `setup_https({ action: "verify" })`
