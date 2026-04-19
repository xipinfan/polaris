import type {
  WhistleCompatibilityFilter,
  WhistleImportScope,
} from "./utils";
import { useEffect, useMemo, useState } from "react";
import type { WhistleImportCandidate, WhistleImportExecuteResponse } from "@polaris/shared-contracts";
import { Alert, Button, Checkbox, Empty, Input, Modal, Select, Spin, Tag } from "antd";
import { useQueryClient } from "@tanstack/react-query";
import { useProxyForwardGroupsQuery } from "../../../domains/proxy-forward/queries";
import type { StoredGroup } from "../../../domains/proxy-forward/types";
import { activeGroupStorageKey, groupsStorageKey } from "../../../domains/proxy-forward/state";
import { useToast } from "../../feedback/ToastProvider";
import { writePersistence } from "../../../lib/persistence";
import { queryKeys } from "../../../lib/query/queryKeys";
import { apiClient } from "../../../services/apiClient";
import {
  buildDefaultSelectedIds,
  buildExecutePayload,
  buildSelectionSummary,
  filterWhistleCandidates,
  formatExecuteSummary,
  getEffectiveConflictMode,
} from "./utils";
import styles from "./WhistleImportModal.module.less";

type WhistleImportModalProps = {
  defaultScope: WhistleImportScope;
  onClose: () => void;
  open: boolean;
};

function getSkipReasonText(candidate: Extract<WhistleImportCandidate, { candidateType: "unsupported" }>) {
  switch (candidate.skipReason) {
    case "unsupported_plugin_rule":
      return "插件规则暂不支持";
    case "unsupported_script_rule":
      return "脚本规则暂不支持";
    case "unsupported_multi_operator_rule":
      return "多操作链暂不支持";
    case "unsupported_dynamic_value":
      return "动态值无法稳定导入";
    case "unsupported_proxy_granularity":
      return "代理粒度超出当前能力";
    case "invalid_matcher":
      return "匹配器格式无法识别";
    case "missing_target":
      return "缺少目标地址";
    case "unresolved_value_reference":
      return "values 引用未解析";
    default:
      return "当前规则无法映射到 Polaris";
  }
}

function getPlatformLabel(platform: "windows" | "macos" | "linux") {
  if (platform === "windows") {
    return "Windows";
  }
  if (platform === "linux") {
    return "Linux";
  }
  return "macOS";
}

