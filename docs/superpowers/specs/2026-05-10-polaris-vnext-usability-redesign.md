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

导航标签是否立即改名可以在实现阶段决定。第一阶段可以先保持当前路由和标签，逐步调整页面标题、说明和空态。

## 6. 核心工作流

### 6.1 首次接入

用户目标：确认 Polaris 能抓到浏览器请求。

推荐流程：

1. 打开首页。
2. 首页显示运行诊断：Core、代理模式、系统代理或扩展、证书、规则命中状态。
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
2. 分组列表明确显示：当前、生效中、待命、规则数、启用数。
3. 规则列表明确显示：启停、匹配条件、结果、最近命中。
4. 批量导入、导出、移动、复制等操作使用一致的入口和反馈。

### 6.5 MCP/AI 使用

用户目标：让 AI 或外部工具理解当前工作台状态，并调用 Polaris 能力。

推荐流程：

1. 设置页展示 MCP 地址、pack 选择建议、stdio 命令和复制按钮。
2. 首页显示 MCP 是否可用，以及推荐接入方式。
3. 实时请求页提供“复制诊断上下文”动作，输出选中请求、代理模式、证书状态、相关规则等结构化摘要。
4. Mock 和代理页面提供“复制规则上下文”动作，帮助 AI 分析规则是否合理。

## 7. 页面设计建议

### 7.1 首页：从概览页变成运行诊断页

首页首屏应优先回答“Polaris 现在能不能用”。

建议模块：

- 运行诊断卡：Core 在线、代理模式、系统代理、扩展状态、证书状态、MCP 状态。
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
- 分组状态文案统一为“当前生效组”“待命组”。
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

## 11. 补充问题排查与方案

本节记录后续补充的三个问题：MCP 修改请求失败、Traffic 筛选能力不足、Traffic 单请求详情可读性差。它们都应纳入 vNext 的第一阶段或第二阶段。

### 11.1 MCP 修改请求失败

#### 现状链路

MCP 请求相关能力当前有两套入口：

- 标准合并工具：`mutate_request`
- legacy 原子工具：`update_saved_request`

两者最终都会进入 Core 的 `handleMutateRequest`：

1. `packages/mcp-contracts/src/tools/mutateRequest.ts` 定义合并工具名称和描述。
2. `apps/core/src/modules/mcp/sdkServer.ts` 注册 `mutate_request`，并使用 `mutateRequestInputSchema` 做输入校验。
3. `apps/core/src/modules/mcp/toolHandlers.ts` 的 `handleLegacyToolInvocation` 会把 `update_saved_request` 转为 `{ op: "update" }` 后调用 `handleMutateRequest`。
4. `handleMutateRequest` 读取已保存请求，再调用 `RequestService.updateSaved`。
5. `RequestService.updateSaved` 合并旧值和新值，写回 `StorageAdapter`。

#### 关键发现

当前问题更像通用链路风险，不是单个页面问题。

风险点如下：

- 标准 MCP schema 把 `headers` 和 `query` 限制为 `Record<string,string>`。AI 修改请求时经常会传入数字、布尔、数组或对象，例如 query 参数值为 `123`，这会在 MCP SDK schema 层直接失败。
- `SaveRequestInput` 同时用于创建和更新，但类型名和语义更偏创建。更新场景虽然在 `handleMutateRequest` 中补齐旧值，但契约层没有明确“部分更新”的输入类型。
- legacy `update_saved_request` 工具文件只有名称和描述，没有独立 schema。legacy HTTP invoke 依赖 handler 里的强制类型转换，错误反馈不够精确。
- `handleMutateRequest` 缺少 request mutation 的单元测试。当前 `toolHandlers.test.ts` 覆盖了 proxy、mock 和部分 legacy list，但没有覆盖保存请求的更新、字段保留、非字符串 query/header 值、body 更新失败等场景。
- 写回执只返回 `changedFields`，失败时缺少对 AI 友好的原因说明，例如“headers.x 必须是字符串”或“id 指向的是 captured request，不是 saved request”。

#### 推荐修复设计

MCP 请求修改应按“宽输入、窄存储、清晰错误”处理。

建议新增或调整：

- 为更新请求新增明确契约：`UpdateSavedRequestInput`，字段全部可选，但至少一个可更新字段存在。
- MCP schema 接受更宽松的输入：
  - `headers`: `Record<string, string | number | boolean | null>`
  - `query`: `Record<string, string | number | boolean | null | Array<string | number | boolean>>`
  - 进入服务层前统一归一化为当前 `KeyValueMap` 或字符串 map。
