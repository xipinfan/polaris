# Polaris 全量改动执行清单

> 目标：把“全量改动复刻文档”转为可执行、可回归、可勾选的任务清单。
> 使用方式：按模块顺序执行；每完成一项勾选，并在“验证记录”补充命令与结果。

## 0. 基础信息

- [ ] 执行日期：
- [ ] 执行人：
- [ ] 分支名：
- [ ] 对应需求/Issue：

---

## 1. MCP 工具合并重构

### 1.1 合约与注册层

- [ ] 新增 9 个合并工具合约文件（`query_* / mutate_* / test_mock_match / get_workspace_snapshot / setup_https`）
- [ ] 更新 `packages/mcp-contracts/src/registry/index.ts`：
- [ ] 追加 `mcpMergedToolRegistry`（12 工具）
- [ ] 新增 `mcpLegacyPackRegistry`
- [ ] pack 数组拆分为 merged/legacy 两套
- [ ] 新增 `getLegacyMcpToolRegistryByPackId`
- [ ] `getMcpToolRegistryByPackId` 改为基于 merged registry
- [ ] 更新 `packages/mcp-contracts/src/index.ts` 导出（区分旧工具与新合并工具）
- [ ] 旧工具 description 中文化（30 个文件）

### 1.2 业务逻辑抽离

- [ ] 新增 `apps/core/src/modules/mcp/toolHandlers.ts`
- [ ] 定义 `ToolServiceDeps` / 各类 `Query*Args` / `Mutate*Args` / `SetupHttpsArgs`
- [ ] 实现 `syncActiveMockGroupFromRuleName`
- [ ] 实现 `getInstallGuideForPlatform`
- [ ] 实现 `handleQueryRequests`
- [ ] 实现 `handleMutateRequest`
- [ ] 实现 `handleReplayRequest`
- [ ] 实现 `handleRunRequest`
- [ ] 实现 `handleClearRequests`
- [ ] 实现 `handleQueryMock`
- [ ] 实现 `handleMutateMock`
- [ ] 实现 `handleTestMockMatch`
- [ ] 实现 `handleQueryProxy`
- [ ] 实现 `handleMutateProxy`
- [ ] 实现 `handleGetWorkspaceSnapshot`
- [ ] 实现 `handleSetupHttps`
- [ ] 实现 `handleLegacyToolInvocation`

### 1.3 服务接入改造

- [ ] 重构 `apps/core/src/modules/mcp/sdkServer.ts`：
- [ ] 版本号 `0.1.0 -> 0.2.0`
- [ ] instructions 改为中文多段工作流说明
- [ ] 引入 `deps: ToolServiceDeps`
- [ ] 用 discriminatedUnion 重建 inputSchema（query/mutate/request/mock/proxy/setup）
- [ ] 12 个新工具注册替换旧 30 个工具注册
- [ ] 新增 4 个 MCP Prompt（`debug_mock`/`mock_from_request`/`check_proxy_routing`/`setup_https`）
- [ ] 三个 Resource 结果集增加 `.slice(0, 50)`
- [ ] 重构 `apps/core/src/modules/mcp/mcpServer.ts`：
- [ ] 薄路由化，仅调用 `handleLegacyToolInvocation`
- [ ] 使用 legacy pack registry
- [ ] resource 输出加 `.slice(0, 50)`

---

## 2. Payload 与文本策略

- [ ] 更新 `apps/core/src/modules/mcp/payloads.ts`：
- [ ] 新增 `DEFAULT_LIST_LIMIT` / `MAX_FULL_VIEW_CHARS`
- [ ] 新增 `BodySizeClassification` / `BodySizeInfo` / `PaginationMeta`
- [ ] 新增 `classifyBodySize`
- [ ] 新增 `buildPaginatedResult`
- [ ] `truncateText` 改为导出
- [ ] `ToolResultTextMode` 移除 `"full"`
- [ ] `buildTextContent` 移除 full JSON 输出分支
- [ ] `buildRequestSummary` 增加 `responseBodySize`
- [ ] `buildMockRuleSummary` 增加 `responseBodySize`
- [ ] full 视图的 large body 自动降级为 shape
- [ ] 更新 `apps/core/src/modules/mcp/toolResultPolicy.ts`：
- [ ] `resolveDetailTextMode` 仅返回 `"summary" | "preview"`
- [ ] `full/diagnostic/preview/undefined -> preview`
- [ ] `summary/shape -> summary`
- [ ] 更新 `apps/core/src/modules/mcp/payloads.test.ts` 断言（text 不再输出完整 JSON）

