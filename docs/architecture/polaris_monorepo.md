# 《北极星》Monorepo 目录建议 v0.1

## 1. 设计目标

这套目录结构主要服务于北极星当前已经确定的架构：

* **Local Core**：本地服务核心
* **Web Console**：主工作台
* **Browser Extension**：浏览器插件
* **MCP Server**：对外能力暴露层
* **Shared Contract / Schema**：共享对象与协议
* **扩展机制预留**：但不开放第三方安装

所以目录设计原则是：

1. **按运行主体拆分，不按技术类型乱拆**
2. **共享类型和协议单独抽出来**
3. **MCP 不要散落在 Console 或 Extension 里**
4. **未来扩展机制要有明确落点**
5. **V2 / V3 新增能力不需要推翻目录结构**

---

# 2. 推荐目录结构

```text
polaris/
  apps/
    core/
    console/
    extension/

  packages/
    shared-types/
    shared-contracts/
    shared-utils/
    mcp-contracts/
    extension-sdk/

  docs/
    prd/
    architecture/
    prompts/

  scripts/
    dev/
    build/
    release/

  configs/
    eslint/
    typescript/
    build/

  .github/
  package.json
  pnpm-workspace.yaml
  turbo.json
  README.md
```

---

# 3. 顶层目录说明

## 3.1 `apps/`

放“可以独立运行的应用”。

### 为什么这样拆

因为北极星现在天然就是 3 个运行主体：

* 本地服务
* Web 控制台
* 浏览器插件

所以它们应该是平级 app，而不是互相嵌套。

---

## 3.2 `packages/`

放“共享但不可独立运行”的模块。

例如：

* 共享类型
* 共享契约
* MCP 定义
* 工具函数
* 扩展机制预留

---

## 3.3 `docs/`

放文档，不要和代码混在一起。

建议把你现在已经产出的内容都收进这里：

* PRD
* 架构说明
* vibe coding prompt

---

## 3.4 `scripts/`

放工程脚本。

例如：

* 本地启动脚本
* 构建脚本
* 打包脚本
* 版本发布脚本

---

## 3.5 `configs/`

放共享配置。

例如：

* ESLint
* TSConfig
* 构建配置

这样避免每个 app 和 package 里到处复制配置。

---

# 4. apps 层详细建议

---

## 4.1 `apps/core/`

这是 **Local Core**，也是北极星的核心。

### 它负责

* 本地服务启动
* Proxy Engine
* Traffic Recorder
* Saved Request
* Mock Engine
* Proxy Rule
* PAC 生成
* MCP Server
* Storage Adapter
* 扩展宿主

### 推荐内部结构

```text
apps/core/
  src/
    app/
      server.ts
      bootstrap.ts
      config.ts

    modules/
      proxy/
      traffic/
      requests/
      mock/
      rules/
      replay/
      settings/
      mcp/
      extensions/

    storage/
      adapters/
      repositories/

    api/
      routes/
      controllers/
      schemas/

    shared/
      errors/
      logger/
      constants/

  tests/
  package.json
  tsconfig.json
```

### 说明

#### `src/app/`

应用启动和全局配置。

#### `src/modules/`

按业务能力拆，不按“controller/service/utils”一层平铺。
这样更适合 V1/V2/V3 逐步扩展。

例如：

* `proxy/`
* `traffic/`
* `requests/`
* `mock/`
* `mcp/`

#### `src/storage/`

专门放存储适配层，方便未来接 RemoteStorageAdapter。

#### `src/api/`

放给 Web Console 和 Extension 调用的本地 API。

---

## 4.2 `apps/console/`

这是 **Web Console**。

### 它负责

* 首页
* 实时请求页
* 已保存请求页
* Mock 页
* 调试页
* 设置页
* V2/V3 的项目、集合、运行记录、问题现场等页面

### 推荐内部结构

```text
apps/console/
  src/
    app/
      router/
      providers/
      layouts/

    pages/
      home/
      traffic/
      requests/
      mock/
      debug/
      settings/
      projects/
      runs/
      issues/

    features/
      service-status/
      proxy-mode/
      request-detail/
      request-save/
      mock-editor/
      mcp-guide/

    components/
      common/
      cards/
      forms/
      tables/
      empty-states/

    hooks/
    services/
    store/
    styles/

  public/
  tests/
  package.json
  tsconfig.json
```

