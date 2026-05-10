# Polaris vNext 易用性重设计稿

## 1. 背景

Polaris 当前已经具备本地接口工作台的核心能力：Core 本地服务、Web Console、浏览器扩展、实时请求、代理转发、Mock、调试请求、Whistle 导入和 MCP 接入。

当前主要问题不是能力不足，而是能力之间的关系还不够直观。页面更像按技术模块排列的功能清单，用户需要自己理解“先接入代理、再抓包、再调试、再沉淀 Mock、再交给 AI/MCP 使用”的完整链路。

vNext 的目标是把 Polaris 从“功能集合”整理成“易用的接口调试工作台”。

## 2. 最高原则

易用性优先。

每个页面、每个状态、每个操作都要尽量回答用户的三个问题：

1. 我现在能不能继续？
2. 如果不能，原因是什么？
3. 下一步最合理的操作是什么？

文案必须面向人类阅读，避免只暴露内部技术名词。必要的技术概念可以保留，但要提供清晰解释。

## 3. 设计目标

- 让首次使用者能在 3 分钟内判断 Polaris 是否已正确接入浏览器流量。
- 让日常使用者能从真实请求快速完成复制 curl、重放、调试、创建 Mock、保存资产。
- 让 Mock 和代理规则的分组、生效状态、命中关系更容易理解。
- 让 MCP/AI 能力成为现有工作流的增强，而不是另一个需要单独学习的新入口。
- 统一页面结构、空态、失败态、加载态和操作语言。

## 4. 非目标

- 不重写 Core 架构。
- 不引入新的前端框架、状态库或样式体系。
- 不把浏览器扩展做成第二个 Console。
- 不在第一阶段实现完整 AI 对话能力。
- 不把所有页面强行做成完全相同的布局。

## 5. 产品信息架构

推荐保留当前主导航数量，但调整用户理解方式。

| 当前入口 | vNext 语义 | 主要职责 |
| --- | --- | --- |
| 首页 | 运行状态 | 诊断 Polaris 是否可用，给出下一步 |
| 实时请求 | 抓包工作台 | 查看请求、筛选、详情、后续动作 |
| 代理转发 | 转发规则 | 管理站点级代理、转发目标、规则命中 |
| 模拟 | Mock 资产 | 管理 Mock 分组、规则、保存的请求资产 |
| 调试 | 请求调试 | 构造、发送、保存、重放请求 |
| 设置 | 接入与配置 | 端口、证书、系统代理、扩展、MCP |

第一阶段 IA 决策：不改主导航标签和路由，只改用户可见文案、页面标题、空态和筛选提示。

原因：

- `README.md`、`docs/console.md`、`docs/e2e-testing.md` 当前都以 `/traffic`、`/proxy-forward`、`/mock`、`/debug`、`/settings` 作为稳定入口。
- 第一阶段重点是修失败链路和可读性，不应同时引入导航改名带来的文档、截图和 E2E 标识迁移成本。
- “实时请求”“代理转发”“模拟”等导航标签先保留，页面内标题可以逐步使用“抓包工作台”“转发规则”“Mock 资产”等解释性文案。

如果后续阶段决定改导航标签，必须同步：

- `README.md` 的 Console 页面列表。
- `docs/console.md` 的页面总览和推荐工作流。
- `docs/extension.md` 中从扩展进入 Console 的说明。
- `docs/e2e-testing.md` 的页面 key、截图基线命名和视觉测试说明。
- Playwright 里依赖可见导航文本的 locator，不改 `/traffic` 等路由作为兼容入口。

## 6. 核心工作流

### 6.1 首次接入

用户目标：确认 Polaris 能抓到浏览器请求。

推荐流程：

1. 打开首页。
2. 首页显示运行诊断：Core、代理模式、系统代理或扩展、证书、规则命中状态。MCP 状态在 P3 做独立状态卡，P1 不把 MCP 作为首页诊断验收项。
3. 如果存在阻塞项，页面给出明确原因和操作入口。
4. 用户进入实时请求页。
5. 实时请求页空态继续给出接入检查，而不是只显示空列表。

### 6.2 日常抓包

用户目标：从真实流量中定位接口问题。

推荐流程：

1. 在实时请求页查看请求列表。
2. 使用关键词、Host、Method、状态码、错误、HTTPS、Mock、转发等筛选条件。
3. 选中请求后查看总览、时间线、Header、Body、匹配规则。
4. 从详情区执行复制 curl、重放、带入调试、创建 Mock、保存请求。

### 6.3 从请求创建 Mock

用户目标：把真实响应沉淀为可复用 Mock。

推荐流程：

1. 在实时请求详情中点击“创建 Mock”。
2. 弹窗自动填充 Method、URL、状态码、响应头、响应体。
3. 页面提醒匹配条件是否过宽，例如只按 URL 匹配可能影响同路径不同请求体。
4. 保存后跳转或提示可在 Mock 页面继续编辑。

### 6.4 管理规则资产

用户目标：理解哪些规则正在生效，哪些规则只是备用资产。

推荐流程：

