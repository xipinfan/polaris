import { useEffect, useMemo, useState } from "react";
import { useLocation } from "react-router-dom";
import type { MockRule, RequestRecord } from "@polaris/shared-types";
import { useToast } from "../../features/feedback/ToastProvider";
import { useConsoleI18n } from "../../i18n/I18nProvider";
import { apiClient } from "../../services/apiClient";
import styles from "./MockPage.module.less";

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

function classNames(...values: Array<string | false | null | undefined>) {
  return values.filter(Boolean).join(" ");
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

  return label;
}

function getMatchSummary(
  queryCount: number,
  t: ReturnType<typeof useConsoleI18n>["t"],
) {
  return [
    t("mock.ruleMatchMode"),
    t("mock.ruleMatchQueryCount", { count: queryCount }),
    t("mock.ruleMatchHeaderCount", { count: 0 }),
    t("mock.ruleMatchBodyCount", { count: 0 }),
  ].join(" · ");
}

function getMethodClass(method: string) {
  switch (method.toUpperCase()) {
    case "POST":
      return styles.methodPost;
    case "PUT":
      return styles.methodPut;
    case "PATCH":
      return styles.methodPatch;
    case "DELETE":
      return styles.methodDelete;
    default:
      return styles.methodGet;
  }
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
    return Array.from(new Set([defaultGroup, ...customGroups, ...Object.keys(groupedRules)]));
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

  const currentGroupEnabledRules = useMemo(
    () => currentGroupRules.filter((rule) => rule.enabled),
    [currentGroupRules],
  );
  const currentGroupDescription = groupMeta[currentGroup]?.description?.trim();
  const isCurrentGroupEnabled = currentGroupRules.some((rule) => rule.enabled);

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

  const saveRule = async () => {
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
        : t("common.mockCreatedInGroup", { name: form.variant, group: form.group }),
    );

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
    const nextName = buildUniqueGroupName(`${groupName} 副本`, groups);
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
      currentGroupRules.map((rule) => apiClient.enableMockRule(rule.id, nextEnabled)),
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
      name: buildRuleName(currentGroup, `${scene.variant} 副本`),
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

  const overviewDescription = currentGroupDescription || t("mock.currentGroupHint");

  return (
    <div className={styles.page}>
      <section className={styles.header}>
        <div className={styles.headerCopy}>
          <span className={styles.pageEyebrow}>{t("mock.title")}</span>
          <h2>{t("mock.title")}</h2>
          <p>{t("mock.currentGroupBody")}</p>
        </div>
      </section>

      <section className={styles.workspace}>
        <aside className={styles.sidebar}>
          <div className={styles.sidebarHeader}>
            <div>
              <span className={styles.sectionLabel}>{t("mock.groupsTitle")}</span>
              <strong>{t("mock.groupsTitle")}</strong>
            </div>
            <button
              className={styles.secondaryButton}
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
            className={styles.searchInput}
            placeholder={t("mock.groupSearch")}
            value={groupSearch}
            onChange={(event) => setGroupSearch(event.target.value)}
          />

          <div className={styles.groupList}>
            {filteredGroups.map((group) => {
              const summary = groupSummaries.find((item) => item.group === group) ?? {
                group,
                count: 0,
                enabledCount: 0,
                active: false,
              };

              return (
                <div
                  className={classNames(
                    styles.groupItem,
                    group === currentGroup && styles.groupItemActive,
                    groupMenuName === group && styles.groupItemOpen,
                  )}
                  key={group}
                >
                  <button
                    className={styles.groupSelect}
                    type="button"
                    onClick={() => void activateGroup(group).catch(console.error)}
                  >
                    <div className={styles.groupMain}>
                      <div className={styles.groupTitleRow}>
                        <span
                          className={classNames(
                            styles.groupStatusDot,
                            summary.active && styles.groupStatusDotActive,
                          )}
                        />
                        <strong>{group}</strong>
                      </div>
                      <span className={styles.groupMeta}>
                        {t("mock.groupRuleCount", { count: summary.count })}
                      </span>
                    </div>
                    <span
                      className={classNames(
                        styles.statusBadge,
                        summary.active ? styles.statusBadgeSuccess : styles.statusBadgeMuted,
                      )}
                    >
                      {summary.active ? t("mock.groupActive") : t("mock.groupInactive")}
                    </span>
                  </button>

                  <div className={styles.menuRoot} onClick={(event) => event.stopPropagation()}>
                    <button
                      className={classNames(styles.iconButton, styles.moreButton)}
                      aria-label={t("mock.ruleMore")}
                      type="button"
                      onClick={() => setGroupMenuName((current) => (current === group ? null : group))}
                    >
                      ...
                    </button>
                    {groupMenuName === group ? (
                      <div className={classNames(styles.actionMenu, styles.groupActionMenu)}>
                        <button type="button" onClick={() => renameGroup(group).catch(console.error)}>
                          {t("mock.groupRename")}
                        </button>
                        <button type="button" onClick={() => copyGroup(group).catch(console.error)}>
                          {t("mock.groupCopy")}
                        </button>
                        {group !== defaultGroup ? (
                          <button
                            className={styles.menuDanger}
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
              );
            })}
          </div>
        </aside>

        <section className={styles.main}>
          <div className={styles.overview}>
            <div className={styles.overviewCopy}>
              <div className={styles.overviewTitleRow}>
                <h3>{currentGroup}</h3>
                <span className={classNames(styles.statusBadge, styles.statusBadgeSuccess)}>
                  {t("mock.groupActive")}
                </span>
              </div>
              <p>{overviewDescription}</p>
            </div>

            <div className={styles.metricRow}>
              <div className={styles.metricCard}>
                <span>{t("mock.headerRequestCount")}</span>
                <strong>{currentGroupRules.length}</strong>
              </div>
              <div className={styles.metricCard}>
                <span>{t("mock.headerEnabledRuleCount")}</span>
                <strong>{currentGroupEnabledRules.length}</strong>
              </div>
            </div>

            <div className={styles.overviewActions}>
              <button className={styles.primaryButton} type="button" onClick={openCreateModal}>
                {t("mock.newRequest")}
              </button>
              <button className={styles.secondaryButton} type="button" onClick={editGroupDescription}>
                {t("mock.groupEdit")}
              </button>
              <div className={styles.menuRoot} onClick={(event) => event.stopPropagation()}>
                <button
                  className={styles.iconButton}
                  aria-label={t("mock.ruleMore")}
                  type="button"
                  onClick={() =>
                    setGroupMenuName((current) => (current === "__header__" ? null : "__header__"))
                  }
                >
                  ...
                </button>
                {groupMenuName === "__header__" ? (
                  <div className={styles.actionMenu}>
                    <button type="button" onClick={() => copyGroup(currentGroup).catch(console.error)}>
                      {t("mock.groupCopy")}
                    </button>
                    <button type="button" onClick={() => toggleCurrentGroup().catch(console.error)}>
                      {isCurrentGroupEnabled ? t("mock.groupDisableAll") : t("mock.groupEnableAll")}
                    </button>
                    {currentGroup !== defaultGroup ? (
                      <button
                        className={styles.menuDanger}
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

            <div className={styles.ruleTable}>
              <div className={styles.ruleTableHead}>
                <span>{t("mock.ruleTable.status")}</span>
                <span>{t("mock.ruleTable.request")}</span>
                <span>{t("mock.ruleTable.match")}</span>
                <span>{t("mock.ruleTable.response")}</span>
                <span>{t("mock.ruleTable.actions")}</span>
              </div>

            {currentGroupRules.length === 0 ? (
              <div className={styles.emptyState}>
                <h3>{t("mock.ruleNoRulesTitle")}</h3>
                <p>{t("mock.ruleNoRulesBody")}</p>
              </div>
            ) : (
              <div className={styles.ruleTableBody}>
                {currentGroupRuleBlocks.map((block) => (
                  <section className={styles.ruleBlock} key={block.key}>
                    <button
                      className={styles.ruleBlockHeader}
                      type="button"
                      onClick={() => toggleBlockCollapsed(block.key)}
                    >
                      <div className={styles.ruleBlockCopy}>
                        <strong>{block.key}</strong>
                        <span>{collapsedBlocks[block.key] ? t("mock.expand") : t("mock.collapse")}</span>
                      </div>
                      <div className={styles.ruleBlockMeta}>
                        <span className={classNames(styles.statusBadge, styles.statusBadgeMuted)}>
                          {t("mock.groupRuleCount", { count: block.rules.length })}
                        </span>
                        <span className={styles.collapseIndicator}>
                          {collapsedBlocks[block.key] ? t("mock.expand") : t("mock.collapse")}
                        </span>
                      </div>
                    </button>

                    <div
                      className={classNames(
                        styles.ruleRows,
                        collapsedBlocks[block.key] && styles.ruleRowsCollapsed,
                      )}
                    >
                      {block.rules.map((rule) => {
                        const scene = getRuleScene(rule, defaultGroup);
                        const queryCount = getQueryCount(rule.url);
                        const responseKind = getResponseKind(rule, t);
                        const urlSummary = getUrlSummary(rule.url);
                        const matchSummary = getMatchSummary(queryCount, t);

                        return (
                          <div
                            className={classNames(
                              styles.ruleRow,
                              selectedRuleId === rule.id && styles.ruleRowActive,
                            )}
                            key={rule.id}
                            onClick={() => setSelectedRuleId(rule.id)}
                            onKeyDown={(event) => {
                              if (event.key === "Enter" || event.key === " ") {
                                event.preventDefault();
                                setSelectedRuleId(rule.id);
                              }
                            }}
                            role="button"
                            tabIndex={0}
                          >
                            <div className={styles.ruleStatus}>
                              <label
                                className={styles.switch}
                                aria-label={rule.enabled ? t("mock.disable") : t("mock.enable")}
                              >
                                <input
                                  checked={rule.enabled}
                                  type="checkbox"
                                  onChange={() => {
                                    void toggleRule(rule).catch(console.error);
                                  }}
                                />
                                <span className={styles.switchTrack} />
                              </label>
                            </div>

                            <div className={styles.ruleRequest}>
                              <div className={styles.ruleRequestTop}>
                                <span className={classNames(styles.methodBadge, getMethodClass(rule.method))}>
                                  {rule.method}
                                </span>
                                <strong>{scene.variant}</strong>
                              </div>
                              <small>{urlSummary.full}</small>
                            </div>

                            <div className={styles.ruleMatch}>
                              <strong>{matchSummary}</strong>
                            </div>

                            <div className={styles.ruleResponse}>
                              <strong>{`${responseKind} · ${rule.responseStatus}`}</strong>
                            </div>

                            <div className={styles.ruleActions} onClick={(event) => event.stopPropagation()}>
                              <button
                                className={styles.secondaryButton}
                                type="button"
                                onClick={() => openEditModal(rule)}
                              >
                                {t("mock.edit")}
                              </button>
                              <div className={styles.menuRoot} onClick={(event) => event.stopPropagation()}>
                                <button
                                  className={classNames(styles.iconButton, styles.moreButton)}
                                  aria-label={t("mock.ruleMore")}
                                  type="button"
                                  onClick={() =>
                                    setRuleMenuId((current) => (current === rule.id ? null : rule.id))
                                  }
                                >
                                  ...
                                </button>
                                {ruleMenuId === rule.id ? (
                                  <div className={styles.actionMenu}>
                                    <button type="button" onClick={() => duplicateRule(rule).catch(console.error)}>
                                      {t("mock.duplicate")}
                                    </button>
                                    <button type="button" onClick={() => openEditModal(rule)}>
                                      {t("mock.ruleMove")}
                                    </button>
                                    <button
                                      className={styles.menuDanger}
                                      type="button"
                                      onClick={() => removeRule(rule).catch(console.error)}
                                    >
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
        <div className={styles.modalOverlay} onClick={() => setIsModalOpen(false)} role="presentation">
          <section
            aria-modal="true"
            className={styles.modalCard}
            onClick={(event) => event.stopPropagation()}
            role="dialog"
          >
            <div className={styles.modalHeader}>
              <div className={styles.modalHeaderCopy}>
                <span className={styles.sectionBadge}>
                  {editingId ? t("mock.modalEditTitle") : t("mock.modalCreateTitle")}
                </span>
                <h3>{editingId ? t("mock.modalEditTitle") : t("mock.modalCreateTitle")}</h3>
                <p>{t("mock.modalBody")}</p>
              </div>
              <button
                aria-label={t("mock.form.cancel")}
                className={styles.modalClose}
                type="button"
                onClick={() => setIsModalOpen(false)}
              />
            </div>

            <div className={styles.modalStatusCard}>
              <div className={styles.modalStatusCopy}>
                <strong>{t("mock.form.ruleStatus")}</strong>
                <span>{form.enabled ? t("mock.form.ruleEnabledHint") : t("mock.form.ruleDisabledHint")}</span>
              </div>
              <label className={styles.switch} aria-label={form.enabled ? t("mock.disable") : t("mock.enable")}>
                <input
                  checked={form.enabled}
                  type="checkbox"
                  onChange={(event) =>
                    setForm((current) => ({ ...current, enabled: event.target.checked }))
                  }
                />
                <span className={styles.switchTrack} />
              </label>
            </div>

            <div className={styles.modalSections}>
              <section className={styles.modalSection}>
                <div className={styles.modalSectionHeader}>
                  <div>
                    <strong>{t("mock.modalBasic")}</strong>
                    <p>{t("mock.form.basicHint")}</p>
                  </div>
                </div>
                <div className={styles.modalGrid}>
                  <label className={styles.field}>
                    <span>{t("mock.form.nameLabel")}</span>
                    <input
                      className={styles.control}
                      placeholder={t("mock.form.name")}
                      value={form.variant}
                      onChange={(event) =>
                        setForm((current) => ({ ...current, variant: event.target.value }))
                      }
                    />
                  </label>
                  <label className={styles.field}>
                    <span>{t("mock.form.groupLabel")}</span>
                    <select
                      className={styles.control}
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
                    <small className={styles.fieldHint}>{t("mock.form.groupHint")}</small>
                  </label>
                  <label className={styles.field}>
                    <span>{t("mock.form.methodLabel")}</span>
                    <select
                      className={styles.control}
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
                  <label className={classNames(styles.field, styles.fieldFull)}>
                    <span>{t("mock.form.urlLabel")}</span>
                    <input
                      className={styles.control}
                      placeholder={t("mock.form.url")}
                      value={form.url}
                      onChange={(event) =>
                        setForm((current) => ({ ...current, url: event.target.value }))
                      }
                    />
                  </label>
                </div>
              </section>

              <section className={styles.modalSection}>
                <div className={styles.modalSectionHeader}>
                  <div>
                    <strong>{t("mock.modalMatch")}</strong>
                    <p>{t("mock.form.matchSectionHint")}</p>
                  </div>
                </div>
                <div className={styles.modalGrid}>
                  <div className={styles.field}>
                    <span>{t("mock.form.matchModeLabel")}</span>
                    <div className={styles.staticValue}>
                      <strong>{t("mock.ruleMatchExactUrl")}</strong>
                    </div>
                  </div>
                  <div className={styles.field}>
                    <span>{t("mock.form.queryLabel")}</span>
                    <div className={styles.staticValue}>
                      <strong>{t("mock.form.queryIncluded")}</strong>
                      <small>{t("mock.ruleMatchQueryCount", { count: getQueryCount(form.url) })}</small>
                    </div>
                  </div>
                  <div className={styles.field}>
                    <span>{t("mock.form.headerLabel")}</span>
                    <div className={styles.staticValue}>
                      <strong>{t("mock.form.unsupportedCompact")}</strong>
                      <small>{t("mock.form.unsupportedHint")}</small>
                    </div>
                  </div>
                  <div className={styles.field}>
                    <span>{t("mock.form.bodyLabel")}</span>
                    <div className={styles.staticValue}>
                      <strong>{t("mock.form.unsupportedCompact")}</strong>
                      <small>{t("mock.form.unsupportedHint")}</small>
                    </div>
                  </div>
                </div>
              </section>

              <section className={styles.modalSection}>
                <div className={styles.modalSectionHeader}>
                  <div>
                    <strong>{t("mock.modalReturn")}</strong>
                    <p>{t("mock.form.responseSectionHint")}</p>
                  </div>
                </div>
                <div className={styles.modalGrid}>
                  <div className={styles.field}>
                    <span>{t("mock.form.returnTypeLabel")}</span>
                    <div className={styles.staticValue}>
                      <strong>{t("mock.ruleResponseFixed")}</strong>
                    </div>
                  </div>
                  <label className={styles.field}>
                    <span>{t("mock.form.statusLabel")}</span>
                    <input
                      className={styles.control}
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
                  <label className={classNames(styles.field, styles.fieldFull)}>
                    <span>{t("mock.form.headersLabel")}</span>
                    <textarea
                      rows={4}
                      className={classNames(styles.codeEditor, styles.codeEditorCompact)}
                      placeholder={t("mock.form.headers")}
                      value={form.responseHeaders}
                      onChange={(event) =>
                        setForm((current) => ({ ...current, responseHeaders: event.target.value }))
                      }
                    />
                  </label>
                  <label className={classNames(styles.field, styles.fieldFull)}>
                    <span>{t("mock.form.bodyContentLabel")}</span>
                    <textarea
                      rows={10}
                      className={classNames(styles.codeEditor, styles.codeEditorBody)}
                      placeholder={t("mock.form.bodyPlaceholder")}
                      value={form.responseBody}
                      onChange={(event) =>
                        setForm((current) => ({ ...current, responseBody: event.target.value }))
                      }
                    />
                  </label>
                </div>
              </section>

              <section className={styles.modalSection}>
                <div className={styles.modalSectionHeader}>
                  <div>
                    <strong>{t("mock.modalAdvanced")}</strong>
                    <p>{t("mock.form.behaviorSectionHint")}</p>
                  </div>
                </div>
                <div className={styles.modalGrid}>
                  <div className={styles.field}>
                    <span>{t("mock.form.priorityLabel")}</span>
                    <div className={styles.staticValue}>
                      <strong>{form.priority}</strong>
                      <small>{t("mock.form.priorityHint")}</small>
                    </div>
                  </div>
                  <div className={styles.field}>
                    <span>{t("mock.form.proxyLabel")}</span>
                    <div className={styles.staticValue}>
                      <strong>{t("mock.ruleProxyOff")}</strong>
                      <small>{t("mock.form.proxyHint")}</small>
                    </div>
                  </div>
                  <div className={styles.field}>
                    <span>{t("mock.form.delayLabel")}</span>
                    <div className={styles.staticValue}>
                      <strong>{form.delayMs} 毫秒</strong>
                      <small>{t("mock.form.delayHint")}</small>
                    </div>
                  </div>
                </div>
                <div className={styles.inlineHint}>{t("mock.currentGroupBody")}</div>
              </section>
            </div>

            <div className={styles.modalActions}>
              <button className={styles.secondaryButton} type="button" onClick={() => setIsModalOpen(false)}>
                {t("mock.form.cancel")}
              </button>
              <button
                className={styles.primaryButton}
                type="button"
                onClick={() => {
                  void saveRule().catch((error) => {
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

