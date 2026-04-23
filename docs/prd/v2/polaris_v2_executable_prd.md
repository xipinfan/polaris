> [!WARNING]
> 历史文档：本文件用于记录历史版本规划或提示词，不代表当前代码实现能力。
> 当前能力请以 `README.md`、`docs/console.md`、`docs/extension.md`、`docs/development.md`、`docs/e2e-testing.md`、`docs/mcp.md` 和源码为准。
# Polaris V2 实施版开发文档

## 1. 文档定位

这不是一份“愿景版 V2”文档，而是一份基于当前仓库现状整理出的“可实现、可开发、可分期交付”的实施版文档。

本文档用于替代当前过宽的 V2 描述，目标是让研发可以直接据此拆分任务并开始实现，同时避免把 Polaris 从“本地接口工作台”拉向“重型测试平台”。

本文档结论基于以下上下文：

- 当前产品与 V1 说明：
  - `README.md`
  - `docs/console.md`
  - `docs/mcp.md`
- 当前 V2 文档：
  - `docs/prd/v2/polaris_v2_prd.md`
  - `docs/prd/v2/polaris_v2_pages_prd.md`
  - `docs/prd/v2/polaris_v2_pages_code.md`
  - `docs/structural/v2.md`
- 当前代码结构：
  - `apps/core`
  - `apps/console`
  - `apps/extension`
  - `packages/shared-types`
  - `packages/shared-contracts`
  - `packages/mcp-contracts`
- Console 工程规范：
  - `docs/architecture/console_modern_react_refactor.md`
  - `apps/console/ARCHITECTURE.md`
  - `apps/console/STATE_GUIDELINES.md`

## 2. 当前项目现状判断

当前 Polaris 已经具备稳定的 V1.5 能力底座：

- Core 已具备请求捕获、保存请求、Mock、代理规则、MCP、多入口 API。
- Console 已完成现代 React 分层改造，具备 `pages / domains / stores / services / lib` 的基础结构。
- Extension 已具备服务状态、代理模式切换、当前站点规则写入。
- MCP 已不只是最小能力暴露，而是已经具备 pack 化工具组织能力。

这意味着 V2 不应该从“补页面”开始，而应该从“补对象模型和状态边界”开始。

## 3. V2 的真实目标

V2 的真实目标不是单纯新增更多页面，而是把 Polaris 从“单条请求工具”升级成“项目级接口资产工作台”。

V2 需要建立的闭环只有 5 个：

1. 项目可以承接请求、Mock 和代理规则。
2. 同一条请求可以在不同环境中复用。
3. 多条请求可以组织成集合并顺序运行。
4. 运行结果可以被轻量查看和复查。
5. MCP 可以围绕项目上下文工作，而不只是围绕单条请求工作。

## 4. V2 的工程边界

### 4.1 必须遵守的 Console 约束

所有 V2 Console 开发必须遵守现有架构约束：

- `pages/*` 只负责页面编排，不直接写 API 组合逻辑。
- `domains/*` 负责 query、mutation、adapter、query key、失效策略。
- `stores/*` 只保存 UI / session 状态，不保存服务端真数据。
- 持久化只作为恢复来源，不作为运行期真源。
- mutation 完成后通过 query invalidation 驱动刷新，不允许页面层同时手写多份真源同步。

### 4.2 必须遵守的 Core 约束

- 新对象必须先进入 `shared-types` 和 `shared-contracts`。
- Core 仍以本地单机运行和单用户使用为前提。
- 当前存储仍以本地 JSON 文件为主，不引入数据库作为 V2 前置依赖。
- 不改变当前 `RequestService / MockService / ProxyService / MCP Server` 的主分层，只在其旁新增服务模块。

### 4.3 必须守住的产品边界

V2 不做：

- 内置 AI 助手
- 对话式工作区
- 断言 DSL
- 前后置脚本系统
- 并发编排器
- 团队协作编辑
- 分享能力
- 版本对比
- 问题现场
- 第三方插件市场

## 5. V2 实施策略

V2 不按“一次性版本”落地，而按 3 个交付包落地：

1. `V2.0 项目化底座`
2. `V2.1 环境与集合`
3. `V2.2 项目级 MCP 与插件增强`

原因：

- 当前代码里还没有 `Project / Environment / RequestCollection / CollectionRun` 基础对象。
- 当前 API、存储、路由、插件上下文都没有项目概念。
- 如果一次性推进全部 V2 页面，会让当前 Console 分层重新失控。

## 6. 核心对象模型

### 6.1 Project