### 说明

#### `pages/`

按页面拆，适合 vibe coding 直接按页面生成。

#### `features/`

放跨页面复用但偏业务的功能模块。
例如：

* 请求详情
* Mock 编辑器
* 服务状态卡片

#### `components/`

放通用 UI 组件。

#### `services/`

这里是 Console 调 Local Core 的调用封装，不必现在就叫“前端 API 层”，但要有统一位置。

---

## 4.3 `apps/extension/`

这是 **Browser Extension**。

### 它负责

* 服务状态展示
* 代理模式切换
* 当前站点快捷代理
* 打开控制台
* V2/V3 的轻量上下文增强

### 推荐内部结构

```text
apps/extension/
  src/
    popup/
      pages/
      components/
      hooks/

    background/
    content/
    bridge/
    services/
    shared/

  public/
  manifest/
  tests/
  package.json
  tsconfig.json
```

### 说明

#### `popup/`

插件弹窗页面相关代码。

#### `background/`

浏览器插件后台逻辑。

#### `content/`

如果后续需要少量页面上下文能力，这里放内容脚本。

#### `bridge/`

建议专门放与 Local Core 通信的桥接逻辑，不要散在组件里。

#### `services/`

放插件侧的本地服务调用封装。

---

# 5. packages 层详细建议

---

## 5.1 `packages/shared-types/`

放最基础、最稳定的共享类型。

### 推荐内容

* RequestRecord
* SavedRequest
* MockRule
* ProxyRule
* AppSetting
* ServiceStatus
* Project
* Environment
* RequestCollection
* CollectionRun
* AssetVersion
* IssueBundle
* ShareRecord
* ProjectSummary

### 推荐结构

```text
packages/shared-types/
  src/
    domain/
    enums/
    common/
    index.ts
```

### 为什么单独放

这是整个 monorepo 最核心的“语言层”。
Core、Console、Extension、MCP 都要依赖它。

---

## 5.2 `packages/shared-contracts/`

放“模块之间怎么通信”的共享协议定义。

### 推荐内容

* 本地 API 请求 / 响应结构
* 列表查询参数结构
* 错误结构
* 筛选条件结构
* 分页结构（如果后续需要）

### 推荐结构

```text
packages/shared-contracts/
  src/
    api/
    filters/
    errors/
    index.ts
```

### 为什么和 shared-types 分开

因为：

* `shared-types` 更偏业务对象
* `shared-contracts` 更偏交互协议

这样后续不会把对象定义和接口定义搅在一起。

---

## 5.3 `packages/mcp-contracts/`

放 MCP 相关定义。

### 推荐内容

* tool 名称
* resource 名称
* tool 输入输出 schema
* resource metadata
* MCP capability registry

### 推荐结构

```text
packages/mcp-contracts/
  src/
    tools/
    resources/
    registry/
    schemas/
    index.ts
```

### 为什么单独拆

因为 MCP 是北极星的关键能力，不应该散落在 core 各模块里。
单独拆出来可以让：

* Core 实现更清晰
* vibe coding 更容易围绕 MCP 生成代码
* 后续扩展新 tool / resource 更自然

---

## 5.4 `packages/shared-utils/`

放一些通用但非业务核心的工具函数。

例如：

* 时间格式化
* URL 处理
* 请求体展示辅助
* JSON 安全格式化
* 比较 / 合并小工具

### 注意

不要把业务逻辑放进来。
这个包要保持轻。

---

## 5.5 `packages/extension-sdk/`

这个名字虽然叫 SDK，但你当前不是对外开放插件市场。
它更像一个 **内部扩展机制预留包**。

### 推荐内容

* extension descriptor 类型
* hook 类型定义
* extension capability 类型
* UI slot 描述类型
* MCP contribution 类型

### 推荐结构

```text
packages/extension-sdk/
  src/
    descriptors/
    hooks/
    capabilities/
    slots/
    index.ts
```