- 明确区分 captured request 和 saved request：
  - captured request 只能保存、重放、带入调试。
  - saved request 才能 update/delete。
  - 如果 AI 传 captured request id 去 update，应返回可读错误，并建议先 `mutate_request(op="save", requestId=...)`。
- `handleMutateRequest` 返回更适合 AI 使用的结构化结果：
  - `ok`
  - `id`
  - `operation`
  - `changedFields`
  - `unchangedFields`
  - `warnings`
  - `nextSuggestedActions`
- legacy `update_saved_request` 应与 `mutate_request(op="update")` 共享同一套校验和错误映射。
- 为 MCP request mutation 增加测试矩阵：
  - 更新 name 不影响 method/url/body。
  - 更新 body 能正确写入对象、数组、字符串、null。
  - 更新 headers/query 时能接受非字符串值并归一化。
  - captured request id 执行 update 返回明确错误。
  - legacy `update_saved_request` 与标准 `mutate_request` 行为一致。

### 11.2 Traffic 筛选能力不足

#### 现状链路

Traffic 筛选从 Console 到 Core 的链路如下：

1. `TrafficRequestPane` 维护关键词、Host、状态码、Method、focus mode。
2. `useTrafficWorkspace` 把筛选条件传给 `useTrafficRequestsQuery`。
3. `domains/traffic/adapters.ts` 转成 URLSearchParams。
4. Core `/api/requests` 读取 `keyword`、`method`、`host`、`statusCode`、`limit`。
5. `RequestService.list(filters)` 在服务端过滤。

当前服务端 keyword 只匹配：

- `item.url.includes(filters.keyword)`
- `JSON.stringify(item.requestBody ?? "").includes(filters.keyword)`

Host 当前是精确匹配：

- `item.host === filters.host`

#### 关键发现

当前筛选能力和用户预期不一致。

具体问题：

- keyword 没有匹配 `host`、`path`、`method`、`statusCode`、`requestHeaders`、`requestQuery`、`responseHeaders`、`responseBody`、`resolution`。
- keyword 匹配区分大小写，对 header 名、Host、URL 片段不友好。
- Host 过滤是精确等于，不能匹配子串、域名后缀、端口差异或通配意图。
- 没有 body path 语义，用户输入 `user.id=123`、`$.user.id=123`、`token` 时很容易筛不到。
- 筛选结果为空时只提示“清空关键词或切换范围”，没有解释当前搜索实际覆盖了哪些字段。
- 前端筛选 UI 文案写着“搜索 URL 或请求体”，但用户需求已经超过这两个字段。

#### 推荐修复设计

Traffic 搜索应分为两层：快速全文搜索和高级结构化搜索。

第一阶段先做通用搜索：

- `keyword` 改为大小写不敏感。
- 搜索字段扩展到：
  - method
  - url
  - host
  - path
  - statusCode
  - source
  - requestHeaders
  - requestQuery
  - requestBody
  - responseHeaders
  - responseBody
  - resolution mode/source/reason/rule name/target
- Host 过滤改为包含匹配，并支持忽略协议和端口输入。
- 请求体和响应体统一使用安全 stringify，避免循环、undefined、二进制或超大对象导致异常。

第二阶段增加结构化搜索：

- 支持 `body:user.id=123`，匹配 request body。
- 支持 `response:data.code=0`，匹配 response body。
- 支持 `header:authorization`，匹配请求头或响应头。
- 支持 `query:page=1`，匹配查询参数。
- 支持 `host:example.com`、`path:/api/user`、`status:4xx`、`method:POST`。
- UI 上可以先提供搜索说明浮层，不需要一开始做完整查询构造器。

服务层建议新增 `requestSearch.ts`：

- `buildRequestSearchText(record)`：生成通用搜索文本。
- `matchRequestKeyword(record, keyword)`：大小写不敏感全文匹配。
- `matchRequestStructuredQuery(record, query)`：处理带前缀的结构化搜索。
- `safeSerializeForSearch(value)`：稳定、安全、可控长度地序列化 body/header/query。

必须补测试：

- keyword 能匹配 request body 内的深层字段值。
- keyword 能匹配 response body。
- keyword 能匹配 query/header。
- host 支持子串和带端口输入。
- status 支持精确状态码，后续支持 `4xx`。
- 大 body 不会让筛选抛错或明显卡顿。

### 11.3 Traffic 单请求详情可读性差

#### 现状链路

Traffic 页面当前使用两栏布局：

- 左侧请求列表：`minmax(0, 1.85fr)`
- 右侧详情：`minmax(360px, 0.95fr)`

