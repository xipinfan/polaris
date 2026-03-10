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
  const [collapsedBlocks, setCollapsedBlocks] = useState<Record<string, boolean>>({});
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

  const currentGroupDescription =
    groupMeta[currentGroup]?.description?.trim() || t("mock.groupDescriptionEmpty");
  const isCurrentGroupEnabled = currentGroupRules.some((rule) => rule.enabled);
  const currentGroupEnabledRules = useMemo(
    () => currentGroupRules.filter((rule) => rule.enabled),
    [currentGroupRules],
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
          enabledCount: rulesInGroup.filter((rule) => rule.enabled).length,
          active: group === currentGroup,
        };
      }),
    [currentGroup, groupedRules, groups],
  );

  const activateGroup = async (group: string) => {
    await apiClient.setActiveMockGroup(group);
    setSelectedGroup(group);
    setGroupMenuName(null);
    showToast(t("mock.groupSwitched", { name: group }));
  };

  const toggleBlockCollapsed = (blockKey: string) => {
    setCollapsedBlocks((current) => ({
      ...current,
      [blockKey]: !current[blockKey],
    }));
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
            <h3>{t("mock.groupsTitle")}</h3>
            <button
              className="ghost-button mock-sidebar-create"
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
                  enabledCount: 0,
                  active: false,
                };

              return (
                <button
                  className={`mock-group-item ${group === currentGroup ? "active" : ""}`}
                  key={group}
                  type="button"
                  onClick={() => void activateGroup(group).catch(console.error)}
                >
                  <div className="mock-group-item-main">
                    <strong>{group}</strong>
                    <span>{t("mock.groupRuleCount", { count: summary.count })}</span>
                  </div>
                  <div className="mock-group-item-side">
                    <span className={`status-badge ${summary.active ? "success" : "muted"}`}>
                      {summary.active ? t("mock.groupActive") : t("mock.groupInactive")}
                    </span>
                    <span className="mock-group-item-count">{summary.count}</span>
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
                </button>
              );
            })}
          </div>
        </aside>

        <section className="panel mock-main">
          <div className="mock-group-overview">
            <div className="mock-group-overview-copy">
              <div className="mock-group-overview-head">
                <span className="feature-badge">{t("mock.currentGroupTitle")}</span>
                <span className="status-badge success">{t("mock.groupActive")}</span>
              </div>
              <h3>{currentGroup}</h3>
              <p>{currentGroupDescription}</p>
              <small>{t("mock.currentGroupBody")}</small>
            </div>
            <div className="mock-group-overview-metrics">
              <div className="mock-overview-stat">
                <span>{t("mock.headerStatus")}</span>
                <strong>{t("mock.groupActive")}</strong>
              </div>
              <div className="mock-overview-stat">
                <span>{t("mock.headerRequestCount")}</span>
                <strong>{currentGroupRules.length}</strong>
              </div>
              <div className="mock-overview-stat">
                <span>{t("mock.headerEnabledRuleCount")}</span>
                <strong>{currentGroupEnabledRules.length}</strong>
              </div>
            </div>
            <div className="mock-group-overview-actions">
              <button className="primary-action" type="button" onClick={openCreateModal}>
                {t("mock.newRequest")}
              </button>
              <button className="ghost-button" type="button" onClick={editGroupDescription}>
                {t("mock.groupEdit")}
              </button>
              <div className="mock-menu-root">
                <button
                  className="ghost-button"
                  type="button"
                  onClick={() =>
                    setGroupMenuName((current) => (current === "__header__" ? null : "__header__"))
                  }
                >
                  {t("mock.ruleMore")}
                </button>
                {groupMenuName === "__header__" ? (
                  <div className="mock-action-menu">
                    <button type="button" onClick={() => copyGroup(currentGroup).catch(console.error)}>
                      {t("mock.groupCopy")}
                    </button>
                    <button type="button" onClick={() => toggleCurrentGroup().catch(console.error)}>
                      {isCurrentGroupEnabled ? t("mock.groupDisableAll") : t("mock.groupEnableAll")}
                    </button>
                    {currentGroup !== defaultGroup ? (
                      <button
                        className="danger-button"
                        type="button"
                        onClick={() => deleteGroup(currentGroup).catch(console.error)}
                      >
                        {t("mock.groupDelete")}
                      </button>
                    ) : null}
                  </div>
                ) : null}
              </div>
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
                      <div className="mock-rule-block-meta">
                        <span className="status-badge muted">
                          {t("mock.groupRuleCount", { count: block.rules.length })}
                        </span>
                        <button
                          className="ghost-button mock-collapse-button"
                          type="button"
                          onClick={() => toggleBlockCollapsed(block.key)}
                        >
                          {collapsedBlocks[block.key] ? t("mock.expand") : t("mock.collapse")}
                        </button>
                      </div>
                    </div>

                    <div className={`mock-rule-block-rows ${collapsedBlocks[block.key] ? "collapsed" : ""}`}>
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
                              <span>{t("mock.ruleMatchMode")}</span>
                              <span>{t("mock.ruleMatchQueryCount", { count: queryCount })}</span>
                              <span>{t("mock.ruleMatchHeaderCount", { count: 0 })}</span>
                              <span>{t("mock.ruleMatchBodyCount", { count: 0 })}</span>
                            </div>

                            <div className="mock-rule-response">
                              <strong>{responseKind.label}</strong>
                              <small>{t("mock.ruleResponseSummary", { status: rule.responseStatus, name: scene.variant })}</small>
                            </div>

                            <div className="mock-rule-proxy">
                              <span className="status-badge muted">{t("mock.ruleProxyOff")}</span>
                              <small>{t("mock.ruleProxyOffBody")}</small>
                            </div>

                            <div className="mock-rule-status">
                              <label className="mock-switch" aria-label={rule.enabled ? t("mock.disable") : t("mock.enable")}>
                                <input
                                  checked={rule.enabled}
                                  type="checkbox"
                                  onChange={() => {
                                    void toggleRule(rule).catch(console.error);
                                  }}
                                />
                                <span className="mock-switch-track" />
                              </label>
                            </div>

                            <div className="mock-rule-actions" onClick={(event) => event.stopPropagation()}>
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
              <div className="mock-modal-head-copy">
                <div className="mock-modal-head-top">
                  <span className="feature-badge">
                    {editingId ? t("mock.modalEditTitle") : t("mock.modalCreateTitle")}
                  </span>
                </div>
                <h3>{editingId ? t("mock.modalEditTitle") : t("mock.modalCreateTitle")}</h3>
                <p>{t("mock.modalBody")}</p>
              </div>
              <button
                aria-label={t("mock.form.cancel")}
                className="ghost-button mock-modal-close"
                type="button"
                onClick={() => setIsModalOpen(false)}
              >
                ×
              </button>
            </div>

            <div className="mock-modal-status-bar">
              <div className="mock-modal-status-copy">
                <strong>{t("mock.form.ruleStatus")}</strong>
                <span>{form.enabled ? t("mock.form.ruleEnabledHint") : t("mock.form.ruleDisabledHint")}</span>
              </div>
              <label className="mock-switch" aria-label={form.enabled ? t("mock.disable") : t("mock.enable")}>
                <input
                  checked={form.enabled}
                  type="checkbox"
                  onChange={(event) =>
                    setForm((current) => ({ ...current, enabled: event.target.checked }))
                  }
                />
                <span className="mock-switch-track" />
              </label>
            </div>

            <div className="mock-modal-sections">
              <section className="mock-modal-section">
                <div className="mock-modal-section-head">
                  <div>
                    <strong>{t("mock.modalBasic")}</strong>
                    <p>{t("mock.form.basicHint")}</p>
                  </div>
                </div>
                <div className="mock-modal-grid">
                  <label className="mock-field">
                    <span>{t("mock.form.nameLabel")}</span>
                    <input
                      placeholder={t("mock.form.name")}
                      value={form.variant}
                      onChange={(event) =>
                        setForm((current) => ({ ...current, variant: event.target.value }))
                      }
                    />
                  </label>
                  <label className="mock-field">
                    <span>{t("mock.form.groupLabel")}</span>
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
                  </label>
                  <label className="mock-field">
                    <span>{t("mock.form.methodLabel")}</span>
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
                  </label>
                  <div className="mock-field mock-field-muted">
                    <span>{t("mock.form.groupActiveHintLabel")}</span>
                    <div className="mock-static-value">{t("mock.currentGroupBody")}</div>
                  </div>
                  <label className="mock-field mock-modal-grid-span">
                    <span>{t("mock.form.urlLabel")}</span>
                    <input
                      placeholder={t("mock.form.url")}
                      value={form.url}
                      onChange={(event) =>
                        setForm((current) => ({ ...current, url: event.target.value }))
                      }
                    />
                  </label>
                </div>
              </section>

              <section className="mock-modal-section">
                <div className="mock-modal-section-head">
                  <div>
                    <strong>{t("mock.modalMatch")}</strong>
                    <p>{t("mock.form.matchSectionHint")}</p>
                  </div>
                </div>
                <div className="mock-modal-grid">
                  <div className="mock-field">
                    <span>{t("mock.form.matchModeLabel")}</span>
                    <div className="mock-static-value">
                      <strong>{t("mock.ruleMatchMode")}</strong>
                      <small>{t("mock.ruleMatchExactUrl")}</small>
                    </div>
                  </div>
                  <div className="mock-field">
                    <span>{t("mock.form.queryLabel")}</span>
                    <div className="mock-static-value">
                      <strong>{t("mock.ruleMatchQueryCount", { count: getQueryCount(form.url) })}</strong>
                      <small>{t("mock.form.matchHint")}</small>
                    </div>
                  </div>
                  <div className="mock-field">
                    <span>{t("mock.form.headerLabel")}</span>
                    <div className="mock-static-value">
                      <strong>{t("mock.ruleMatchHeaderCount", { count: 0 })}</strong>
                      <small>{t("mock.form.unsupportedHint")}</small>
                    </div>
                  </div>
                  <div className="mock-field">
                    <span>{t("mock.form.bodyLabel")}</span>
                    <div className="mock-static-value">
                      <strong>{t("mock.ruleMatchBodyCount", { count: 0 })}</strong>
                      <small>{t("mock.form.unsupportedHint")}</small>
                    </div>
                  </div>
                </div>
              </section>

              <section className="mock-modal-section">
                <div className="mock-modal-section-head">
                  <div>
                    <strong>{t("mock.modalReturn")}</strong>
                    <p>{t("mock.form.responseSectionHint")}</p>
                  </div>
                </div>
                <div className="mock-modal-grid">
                  <div className="mock-field">
                    <span>{t("mock.form.returnTypeLabel")}</span>
                    <div className="mock-static-value">
                      <strong>{t("mock.ruleResponseFixed")}</strong>
                    </div>
                  </div>
                  <label className="mock-field">
                    <span>{t("mock.form.statusLabel")}</span>
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
                  </label>
                  <label className="mock-field mock-modal-grid-span">
                    <span>{t("mock.form.headersLabel")}</span>
                    <textarea
                      rows={5}
                      className="mock-code-editor"
                      placeholder={t("mock.form.headers")}
                      value={form.responseHeaders}
                      onChange={(event) =>
                        setForm((current) => ({ ...current, responseHeaders: event.target.value }))
                      }
                    />
                  </label>
                  <label className="mock-field mock-modal-grid-span">
                    <span>{t("mock.form.bodyContentLabel")}</span>
                    <textarea
                      rows={10}
                      className="mock-code-editor"
                      placeholder={t("mock.form.bodyPlaceholder")}
                      value={form.responseBody}
                      onChange={(event) =>
                        setForm((current) => ({ ...current, responseBody: event.target.value }))
                      }
                    />
                  </label>
                </div>
              </section>

              <section className="mock-modal-section">
                <div className="mock-modal-section-head">
                  <div>
                    <strong>{t("mock.modalAdvanced")}</strong>
                    <p>{t("mock.form.behaviorSectionHint")}</p>
                  </div>
                </div>
                <div className="mock-modal-grid">
                  <div className="mock-field">
                    <span>{t("mock.form.priorityLabel")}</span>
                    <div className="mock-static-value">
                      <strong>{form.priority}</strong>
                      <small>{t("mock.form.priorityHint")}</small>
                    </div>
                  </div>
                  <div className="mock-field">
                    <span>{t("mock.form.proxyLabel")}</span>
                    <div className="mock-static-value">
                      <strong>{t("mock.ruleProxyOff")}</strong>
                      <small>{t("mock.form.proxyHint")}</small>
                    </div>
                  </div>
                  <div className="mock-field">
                    <span>{t("mock.form.delayLabel")}</span>
                    <div className="mock-static-value">
                      <strong>{form.delayMs} ms</strong>
                      <small>{t("mock.form.delayHint")}</small>
                    </div>
                  </div>
                  <div className="mock-field">
                    <span>{t("mock.form.groupRuleLabel")}</span>
                    <div className="mock-static-value">
                      <strong>{form.group}</strong>
                      <small>{t("mock.currentGroupBody")}</small>
                    </div>
                  </div>
                </div>
              </section>
            </div>

            <div className="mock-modal-actions">
              <button className="ghost-button" type="button" onClick={() => setIsModalOpen(false)}>
                {t("mock.form.cancel")}
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