1. Mock 和转发规则都使用“分组 + 当前生效组”的概念。
2. 分组列表固定使用“当前生效组”“待命组”两类状态，不再混用“当前”“生效中”“active group”。
3. 规则列表明确显示：启停、匹配条件、结果、最近命中。
4. 规则级别固定使用“已停用规则”表示规则自身 disabled；不要用“停用组”暗示整个分组被禁用。
5. 批量导入、导出、移动、复制等操作使用一致的入口和反馈。

### 6.5 MCP/AI 使用

用户目标：让 AI 或外部工具理解当前工作台状态，并调用 Polaris 能力。

推荐流程：

1. 设置页展示 MCP 地址、pack 选择建议、stdio 命令和复制按钮。
2. 首页显示 MCP 是否可用，以及推荐接入方式。该项属于 P3 MCP/AI 增强，不进入 P1 首页重设计范围。
3. 实时请求页提供“复制诊断上下文”动作，输出选中请求、代理模式、证书状态、相关规则等结构化摘要。
4. Mock 和代理页面提供“复制规则上下文”动作，帮助 AI 分析规则是否合理。

## 7. 页面设计建议

### 7.1 首页：从概览页变成运行诊断页

首页首屏应优先回答“Polaris 现在能不能用”。

建议模块：

- 运行诊断卡：Core 在线、代理模式、系统代理、扩展状态、证书状态、规则命中状态。MCP 状态卡留到 P3，避免 P1 首页验收和 P3 MCP/AI 增强边界冲突。
- 下一步操作：根据诊断结果动态给出一个主操作。
- 最近活动：最近请求、最近 Mock、最近规则命中。
- 快捷入口：进入抓包、创建调试请求、管理 Mock、打开设置。

首页不应该堆叠太多宣传式内容。它是工作台入口，不是官网首页。

### 7.2 实时请求：抓包主工作台

实时请求页是 Polaris 的核心。

建议模块：

- 顶部状态条：录制状态、代理模式、证书状态、最近同步时间。
- 筛选工具条：关键词、Host、状态码、Method、错误、HTTPS、Mock、转发。
- 请求列表：保持高密度，但要避免信息挤压。
- 详情区：总览、时间线、Header、Body、规则工具。
- 操作区：复制 curl、重放、带入调试、创建 Mock、保存请求。

空态必须可操作：

- 如果没有请求，显示接入检查。
- 如果代理未开启，引导开启规则代理或打开扩展。
- 如果证书未安装，给出安装入口。
- 如果当前规则不命中，提示去代理转发页检查规则。

### 7.3 代理转发：突出命中关系

代理转发页当前已经有分组和规则列表。vNext 应重点补足“为什么命中 / 为什么没命中”。

建议增强：

- 添加 URL 测试输入框：输入 URL 后显示会命中的规则和原因。
- 每条规则显示最近命中次数和最近命中时间。
- 分组状态文案统一为“当前生效组”“待命组”；规则关闭状态统一为“已停用规则”。
- 规则编辑时明确区分来源地址、目标地址、匹配方式和启停状态。

### 7.4 Mock：突出资产和生效范围

Mock 页当前已经具备分组、规则块、导入导出等能力。vNext 应让用户更容易理解启用规则的影响范围。

建议增强：

- 每个 URL block 显示启用规则数、总规则数、最近命中。
- 规则详情中明确显示匹配条件：URL、Method、Body 精确匹配、Body key 匹配。
- 从请求创建 Mock 时提示匹配风险。
- 修复规则块中的嵌套按钮结构，避免 HTML 语义错误。

### 7.5 设置：接入与配置中心

设置页不只展示配置，还要帮助用户完成接入。

建议模块：

- 服务端口：API、Proxy、MCP。
- 浏览器接入：扩展、PAC、系统代理。
- HTTPS：证书状态、下载、安装说明。
- 局域网：手机代理地址和二维码。
- MCP：地址、pack、stdio 命令、复制入口。

## 8. 交互与文案规范

### 8.1 操作命名

优先使用用户能理解的动作：

- 使用“抓包”而不是只说“请求采集”。
- 使用“创建 Mock”而不是“生成规则”。
- 使用“带入调试”而不是“打开 Debug”。
- 使用“当前生效组”而不是只说“active group”。
- 使用“待命组”表示非当前分组。
- 使用“已停用规则”表示 disabled 规则。

### 8.2 状态反馈

每个异步操作都要有明确反馈：

- 加载中：说明正在加载什么。
- 成功：说明完成了什么。
- 失败：说明失败原因和下一步。
- 空态：说明为什么为空，以及如何产生数据。

### 8.3 信息密度

Polaris 是工具型产品，应保持紧凑、清晰、可扫描。

- 列表和表格可以高密度。
- 首页和空态要降低认知负担。
- 不使用营销式大段文案。
- 不使用装饰性强但不提供信息的卡片。

## 9. 技术设计原则

沿用当前项目分层：

- `pages/*` 负责页面编排。
- `domains/*` 负责 React Query、mutation、缓存失效。
- `stores/*` 负责 UI 与会话状态。
- `features/*` 放跨页面复用功能。
- `services/*` 保持 API 客户端和错误处理。

建议新增或强化的边界：

- 把“从请求创建 Mock”的跨域逻辑抽为明确 action，减少 Traffic 对 Mock workspace 的直接依赖。
- 把诊断状态整理为 `domains/diagnostics` 或复用 `home` domain，避免各页面重复判断。
- 把可复制给 AI 的上下文构建逻辑放在 `features/ai-context` 或类似位置。
- 继续避免把服务端实体数据放进 Zustand。

