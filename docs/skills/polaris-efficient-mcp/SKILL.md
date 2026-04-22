---
name: polaris-efficient-mcp
description: Polaris MCP 中文高效使用规范（低上下文优先）
---

## 四条铁律

1. 先 `list` 再 `detail`，不要直接全量读取。
2. 详情按 `summary -> preview -> shape -> full/diagnostic` 递进。
3. 写操作后优先看回执，不立即 full 回读。
4. 大数据先用 `jsonPath/responsePath/includePaths/excludePaths` 过滤。

## 开始会话

第一步先调用：

- `get_workspace_snapshot`

用于快速掌握当前服务状态、请求概况、Mock/Proxy 规则与模板列表。

## 12 个核心工具

| 工具 | 用途 |
|---|---|
| `query_requests` | 查询抓包与已保存请求（list/detail/list_saved/saved_detail） |
| `mutate_request` | 保存/更新/删除已保存请求 |
| `replay_request` | 重放已有请求 |
| `run_request` | 直接发起 HTTP 请求 |
| `clear_requests` | 清空抓包记录 |
| `query_mock` | 查询 Mock 规则与激活分组 |
| `mutate_mock` | 创建/更新/删除/启停规则与切换分组 |
| `test_mock_match` | 检查某请求是否命中 Mock 规则 |
| `query_proxy` | 查询代理规则、模式和路由决策 |
| `mutate_proxy` | 切换模式、创建/更新/删除代理规则 |
| `get_workspace_snapshot` | 返回工作区全景快照 |
| `setup_https` | HTTPS 证书状态、安装指引、前置检查 |

## 任务速查

### 排查 mock 不生效

1. `test_mock_match`
2. `query_mock(action="list")`
3. `query_mock(action="detail", view="diagnostic", requestId=...)`
4. 必要时 `mutate_mock(op="enable"/"update"/"set_group")`

### 快速创建 mock

1. `query_requests(action="detail", id=...)`
2. `mutate_mock(op="create", requestId=..., patch=...)`
3. `test_mock_match`

### 修改 mock 返回值

1. `query_mock(action="detail", id=..., view="summary")`
2. `mutate_mock(op="update", id=..., patch=... 或 operations=...)`

### 排查代理转发

1. `query_proxy(action="decision", host=...)`
2. `query_proxy(action="list")` / `query_proxy(action="detail", ruleId=...)`
3. `mutate_proxy(op="upsert"/"set_mode")`

### HTTPS 抓包不工作

1. `setup_https(action="verify")`
2. `setup_https(action="status")`
3. `setup_https(action="install_guide")`
4. 修复后再次 `setup_https(action="verify")`

### 测试接口响应

1. `run_request`
2. 必要时 `mutate_mock` 或 `mutate_proxy` 调整环境
3. 再次 `run_request` 或 `replay_request`

## 反模式

- 直接用 `view="full"` 读取大 body。
- 写操作后立刻完整读回对象做“确认”。
- 不带 `requestId` 就做 mock 诊断结论。
- 忽略 `structuredContent.result`，只看短文本 `content`。