---

## 3. Mock 模板扩展

- [ ] 更新 `apps/core/src/modules/mock/mockTemplates.ts`
- [ ] 新增 `json_error`
- [ ] 新增 `json_list`
- [ ] 新增 `json_detail`
- [ ] 新增 `json_post_ok`
- [ ] 新增 `not_found`
- [ ] 新增 `unauthorized`
- [ ] 新增 `empty_ok`

---

## 4. HTTPS 证书与 WebSocket 代理

### 4.1 证书链修复（`certificateManager.ts`）

- [ ] 导入 `readdir` / `unlink`
- [ ] 新增 `NOT_BEFORE_OFFSET_MS` / `CERT_RENEWAL_BUFFER_MS`
- [ ] 新增 `safeUnlink`
- [ ] 新增 `authorityFingerprint`
- [ ] `init` 中调用 `purgeStaleHostCertificates`
- [ ] `loadOrCreateAuthority` 两分支记录 CA 指纹
- [ ] `notBefore` 偏移改为 1 天
- [ ] AKI 修复：`authorityKeyIdentifier.keyIdentifier = issuerKeyIdentifier`
- [ ] 域名证书返回拼接完整链（domain + ca）
- [ ] 缓存证书读取校验 + 失效清理重签
- [ ] 新增 `computeCertFingerprint`
- [ ] 新增 `ensureCertChain`
- [ ] 新增 `isHostCertificateValid`
- [ ] 新增 `purgeStaleHostCertificates`

### 4.2 WS 升级支持（`proxyEngine.ts`）

- [ ] 新增 `isWebSocketUpgrade`
- [ ] `sanitizeProxyHeaders`：WS 请求保留 `connection/keep-alive/upgrade`
- [ ] HTTP server 增加 `upgrade` 监听
- [ ] MITM server 增加 `upgrade` 监听
- [ ] 新增 `handleUpgradeRequest`
- [ ] `tlsClientError` 注释化说明（alert 46 预期）

---

## 5. 其他功能修复

### 5.1 代理规则协议容错（`proxyService.ts`）

- [ ] `normalizePattern` 增加 `.replace(/^https?:\/\//, "")`
- [ ] `upsertSiteRule`：`targetUrl` 自动补全协议
- [ ] `upsertSiteRule`：`rewriteHost` 剥离协议前缀
- [ ] `nextRule` 分支使用规范化后的 `targetUrl` / `rewriteHost`

### 5.2 控制台请求列表溢出（`TrafficRequestPane/index.module.less`）

- [ ] 移除 `.requestHeader, .requestRow` 的 `width: max-content`

---

## 6. 文档更新

- [ ] 更新 `docs/mcp-efficient-usage.md`（旧工具名 -> 新合并工具调用）
- [ ] 更新 `docs/mcp.md`（渐进式查询示例改为 `query_*`）
- [ ] 更新 `docs/skills/polaris-efficient-mcp/SKILL.md`（中文重写版）
- [ ] 非功能文档（可选保留）：
- [ ] `docs/fix-https-certificate-trust.md`
- [ ] `docs/mcp-optimization-remaining.md`

---

## 7. 验证与发布前检查

- [ ] `corepack pnpm typecheck`
- [ ] `corepack pnpm --filter @polaris/core test`
- [ ] `corepack pnpm --filter @polaris/console test`（如本次改动含 console）
- [ ] 手工验证：HTTPS 站点证书链不再报不可信
- [ ] 手工验证：WebSocket 连接可正常握手与转发
- [ ] 手工验证：MCP 新工具可调，旧工具兼容
- [ ] 文档链接与示例命令可用

---

## 8. 证书缓存清理与重启（执行阶段）

- [ ] 清理 `{POLARIS_HOME}/data/certificates/hosts/*.pem`
- [ ] 重启 Polaris
- [ ] 确认无需重建/重装 CA 根证书

---

## 验证记录

- [ ] 记录命令：
- [ ] 记录输出摘要：
- [ ] 记录回归结论：