## 10. 已知技术债

本次 review 发现以下问题应在重设计前或第一阶段处理：

- Mock 页面存在 `button` 内嵌 `button` 的结构警告。
- AntD 6 中部分 API 已 deprecated，例如 `Tag bordered={false}`、`Drawer width`、`List`。
- 首页存在中英文混排文案。
- 部分页面编排逻辑仍然偏重，尤其是 Traffic 和 Mock 的跨域联动。

## 11. 重点问题设计补充

本节补充三个必须在 vNext 中明确边界的问题：MCP 修改请求失败、Traffic 搜索契约不清、Traffic 单请求详情不可读。写法按“用户问题 / 当前限制 / 第一阶段方案 / 暂不做 / 验收”组织，代码事实只作为设计依据。

### 11.1 MCP 修改请求：P0 修失败链路，P3 做体验增强

#### 用户问题

AI 或用户通过 MCP 修改已保存请求时，常见失败不可恢复：传入数字型 query、布尔型 header、数组型参数，或者把 captured request id 当作 saved request id 去 update，都会得到过于底层或不够明确的错误。

用户真正需要的是：

- 能更新已保存请求。
- 更新失败时知道是字段类型错、id 类型错，还是请求不存在。
- 标准 MCP 和 legacy `/invoke` 的行为一致，便于旧脚本继续工作。

#### 当前限制

已核对的当前链路如下：

1. `packages/mcp-contracts/src/tools/mutateRequest.ts` 定义标准合并工具 `mutate_request`。
2. `packages/mcp-contracts/src/tools/updateSavedRequest.ts` 定义 legacy 原子工具 `update_saved_request`，只有名称和描述，没有独立 schema。
3. `apps/core/src/modules/mcp/sdkServer.ts` 注册 `mutate_request`，`mutateRequestInputSchema` 目前把 `headers`、`query` 限制为 `Record<string,string>`。
4. `apps/core/src/modules/mcp/toolHandlers.ts` 的 `handleLegacyToolInvocation("update_saved_request")` 会把参数强转为 `{ op: "update" }` 并调用 `handleMutateRequest`。
5. `handleMutateRequest` 通过 `RequestService.getSavedById` 找 saved request，再调用 `RequestService.updateSaved`。
6. `apps/core/src/modules/requests/requestService.ts` 的 `updateSaved` 复用 `SaveRequestInput`，把新旧字段合并后写回。
7. `apps/core/src/modules/mcp/toolHandlers.test.ts` 当前覆盖 proxy、mock、部分 legacy list，没有覆盖 request mutation 的更新、字段保留、类型归一化和 captured id 误用。
8. `docs/mcp.md` 已说明标准 MCP 返回 `structuredContent + content`，legacy `/invoke/:tool` 返回 `{ data: ... }`。

#### 第一阶段方案

P0 只修线上失败链路和契约，不做新入口、不做设置页向导、不做“AI 体验包装”。

P0 必须完成：

- 新增明确的 `UpdateSavedRequestInput` 契约，避免继续用偏创建语义的 `SaveRequestInput` 表达部分更新。
- `mutate_request(op="update")` 接受 AI 常见宽输入，再在进入存储前归一化为当前保存结构：
  - `headers`: `Record<string, string | number | boolean | null>`
  - `query`: `Record<string, string | number | boolean | null | Array<string | number | boolean>>`
  - `body`: `unknown | null`
  - `tags`: `string[]`
- 归一化规则：
  - `headers` 的 number/boolean 转字符串。
  - `headers` 的 null 明确表示移除该 header；移除后仍以当前存储兼容的 `Record<string,string>` 写回，不保存 null。
  - `query` 的 number/boolean 转字符串。
  - `query` 的数组采用保守落地规则：先把每个元素按 string/number/boolean 转字符串，再用逗号拼接成单个字符串写回；空数组写成空字符串。第一阶段不引入重复 key 存储，保持 `Record<string,string>` 兼容。
  - 限制：第一阶段 query 数组如果包含带逗号的元素，读取时无法还原原始多值边界；需要保留严格多值语义的场景暂不支持，必须写入 `docs/mcp.md`。
  - `query` 的 null 明确表示移除该 query key；移除后不保存 null。
  - 对象型 header/query 值第一阶段拒绝，返回字段路径错误。
- `captured request` 和 `saved request` 明确分流：
  - captured request 可以 save、replay、带入调试。
  - saved request 才能 update/delete。
  - update 收到 captured request id 时，返回“这是抓包请求 id，请先 save 为 saved request 再 update”的错误，并给出可执行的下一步。
- 标准 MCP 和 legacy `update_saved_request` 共享同一套归一化、校验和错误映射。
- `handleMutateRequest` 测试覆盖：
  - 更新 name 不影响 method/url/body。
  - 更新 body 支持对象、数组、字符串、null。
  - 更新 headers/query 能归一化 number/boolean。
  - captured request id 执行 update 返回明确错误。
  - legacy `update_saved_request` 与 `mutate_request(op="update")` 行为一致。

#### MCP 输入输出示例