```ts
interface Project {
  id: string;
  name: string;
  description: string;
  tags: string[];
  createdAt: string;
  updatedAt: string;
  lastUsedAt: string;
}
```

约束：

- `name` 必填。
- `description` 可为空。
- V2 不做归档态、不做删除回收站。
- `lastUsedAt` 用于首页最近项目、插件最近项目、默认项目推荐。

### 6.2 Active Project 与 Default Project

V2 必须明确区分两个概念：

- `activeProjectId`
  - 当前系统上下文中正在工作的项目
  - 用于项目详情、插件“当前项目”、项目级规则生效范围
- `defaultProjectId`
  - 用户保存请求、创建 Mock 时的默认归属项目
  - 用于减少重复选择成本

建议存放位置：

- Core settings 中增加：
  - `activeProjectId?: string | null`
  - `defaultProjectId?: string | null`
  - `recentProjectIds?: string[]`
  - `defaultEnvironmentIdByProjectId?: Record<string, string | null>`

### 6.3 Environment

```ts
interface Environment {
  id: string;
  projectId: string;
  name: string;
  variables: Record<string, string>;
  createdAt: string;
  updatedAt: string;
}
```

约束：

- 环境一定归属于项目。
- 是否默认环境不写在 `Environment` 对象里，而写在 `settings.defaultEnvironmentIdByProjectId` 中，避免多默认冲突。
- V2 只支持字符串键值。

### 6.4 SavedRequest

在现有 `SavedRequest` 基础上新增：

```ts
type SavedRequestV2 = SavedRequest & {
  projectId: string;
  collectionIds: string[];
};
```

说明：

- V2.0 先增加 `projectId`。
- `collectionIds` 可在 V2.1 引入。
- 不在 `SavedRequest` 上直接存默认环境快照，环境始终在执行时解析。

### 6.5 MockRule

在现有 `MockRule` 基础上新增：

```ts
type MockRuleV2 = MockRule & {
  projectId: string;
  scenarioName?: string | null;
};
```

说明：

- 当前基于规则名推导 group 的逻辑可以保留。
- `scenarioName` 是对当前分组能力的补充，不是替代。
- V2 不做脚本化 Mock。

### 6.6 ProxyRule

在现有 `ProxyRule` 基础上新增：

```ts
type ProxyRuleV2 = ProxyRule & {
  projectId: string;
  priority: number;
};
```

说明：

- `priority` 在 V2.0 预留，默认统一为 `100`。
- V2.0 不做复杂优先级编辑器，只做排序字段预留。

### 6.7 RequestCollection

```ts
interface RequestCollection {
  id: string;
  projectId: string;
  name: string;
  description: string;
  requestIds: string[];
  createdAt: string;
  updatedAt: string;
}
```

约束：

- 集合只能引用同一项目下的请求。
- V2 先用 `requestIds` 维护顺序，不引入独立 collection item 模型。

### 6.8 CollectionRun

```ts
type CollectionRunStatus = "idle" | "running" | "success" | "partial_failed" | "failed";

interface CollectionRunItem {
  requestId: string;
  savedRequestName: string;
  status: "success" | "failed";
  statusCode?: number;
  duration?: number;
  errorMessage?: string;
  requestRecordId?: string;
}

interface CollectionRun {
  id: string;
  projectId: string;
  collectionId: string;
  status: CollectionRunStatus;
  items: CollectionRunItem[];
  startedAt: string;
  finishedAt?: string;
}
```

约束：

- V2 只做顺序执行。
- 执行结果保留摘要，不做复杂断言树。

## 7. 环境变量语法与解析规则

这是 V2 必须先钉死的规则。

### 7.1 语法

V2 统一使用：

```text
{{variableName}}
```

适用位置：

- URL
- Header value
- Query value
- Body 中的字符串值

### 7.2 V2 不支持

- 嵌套表达式
- 函数调用
- 动态脚本
- 变量间链式引用
- 非字符串占位符语法

### 7.3 解析顺序

执行请求或运行集合时：

1. 读取 `activeProjectId` 对应项目
2. 通过 `settings.defaultEnvironmentIdByProjectId[activeProjectId]` 解析该项目默认环境
3. 对 `url / headers / query / body` 做字符串替换
4. 若存在未解析变量，返回友好错误，不静默吞掉

### 7.4 错误策略

新增明确错误：

- `PROJECT_NOT_FOUND`
- `DEFAULT_ENVIRONMENT_NOT_SET`
- `ENVIRONMENT_VARIABLE_MISSING`
- `COLLECTION_PROJECT_MISMATCH`

