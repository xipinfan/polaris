# State Guidelines

## Zustand Scope（Allowed）

- 抽屉/弹窗开关
- 当前选中项
- 筛选与视图偏好
- 会话期 UI 上下文

## Zustand Scope（Forbidden）

- 服务端实体真数据（`requests`、`rules`、`settings` 全量载荷）

## Persistence Policy

- 仅持久化白名单 UI 偏好
- 持久化 store 需包含 `version` + `migrate`
- 会话态尽量不持久化

## Selector Rules

- 使用窄选择器读取 store
- 避免对象整块订阅
- 优先小 slice，避免超大嵌套对象

## Query + Store Collaboration

- Query 负责服务端数据真源
- Store 负责视图模式与交互上下文
- Mutation 负责写服务端，成功后通过 query key 失效同步