标准 MCP 成功：`mutate_request(op="update")`

```json
{
  "op": "update",
  "id": "saved-123",
  "name": "登录接口 - 带分页",
  "query": {
    "page": 1,
    "debug": true,
    "roles": ["admin", "tester"],
    "obsolete": null
  },
  "headers": {
    "x-trace": 9001,
    "x-old": null
  }
}
```

上述输入写入前归一化为：

```json
{
  "query": {
    "page": "1",
    "debug": "true",
    "roles": "admin,tester"
  },
  "headers": {
    "x-trace": "9001"
  }
}
```

其中 `query.obsolete` 和 `headers.x-old` 被移除，不保存为 null；数组 query 不保存为重复 key，第一阶段固定为逗号拼接字符串。

标准 MCP 成功返回应保留 `structuredContent + content`：

```json
{
  "structuredContent": {
    "result": {
      "ok": true,
      "id": "saved-123",
      "operation": "update",
      "changedFields": ["name", "query", "headers"],
      "unchangedFields": ["method", "url", "body", "tags"],
      "warnings": []
    }
  },
  "content": [
    {
      "type": "text",
      "text": "Updated saved request 登录接口 - 带分页"
    }
  ]
}
```

字段类型错误：

```json
{
  "op": "update",
  "id": "saved-123",
  "headers": {
    "x-meta": {
      "env": "dev"
    }
  }
}
```

返回应明确字段路径和下一步：

```json
{
  "code": "INVALID_REQUEST_FIELD",
  "message": "headers.x-meta 必须是 string、number、boolean 或 null，不能是 object。",
  "field": "headers.x-meta",
  "nextSuggestedActions": [
    "把 headers.x-meta 改成字符串",
    "如果要保存结构化数据，请放入 body"
  ]
}
```

captured request id 错误：

```json
{
  "op": "update",
  "id": "captured-abc",
  "name": "新的名称"
}
```

返回应说明 id 所属资源类型：

```json
{
  "code": "REQUEST_ID_NOT_SAVED",
  "message": "captured-abc 是抓包请求 id，不是已保存请求 id，不能直接 update。",
  "nextSuggestedActions": [
    "先调用 mutate_request(op=\"save\", requestId=\"captured-abc\", name=\"新的名称\")",
    "再使用返回的 saved request id 调用 mutate_request(op=\"update\")"
  ]
}
```

legacy `/invoke/update_saved_request` 输入仍是旧脚本友好形态：

```json
{
  "id": "saved-123",
  "name": "登录接口 - 带分页",
  "query": {
    "page": 1
  }
}
```

legacy 返回保持 `/invoke` 包装差异：

```json
{
  "data": {
    "ok": true,
    "id": "saved-123",
    "operation": "update",
    "changedFields": ["name", "query"]
  }
}
```

标准 MCP 与 legacy 差异固定为：标准 MCP 返回 `structuredContent + content`，legacy `/invoke/:tool` 返回 `{ data: ... }`；内部 result 字段语义必须一致。

#### P3 才做的体验增强

- 设置页 MCP 接入向导。
- MCP pack 选择建议和复制 stdio 命令。
- 首页 MCP 状态卡。
- Traffic、Mock、代理页面的“复制给 AI 的上下文”。
- 面向 AI 的任务模板和更完整的 next action 推荐。

这些不属于 P0。P0 的验收标准是“失败链路修复、契约清楚、测试覆盖”，不是“AI 使用体验完整”。

#### 验收

- AI 用标准 MCP 更新 saved request 可以成功，非字符串 query/header 值按契约归一化。
- legacy `update_saved_request` 与标准 `mutate_request(op="update")` 对同一输入得到同等 result。
- captured id 误用时返回可读错误和下一步。
- `docs/mcp.md` 同步说明 update 输入、错误和标准/legacy 返回差异。

### 11.2 Traffic 搜索：第一阶段先固定通用搜索契约

#### 用户问题

用户在实时请求页想按 host、path、query、header、请求体、响应体、处理结果搜索，但当前输入框文案只说“搜索 URL 或请求体”，实际结果也经常搜不到。空结果时用户无法判断是没有请求，还是搜索范围太窄。

#### 当前限制

已核对的当前链路如下：

1. `TrafficRequestPane` 维护 `keyword`、`hostOnly`、`statusCode`、`method`、`focusMode`。
2. `useTrafficWorkspace` 把这些值传给 `useTrafficRequestsQuery`。
3. `apps/console/src/domains/traffic/adapters.ts` 转为 `keyword`、`method`、`statusCode`、`host` URLSearchParams。
4. `packages/shared-contracts/src/filters/requestFilters.ts` 当前只有 `keyword`、`method`、`statusCode`、`host`、`limit`。
5. `RequestService.list(filters)` 的 keyword 当前只匹配 `item.url.includes(keyword)` 和 `JSON.stringify(item.requestBody ?? "").includes(keyword)`。
6. Host 当前是精确匹配：`item.host === filters.host`。
7. focus mode 是 Console 侧二次过滤，不属于 Core 搜索契约。

#### 第一阶段搜索契约表

第一阶段只做通用搜索和现有筛选增强，不做高级查询语言。