## 8. 项目级代理规则生效规则

这是当前 V2 文档里最需要补清楚的部分。

### 8.1 规则归属

- 每条规则必须归属一个项目。
- 旧 V1 规则在迁移后统一归属到默认项目。

### 8.2 生效范围

在 `proxyMode === "rules"` 时：

- 只让 `activeProjectId` 对应项目下的已启用规则参与匹配。

在 `proxyMode === "global"` 时：

- 继续走全局代理，不看项目规则。

在 `proxyMode === "direct"` 或 `system` 时：

- 不执行项目规则匹配。

### 8.3 PAC 生成规则

PAC 只生成 `activeProjectId` 对应项目下的启用规则。

这样可以保证：

- 用户理解成本低
- 插件“当前项目规则”语义清楚
- 不会出现多个项目规则同时污染浏览器流量的情况

## 9. 存储升级与迁移策略

当前存储适配器只有：

- `settings`
- `savedRequests`
- `mockRules`
- `proxyRules`

V2 必须升级为：

```ts
interface StorageSnapshotV2 {
  schemaVersion: 2;
  settings: AppSettingV2;
  projects: Project[];
  environments: Environment[];
  savedRequests: SavedRequestV2[];
  mockRules: MockRuleV2[];
  proxyRules: ProxyRuleV2[];
  requestCollections: RequestCollection[];
  collectionRuns: CollectionRun[];
}
```

### 9.1 首次迁移流程

当发现旧文件无 `schemaVersion` 时：

1. 备份原始文件为 `polaris-v1.backup-<timestamp>.json`
2. 创建一个默认项目：
   - 名称：`默认项目`
   - 描述：`从 V1 自动迁移生成`
3. 将现有 `savedRequests / mockRules / proxyRules` 全部绑定到该默认项目
4. settings 写入：
   - `activeProjectId = 默认项目.id`
   - `defaultProjectId = 默认项目.id`
   - `recentProjectIds = [默认项目.id]`
   - `defaultEnvironmentIdByProjectId = {}`
5. 初始化：
   - `environments = []`
   - `requestCollections = []`
   - `collectionRuns = []`
6. 写入 `schemaVersion = 2`

### 9.2 迁移失败策略

- 若迁移写入失败，保留原始文件不覆盖。
- Core 启动时返回明确错误，引导用户恢复备份。
- 不做静默部分迁移。

## 10. Core 实施方案

### 10.1 新增模块

建议在 `apps/core/src/modules` 下新增：

- `projects/`
- `environments/`
- `collections/`
- `runs/`

### 10.2 API 路由新增

建议新增：

- `GET /projects`
- `POST /projects`
- `GET /projects/:id`
- `PUT /projects/:id`
- `DELETE /projects/:id`
- `GET /projects/active`
- `POST /projects/active`
- `POST /projects/default`
- `GET /environments`
- `POST /environments`
- `PUT /environments/:id`
- `DELETE /environments/:id`
- `GET /environments/default`
- `POST /environments/default`
- `GET /collections`
- `POST /collections`
- `GET /collections/:id`
- `PUT /collections/:id`
- `DELETE /collections/:id`
- `POST /collections/:id/run`
- `GET /runs`
- `GET /runs/:id`

### 10.3 现有接口升级

现有接口增量升级，不重命名：

- `POST /requests/:id/save`
  - 支持 `projectId`
- `POST /saved-requests`
  - 支持 `projectId`
- `GET /saved-requests`
  - 支持 `projectId`
- `GET /mock-rules`
  - 支持 `projectId`
- `POST /mock-rules`
  - 支持 `projectId`
- `GET /proxy-rules`
  - 支持 `projectId`
- `POST /proxy-rules/site`
  - 支持 `projectId`

### 10.4 集合运行策略

V2.1 先做：

- 串行执行
- 失败继续执行后续请求
- 最终给出 `success / partial_failed / failed`

V2 不做：

- 并发
- 前后置脚本
- 条件跳转

## 11. Console 实施方案

### 11.1 路由调整

建议将当前路由升级为：

- `/`
- `/projects`
- `/projects/:projectId`
- `/traffic`
- `/requests`
- `/mock`
- `/debug`
- `/runs`
- `/settings`

说明：

- `collections` 和 `environments` 不做一级导航。
- `collections` 挂在项目详情或请求资产内部。
- `environments` 挂在项目详情内。

### 11.2 页面职责

#### 首页

增强为：

- 服务状态
- 最近项目
- 最近请求
- 最近运行

#### 项目列表页

新增：