详情区内部结构：

- `TrafficDetailPane` 顶部 tabs：总览、时间线、工具。
- 总览里依次展示请求详情、处理决策、查询参数、请求头、响应头、请求体、响应体。
- JSON 内容通过 `JsonBlock` 展示，`pre` 使用 `white-space: pre-wrap` 和 `word-break: break-word`。

#### 关键发现

详情体验差的根因是布局与内容类型不匹配。

具体问题：

- 右侧栏最小只有 360px，真实接口 URL、Header、JSON body 都是长文本，天然不适合窄栏阅读。
- 请求列表占比过大，详情区是分析主区域却被压缩为辅助栏。
- JSON 使用自动换行和断词，在窄栏下会把结构打碎，降低可读性。
- 请求体和响应体在同一个窄栏里纵向堆叠，用户需要大量滚动。
- 详情页的“总览”承载了太多内容，tabs 粒度不符合阅读任务。
- 复制按钮和操作按钮占据详情头部空间，进一步压缩上下文。

#### 推荐修复设计

Traffic 详情应从“窄侧栏”升级为“可阅读的请求检查器”。

推荐布局：

- 默认桌面使用三段式：
  - 左侧请求列表：固定或弹性宽度，建议 520-680px。
  - 右侧详情：占剩余空间，最小 640px。
  - 当视口不足时，列表在上、详情在下，或详情进入聚焦模式。
- 增加“详情聚焦模式”：
  - 选中请求后可一键放大详情。
  - 聚焦模式隐藏或压缩请求列表。
  - 适合阅读长 JSON、Header、响应体。
- 详情 tabs 重新拆分：
  - 概览：URL、状态、耗时、处理决策、命中规则。
  - 请求：Query、Request Headers、Request Body。
  - 响应：Response Headers、Response Body。
  - 时间线：阶段、耗时、来源。
  - 动作：复制 curl、重放、带入调试、创建 Mock、保存请求。
- JSON 阅读优化：
  - 默认不强制断词，保留缩进结构，使用横向滚动。
  - 字号使用 12px 或 12.5px 等宽字体，行高 1.55 左右。
  - Header 表格使用更紧凑行高，长值支持复制和展开。
  - 大 body 默认展示 preview，提供“展开完整内容”或“复制完整内容”。
  - 请求体/响应体支持独立高度和内部滚动。
- 详情头部保留必要上下文：
  - method
  - status
  - path
  - host
  - 处理结果
  - 主操作只保留 1-2 个，其余放入更多菜单。

必须补验证：

- 桌面 1365px 宽度下，详情区不得低于可读宽度。
- 1280px 以下布局不应让详情挤成窄栏。
- 长 URL、长 header、深层 JSON 不应破坏布局。
- Playwright 截图覆盖空态、有请求态、详情聚焦态。

## 12. 推荐实施顺序

### P0：基础可用性修正

- 修复 Mock 嵌套按钮结构。
- 替换 AntD deprecated API。
- 统一中文文案。
- 统一空态、错误态、加载态的基础组件用法。
- 为 MCP request mutation 补测试，修正请求更新失败链路。

### P1：首页和实时请求重设计

- 首页改为运行诊断入口。
- 实时请求空态改为接入排障向导。
- 请求详情动作统一。
- 补充代理、证书、规则命中相关提示。
- 扩展 Traffic 搜索范围，支持 request/response body、query、header、path、resolution。
- 重做 Traffic 单请求详情布局，提供可阅读的请求检查器。

### P2：Mock 与代理规则体验统一

- 统一分组状态语言。
- 统一导入、导出、启停、更多菜单。
- 增加规则命中解释。
- 优化从真实请求创建 Mock 的流程。

### P3：MCP/AI 增强

- 设置页 MCP 接入向导。
- 首页 MCP 可用状态。
- 请求和规则上下文复制。
- MCP 工具清单和 pack 选择建议。

## 13. 验证方案

每个阶段完成后都要验证：

- TypeScript typecheck。
- Console 单测。
- 关键页面 Playwright 视觉截图。
- 首页、实时请求、Mock、代理转发的主要路径 E2E。
- 空态、失败态、移动端窄布局。
- 文档是否同步更新：`README.md`、`docs/console.md`、`docs/extension.md`、`docs/mcp.md`、`docs/e2e-testing.md`。
- MCP request mutation 测试覆盖标准工具和 legacy 工具。
- Traffic 筛选测试覆盖 URL、Host、Query、Header、Request Body、Response Body。
- Traffic 详情页截图覆盖普通模式和聚焦模式。

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