| 字段 | 来源 | 匹配方式 | 大小写 | 序列化上限 | 二进制/超大内容降级 | 数组/空值规则 |
| --- | --- | --- | --- | --- | --- | --- |
| `method` | `RequestRecord.method` | keyword 包含匹配；method 筛选精确匹配 | 不敏感 | 不需要序列化 | 不涉及 | 空值不加入搜索文本 |
| `url` | `RequestRecord.url` | keyword 包含匹配 | 不敏感 | 4096 字符 | 超长 URL 截断并保留开头 | 空值不加入 |
| `host` | `RequestRecord.host` | keyword 包含匹配；host 筛选包含匹配 | 不敏感 | 512 字符 | 去掉协议，保留 host 和端口 | 用户输入协议时先归一化；空值不筛 |
| `path` | `RequestRecord.path` | keyword 包含匹配 | 不敏感 | 2048 字符 | 超长 path 截断 | 空值不加入 |
| `statusCode` | `RequestRecord.statusCode` | keyword 字符串包含；statusCode 筛选精确数字 | 不涉及 | 不需要序列化 | 不涉及 | 0/undefined 不加入 |
| `source` | `RequestRecord.source` | keyword 包含匹配 | 不敏感 | 不需要序列化 | 不涉及 | 空值不加入 |
| `requestHeaders` | `RequestRecord.requestHeaders` | key/value 扁平化后包含匹配 | 不敏感 | 每块最多 8192 字符 | 超限截断并追加 `[truncated]` | null/undefined 跳过；数组按逗号连接 |
| `requestQuery` | `RequestRecord.requestQuery` | key/value 扁平化后包含匹配 | 不敏感 | 每块最多 8192 字符 | 超限截断并追加 `[truncated]` | null/undefined 跳过；数组按逗号连接 |
| `requestBody` | `RequestRecord.requestBody` | safe stringify 后包含匹配 | 不敏感 | 每块最多 20000 字符 | Buffer/ArrayBuffer/不可读二进制显示 `[binary content]`；循环引用显示 `[circular]`；超限截断 | 数组按 JSON 序列化；null 搜索文本包含 `null`；undefined 跳过 |
| `responseHeaders` | `RequestRecord.responseHeaders` | key/value 扁平化后包含匹配 | 不敏感 | 每块最多 8192 字符 | 超限截断并追加 `[truncated]` | null/undefined 跳过；数组按逗号连接 |
| `responseBody` | `RequestRecord.responseBody` | safe stringify 后包含匹配 | 不敏感 | 每块最多 20000 字符 | Buffer/ArrayBuffer/不可读二进制显示 `[binary content]`；循环引用显示 `[circular]`；超限截断 | 数组按 JSON 序列化；null 搜索文本包含 `null`；undefined 跳过 |
| `resolution.mode` | `RequestRecord.resolution.mode` | keyword 包含匹配 | 不敏感 | 不需要序列化 | 不涉及 | 空值不加入 |
| `resolution.source` | `RequestRecord.resolution.source` | keyword 包含匹配 | 不敏感 | 不需要序列化 | 不涉及 | 空值不加入 |
| `resolution.reason` | `RequestRecord.resolution.reason` | keyword 包含匹配 | 不敏感 | 2048 字符 | 超限截断 | 空值不加入 |
| `resolution.matchedRuleName` | `RequestRecord.resolution.matchedRuleName` | keyword 包含匹配 | 不敏感 | 2048 字符 | 超限截断 | 空值不加入 |
| `resolution.target` | `RequestRecord.resolution.target` | keyword 包含匹配 | 不敏感 | 4096 字符 | 超限截断 | 空值不加入 |

第一阶段 UI 文案同步改为：

- keyword placeholder：`搜索 URL、Host、Header、Body、处理结果`
- host placeholder：`Host 过滤，支持片段`
- 空结果说明：明确“当前搜索覆盖 URL、Host、Path、Header、Query、请求体、响应体、处理结果”。

#### 第一阶段方案

- 在 Core 增加独立搜索 helper，例如 `requestSearch.ts`：
  - `buildRequestSearchText(record)`：按上表生成搜索文本。
  - `matchRequestKeyword(record, keyword)`：大小写不敏感全文匹配。
  - `normalizeHostFilter(value)`：去掉协议、路径和首尾空格。
  - `safeSerializeForSearch(value, maxChars)`：稳定、安全、可控长度地序列化。
- `RequestService.list` 继续是服务端过滤入口，避免 Console 和 MCP 看到不同结果。
- `RequestFilters` 不新增复杂字段，第一阶段仍保持 `keyword/method/statusCode/host/limit`。
- Console 侧只改文案和空态说明，不做完整搜索语法浮层。

#### 暂不做

- 不支持 `body:user.id=123`、`$.user.id`、`status:4xx` 等结构化查询语言。
- 不做可视化查询构造器。
- 不做索引库或持久化全文索引。
- 不做跨历史归档搜索。

#### 验收

- keyword 能命中 request/response body 深层值、query、header、host、path、resolution。
- keyword 大小写不敏感。
- host 筛选支持 host 片段，输入 `https://api.example.com:443/foo` 时能归一化为 host 意图。
- 二进制、循环引用和超大 body 不抛错，不明显卡顿。
- 文案和文档不再宣称只搜索 URL 或请求体。

