import { useEffect, useMemo, useState } from "react";
import { useLocation } from "react-router-dom";
import type { MockRule, RequestRecord } from "@polaris/shared-types";
import { useToast } from "../../features/feedback/ToastProvider";
import { useConsoleI18n } from "../../i18n/I18nProvider";
import { apiClient } from "../../services/apiClient";

const groupNamePattern = /^\[(.+?)\]\s*(.+)$/;
const groupsStorageKey = "polaris.console.mock.groups";
const groupMetaStorageKey = "polaris.console.mock.group-meta";

type MockPageLocationState = {
  seedRequest?: RequestRecord;
};

type GroupMetaMap = Record<string, { description?: string }>;
type RuleUrlBlock = {
  key: string;
  host: string;
  label: string;
  rules: MockRule[];
};

type MockFormState = {
  group: string;
  variant: string;
  method: string;
  url: string;
  responseStatus: number;
  responseHeaders: string;
  responseBody: string;
  enabled: boolean;
  allowProxy: boolean;
  delayMs: number;
  priority: number;
};

function readStorage<T>(key: string, fallback: T) {
  if (typeof window === "undefined") {
    return fallback;
  }

  const raw = window.localStorage.getItem(key);
  if (!raw) {
    return fallback;
  }

  try {
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

function writeStorage<T>(key: string, value: T) {
  if (typeof window === "undefined") {
    return;
  }
  window.localStorage.setItem(key, JSON.stringify(value));
}

function getRuleScene(rule: MockRule, defaultGroup: string) {
  const match = rule.name.match(groupNamePattern);
  if (!match) {
    return { group: defaultGroup, variant: rule.name };
  }

  return {
    group: match[1].trim() || defaultGroup,
    variant: match[2].trim() || rule.name,
  };
}

function buildRuleName(group: string, variant: string) {
  return `[${group.trim()}] ${variant.trim()}`;
}

function buildUniqueGroupName(baseName: string, existing: string[]) {
  if (!existing.includes(baseName)) {
    return baseName;
  }

  let index = 2;
  let nextName = `${baseName} ${index}`;
  while (existing.includes(nextName)) {
    index += 1;
    nextName = `${baseName} ${index}`;
  }
  return nextName;
}

function buildEmptyForm(group: string): MockFormState {
  return {
    group,
    variant: "",
    method: "GET",
    url: "",
    responseStatus: 200,
    responseHeaders: "{}",
    responseBody: "{}",
    enabled: true,
    allowProxy: false,
    delayMs: 0,
    priority: 100,
  };
}

function buildFormFromRule(
  rule: MockRule,
  group: string,
  defaultGroup: string,
): MockFormState {
  const scene = getRuleScene(rule, defaultGroup);
  return {
    group,
    variant: scene.variant,
    method: rule.method,
    url: rule.url,
    responseStatus: rule.responseStatus,
    responseHeaders: JSON.stringify(rule.responseHeaders ?? {}, null, 2),
    responseBody: JSON.stringify(rule.responseBody ?? {}, null, 2),
    enabled: rule.enabled,
    allowProxy: false,
    delayMs: 0,
    priority: 100,
  };
}

function getQueryCount(url: string) {
  try {
    return Array.from(new URL(url).searchParams.keys()).length;
  } catch {
    return 0;
  }
}

function getMethodWeight(method: string) {
  const order = ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS", "HEAD"];
  const index = order.indexOf(method.toUpperCase());
  return index === -1 ? order.length : index;
}

function getUrlSummary(url: string) {
  try {
    const parsed = new URL(url);
    return {
      blockKey: `${parsed.origin}${parsed.pathname}`,
      host: parsed.host,
      label: parsed.pathname || "/",
      full: url,
    };
  } catch {
    const [pathOnly] = url.split("?");
    return {
      blockKey: pathOnly || url,
      host: "",
      label: pathOnly || url,
      full: url,
    };
  }
}

function getResponseKind(
  rule: MockRule,
  variant: string,
  t: ReturnType<typeof useConsoleI18n>["t"],
) {
  const contentType =
    rule.responseHeaders["content-type"] ??
    rule.responseHeaders["Content-Type"] ??
    "";

  let label = t("mock.ruleResponseFixed");
  if (typeof rule.responseBody === "object" && rule.responseBody !== null) {
    label = t("mock.ruleResponseStaticJson");
  } else if (String(contentType).toLowerCase().includes("json")) {
    label = t("mock.ruleResponseStaticJson");
  } else if (typeof rule.responseBody === "string") {
    label = t("mock.ruleResponseStaticText");
  }

  return { label, summary: `${rule.responseStatus} / ${variant}` };
}

export function MockPage() {
  const { t } = useConsoleI18n();
  const { showToast } = useToast();
  const location = useLocation();
  const locationState = location.state as MockPageLocationState | null;
  const defaultGroup = t("mock.defaultGroup");

  const [rules, setRules] = useState<MockRule[]>([]);
  const [customGroups, setCustomGroups] = useState<string[]>([]);
  const [groupMeta, setGroupMeta] = useState<GroupMetaMap>({});
  const [selectedGroup, setSelectedGroup] = useState("");
  const [groupSearch, setGroupSearch] = useState("");
  const [selectedRuleId, setSelectedRuleId] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [groupMenuName, setGroupMenuName] = useState<string | null>(null);
  const [ruleMenuId, setRuleMenuId] = useState<string | null>(null);
  const [form, setForm] = useState<MockFormState>(buildEmptyForm(defaultGroup));
  const [storageHydrated, setStorageHydrated] = useState(false);

  const load = async () => {
    const [nextRules, activeGroupState] = await Promise.all([
      apiClient.listMockRules(),
      apiClient.getActiveMockGroup(),
    ]);
    setRules(nextRules);
    setSelectedGroup(activeGroupState.group ?? defaultGroup);
  };

  useEffect(() => {
    setCustomGroups(readStorage<string[]>(groupsStorageKey, []));
    setGroupMeta(readStorage<GroupMetaMap>(groupMetaStorageKey, {}));
    setStorageHydrated(true);
    load().catch(console.error);
  }, [defaultGroup]);

  useEffect(() => {
    if (!storageHydrated) {
      return;
    }
    writeStorage(groupsStorageKey, customGroups);
  }, [customGroups, storageHydrated]);

  useEffect(() => {
    if (!storageHydrated) {
      return;
    }
    writeStorage(groupMetaStorageKey, groupMeta);
  }, [groupMeta, storageHydrated]);

  const groupedRules = useMemo(() => {
    return rules.reduce<Record<string, MockRule[]>>((acc, rule) => {
      const { group } = getRuleScene(rule, defaultGroup);
      acc[group] = [...(acc[group] ?? []), rule];
      return acc;
    }, {});
  }, [defaultGroup, rules]);

  const groups = useMemo(() => {
    return Array.from(
      new Set([defaultGroup, ...customGroups, ...Object.keys(groupedRules)]),
    );
  }, [customGroups, defaultGroup, groupedRules]);

  const filteredGroups = useMemo(() => {
    const keyword = groupSearch.trim().toLowerCase();
    if (!keyword) {
      return groups;
    }
    return groups.filter((group) => group.toLowerCase().includes(keyword));
  }, [groupSearch, groups]);

  useEffect(() => {
    if (groups.length === 0) {
      return;
    }
    if (!selectedGroup || !groups.includes(selectedGroup)) {
      setSelectedGroup(groups[0]);
    }
  }, [groups, selectedGroup]);

  const currentGroup = groups.includes(selectedGroup) ? selectedGroup : defaultGroup;
  const currentGroupRules = useMemo(() => {
    return [...(groupedRules[currentGroup] ?? [])].sort((left, right) => {
      const leftUrl = getUrlSummary(left.url);
      const rightUrl = getUrlSummary(right.url);
      const urlDiff = leftUrl.blockKey.localeCompare(rightUrl.blockKey, "zh-CN");
      if (urlDiff !== 0) {
        return urlDiff;
      }
      if (left.enabled !== right.enabled) {
        return left.enabled ? -1 : 1;
      }
      const methodDiff = getMethodWeight(left.method) - getMethodWeight(right.method);
      if (methodDiff !== 0) {
        return methodDiff;
      }
      const leftScene = getRuleScene(left, defaultGroup);
      const rightScene = getRuleScene(right, defaultGroup);
      const variantDiff = leftScene.variant.localeCompare(rightScene.variant, "zh-CN");
      if (variantDiff !== 0) {
        return variantDiff;
      }
      return new Date(right.updatedAt).getTime() - new Date(left.updatedAt).getTime();
    });
  }, [currentGroup, defaultGroup, groupedRules]);

  const currentGroupRuleBlocks = useMemo(() => {
    return currentGroupRules.reduce<RuleUrlBlock[]>((blocks, rule) => {
      const summary = getUrlSummary(rule.url);
      const latestBlock = blocks[blocks.length - 1];
      if (!latestBlock || latestBlock.key !== summary.blockKey) {
        blocks.push({
          key: summary.blockKey,
          host: summary.host,
          label: summary.label,
          rules: [rule],
        });
        return blocks;
      }
      latestBlock.rules.push(rule);
      return blocks;
    }, []);
  }, [currentGroupRules]);

  useEffect(() => {
    if (currentGroupRules.length === 0) {
      setSelectedRuleId(null);
      return;
    }
    if (!selectedRuleId || !currentGroupRules.some((rule) => rule.id === selectedRuleId)) {
      setSelectedRuleId(currentGroupRules[0].id);
    }
  }, [currentGroupRules, selectedRuleId]);

  const selectedRule = currentGroupRules.find((rule) => rule.id === selectedRuleId) ?? null;
  const currentGroupDescription =
    groupMeta[currentGroup]?.description?.trim() || t("mock.groupDescriptionEmpty");
  const isCurrentGroupEnabled = currentGroupRules.some((rule) => rule.enabled);
  const currentGroupEnabledRules = useMemo(
    () => currentGroupRules.filter((rule) => rule.enabled),
    [currentGroupRules],
  );
  const currentGroupEnabledUrls = useMemo(
    () => Array.from(new Set(currentGroupEnabledRules.map((rule) => rule.url))),
    [currentGroupEnabledRules],
  );

  useEffect(() => {
    const seedRequest = locationState?.seedRequest;
    if (!seedRequest) {
      return;
    }

    setEditingId(null);
    setForm({
      ...buildEmptyForm(currentGroup),
      group: currentGroup,
      variant: `${seedRequest.method} ${seedRequest.path}`,
      method: seedRequest.method,
      url: seedRequest.url,
      responseStatus: seedRequest.statusCode,
      responseHeaders: JSON.stringify(seedRequest.responseHeaders, null, 2),
      responseBody: JSON.stringify(seedRequest.responseBody ?? {}, null, 2),
      enabled: true,
    });
    setIsModalOpen(true);
    showToast(t("mock.seeded", { host: seedRequest.host, group: currentGroup }));
    window.history.replaceState(window.history.state, document.title, location.pathname);
  }, [currentGroup, location.pathname, locationState?.seedRequest, showToast, t]);

  useEffect(() => {
    const closeMenus = () => {
      setGroupMenuName(null);
      setRuleMenuId(null);
    };

    document.addEventListener("click", closeMenus);
    return () => document.removeEventListener("click", closeMenus);
  }, []);

  const groupSummaries = useMemo(
    () =>
      groups.map((group) => {
        const rulesInGroup = groupedRules[group] ?? [];
        return {
          group,
          count: rulesInGroup.length,
          enabled: rulesInGroup.some((rule) => rule.enabled),
          description:
            groupMeta[group]?.description?.trim() || t("mock.groupDescriptionEmpty"),
        };
      }),
    [groupMeta, groupedRules, groups, t],
  );

  const activateGroup = async (group: string) => {
    await apiClient.setActiveMockGroup(group);
    setSelectedGroup(group);
    setGroupMenuName(null);
    showToast(t("mock.groupSwitched", { name: group }));
  };

  const openCreateModal = () => {
    setEditingId(null);
    setForm(buildEmptyForm(currentGroup));
    setIsModalOpen(true);
  };

  const openEditModal = (rule: MockRule) => {
    const scene = getRuleScene(rule, defaultGroup);
    setSelectedRuleId(rule.id);
    setEditingId(rule.id);
    setForm(buildFormFromRule(rule, scene.group, defaultGroup));
    setIsModalOpen(true);
  };

  const saveRule = async (keepOpen = false) => {
    const payload = {
      name: buildRuleName(form.group, form.variant),
      method: form.method,
      url: form.url,
      responseStatus: Number(form.responseStatus),
      responseHeaders: JSON.parse(form.responseHeaders || "{}"),
      responseBody: JSON.parse(form.responseBody || "{}"),
      enabled: form.enabled,
    };

    const persistedRule = editingId
      ? await apiClient.updateMockRule(editingId, payload)
      : await apiClient.createMockRule(payload);

    if (!customGroups.includes(form.group) && form.group !== defaultGroup) {
      setCustomGroups((current) => [...current, form.group]);
    }

    await apiClient.setActiveMockGroup(form.group);
    setSelectedGroup(form.group);
    setSelectedRuleId(persistedRule.id);
    await load();

    showToast(
      editingId
        ? t("common.mockUpdated", { name: form.variant })
        : t("common.mockCreatedInGroup", {
            name: form.variant,
            group: form.group,
          }),
    );

    if (keepOpen) {
      setEditingId(null);
      setForm(buildEmptyForm(form.group));
      return;
    }

    setIsModalOpen(false);
    setEditingId(null);
  };

  const renameGroup = async (groupName: string) => {
    const nextName = window.prompt(t("mock.groupRenamePrompt"), groupName)?.trim();
    if (!nextName || nextName === groupName || groups.includes(nextName)) {
      return;
    }

    const groupRules = groupedRules[groupName] ?? [];
    await Promise.all(
      groupRules.map((rule) => {
        const scene = getRuleScene(rule, defaultGroup);
        return apiClient.updateMockRule(rule.id, {
          name: buildRuleName(nextName, scene.variant),
          method: rule.method,
          url: rule.url,
          responseStatus: rule.responseStatus,
          responseHeaders: rule.responseHeaders,
          responseBody: rule.responseBody,
          enabled: rule.enabled,
        });
      }),
    );

    setCustomGroups((current) => current.map((item) => (item === groupName ? nextName : item)));
    setGroupMeta((current) => {
      const next = { ...current };
      next[nextName] = next[groupName];
      delete next[groupName];
      return next;
    });
    await apiClient.setActiveMockGroup(nextName);
    setSelectedGroup(nextName);
    setGroupMenuName(null);
    await load();
    showToast(t("mock.groupRenamed", { name: nextName }));
  };

  const copyGroup = async (groupName: string) => {
    const nextName = buildUniqueGroupName(`${groupName} Copy`, groups);
    const groupRules = groupedRules[groupName] ?? [];

    await Promise.all(
      groupRules.map((rule) => {
        const scene = getRuleScene(rule, defaultGroup);
        return apiClient.createMockRule({
          name: buildRuleName(nextName, scene.variant),
          method: rule.method,
          url: rule.url,
          responseStatus: rule.responseStatus,
          responseHeaders: rule.responseHeaders,
          responseBody: rule.responseBody,
          enabled: false,
        });
      }),
    );

    setCustomGroups((current) => [...current, nextName]);
    setGroupMeta((current) => ({
      ...current,
      [nextName]: current[groupName],
    }));
    await apiClient.setActiveMockGroup(nextName);
    setSelectedGroup(nextName);
    setGroupMenuName(null);
    await load();
    showToast(t("mock.groupCopied", { name: nextName }));
  };

  const deleteGroup = async (groupName: string) => {
    const confirmed = window.confirm(t("mock.groupDeleteConfirm", { name: groupName }));
    if (!confirmed) {
      return;
    }

    const groupRules = groupedRules[groupName] ?? [];
    await Promise.all(groupRules.map((rule) => apiClient.deleteMockRule(rule.id)));

    setCustomGroups((current) => current.filter((item) => item !== groupName));
    setGroupMeta((current) => {
      const next = { ...current };
      delete next[groupName];
      return next;
    });
    await apiClient.setActiveMockGroup(defaultGroup);
    setSelectedGroup(defaultGroup);
    setGroupMenuName(null);
    await load();
    showToast(t("mock.groupDeleted", { name: groupName }));
  };

  const editGroupDescription = () => {
    const nextDescription = window.prompt(
      t("mock.groupDescriptionPrompt"),
      groupMeta[currentGroup]?.description ?? "",
    );

    if (nextDescription === null) {
      return;
    }

    setGroupMeta((current) => ({
      ...current,
      [currentGroup]: { description: nextDescription.trim() },
    }));
    showToast(t("mock.groupDescriptionSaved"));
  };

  const toggleCurrentGroup = async () => {
    const nextEnabled = !isCurrentGroupEnabled;
    await Promise.all(
      currentGroupRules.map((rule) =>
        apiClient.enableMockRule(rule.id, nextEnabled),
      ),
    );
    await load();
    showToast(
      nextEnabled
        ? t("mock.groupEnabled", { name: currentGroup })
        : t("mock.groupDisabled", { name: currentGroup }),
    );
  };

  const duplicateRule = async (rule: MockRule) => {
    const scene = getRuleScene(rule, defaultGroup);
    await apiClient.createMockRule({
      name: buildRuleName(currentGroup, `${scene.variant} Copy`),
      method: rule.method,
      url: rule.url,
      responseStatus: rule.responseStatus,
      responseHeaders: rule.responseHeaders,
      responseBody: rule.responseBody,
      enabled: false,
    });
    await load();
    setRuleMenuId(null);
    showToast(t("common.mockDuplicated", { name: scene.variant }));
  };

  const toggleRule = async (rule: MockRule) => {
    const scene = getRuleScene(rule, defaultGroup);
    await apiClient.enableMockRule(rule.id, !rule.enabled);
    await load();
    setRuleMenuId(null);
    showToast(
      rule.enabled
        ? t("common.mockDisabled", { name: scene.variant })
        : t("common.mockEnabled", { name: scene.variant }),
    );
  };

  const removeRule = async (rule: MockRule) => {
    const scene = getRuleScene(rule, defaultGroup);
    await apiClient.deleteMockRule(rule.id);
    await load();
    setRuleMenuId(null);
    showToast(t("common.mockDeleted", { name: scene.variant }));
  };

  return (
    <div className="page-stack mock-v3-page">
      <section className="page-header mock-v3-header">
        <div>
          <h2>{t("mock.title")}</h2>
        </div>
      </section>

      <section className="mock-v3-shell">
        <aside className="panel mock-sidebar">
          <div className="mock-sidebar-head">
            <div>
              <h3>{t("mock.groupsTitle")}</h3>
              <p>{t("mock.groupsBody")}</p>
            </div>
            <button
              className="primary-action"
              type="button"
              onClick={() => {
                const nextName = window.prompt(t("mock.groupCreatePrompt"))?.trim();
                if (!nextName) {
                  return;
                }
                const uniqueName = buildUniqueGroupName(nextName, groups);
                setCustomGroups((current) =>
                  current.includes(uniqueName) ? current : [...current, uniqueName],
                );
                void apiClient.setActiveMockGroup(uniqueName).catch(console.error);
                setSelectedGroup(uniqueName);
                showToast(t("mock.groupCreated", { name: uniqueName }));
              }}
            >
              {t("mock.groupNew")}
            </button>
          </div>

          <input
            className="mock-group-search"
            placeholder={t("mock.groupSearch")}
            value={groupSearch}
            onChange={(event) => setGroupSearch(event.target.value)}
          />

          <div className="mock-group-list">
            {filteredGroups.map((group) => {
              const summary =
                groupSummaries.find((item) => item.group === group) ??
                {
                  group,
                  count: 0,
                  enabled: false,
                  description: t("mock.groupDescriptionEmpty"),
                };

              return (
                <button
                  className={`mock-group-item ${group === currentGroup ? "active" : ""}`}
                  key={group}
                  type="button"
                  onClick={() => void activateGroup(group).catch(console.error)}
                >
                  <div className="mock-group-item-top">
                    <strong>{group}</strong>
                    <div className="mock-group-item-meta">
                      <span className={`status-badge ${summary.enabled ? "success" : "muted"}`}>
                        {summary.enabled ? t("mock.enabledState") : t("mock.disabledState")}
                      </span>
                      <span className="status-badge muted">{summary.count}</span>
                      <div
                        className="mock-menu-root"
                        onClick={(event) => event.stopPropagation()}
                      >
                        <button
                          className="ghost-button mock-more-button"
                          type="button"
                          onClick={() =>
                            setGroupMenuName((current) =>
                              current === group ? null : group,
                            )
                          }
                        >
                          {t("mock.ruleMore")}
                        </button>
                        {groupMenuName === group ? (
                          <div className="mock-action-menu">
                            <button type="button" onClick={() => renameGroup(group).catch(console.error)}>
                              {t("mock.groupRename")}
                            </button>
                            <button type="button" onClick={() => copyGroup(group).catch(console.error)}>
                              {t("mock.groupCopy")}
                            </button>
                            {group !== defaultGroup ? (
                              <button
                                className="danger-button"
                                type="button"
                                onClick={() => deleteGroup(group).catch(console.error)}
                              >
                                {t("mock.groupDelete")}
                              </button>
                            ) : null}
                          </div>
                        ) : null}
                      </div>
                    </div>
                  </div>
                  <small>{summary.description}</small>
                </button>
              );
            })}
          </div>
        </aside>

        <section className="panel mock-main">
          <div className="mock-group-overview">
            <div className="mock-group-overview-copy">
              <span className="feature-badge">{t("mock.currentGroupTitle")}</span>
              <h3>{currentGroup}</h3>
              <p>{currentGroupDescription}</p>
            </div>
            <div className="mock-group-overview-metrics">
              <div className="mock-overview-stat">
                <span>{t("mock.headerStatus")}</span>
                <strong>{isCurrentGroupEnabled ? t("mock.enabledState") : t("mock.disabledState")}</strong>
              </div>
              <div className="mock-overview-stat">
                <span>{t("mock.headerRequestCount")}</span>
                <strong>{currentGroupRules.length}</strong>
              </div>
              <div className="mock-overview-stat mock-overview-stat-hover">
                <span>{t("mock.headerEnabledUrlCount")}</span>
                <strong>{currentGroupEnabledUrls.length}</strong>
                <div className="mock-hover-popover">
                  <strong>{t("mock.headerEnabledUrlList")}</strong>
                  {currentGroupEnabledUrls.length === 0 ? (
                    <span>{t("mock.headerEnabledUrlEmpty")}</span>
                  ) : (
                    <div className="mock-hover-popover-list">
                      {currentGroupEnabledUrls.map((url) => (
                        <code key={url}>{url}</code>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </div>
            <div className="mock-group-overview-actions">
              <button className="primary-action" type="button" onClick={openCreateModal}>
                {t("mock.newRequest")}
              </button>
              <button type="button" onClick={() => toggleCurrentGroup().catch(console.error)}>
                {isCurrentGroupEnabled ? t("mock.groupDisableAll") : t("mock.groupEnableAll")}
              </button>
              <button className="ghost-button" type="button" onClick={editGroupDescription}>
                {t("mock.groupDescriptionEdit")}
              </button>
            </div>
          </div>

          <div className="mock-rules-table-shell">
            <div className="mock-rules-table-head">
              <span>{t("mock.ruleTable.request")}</span>
              <span>{t("mock.ruleTable.match")}</span>
              <span>{t("mock.ruleTable.response")}</span>
              <span>{t("mock.ruleTable.proxy")}</span>
              <span>{t("mock.ruleTable.status")}</span>
              <span>{t("mock.ruleTable.actions")}</span>
            </div>

            {currentGroupRules.length === 0 ? (
              <div className="mock-rules-empty">
                <h3>{t("mock.ruleNoRulesTitle")}</h3>
                <p>{t("mock.ruleNoRulesBody")}</p>
              </div>
            ) : (
              <div className="mock-rules-table-body">
                {currentGroupRuleBlocks.map((block) => (
                  <section className="mock-rule-block" key={block.key}>
                    <div className="mock-rule-block-header">
                      <div className="mock-rule-block-copy">
                        <strong>{block.label}</strong>
                        <span>{block.host || block.key}</span>
                      </div>
                      <span className="status-badge muted">{block.rules.length}</span>
                    </div>

                    <div className="mock-rule-block-rows">
                      {block.rules.map((rule) => {
                        const scene = getRuleScene(rule, defaultGroup);
                        const queryCount = getQueryCount(rule.url);
                        const responseKind = getResponseKind(rule, scene.variant, t);
                        const urlSummary = getUrlSummary(rule.url);

                        return (
                          <div
                            className={`mock-rule-row ${selectedRuleId === rule.id ? "active" : ""}`}
                            key={rule.id}
                            onClick={() => setSelectedRuleId(rule.id)}
                            role="button"
                            tabIndex={0}
                          >
                            <div className="mock-rule-request">
                              <div className="mock-rule-request-top">
                                <span className={`method-badge method-${rule.method.toLowerCase()}`}>
                                  {rule.method}
                                </span>
                                <strong>{scene.variant}</strong>
                              </div>
                              <small>{urlSummary.full}</small>
                            </div>

                            <div className="mock-rule-match">
                              <span>{t("mock.ruleMatchExactUrl")}</span>
                              {queryCount > 0 ? (
                                <span>{t("mock.ruleMatchQueryCount", { count: queryCount })}</span>
                              ) : (
                                <span>{t("mock.ruleMatchNoExtra")}</span>
                              )}
                            </div>

                            <div className="mock-rule-response">
                              <strong>{responseKind.label}</strong>
                              <small>{responseKind.summary}</small>
                            </div>

                            <div className="mock-rule-proxy">
                              <span className="status-badge muted">{t("mock.ruleProxyOff")}</span>
                              <small>{t("mock.ruleProxyOffBody")}</small>
                            </div>

                            <div className="mock-rule-status">
                              <span className={`status-badge ${rule.enabled ? "success" : "muted"}`}>
                                {rule.enabled ? t("mock.enabledState") : t("mock.disabledState")}
                              </span>
                            </div>

                            <div className="mock-rule-actions" onClick={(event) => event.stopPropagation()}>
                              <button
                                className={rule.enabled ? "ghost-button" : "primary-action"}
                                type="button"
                                onClick={() => toggleRule(rule).catch(console.error)}
                              >
                                {rule.enabled ? t("mock.disable") : t("mock.enable")}
                              </button>
                              <button
                                className="ghost-button"
                                type="button"
                                onClick={() => openEditModal(rule)}
                              >
                                {t("mock.edit")}
                              </button>
                              <div className="mock-menu-root">
                                <button
                                  className="ghost-button mock-more-button"
                                  type="button"
                                  onClick={() =>
                                    setRuleMenuId((current) =>
                                      current === rule.id ? null : rule.id,
                                    )
                                  }
                                >
                                  {t("mock.ruleMore")}
                                </button>
                                {ruleMenuId === rule.id ? (
                                  <div className="mock-action-menu">
                                    <button type="button" onClick={() => duplicateRule(rule).catch(console.error)}>
                                      {t("mock.duplicate")}
                                    </button>
                                    <button type="button" onClick={() => openEditModal(rule)}>
                                      {t("mock.ruleMove")}
                                    </button>
                                    <button className="danger-button" type="button" onClick={() => removeRule(rule).catch(console.error)}>
                                      {t("mock.delete")}
                                    </button>
                                  </div>
                                ) : null}
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </section>
                ))}
              </div>
            )}
          </div>
        </section>
      </section>

      {isModalOpen ? (
        <div
          className="mock-modal-overlay"
          onClick={() => setIsModalOpen(false)}
          role="presentation"
        >
          <section
            aria-modal="true"
            className="mock-modal-card"
            onClick={(event) => event.stopPropagation()}
            role="dialog"
          >
            <div className="mock-modal-head">
              <div>
                <span className="feature-badge">
                  {editingId ? t("mock.modalEditTitle") : t("mock.modalCreateTitle")}
                </span>
                <h3>{editingId ? t("mock.modalEditTitle") : t("mock.modalCreateTitle")}</h3>
                <p>{t("mock.modalBody")}</p>
              </div>
              <button className="ghost-button" type="button" onClick={() => setIsModalOpen(false)}>
                {t("traffic.certificate.close")}
              </button>
            </div>

            <div className="mock-modal-sections">
              <section className="mock-modal-section">
                <div className="mock-modal-section-head">
                  <strong>{t("mock.modalBasic")}</strong>
                </div>
                <div className="mock-modal-grid">
                  <input
                    placeholder={t("mock.form.name")}
                    value={form.variant}
                    onChange={(event) =>
                      setForm((current) => ({ ...current, variant: event.target.value }))
                    }
                  />
                  <select
                    value={form.group}
                    onChange={(event) =>
                      setForm((current) => ({ ...current, group: event.target.value }))
                    }
                  >
                    {groups.map((group) => (
                      <option key={group} value={group}>
                        {group}
                      </option>
                    ))}
                  </select>
                  <select
                    value={form.method}
                    onChange={(event) =>
                      setForm((current) => ({ ...current, method: event.target.value }))
                    }
                  >
                    <option>GET</option>
                    <option>POST</option>
                    <option>PUT</option>
                    <option>PATCH</option>
                    <option>DELETE</option>
                  </select>
                  <input
                    className="mock-modal-grid-span"
                    placeholder={t("mock.form.url")}
                    value={form.url}
                    onChange={(event) =>
                      setForm((current) => ({ ...current, url: event.target.value }))
                    }
                  />
                </div>
              </section>

              <section className="mock-modal-section">
                <div className="mock-modal-section-head">
                  <strong>{t("mock.modalMatch")}</strong>
                </div>
                <div className="mock-modal-note">
                  <strong>{t("mock.ruleMatchExactUrl")}</strong>
                  <p>{t("mock.form.matchHint")}</p>
                </div>
              </section>

              <section className="mock-modal-section">
                <div className="mock-modal-section-head">
                  <strong>{t("mock.modalReturn")}</strong>
                </div>
                <div className="mock-modal-grid">
                  <div className="mock-readonly-field">
                    <span>{t("mock.form.returnType")}</span>
                    <strong>{t("mock.ruleResponseFixed")}</strong>
                  </div>
                  <input
                    type="number"
                    placeholder={t("mock.form.status")}
                    value={form.responseStatus}
                    onChange={(event) =>
                      setForm((current) => ({
                        ...current,
                        responseStatus: Number(event.target.value),
                      }))
                    }
                  />
                  <textarea
                    rows={5}
                    className="mock-modal-grid-span"
                    placeholder={t("mock.form.headers")}
                    value={form.responseHeaders}
                    onChange={(event) =>
                      setForm((current) => ({ ...current, responseHeaders: event.target.value }))
                    }
                  />
                  <textarea
                    rows={12}
                    className="mock-modal-grid-span"
                    placeholder={t("mock.form.bodyPlaceholder")}
                    value={form.responseBody}
                    onChange={(event) =>
                      setForm((current) => ({ ...current, responseBody: event.target.value }))
                    }
                  />
                </div>
              </section>

              <section className="mock-modal-section">
                <div className="mock-modal-section-head">
                  <strong>{t("mock.modalAdvanced")}</strong>
                </div>
                <div className="mock-modal-grid">
                  <label className="checkbox-row">
                    <input
                      checked={form.enabled}
                      type="checkbox"
                      onChange={(event) =>
                        setForm((current) => ({ ...current, enabled: event.target.checked }))
                      }
                    />
                    {t("mock.form.enableNow")}
                  </label>
                  <div className="mock-readonly-field">
                    <span>{t("mock.form.proxy")}</span>
                    <strong>{t("mock.ruleProxyOff")}</strong>
                    <small>{t("mock.form.proxyHint")}</small>
                  </div>
                  <div className="mock-readonly-field">
                    <span>{t("mock.form.delay")}</span>
                    <strong>{form.delayMs} ms</strong>
                    <small>{t("mock.form.delayHint")}</small>
                  </div>
                  <div className="mock-readonly-field">
                    <span>{t("mock.form.priority")}</span>
                    <strong>{form.priority}</strong>
                    <small>{t("mock.form.priorityHint")}</small>
                  </div>
                </div>
              </section>
            </div>

            <div className="mock-modal-actions">
              <button className="ghost-button" type="button" onClick={() => setIsModalOpen(false)}>
                {t("traffic.certificate.close")}
              </button>
              <button
                type="button"
                onClick={() => {
                  void saveRule(true).catch((error) => {
                    showToast(error instanceof Error ? error.message : String(error), "error");
                  });
                }}
              >
                {t("mock.form.saveAndContinue")}
              </button>
              <button
                className="primary-action"
                type="button"
                onClick={() => {
                  void saveRule(false).catch((error) => {
                    showToast(error instanceof Error ? error.message : String(error), "error");
                  });
                }}
              >
                {editingId ? t("mock.form.saveChanges") : t("mock.form.save")}
              </button>
            </div>
          </section>
        </div>
      ) : null}
    </div>
  );
}