export function WhistleImportModal({ defaultScope, onClose, open }: WhistleImportModalProps) {
  const { showToast } = useToast();
  const queryClient = useQueryClient();
  const proxyGroupsQuery = useProxyForwardGroupsQuery();
  const currentProxyGroups = proxyGroupsQuery.data?.groups ?? [];
  const currentProxyActiveGroupId = proxyGroupsQuery.data?.activeGroupId ?? null;

  const [scanResult, setScanResult] = useState<Awaited<ReturnType<typeof apiClient.scanWhistleImport>> | null>(null);
  const [scanError, setScanError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [selection, setSelection] = useState<Set<string>>(new Set());
  const [scope, setScope] = useState<WhistleImportScope>(defaultScope);
  const [compatibility, setCompatibility] = useState<WhistleCompatibilityFilter>("all");
  const [selectedGroupName, setSelectedGroupName] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [onlyCompatible, setOnlyCompatible] = useState(true);
  const [onlyEnabled, setOnlyEnabled] = useState(false);
  const [result, setResult] = useState<WhistleImportExecuteResponse | null>(null);

  useEffect(() => {
    if (!open) {
      return;
    }
    setScope(defaultScope);
  }, [defaultScope, open]);

  const scan = async () => {
    setLoading(true);
    setScanError(null);
    setResult(null);
    try {
      const nextResult = await apiClient.scanWhistleImport();
      setScanResult(nextResult);
      setSelection(buildDefaultSelectedIds(nextResult.candidates, scope));
      setSelectedGroupName(null);
    } catch (error) {
      const message = error instanceof Error ? error.message : "扫描失败";
      setScanError(message);
      setScanResult(null);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!open) {
      return;
    }
    void scan();
  }, [open]);

  useEffect(() => {
    if (!scanResult) {
      return;
    }
    setSelection(buildDefaultSelectedIds(scanResult.candidates, scope));
  }, [scanResult, scope]);

  const filteredCandidates = useMemo(
    () =>
      filterWhistleCandidates({
        candidates: scanResult?.candidates ?? [],
        compatibility,
        currentProxyGroups,
        onlyCompatible,
        onlyEnabled,
        scope,
        search,
        selectedGroupName,
      }),
    [compatibility, currentProxyGroups, onlyCompatible, onlyEnabled, scope, scanResult, search, selectedGroupName],
  );

  const filteredGroupEntries = useMemo(() => {
    const groupMap = new Map<string, WhistleImportCandidate[]>();
    for (const candidate of filteredCandidates) {
      const current = groupMap.get(candidate.groupName) ?? [];
      current.push(candidate);
      groupMap.set(candidate.groupName, current);
    }
    return [...groupMap.entries()];
  }, [filteredCandidates]);

  const summary = useMemo(
    () =>
      buildSelectionSummary({
        candidates: scanResult?.candidates ?? [],
        currentProxyGroups,
        selectedIds: selection,
      }),
    [currentProxyGroups, scanResult, selection],
  );

  const selectableFilteredIds = filteredCandidates
    .filter((candidate) => candidate.compatible)
    .map((candidate) => candidate.id);

  const handleToggle = (candidate: WhistleImportCandidate, checked: boolean) => {
    if (!candidate.compatible) {
      return;
    }
    setSelection((current) => {
      const next = new Set(current);
      if (checked) {
        next.add(candidate.id);
      } else {
        next.delete(candidate.id);
      }
      return next;
    });
  };

  const handleSelectFiltered = () => {
    setSelection((current) => {
      const next = new Set(current);
      selectableFilteredIds.forEach((id) => next.add(id));
      return next;
    });
  };

  const handleClearSelection = () => {
    setSelection(new Set());
  };

  const handleImport = async () => {
    if (!scanResult) {
      return;
    }
    const payload = buildExecutePayload({
      candidates: scanResult.candidates,
      currentProxyActiveGroupId,
      currentProxyGroups,
      selectedIds: selection,
    });
    if (!payload.mockRules.length && !payload.proxyGroups.length) {
      showToast("请先选择要导入的内容", "info");
      return;
    }

    setSubmitting(true);
    try {
      const executeResult = await apiClient.executeWhistleImport(payload);
      writePersistence(groupsStorageKey, executeResult.nextProxyGroups as StoredGroup[]);
      writePersistence(activeGroupStorageKey, executeResult.nextProxyActiveGroupId);
      setResult(executeResult);
      showToast(formatExecuteSummary(executeResult), "success");
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: queryKeys.mock.rules }),
        queryClient.invalidateQueries({ queryKey: queryKeys.mock.activeGroup }),
        queryClient.invalidateQueries({ queryKey: queryKeys.proxyForward.groups }),
        queryClient.invalidateQueries({ queryKey: queryKeys.proxyForward.rules }),
      ]);
    } catch (error) {
      showToast(error instanceof Error ? error.message : "导入失败", "error");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Modal
      className={styles.modal}
      destroyOnHidden
      footer={null}
      onCancel={onClose}
      open={open}
      title={null}
      width={1120}
    >
      <div className={styles.shell}>
        <div className={styles.topBar}>
          <div className={styles.topBarCopy}>
            <h3>从 Whistle 导入</h3>
            <p>自动扫描本机 Whistle 存储目录，预览并选择要导入的 Mock 与代理规则。</p>
          </div>
          <div className={styles.topActions}>
            <Button className={styles.secondaryButton} disabled={loading || submitting} onClick={() => void scan()}>
              重新扫描
            </Button>
          </div>
        </div>

        {scanResult ? (
          <section className={styles.sourceCard}>
            <div className={styles.sourceMeta}>
              <span className={styles.label}>平台</span>
              <strong>{getPlatformLabel(scanResult.source.platform)}</strong>
            </div>
            <div className={styles.sourceMeta}>
              <span className={styles.label}>目录</span>
              <strong>{scanResult.source.resolvedDir ?? "未发现"}</strong>
            </div>
            <div className={styles.sourceMeta}>
              <span className={styles.label}>状态</span>
              <div className={styles.badges}>
                <Tag className={`${styles.pill} ${scanResult.source.resolvedDir ? styles.pillSuccess : styles.pillMuted}`}>
                  {scanResult.source.resolvedDir ? "扫描成功" : "未发现目录"}
                </Tag>
                <Tag className={`${styles.pill} ${styles.pillBrand}`}>规则 {scanResult.source.ruleFileCount}</Tag>
                <Tag className={`${styles.pill} ${styles.pillProxy}`}>Values {scanResult.source.valueFileCount}</Tag>
                <Tag className={`${styles.pill} ${styles.pillWarn}`}>分组 {scanResult.source.groupCount}</Tag>
              </div>
            </div>
          </section>
        ) : null}

        {scanError ? <Alert className={styles.notice} message={scanError} type="error" showIcon /> : null}
        {scanResult?.source.scanWarnings.map((warning) => (
          <Alert
            className={styles.notice}
            key={`${warning.code}-${warning.detail ?? warning.message}`}
            message={warning.message}
            description={warning.detail}
            type="warning"
            showIcon
          />
        ))}

        <section className={styles.filters}>
          <Select
            className={styles.select}
            onChange={(value) => setScope(value)}
            popupClassName={styles.selectDropdown}
            options={[
              { label: "全部", value: "all" },
              { label: "Mock", value: "mock" },
              { label: "代理转发", value: "proxy" },
            ]}
            value={scope}
          />
          <Select
            allowClear
            className={styles.select}
            onChange={(value) => setSelectedGroupName(value ?? null)}
            popupClassName={styles.selectDropdown}
            options={(scanResult?.groupSummaries ?? []).map((group) => ({ label: group.name, value: group.name }))}
            placeholder="筛选分组"
            value={selectedGroupName ?? undefined}
          />
          <Select
            className={styles.select}
            onChange={(value) => setCompatibility(value)}
            popupClassName={styles.selectDropdown}
            options={[
              { label: "全部状态", value: "all" },
              { label: "仅可导入", value: "compatible" },
              { label: "冲突复制", value: "duplicate" },
              { label: "不兼容", value: "unsupported" },
            ]}
            value={compatibility}
          />
          <Input.Search
            allowClear
            className={styles.search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="搜索文件名、URL、Host、规则摘要"
            value={search}
          />
          <Checkbox className={styles.filterCheckbox} checked={onlyCompatible} onChange={(event) => setOnlyCompatible(event.target.checked)}>
            仅显示可导入项
          </Checkbox>
          <Checkbox className={styles.filterCheckbox} checked={onlyEnabled} onChange={(event) => setOnlyEnabled(event.target.checked)}>
            仅显示启用项
          </Checkbox>
        </section>

        <section className={styles.actionsRow}>
          <Button className={styles.secondaryButton} disabled={!selectableFilteredIds.length} onClick={handleSelectFiltered}>
            全选当前筛选结果
          </Button>
          <Button className={styles.secondaryButton} onClick={handleClearSelection}>清空选择</Button>
        </section>

        <div className={styles.content}>
          <div className={styles.listPane}>
            {loading ? (
              <div className={styles.loadingState}>
                <Spin />
              </div>
            ) : filteredGroupEntries.length ? (
              filteredGroupEntries.map(([groupName, candidates]) => (
                <section className={styles.groupSection} key={groupName}>
                  <div className={styles.groupHeader}>
                    <strong>{groupName}</strong>
                    <span>{candidates.length} 项</span>
                  </div>
                  <div className={styles.groupList}>
                    {candidates.map((candidate) => {
                      const effectiveConflictMode = getEffectiveConflictMode(candidate, currentProxyGroups);
                      return (
                        <label className={styles.candidateCard} key={candidate.id}>
                          <Checkbox
                            className={styles.cardCheckbox}
                            checked={selection.has(candidate.id)}
                            disabled={!candidate.compatible}
                            onChange={(event) => handleToggle(candidate, event.target.checked)}
                          />
                          <div className={styles.candidateBody}>
                            <div className={styles.candidateTitleRow}>
                              <strong>{candidate.title}</strong>
                              <div className={styles.badges}>
                                <Tag
                                  className={`${styles.pill} ${
                                    candidate.candidateType === "mock"
                                      ? styles.pillBrand
                                      : candidate.candidateType === "proxy"
                                        ? styles.pillProxy
                                        : styles.pillMuted
                                  }`}
                                >
                                  {candidate.candidateType === "mock" ? "Mock" : candidate.candidateType === "proxy" ? "代理" : "跳过"}
                                </Tag>
                                <Tag className={`${styles.pill} ${candidate.enabled ? styles.pillSuccess : styles.pillMuted}`}>
                                  {candidate.enabled ? "启用中" : "未启用"}
                                </Tag>
                                {effectiveConflictMode === "duplicate" ? (
                                  <Tag className={`${styles.pill} ${styles.pillWarn}`}>冲突复制</Tag>
                                ) : null}
                              </div>
                            </div>
                            <div className={styles.summary}>{candidate.sourceSummary}</div>
                            <div className={styles.preview}>{candidate.targetPreview || candidate.matcher}</div>
                            {!candidate.compatible && candidate.candidateType === "unsupported" ? (
                              <div className={styles.skipReason}>{getSkipReasonText(candidate)}</div>
                            ) : null}
                          </div>
                        </label>
                      );
                    })}
                  </div>
                </section>
              ))
            ) : (
              <div className={styles.emptyState}>
                <Empty description="当前筛选条件下没有候选项" />
              </div>
            )}
          </div>

          <aside className={styles.summaryPane}>
            <div className={styles.summaryCard}>
              <h4>导入摘要</h4>
              <div className={styles.metric}><span>已选 Mock</span><strong>{summary.selectedMockCount}</strong></div>
              <div className={styles.metric}><span>已选代理</span><strong>{summary.selectedProxyCount}</strong></div>
              <div className={styles.metric}><span>涉及分组</span><strong>{summary.selectedGroupCount}</strong></div>
              <div className={styles.metric}><span>冲突复制</span><strong>{summary.duplicatedCount}</strong></div>
            </div>

            {result ? (
              <article className={`${styles.strategyCard} ${styles.strategyCardSuccess}`}>
                <h4>导入完成</h4>
                <p>{formatExecuteSummary(result)}</p>
              </article>
            ) : (
              <article className={`${styles.strategyCard} ${styles.strategyCardInfo}`}>
                <h4>导入策略</h4>
                <p>不兼容项会保持未勾选，并在列表中展示跳过原因。已有 Polaris 规则默认采用保留并复制策略。</p>
              </article>
            )}
          </aside>
        </div>

        <div className={styles.footer}>
          <Button className={styles.secondaryButton} onClick={onClose}>{result ? "关闭" : "取消"}</Button>
          <Button
            className={styles.primaryButton}
            disabled={submitting || loading || result !== null}
            loading={submitting}
            onClick={() => void handleImport()}
          >
            开始导入
          </Button>
        </div>
      </div>
    </Modal>
  );
}
