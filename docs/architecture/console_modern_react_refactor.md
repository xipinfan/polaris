# Polaris Console 现代 React 工程化整改建议

本文档基于通用的 React / TypeScript / TanStack Query / Zustand 工程化实践整理，目标不是追求“教条式最优”，而是为当前 `apps/console` 提供一套可落地、可分阶段推进的整改方案。

## 1. 外部规范依据

以下资料是本次建议的主要参考来源：

- React 官方：
  - [Rules of Hooks](https://react.dev/reference/rules/rules-of-hooks)
  - [Reusing Logic with Custom Hooks](https://react.dev/learn/reusing-logic-with-custom-hooks)
  - [useEffect](https://react.dev/reference/react/useEffect)
  - [eslint-plugin-react-hooks / exhaustive-deps](https://react.dev/reference/eslint-plugin-react-hooks/lints/exhaustive-deps)
  - [React calls Components and Hooks](https://react.dev/reference/rules/react-calls-components-and-hooks)
- TypeScript ESLint 官方：
  - [Typed Linting](https://typescript-eslint.io/getting-started/typed-linting)
- TanStack Query 官方：
  - [Important Defaults](https://tanstack.com/query/v4/docs/react/guides/important-defaults)
  - [TanStack Query Docs](https://tanstack.com/query/latest/docs/react/)
- Zustand 官方：
  - [Introduction](https://zustand.docs.pmnd.rs/getting-started/introduction)
  - [Prevent rerenders with useShallow](https://zustand.docs.pmnd.rs/guides/prevent-rerenders-with-use-shallow)
  - [persist middleware](https://zustand.docs.pmnd.rs/reference/middlewares/persist)
  - [How to reset state](https://zustand.docs.pmnd.rs/learn/guides/how-to-reset-state)
- 社区工程化参考：
  - [Airbnb JavaScript Style Guide](https://github.com/airbnb/javascript)
  - [Bulletproof React](https://github.com/alan2207/bulletproof-react)
  - [Ant Design Pro lint 文档](https://beta-pro.ant.design/docs/lint-cn/)

## 2. 这些规范的共同结论

把这些资料放在一起看，结论其实比较一致：

1. 页面组件应该偏“编排层”，不要自己承担大段业务状态同步、缓存写入、持久化和导入导出逻辑。
2. 自定义 Hook 应该聚焦一类问题，不要演变成“页面总控制器”。
3. `useEffect` 主要用于和外部系统同步，不应该成为普通业务流程的主承载体。
4. 服务端状态和客户端 UI 状态要分清边界：
   - 服务端状态优先交给 TanStack Query
   - 本地 UI 状态优先交给 React state / Zustand
5. 状态源要尽量单一，避免同一份数据同时写 Query Cache、Zustand、localStorage 三处。
6. 工程护栏必须前置：
   - ESLint 不能是摆设
   - 要启用 hooks 规则
   - TypeScript lint 最好使用 type-aware 规则
7. 组件和 store 的订阅要有选择器，避免整块订阅导致无意义重渲染。
8. 大型前端项目更适合按 feature / domain 组织，而不是把所有逻辑长期堆在 page 里。

## 3. 当前 Polaris Console 的主要偏差

以下判断基于当前仓库代码，不是泛泛而谈。

### 3.1 工程护栏不足

当前 `apps/console` 的 ESLint 配置非常薄弱：

- [`apps/console/eslint.config.js`](/E:/code/polaris/apps/console/eslint.config.js)

目前通用规则基本为空，只保留了一条页面层禁止直接依赖 `services/*` 的导入限制。  
这意味着：

- Hooks 依赖问题不会被系统发现
- 无用变量、隐式问题、复杂度膨胀、循环依赖等不会被持续约束
- 代码风格主要靠人为自觉，不适合后续多人协作

这已经在实际 lint 中体现出来了：当前只会报出 1 条页面越界导入，而不是系统性发现问题。

### 3.2 页面文件过大，职责过重

以下文件已经明显超过“页面编排层”应有复杂度：

- [`apps/console/src/pages/proxy-forward/ProxyForwardPage.tsx`](/E:/code/polaris/apps/console/src/pages/proxy-forward/ProxyForwardPage.tsx)
- [`apps/console/src/pages/mock/hooks/useMockWorkspace.ts`](/E:/code/polaris/apps/console/src/pages/mock/hooks/useMockWorkspace.ts)
- [`apps/console/src/pages/mock/components/MockRulesWorkspace/index.tsx`](/E:/code/polaris/apps/console/src/pages/mock/components/MockRulesWorkspace/index.tsx)

这些文件同时承担了：

- 远程数据查询
- 本地 UI 状态控制
- Query Cache 写入
- localStorage 持久化
- 批量导入导出
- 表单构造
- 乐观更新和失败回滚
- Toast 文案
- 弹窗控制

这会带来三个直接问题：

1. 难测
2. 难拆
3. 改一处容易影响整页

### 3.3 同一份数据有多个真源

以代理转发页面为例：

- [`apps/console/src/pages/proxy-forward/ProxyForwardPage.tsx`](/E:/code/polaris/apps/console/src/pages/proxy-forward/ProxyForwardPage.tsx)

其中 `commitGroups` 会同时写：

- React Query cache
- local persistence
- workspace store

这类模式短期很灵活，但长期会出现“谁才是真源”不清晰的问题。  
一旦 mutation、回滚、重载顺序不同步，就容易出现：

- 页面显示和服务端不一致
- store 和缓存不一致
- 持久化恢复后状态错乱

### 3.4 浏览器环境访问过于分散

当前直接访问浏览器 API 的代码分散在多个页面和组件里，例如：

- [`apps/console/src/app/router.tsx`](/E:/code/polaris/apps/console/src/app/router.tsx)
- [`apps/console/src/pages/settings/SettingsPage.tsx`](/E:/code/polaris/apps/console/src/pages/settings/SettingsPage.tsx)
- [`apps/console/src/pages/mock/hooks/useMockWorkspace.ts`](/E:/code/polaris/apps/console/src/pages/mock/hooks/useMockWorkspace.ts)

包括：

- `window.localStorage`
- `window.location`
- `window.history`
- `document.body`
- `document.addEventListener`

这类代码不是不能写，但现代工程更推荐封装到：

- `lib/persistence/*`
- `services/*`
- 专用 hooks

这样才能：

- 统一处理边界情况
- 更容易测试
- 降低页面层复杂度

### 3.5 Zustand 使用方式还可以继续现代化

当前项目已经在用 selector，这是好的。  
但仍有继续提升空间：

- 多次独立 `useUiStore(...)` / `useWorkspaceStore(...)` 订阅比较多
- 某些页面订阅粒度仍然偏散
- 还没有引入 `useShallow` 这类官方推荐的浅比较模式

重点关注：

- [`apps/console/src/pages/traffic/hooks/useTrafficWorkspace.ts`](/E:/code/polaris/apps/console/src/pages/traffic/hooks/useTrafficWorkspace.ts)
- [`apps/console/src/pages/proxy-forward/ProxyForwardPage.tsx`](/E:/code/polaris/apps/console/src/pages/proxy-forward/ProxyForwardPage.tsx)
- [`apps/console/src/pages/mock/hooks/useMockWorkspace.ts`](/E:/code/polaris/apps/console/src/pages/mock/hooks/useMockWorkspace.ts)

### 3.6 Effect 和 Memo 有部分“能跑但不够克制”的用法

例如：

- [`apps/console/src/pages/traffic/hooks/useTrafficWorkspace.ts`](/E:/code/polaris/apps/console/src/pages/traffic/hooks/useTrafficWorkspace.ts)

里面存在一些典型信号：

- 用 `useMemo` 包装常量空数组
- 一个 Hook 里混合筛选、自动选中、滚动、重放、会话管理
- 多个 `useEffect` 同时承担状态修正职责

这类代码未必立即出错，但通常意味着：

- 边界还没拆清楚
- 派生状态过多
- 页面行为正在逐步耦合

## 4. Polaris 应采用的目标工程约定

下面这套约定更适合当前仓库，而不是机械照搬外部模板。

### 4.1 分层建议

`apps/console/src` 建议按以下职责理解：

- `app/`
  - 应用入口、路由、Provider 组合、全局布局
- `pages/`
  - 页面编排层，只负责组合 feature，不承载重业务逻辑
- `domains/`
  - 面向业务域的数据访问、query/mutation、adapter、schema、服务端状态封装
- `features/`
  - 可跨页面复用的业务能力块
- `stores/`
  - 只放 UI 状态、短期会话状态，不放服务端真数据
- `lib/`
  - 基础设施封装，例如 query、持久化、浏览器 API 封装
- `services/`
  - 更底层的运行时服务，例如 core 发现、API client、错误标准化

### 4.2 单一真源约定

建议明确：

- 服务端数据：以 TanStack Query 为主
- UI 展开态、筛选项、弹窗态：以 Zustand / React state 为主
- 持久化：只作为恢复来源，不作为运行期真源

不再推荐页面里手动同时同步三份状态。

### 4.3 页面复杂度约定

建议新增团队约束：

- 页面文件控制在 200 到 300 行以内
- 单个自定义 Hook 尽量控制在 200 到 300 行以内
- 超过 400 行的文件默认进入拆分清单

这不是绝对标准，但对当前项目很有必要。

### 4.4 Hook 设计约定

建议遵循：

- Hook 只处理一类问题
- 不写“万能 workspace hook”
- 纯派生逻辑优先普通函数
- 需要复用并依赖 React 状态时再抽成 Hook
- `useEffect` 只做外部同步，不做普通业务计算

### 4.5 Zustand 使用约定

建议：

- 默认通过 selector 读取 store
- 组合选择多个字段时优先 `useShallow`
- store 中的 action 和 state 尽量同地定义
- UI store 和业务数据 store 分离
- 能用 React Query 表达的数据不要再重复塞进 Zustand

### 4.6 React Query 使用约定

建议：

- 所有服务端数据都通过 query key 管理
- 页面层不要手写大量 `setQueryData`
- 优先通过 mutation 成功后的失效 / 更新策略维持一致性
- 先梳理哪些数据是真正需要乐观更新，避免“先全写本地再回滚”

## 5. 建议的整改顺序

不要一次性大重构，建议分 4 个阶段推进。

### 第一阶段：先立规矩

目标：先让代码库具备“能持续变好”的基础。

建议修改：

1. 升级 `apps/console/eslint.config.js`
2. 启用：
   - React hooks 规则
   - TypeScript typed lint
   - import 边界规则
   - `max-lines`
   - `max-lines-per-function`
   - `complexity`
   - `no-restricted-imports`
3. 增加统一脚本：
   - `lint`
   - `lint:fix`
4. 在根目录 CI 中加入 console lint 校验

完成标准：

- 新增代码必须过 lint
- 不允许继续新增超大页面文件

### 第二阶段：先拆最重的 2 个热点

优先目标：

1. [`apps/console/src/pages/proxy-forward/ProxyForwardPage.tsx`](/E:/code/polaris/apps/console/src/pages/proxy-forward/ProxyForwardPage.tsx)
2. [`apps/console/src/pages/mock/hooks/useMockWorkspace.ts`](/E:/code/polaris/apps/console/src/pages/mock/hooks/useMockWorkspace.ts)

建议拆法：

- `queries / mutations` 留在 `domains`
- 导入导出逻辑提到 `features/*` 或 `domains/*/importExport.ts`
- 持久化写入提到单独 coordinator / repository
- 页面里只保留：
  - 取数据
  - 调 action
  - 传 props

完成标准：

- 页面和 Hook 体积明显下降
- 导入导出、回滚、持久化不再堆在页面主文件

### 第三阶段：统一状态源

重点处理：

- 代理转发分组
- mock 分组和描述
- traffic 页面的一些会话型状态

整改方向：

- 明确 query 是真源还是 store 是真源
- 清理“手动同步三份数据”的逻辑
- 用更稳定的 mutation 成功后同步策略代替页面级回滚拼装

完成标准：

- 每类核心数据都能说清唯一真源
- 页面中 `setQueryData + local persistence + store` 三连写明显减少

### 第四阶段：性能和可维护性收尾

重点处理：

- store selector 优化
- `useShallow`
- 无意义 `useMemo`
- 浏览器 API 封装下沉
- 文档化约定

完成标准：

- 页面层直接操作 `window` / `document` 的代码显著减少
- store 订阅更稳定
- 文档中明确项目约定

## 6. 建议新增或修改的具体文件

建议优先修改这些位置：

- [`apps/console/eslint.config.js`](/E:/code/polaris/apps/console/eslint.config.js)
  - 升级 lint 规则
- [`apps/console/src/pages/proxy-forward/ProxyForwardPage.tsx`](/E:/code/polaris/apps/console/src/pages/proxy-forward/ProxyForwardPage.tsx)
  - 拆分页面逻辑
- [`apps/console/src/pages/mock/hooks/useMockWorkspace.ts`](/E:/code/polaris/apps/console/src/pages/mock/hooks/useMockWorkspace.ts)
  - 拆分为多个专用 hook / service
- [`apps/console/src/pages/traffic/hooks/useTrafficWorkspace.ts`](/E:/code/polaris/apps/console/src/pages/traffic/hooks/useTrafficWorkspace.ts)
  - 继续压缩职责
- [`apps/console/src/app/router.tsx`](/E:/code/polaris/apps/console/src/app/router.tsx)
  - 将 sidebar 持久化抽到 `lib/persistence` 或单独 hook
- [`apps/console/src/pages/settings/SettingsPage.tsx`](/E:/code/polaris/apps/console/src/pages/settings/SettingsPage.tsx)
  - 运行时环境读取下沉
- [`apps/console/src/stores/*.ts`](/E:/code/polaris/apps/console/src/stores)
  - 增加 selector 规范与 reset 规范
- [`docs/development.md`](/E:/code/polaris/docs/development.md)
  - 后续可补充团队工程约定

## 7. 本项目不建议盲目照搬的部分

虽然参考了社区方案，但以下内容不建议直接照抄：

- 不要为了“像 Bulletproof React”而再引入一层过重目录
- 不要为了追求纯架构，把所有小逻辑都拆成文件碎片
- 不要把 Zustand、React Query、localStorage 都继续保留为并列真源
- 不要过度添加 `useMemo` / `useCallback`

适合 Polaris 的方向是：

- 结构清晰
- 状态单一
- 页面变薄
- lint 变强
- 文档可执行

## 8. 建议的下一步执行顺序

如果按收益和风险排序，建议你下一步这样做：

1. 先升级 `apps/console/eslint.config.js`
2. 再拆 `ProxyForwardPage.tsx`
3. 再拆 `useMockWorkspace.ts`
4. 然后统一 proxy-forward / mock 的状态真源
5. 最后处理 traffic / settings 的细节优化

## 9. 一句话结论

当前 Polaris Console 最大的问题不是“代码风格不现代”，而是：

- 工程护栏太弱
- 页面和 Hook 承担了过多职责
- 多状态源并存

所以整改重点应该是：

先立规则，再拆热点，再统一状态源。