### 11.3 Traffic 详情布局：从窄侧栏改为可阅读检查器

#### 用户问题

用户选中单个请求后，最常阅读的是 URL、Header、Query、请求体、响应体和处理决策。但当前详情栏在桌面宽度下可能只有 360px，长 URL 和 JSON 被强制换行、断词，结构被打散，阅读和复制都很吃力。

#### 当前限制

已核对的当前布局事实如下：

- `TrafficPage.module.less` 当前在 1280px 以上使用两栏：`minmax(0, 1.85fr) minmax(360px, 0.95fr)`。
- 1280px 以下切成单列，但仍需要处理列表和详情的优先级。
- App Shell 当前桌面侧栏约 232px，content 左右 padding 为 26px + 26px；1365px 视口下内容区可用宽度约 `1365 - 232 - 52 = 1081px`，再扣 Traffic 两栏 gap 12px 后只剩约 1069px，无法同时满足“列表 440px + 详情 640px + gap”的 1092px 需求。
- `TrafficDetailPane` 当前 tabs 是“总览 / 时间线 / 工具”。
- `TrafficOverviewTab` 在“总览”里放了请求详情、处理决策、查询参数、请求头、响应头、请求体、响应体。
- `JsonBlock.module.css` 当前 `pre` 使用 `white-space: pre-wrap` 和 `word-break: break-word`，长 JSON 会被断词换行。
- `KeyValueBlock.module.css` 长值使用 `overflow-wrap: anywhere`，适合防溢出，但不适合长 header 的可读扫描。

#### 第一阶段 breakpoint 表

| 视口宽度 | 默认布局 | 请求列表宽度 | 详情最小宽度 | 聚焦模式 | JSON 滚动策略 |
| --- | --- | --- | --- | --- | --- |
| `>=1460px` | 左列表 + 右详情 | 480-600px，可随空间增长但不超过 45% | 680px | 可选；开启后列表压缩到 320px 或隐藏 | JSON 保留缩进，不断词；容器内部横向滚动；body 区独立纵向滚动 |
| `1360-1459px` | 左列表 + 右详情，详情优先但不承诺 640px | 360-420px | 600px | 必须显眼；开启后详情占主区域，列表折叠或降到窄摘要 | JSON 保留缩进，不断词；横向滚动；请求体/响应体分区滚动 |
| `1181-1359px` | 默认详情优先或单列切换 | 列表全宽摘要；选中后折叠列表 | 视口宽度减 Shell padding，不再使用 360px 侧栏 | 必须提供；进入聚焦后只显示详情和返回列表 | JSON 横向滚动；限制每块最大高度，避免整页失控 |
| `<1181px` | App Shell 已切到顶部导航后的单列任务流 | 列表全宽，高度受控 | 全宽 | 默认详情即聚焦；返回列表是主导航动作 | JSON 使用横向滚动；复制按钮固定在块头；不强制展示请求体和响应体双列 |
| 移动端 | 单列任务流 | 列表全宽，高度受控 | 全宽 | 默认详情即聚焦；返回列表是主导航动作 | JSON 使用横向滚动；复制按钮固定在块头；不强制展示请求体和响应体双列 |

#### 第一阶段方案

- 详情区从辅助侧栏升级为“请求检查器”，布局优先保证详情阅读宽度。
- tabs 拆成：
  - `概览`：URL、状态、耗时、处理决策、命中规则。
  - `请求`：Query、Request Headers、Request Body。
  - `响应`：Response Headers、Response Body。
  - `时间线`：阶段、耗时、来源。
  - `动作`：复制 curl、重放、带入调试、创建 Mock、保存请求。
- 详情头部保留 method、status、path、host、处理结果；主操作只保留 1-2 个，其余进更多菜单。
- JSON 默认不强制断词，保留缩进结构，用内部横向滚动解决长行。
- 大 body 默认展示 preview，提供“展开完整内容”和“复制完整内容”。
- Header 和 Query 行提供单行复制；长值可展开，不默认撑爆布局。

#### 暂不做

- 不做完整 diff 视图。
- 不做 JSONPath 查询器。
- 不做响应体编辑器。
- 不做多请求对比。

#### 验收

- 1365px 宽度下，不再承诺同时显示 440px 列表和 640px 详情；默认双栏时详情不低于 600px，或自动进入详情聚焦/单列模式以获得更宽阅读区。
- 1181-1359px 不再保留 360px 窄侧栏作为唯一详情阅读方式；选中请求后可以折叠列表或进入聚焦态。
- 长 URL、长 header、深层 JSON 不破坏布局。
- Playwright 覆盖空态、有请求态、详情聚焦态。

### 11.4 术语表

