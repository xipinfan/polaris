---
name: polaris-efficient-mcp
description: Polaris MCP 中文高效使用规范（低上下文优先）
---

## 使用前提

本技能默认已接入全量 `/mcp`。  
若仅接入 `/mcp/request`，请只使用请求相关工具。

## 四条铁律

1. 先 `list` 再 `detail`
2. 详情按 `summary -> preview -> shape -> full/diagnostic`
3. 写操作后先看回执
4. 大数据优先路径过滤

## 建议开场

先调用：

- `get_workspace_snapshot`

注意：该工具属于 `ops`，不在 `request` pack 内。

## 核心工具（当前实现）

| 工具 | 用途 |
|---|---|
| `query_requests` | 查询抓包与已保存请求 |
| `mutate_request` | 保存/更新/删除已保存请求 |
| `replay_request` | 重放请求 |
| `run_request` | 直接发 HTTP 请求 |
| `clear_requests` | 清空抓包 |
| `query_mock` | 查询 Mock 规则 |
| `mutate_mock` | 创建/更新/删除/启停 Mock |
| `test_mock_match` | 检查请求是否命中 Mock |
| `query_proxy` | 查询代理模式/规则/路由决策 |
| `mutate_proxy` | 切换代理模式、增删改规则 |
| `get_workspace_snapshot` | 返回工作区全景 |
| `setup_https` | HTTPS 状态/安装指引/就绪验证 |

## 任务速查

### Mock 不生效

1. `test_mock_match`
2. `query_mock(action="list")`
3. `query_mock(action="detail", view="diagnostic", requestId=...)`

### 代理转发异常

1. `query_proxy(action="decision", host=...)`
2. `query_proxy(action="list")`
3. `query_proxy(action="detail", ruleId=...)`

### HTTPS 抓包异常

1. `setup_https(action="verify")`
2. `setup_https(action="install_guide")`
3. 再次 `setup_https(action="verify")`