### 为什么值得现在就有

因为你已经明确：

* V1 就要预留扩展能力
* 但不开放第三方安装

那最合理的做法，就是把“扩展语言”单独抽出来，而不是临时写在 core 某个文件夹里。

---

# 6. docs 层详细建议

---

## 6.1 `docs/prd/`

放产品文档。

建议结构：

```text
docs/prd/
  v1/
  v2/
  v3/
```

每个版本下放：

* 基础 PRD
* 页面线框级 PRD
* 研发任务拆分稿

---

## 6.2 `docs/architecture/`

放架构文档。

建议包括：

* 总体架构说明
* Local Core 说明
* Extension 定位说明
* MCP 设计说明
* 扩展机制说明

---

## 6.3 `docs/prompts/`

专门放给 vibe coding 使用的 prompt。

建议后续你会很需要：

* V1 主提示词
* Core 生成提示词
* Console 生成提示词
* Extension 生成提示词
* MCP 生成提示词

这个目录会非常有用。

---

# 7. scripts 层详细建议

建议这样分：

```text
scripts/
  dev/
  build/
  release/
```

### `dev/`

本地开发启动脚本，比如一键同时启动 core 和 console。

### `build/`

构建脚本，比如打包 extension、构建 console。

### `release/`

发布或版本管理脚本。

---

# 8. configs 层详细建议

如果你是 monorepo，建议共享配置单独抽离：

```text
configs/
  eslint/
  typescript/
  build/
```

这样能避免：

* 每个 app 各写一套 tsconfig
* lint 规则分裂
* 构建配置散落

---

# 9. 对北极星特别重要的几个目录原则

---

## 原则 1：MCP 单独成包，不混在 Console 里

因为 MCP 是产品能力层，不是某个页面能力。

---

## 原则 2：扩展机制单独成包，不临时写在 core 里

因为你已经明确要预留扩展口子。
如果不单独抽，后面一定会和 core 业务逻辑缠住。

---

## 原则 3：Core 的模块按业务能力拆，不按技术层平铺

不要一开始就做成：

```text
services/
controllers/
models/
utils/
```

更建议做成：

```text
modules/
  requests/
  mock/
  proxy/
  mcp/
```

这对产品型项目和 vibe coding 都更稳。

---

## 原则 4：Console 按 page + feature 双层组织

因为你已经有非常清晰的页面结构。
最适合生成代码的方式，就是让页面和业务 feature 都有独立位置。

---

## 原则 5：Extension 和 Console 不共享 UI 组件

最多共享类型和少量 utils。
不要为了“复用”过度耦合，因为插件 UI 和 Web Console 的交互模型差异很大。

---

# 10. 一版更完整的目录示意

```text
polaris/
  apps/
    core/
      src/
        app/
        modules/
          proxy/
          traffic/
          requests/
          mock/
          rules/
          replay/
          settings/
          projects/
          environments/
          collections/
          runs/
          issues/
          versions/
          sharing/
          mcp/
          extensions/
        storage/
        api/
        shared/
      tests/

    console/
      src/
        app/
        pages/
          home/
          traffic/
          requests/
          mock/
          debug/
          settings/
          projects/
          runs/
          issues/
          versions/
        features/
        components/
        hooks/
        services/
        store/
        styles/
      public/
      tests/

    extension/
      src/
        popup/
        background/
        content/
        bridge/
        services/
        shared/
      public/
      manifest/
      tests/

  packages/
    shared-types/
      src/
        domain/
        enums/
        common/

    shared-contracts/
      src/
        api/
        filters/
        errors/

    mcp-contracts/
      src/
        tools/
        resources/
        registry/
        schemas/

    shared-utils/
      src/

    extension-sdk/
      src/
        descriptors/
        hooks/
        capabilities/
        slots/

  docs/
    prd/
      v1/
      v2/
      v3/
    architecture/
    prompts/

  scripts/
    dev/
    build/
    release/

  configs/
    eslint/
    typescript/
    build/

  .github/
  package.json
  pnpm-workspace.yaml
  turbo.json
  README.md
```