| 术语 | 定义 | 用户可见表达 |
| --- | --- | --- |
| Core | Polaris 本地服务，负责 API、代理、抓包、Mock、MCP 和存储。 | 本地服务 |
| MCP pack | MCP 按能力拆分后的入口集合，例如 request、mock、proxy、ops。 | MCP 能力包 |
| stdio | 通过标准输入输出运行 MCP server 的接入方式，适合本地 AI 工具拉起。 | stdio 接入 |
| resolution | 单条请求最终如何处理的决策结果，包含 mock、proxy forward、direct、block、error 等。 | 处理结果 / 处理决策 |
| captured request | 从代理、扩展或调试流程捕获到的真实请求记录。 | 抓包请求 |
| saved request | 用户保存下来的可复用请求资产，可 update/delete/replay。 | 已保存请求 |
| legacy invoke | 旧 HTTP 调用方式 `/invoke/:tool`，返回 `{ data: ... }`，用于兼容旧脚本。 | legacy `/invoke` |
| 规则代理 | 只让命中站点规则的流量进入 Polaris 的代理模式，日常推荐使用。 | 规则代理 |
| 当前生效组 | 当前参与匹配的一组 Mock 或代理规则。 | 当前生效组 |
| 待命组 | 已保存但当前不参与匹配的规则组。 | 待命组 |
| 已停用规则 | 单条规则 disabled，不参与匹配。 | 已停用规则 |

## 12. 推荐实施顺序

### P0：基础可用性修正

阶段边界：修线上失败链路、契约和明显 HTML/API 问题；不做 MCP 体验增强。

| 项目 | 内容 |
| --- | --- |
| 用户可见变化 | MCP 更新已保存请求更稳定；字段错误、captured id 误用能看到可读原因；Mock 嵌套按钮警告消失；基础中文文案更一致。 |
| 必过测试 | `corepack pnpm typecheck`；先给 `apps/core/package.json` 补 `"test": "tsx --test \"src/**/*.test.ts\""` 后运行 `corepack pnpm --filter @polaris/core test`；补 script 前的临时可用命令是 `corepack pnpm --filter @polaris/core exec tsx --test src/modules/mcp/toolHandlers.test.ts src/modules/mcp/payloads.test.ts src/modules/mcp/mockRuleMutations.test.ts src/modules/mock/mockService.test.ts src/modules/whistle-import/whistleImportService.test.ts src/app/server.test.ts`；request mutation 单测覆盖标准 MCP 和 legacy；Mock 嵌套按钮相关页面 E2E 不再出现结构警告。 |
| 必更文档 | `docs/mcp.md` 必须说明 update 输入契约、错误示例、标准 MCP 与 legacy `/invoke` 返回差异；如果用户操作文案变化，同步 `docs/console.md`。 |

P0 任务：

- 修复 MCP request mutation 失败链路和测试缺口。
- 修复 Mock 嵌套按钮结构。
- 替换会影响维护的 AntD deprecated API。
- 统一最明显的中英文混排和错误态文案。

### P1：首页和实时请求重设计

阶段边界：改善首次接入、抓包搜索和单请求详情阅读；不改主导航标签和路由。

| 项目 | 内容 |
| --- | --- |
| 用户可见变化 | 首页更像运行诊断入口，但不新增 MCP 状态卡；实时请求空态可排障；Traffic 搜索能覆盖 URL、Host、Path、Header、Query、请求体、响应体、处理结果；详情区成为可阅读检查器并支持聚焦模式。 |
| 必过测试 | `corepack pnpm typecheck`；`corepack pnpm --filter @polaris/console test`；Traffic 搜索单测覆盖契约表字段；`corepack pnpm test:e2e:page -- --page home`；`corepack pnpm test:e2e:page -- --page traffic`；必要时补 1365px、1280px、移动端截图。 |
| 必更文档 | `README.md` 和 `docs/console.md` 更新实时请求搜索范围、详情阅读模式和首页诊断说明；`docs/e2e-testing.md` 更新新增视觉覆盖或页面 key 说明。 |

P1 任务：

- 首页改为运行诊断入口。
- 实时请求空态改为接入排障向导。
- 扩展 Traffic 搜索范围，按第一阶段契约实现。
- 重做 Traffic 单请求详情布局和 JSON 阅读策略。
- 请求详情动作统一。
- 补充代理、证书、规则命中相关提示。
- 不在 P1 新增首页 MCP 状态卡；如保留当前已有 MCP badge，只能作为非阻塞附加信息，不进入 P1 验收。

### P2：Mock 与代理规则体验统一

阶段边界：统一规则资产语言、命中解释和导入导出体验；不引入新的规则引擎。

| 项目 | 内容 |
| --- | --- |
| 用户可见变化 | Mock 和代理都使用“当前生效组 / 待命组 / 已停用规则”；规则是否命中、为什么不命中更清楚；从真实请求创建 Mock 的风险提示更明确。 |
| 必过测试 | `corepack pnpm typecheck`；Mock/代理相关单测；`corepack pnpm test:e2e:page -- --page mock`；`corepack pnpm test:e2e:page -- --page proxy-forward`；从 Traffic 创建 Mock 的主路径 E2E。 |
| 必更文档 | `docs/console.md` 更新 Mock、代理和从请求创建 Mock 流程；`docs/extension.md` 如规则代理说明变化必须同步；`README.md` 如页面职责文案变化必须同步。 |

P2 任务：

- 统一分组状态语言。
- 统一导入、导出、启停、更多菜单。
- 增加规则命中解释。
- 优化从真实请求创建 Mock 的流程。

### P3：MCP/AI 增强

阶段边界：在 P0 契约稳定后做体验增强；不再混入基础 mutation 修复。

