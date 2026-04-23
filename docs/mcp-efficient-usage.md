# Polaris MCP Low-Context Usage

本指南默认你已接入全量 `/mcp`，或至少接入了当前步骤需要的 pack。

## 先做能力确认

- 如果只接了 `/mcp/request`，只能使用请求相关工具
- 需要 `query_mock/query_proxy/setup_https/get_workspace_snapshot` 时，请接 `/mcp` 或对应 pack

## 推荐工作流

### 排查 mock 不生效

1. `test_mock_match`
2. `query_mock({ action: "list" })`
3. `query_mock({ action: "detail", id, view: "diagnostic", requestId })`

### 排查代理转发

1. `query_proxy({ action: "decision", host })`
2. 必要时 `query_proxy({ action: "list" })`
3. 再看 `query_proxy({ action: "detail", ruleId })`

### HTTPS 抓包排障

1. `setup_https({ action: "verify" })`
2. `setup_https({ action: "install_guide" })`
3. 修复后再次 `setup_https({ action: "verify" })`

## 低上下文原则

1. 先 list，再 detail
2. detail 视图按 `summary -> preview -> shape -> full/diagnostic`
3. 大响应先用 `jsonPath/responsePath/includePaths/excludePaths/topLevelOnly`
4. 写操作后先看回执，不立即 full 回读