- 列表
- 搜索
- 新建 / 编辑 / 删除

#### 项目详情页

新增：

- 项目头部
- 摘要卡片
- 最近请求
- 最近运行
- 环境摘要
- 规则摘要

#### 请求资产页

恢复成真实的“已保存请求中心”，不再重定向到 `/mock`。

#### Mock 页

继续沿用现有 workspace 形态，但增加项目筛选和项目归属编辑。

#### 运行记录页

新增：

- 列表
- 筛选
- 详情面板

### 11.3 Console 分层落点

建议新增这些 domain：

- `domains/projects`
- `domains/environments`
- `domains/request-assets`
- `domains/collections`
- `domains/runs`

页面仅组合这些 domain hooks，不直接拼 API。

### 11.4 Store 约束

V2 页面中 store 只允许保存：

- 当前选中的项目 id
- 列表筛选条件
- 弹窗 / 抽屉状态
- 当前查看的 run id
- 集合编辑时的临时排序状态

不允许在 store 中保存：

- projects 列表真数据
- requests 资产真数据
- mock 资产真数据
- runs 真数据

## 12. Extension 实施方案

V2.2 才做插件增强，保持插件轻量。

### 12.1 新增能力

- 展示当前 `activeProject`
- 打开最近项目
- 当前站点加入当前项目规则

### 12.2 不做能力

- 项目编辑
- 环境编辑
- Mock 编辑
- 集合编辑

### 12.3 依赖条件

插件增强依赖 Core 先提供：

- `activeProject` 读取接口
- 最近项目读取接口
- 写入项目级规则接口

## 13. MCP 实施方案

V2.2 的 MCP 应以“项目为一级上下文”扩展，但优先复用现有对象能力。

### 13.1 新增工具

- `list_projects`
- `get_project_detail`
- `run_collection`
- `get_project_env`

### 13.2 现有工具升级

以下现有工具增加 `projectId` 过滤能力：

- `list_saved_requests`
- `list_mock_rules`
- `list_proxy_rules`

### 13.3 设计原则

- 不新增重复对象名工具
- 优先对现有工具做上下文化增强
- 项目是一级过滤条件
- 资源返回轻摘要，详情通过 detail tool 获取

## 14. 分期交付

### 14.1 V2.0 项目化底座

交付内容：

- `Project` 模型
- settings 增加 `activeProjectId / defaultProjectId / recentProjectIds`
- settings 增加 `defaultEnvironmentIdByProjectId`
- `SavedRequest / MockRule / ProxyRule` 增加 `projectId`
- 存储迁移
- 项目列表页
- 项目详情页
- 首页最近项目
- 请求保存支持项目归属
- Mock / 规则支持按项目筛选

验收标准：

- 用户能创建项目
- 保存请求可归属项目
- Mock 可归属项目
- 当前活跃项目有明确定义
- 规则模式下只使用当前项目规则

### 14.2 V2.1 环境与集合

交付内容：

- `Environment`
- 默认环境设置
- `{{var}}` 基础变量替换
- `RequestCollection`
- `CollectionRun`
- 运行记录页

验收标准：

- 用户可为项目创建环境
- 请求执行时能进行基础变量替换
- 用户可创建集合并顺序运行
- 运行结果可回看

### 14.3 V2.2 项目级 MCP 与插件增强

交付内容：

- 项目级 MCP tools / resources
- 设置页 MCP 项目级说明
- 插件显示当前项目
- 插件打开最近项目
- 插件写入当前项目规则

验收标准：

- AI 工具可读取项目级上下文
- 插件可以感知并利用当前项目

## 15. 对现有 V2 文档的替代关系

本文档替代以下“过宽但尚未工程化”的 V2 约束：

- 不再把全部 V2 能力视作同一批次开发
- 不再把插件增强放到 V2 前半段
- 不再把项目级规则写成模糊的“可按项目管理”
- 不再把环境变量写成泛化能力
- 不再把 MCP 扩展写成仅新增更多工具名

## 16. 最终结论

Polaris V2 可以开始开发，但必须按下面的顺序推进：

1. 先立项目化对象和迁移底座
2. 再做环境与集合闭环
3. 最后做项目级 MCP 和插件增强

如果不按这个顺序推进，V2 很容易出现三个问题：

- 对象语义不清
- 状态真源混乱
- 页面越做越重，回到整改前的 Console 结构

如果按本文档推进，V2 能保持：

- 有真实用户需求
- 与当前代码风格一致
- 可分阶段交付
- 不破坏当前 Polaris 的轻量定位