| 项目 | 内容 |
| --- | --- |
| 用户可见变化 | 设置页能复制 MCP 地址、pack 和 stdio 命令；首页显示 MCP 可用状态；请求和规则页面能复制给 AI 的上下文；AI 更容易按 Polaris 工作流操作。 |
| 必过测试 | `corepack pnpm typecheck`；MCP pack/stdio 相关单测；设置页 E2E；标准 MCP 与 legacy `/invoke` smoke test；MCP 文档示例按固定手工步骤或后续专用 smoke 脚本验证。 |
| 必更文档 | `README.md` 更新 MCP 简介；`docs/mcp.md` 更新 pack、stdio、示例和错误返回；`docs/console.md` 更新设置页入口；`docs/e2e-testing.md` 更新新增 MCP/设置页验证方式。 |

P3 任务：

- 设置页 MCP 接入向导。
- 首页 MCP 可用状态。
- 请求和规则上下文复制。
- MCP 工具清单和 pack 选择建议。

## 13. 验证矩阵

| 功能区 | 验证类型 | 覆盖样例 | 对应命令 | 是否阻塞发布 |
| --- | --- | --- | --- | --- |
| 全仓 | 类型检查 | React、Core、contracts 类型一致 | `corepack pnpm typecheck` | 是 |
| Console | 单测 | Traffic 搜索 helper、UI 状态 reducer/hooks、文案分支 | `corepack pnpm --filter @polaris/console test` | 是 |
| Core 测试脚本 | package script | `apps/core/package.json` 增加 `"test": "tsx --test \"src/**/*.test.ts\""`，让后续 Core 验证命令可执行 | 修改 script 后运行 `corepack pnpm --filter @polaris/core test`；补 script 前临时运行 `corepack pnpm --filter @polaris/core exec tsx --test <具体 .test.ts>` | 是 |
| Core MCP | 单测 | `mutate_request update` 成功、字段类型错误、captured id 错误、legacy 行为一致 | `corepack pnpm --filter @polaris/core test`；补 script 前临时运行 `corepack pnpm --filter @polaris/core exec tsx --test src/modules/mcp/toolHandlers.test.ts` | 是 |
| Core Requests | 单测 | keyword 命中 URL/Host/Path/Header/Query/Request Body/Response Body/resolution；host 归一化；大 body 降级 | `corepack pnpm --filter @polaris/core test`；P1 新增 `requestSearch.ts/requestSearch.test.ts` 后，补 script 前临时运行 `corepack pnpm --filter @polaris/core exec tsx --test src/modules/requests/requestSearch.test.ts`；落地前该命令只表示目标验证方式 | 是 |
| 首页 | E2E/视觉 | P1 覆盖 Core 在线、代理模式、证书、规则命中提示、下一步操作；P3 再覆盖 MCP 状态卡 | `corepack pnpm test:e2e:page -- --page home` | 是 |
| Traffic | E2E/视觉 | 空态、有请求态、筛选空结果、详情普通态、详情聚焦态 | `corepack pnpm test:e2e:page -- --page traffic` | 是 |
| Traffic 响应式 | 视觉 | `>=1460`、1365、1280、移动端；1365 不要求 440px 列表 + 640px 详情同时成立，要求默认详情 >=600px 或自动进入聚焦/单列；JSON 横向滚动 | Playwright 视口截图，命令随现有 e2e 脚本落地 | 是 |
| Mock | E2E/视觉 | 当前生效组、待命组、已停用规则、从请求创建 Mock | `corepack pnpm test:e2e:page -- --page mock` | 是 |
| 代理转发 | E2E/视觉 | 规则代理、当前生效组、待命组、命中解释 | `corepack pnpm test:e2e:page -- --page proxy-forward` | 是 |
| Extension | E2E/视觉 | 规则代理提示、当前站点加入/移除规则、端口发现 | `corepack pnpm test:e2e:page -- --page popup` | 影响扩展时阻塞 |
| MCP 文档示例 | 手工或自动 smoke | `mutate_request`、`update_saved_request`、pack、stdio 示例 | `corepack pnpm dev:mcp` 只作为 stdio server 启动前置条件；验收必须实际调用文档中的 `mutate_request` 和 legacy `/invoke/update_saved_request` 示例并核对成功、字段错误、captured id 错误三类返回；后续可替换为专用 MCP smoke 脚本 | 是 |
| 文档同步 | 人工 review | `README.md`、`docs/console.md`、`docs/extension.md`、`docs/mcp.md`、`docs/e2e-testing.md` 与实现一致 | `git diff -- README.md docs` | 是 |
| 全量回归 | E2E | Console 主路径和 Extension Popup | `corepack pnpm test:e2e` | 合并前阻塞 |

## 14. 成功标准

- 新用户能通过首页判断接入状态，并知道下一步。
- 抓不到包时，页面能解释最可能的原因。
- 从真实请求创建 Mock 的路径清晰且少跳转。
- Mock 和代理规则的“当前生效组”概念一致。
- MCP 接入信息可复制、可理解、可验证。
- 页面文案对人类可读，不依赖开发者阅读源码才能理解功能。
- AI 通过 MCP 修改已保存请求时，成功和失败都有明确、结构化、可继续操作的反馈。
- Traffic 搜索能命中请求体和响应体里的常见参数。
- 单个请求详情在桌面宽度下可阅读，不再被窄栏和大字号破坏。
