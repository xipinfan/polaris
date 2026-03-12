import { useEffect, useMemo, useState } from "react";
import type { ProxyRule, RequestRecord } from "@polaris/shared-types";
import {
  Badge,
  Button,
  Card,
  Drawer,
  Dropdown,
  Input,
  Modal,
  Select,
  Segmented,
  Switch,
  Tag,
} from "antd";
import type { MenuProps } from "antd";
import { useToast } from "../../features/feedback/ToastProvider";
import { apiClient } from "../../services/apiClient";
import styles from "./ProxyForwardPage.module.less";

type FilterMode = "all" | "enabled" | "hits" | "errors";
type SortMode = "updated" | "hits" | "created";
type RuleAction = ProxyRule["action"];

type StoredForwardRule = {
  id: string;
  name: string;
  pattern: string;
  action: RuleAction;
  enabled: boolean;
  createdAt: string;
  updatedAt: string;
};

type StoredGroup = {
  id: string;
  name: string;
  rules: StoredForwardRule[];
};

type RuleView = StoredForwardRule & {
  hitCountToday: number;
  recentErrorCount: number;
  lastHitAt: string | null;
  latestRecord: RequestRecord | null;
  recentRecords: RequestRecord[];
};

const groupsStorageKey = "polaris.console.proxy-forward.groups";
const activeGroupStorageKey = "polaris.console.proxy-forward.active-group";
const fallbackGroup = buildGroupFromRules("默认组", []);

function classNames(...values: Array<string | false | null | undefined>) {
  return values.filter(Boolean).join(" ");
}

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

function createId(prefix: string) {
  return `${prefix}-${Math.random().toString(36).slice(2, 10)}`;
}

function formatTime(value: string | null | undefined) {
  if (!value) {
    return "暂无";
  }

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return value;
  }

  return new Intl.DateTimeFormat("zh-CN", {
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
}

function isToday(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return false;
  }

  const now = new Date();
  return (
    date.getFullYear() === now.getFullYear() &&
    date.getMonth() === now.getMonth() &&
    date.getDate() === now.getDate()
  );
}

function buildGroupFromRules(name: string, rules: ProxyRule[]): StoredGroup {
  return {
    id: createId("proxy-group"),
    name,
    rules: rules.map((rule) => ({
      id: rule.id,
      name: rule.pattern,
      pattern: rule.pattern,
      action: rule.action,
      enabled: rule.enabled,
      createdAt: rule.createdAt,
      updatedAt: rule.updatedAt,
    })),
  };
}

function normalizeGroups(
  storedGroups: StoredGroup[],
  backendRules: ProxyRule[],
  storedActiveGroupId: string | null,
) {
  if (storedGroups.length === 0) {
    const defaultGroup = buildGroupFromRules("默认组", backendRules);
    return { groups: [defaultGroup], activeGroupId: defaultGroup.id };
  }

  const activeGroupId =
    storedActiveGroupId && storedGroups.some((group) => group.id === storedActiveGroupId)
      ? storedActiveGroupId
      : storedGroups[0].id;

  const groups = storedGroups.map((group) => {
    if (group.id !== activeGroupId) {
      return group;
    }

    const backendByPattern = new Map(backendRules.map((rule) => [rule.pattern, rule]));
    const rules = group.rules.map((rule) => {
      const next = backendByPattern.get(rule.pattern);
      if (!next) {
        return { ...rule, enabled: false };
      }

      backendByPattern.delete(rule.pattern);
      return {
        ...rule,
        id: next.id,
        action: next.action,
        enabled: next.enabled,
        createdAt: next.createdAt,
        updatedAt: next.updatedAt,
      };
    });

    backendByPattern.forEach((rule) => {
      rules.push({
        id: rule.id,
        name: rule.pattern,
        pattern: rule.pattern,
        action: rule.action,
        enabled: rule.enabled,
        createdAt: rule.createdAt,
        updatedAt: rule.updatedAt,
      });
    });

    return { ...group, rules };
  });

  return { groups, activeGroupId };
}

async function applyGroupToBackend(group: StoredGroup) {
  const currentRules = await apiClient.listProxyRules();
  await Promise.all(currentRules.map((rule) => apiClient.removeSiteRule(rule.pattern)));

  return Promise.all(
    group.rules
      .filter((rule) => rule.enabled)
      .map((rule) => apiClient.upsertSiteRule(rule.pattern, rule.action)),
  );
}

function buildRuleStats(rule: StoredForwardRule, requests: RequestRecord[]): RuleView {
  const recentRecords = requests
    .filter((request) => request.host === rule.pattern)
    .sort((left, right) => {
      return new Date(right.createdAt).getTime() - new Date(left.createdAt).getTime();
    });

  return {
    ...rule,
    hitCountToday: recentRecords.filter((record) => isToday(record.createdAt)).length,
    recentErrorCount: recentRecords.filter((record) => record.statusCode >= 400).length,
    lastHitAt: recentRecords[0]?.createdAt ?? null,
    latestRecord: recentRecords[0] ?? null,
    recentRecords: recentRecords.slice(0, 10),
  };
}

export function ProxyForwardPage() {
  const { showToast } = useToast();
  const [groups, setGroups] = useState<StoredGroup[]>([fallbackGroup]);
  const [activeGroupId, setActiveGroupId] = useState(fallbackGroup.id);
  const [requests, setRequests] = useState<RequestRecord[]>([]);
  const [groupSearch, setGroupSearch] = useState("");
  const [ruleSearch, setRuleSearch] = useState("");
  const [filterMode, setFilterMode] = useState<FilterMode>("all");
  const [sortMode, setSortMode] = useState<SortMode>("updated");
  const [collapsedHosts, setCollapsedHosts] = useState<Record<string, boolean>>({});
  const [drawerRule, setDrawerRule] = useState<RuleView | null>(null);
  const [menuGroupId, setMenuGroupId] = useState<string | null>(null);
  const [headerMenuOpen, setHeaderMenuOpen] = useState(false);
  const [editingRule, setEditingRule] = useState<StoredForwardRule | null>(null);
  const [editingGroup, setEditingGroup] = useState<StoredGroup | null>(null);
  const [isRuleModalOpen, setIsRuleModalOpen] = useState(false);
  const [isGroupModalOpen, setIsGroupModalOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [ruleForm, setRuleForm] = useState({
    name: "",
    pattern: "",
    action: "proxy" as RuleAction,
    enabled: true,
  });
  const [groupName, setGroupName] = useState("");

  const persistGroups = (nextGroups: StoredGroup[], nextActiveGroupId: string) => {
    setGroups(nextGroups);
    setActiveGroupId(nextActiveGroupId);
    writeStorage(groupsStorageKey, nextGroups);
    writeStorage(activeGroupStorageKey, nextActiveGroupId);
  };

  const load = async () => {
    const [rulesResult, trafficResult] = await Promise.allSettled([
      apiClient.listProxyRules(),
      apiClient.listRequests(),
    ]);

    const backendRules = rulesResult.status === "fulfilled" ? rulesResult.value : [];
    const traffic = trafficResult.status === "fulfilled" ? trafficResult.value : [];

    const normalized = normalizeGroups(
      readStorage<StoredGroup[]>(groupsStorageKey, []),
      backendRules,
      readStorage<string | null>(activeGroupStorageKey, null),
    );

    persistGroups(normalized.groups, normalized.activeGroupId);
    setRequests(traffic);

    if (rulesResult.status === "rejected" || trafficResult.status === "rejected") {
      let message = "数据加载失败";
      if (rulesResult.status === "rejected") {
        message =
          rulesResult.reason instanceof Error
            ? rulesResult.reason.message
            : "代理规则加载失败";
      } else if (trafficResult.status === "rejected") {
        message =
          trafficResult.reason instanceof Error
            ? trafficResult.reason.message
            : "流量数据加载失败";
      }

      showToast(`部分数据加载失败：${message}`, "error");
    }
  };

  useEffect(() => {
    load().catch(console.error);
  }, []);

  const visibleGroups = useMemo(() => {
    const keyword = groupSearch.trim().toLowerCase();
    return groups.filter((group) => !keyword || group.name.toLowerCase().includes(keyword));
  }, [groupSearch, groups]);

  const activeGroup =
    groups.find((group) => group.id === activeGroupId) ?? groups[0] ?? null;

  const rules = useMemo(() => {
    if (!activeGroup) {
      return [];
    }

    return activeGroup.rules.map((rule) => buildRuleStats(rule, requests));
  }, [activeGroup, requests]);

  const filteredRules = useMemo(() => {
    const keyword = ruleSearch.trim().toLowerCase();
    const nextRules = rules.filter((rule) => {
      if (keyword) {
        const haystack = `${rule.name} ${rule.pattern}`.toLowerCase();
        if (!haystack.includes(keyword)) {
          return false;
        }
      }

      if (filterMode === "enabled" && !rule.enabled) {
        return false;
      }

      if (filterMode === "hits" && rule.hitCountToday === 0) {
        return false;
      }

      if (filterMode === "errors" && rule.recentErrorCount === 0) {
        return false;
      }

      return true;
    });

    nextRules.sort((left, right) => {
      if (sortMode === "hits") {
        return right.hitCountToday - left.hitCountToday;
      }

      if (sortMode === "created") {
        return new Date(right.createdAt).getTime() - new Date(left.createdAt).getTime();
      }

      return new Date(right.updatedAt).getTime() - new Date(left.updatedAt).getTime();
    });

    return nextRules;
  }, [filterMode, ruleSearch, rules, sortMode]);

  const urlBlocks = useMemo(() => {
    return filteredRules.map((rule) => ({
      key: rule.pattern,
      fullUrl: `https://${rule.pattern}/*`,
      host: rule.pattern,
      rules: [rule],
    }));
  }, [filteredRules]);

  const overview = useMemo(() => {
    const total = activeGroup?.rules.length ?? 0;
    const enabled = activeGroup?.rules.filter((rule) => rule.enabled).length ?? 0;
    const hits = rules.reduce((sum, rule) => sum + rule.hitCountToday, 0);
    const errors = rules.reduce((sum, rule) => sum + rule.recentErrorCount, 0);
    return { total, enabled, hits, errors };
  }, [activeGroup, rules]);

  const syncGroups = (nextGroups: StoredGroup[], nextActiveGroupId = activeGroupId) => {
    persistGroups(nextGroups, nextActiveGroupId);
  };

  const handleSelectGroup = async (groupId: string) => {
    if (groupId === activeGroupId) {
      return;
    }

    const nextGroup = groups.find((group) => group.id === groupId);
    if (!nextGroup) {
      return;
    }

    setSubmitting(true);
    try {
      await applyGroupToBackend(nextGroup);
      await load();
      persistGroups(
        normalizeGroups(
          readStorage<StoredGroup[]>(groupsStorageKey, groups),
          await apiClient.listProxyRules(),
          groupId,
        ).groups,
        groupId,
      );
      showToast("分组已切换", "success");
    } catch (error) {
      console.error(error);
      showToast(
        `切换失败：${error instanceof Error ? error.message : "分组切换失败"}`,
        "error",
      );
    } finally {
      setSubmitting(false);
    }
  };

  const updateRuleInGroups = (nextRule: StoredForwardRule) => {
    syncGroups(
      groups.map((group) => {
        if (group.id !== activeGroupId) {
          return group;
        }

        const exists = group.rules.some((rule) => rule.id === nextRule.id);
        return {
          ...group,
          rules: exists
            ? group.rules.map((rule) => (rule.id === nextRule.id ? nextRule : rule))
            : [nextRule, ...group.rules],
        };
      }),
    );
  };

  const handleToggleRule = async (rule: RuleView, checked: boolean) => {
    updateRuleInGroups({
      ...rule,
      enabled: checked,
      updatedAt: new Date().toISOString(),
    });

    try {
      if (checked) {
        await apiClient.upsertSiteRule(rule.pattern, rule.action);
      } else {
        await apiClient.removeSiteRule(rule.pattern);
      }
      await load();
    } catch (error) {
      console.error(error);
      await load();
      showToast(
        `状态更新失败：${error instanceof Error ? error.message : "规则状态更新失败"}`,
        "error",
      );
    }
  };

  const handleDeleteRule = async (rule: StoredForwardRule) => {
    syncGroups(
      groups.map((group) => {
        if (group.id !== activeGroupId) {
          return group;
        }
        return { ...group, rules: group.rules.filter((item) => item.id !== rule.id) };
      }),
    );

    try {
      if (rule.enabled) {
        await apiClient.removeSiteRule(rule.pattern);
      }
      await load();
      showToast(`规则已删除：${rule.pattern}`, "success");
    } catch (error) {
      console.error(error);
      await load();
      showToast(
        `删除失败：${error instanceof Error ? error.message : "规则删除失败"}`,
        "error",
      );
    }
  };

  const openCreateRule = () => {
    setEditingRule(null);
    setRuleForm({ name: "", pattern: "", action: "proxy", enabled: true });
    setIsRuleModalOpen(true);
  };

  const openEditRule = (rule: StoredForwardRule) => {
    setEditingRule(rule);
    setRuleForm({
      name: rule.name,
      pattern: rule.pattern,
      action: rule.action,
      enabled: rule.enabled,
    });
    setIsRuleModalOpen(true);
  };

  const handleSaveRule = async () => {
    if (!activeGroup) {
      return;
    }

    const pattern = ruleForm.pattern.trim().toLowerCase();
    if (!pattern) {
      showToast("请填写站点，例如 api.example.com", "error");
      return;
    }

    try {
      const nextRule: StoredForwardRule = {
        id: editingRule?.id ?? createId("proxy-rule"),
        name: ruleForm.name.trim() || pattern,
        pattern,
        action: ruleForm.action,
        enabled: ruleForm.enabled,
        createdAt: editingRule?.createdAt ?? new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      syncGroups(
        groups.map((group) => {
          if (group.id !== activeGroup.id) {
            return group;
          }

          const duplicated = group.rules.some((rule) => {
            return rule.pattern === pattern && rule.id !== editingRule?.id;
          });
          if (duplicated) {
            throw new Error("当前分组中已存在相同站点");
          }

          const exists = group.rules.some((rule) => rule.id === nextRule.id);
          return {
            ...group,
            rules: exists
              ? group.rules.map((rule) => (rule.id === nextRule.id ? nextRule : rule))
              : [nextRule, ...group.rules],
          };
        }),
      );

      setSubmitting(true);
      if (nextRule.enabled) {
        await apiClient.upsertSiteRule(nextRule.pattern, nextRule.action);
      } else if (editingRule?.enabled) {
        await apiClient.removeSiteRule(editingRule.pattern);
      }
      await load();
      setIsRuleModalOpen(false);
      showToast(
        `${editingRule ? "规则已更新" : "规则已创建"}：${nextRule.pattern}`,
        "success",
      );
    } catch (error) {
      console.error(error);
      await load();
      showToast(
        `${editingRule ? "更新失败" : "创建失败"}：${error instanceof Error ? error.message : "规则保存失败"}`,
        "error",
      );
    } finally {
      setSubmitting(false);
    }
  };

  const handleSaveGroup = async () => {
    const nextName = groupName.trim();
    if (!nextName) {
      showToast("请填写分组名称", "error");
      return;
    }

    if (editingGroup) {
      syncGroups(
        groups.map((group) =>
          group.id === editingGroup.id ? { ...group, name: nextName } : group,
        ),
      );
      setIsGroupModalOpen(false);
      return;
    }

    syncGroups([...groups, { id: createId("proxy-group"), name: nextName, rules: [] }]);
    setIsGroupModalOpen(false);
  };

  const handleDeleteGroup = async (groupId: string) => {
    if (groups.length <= 1) {
      showToast("至少保留一个分组", "error");
      return;
    }

    const nextGroups = groups.filter((group) => group.id !== groupId);
    const nextActiveGroupId =
      activeGroupId === groupId ? nextGroups[0]?.id ?? "" : activeGroupId;
    syncGroups(nextGroups, nextActiveGroupId);

    if (activeGroupId === groupId && nextGroups[0]) {
      try {
        await applyGroupToBackend(nextGroups[0]);
        await load();
      } catch (error) {
        console.error(error);
        showToast(
          `删除失败：${error instanceof Error ? error.message : "分组删除失败"}`,
          "error",
        );
      }
    }
  };

  const buildGroupMenu = (group: StoredGroup): MenuProps["items"] => [
    {
      key: "rename",
      label: "重命名分组",
      onClick: () => {
        setEditingGroup(group);
        setGroupName(group.name);
        setIsGroupModalOpen(true);
      },
    },
    {
      key: "delete",
      label: "删除分组",
      danger: true,
      onClick: () => handleDeleteGroup(group.id),
    },
  ];

  const buildRuleMenu = (rule: StoredForwardRule): MenuProps["items"] => [
    {
      key: "remove",
      label: "删除规则",
      danger: true,
      onClick: () => handleDeleteRule(rule),
    },
  ];

  return (
    <div className={styles.page}>
      <header className={styles.header}>
        <div className={styles.headerCopy}>
          <span className={styles.pageEyebrow}>代理转发</span>
          <h2>代理转发</h2>
          <p>管理站点级转发规则、运行状态和最近命中流量。</p>
        </div>
      </header>

      <div className={styles.workspace}>
        <aside className={styles.sidebar}>
          <div className={styles.sidebarHeader}>
            <div>
              <span className={styles.sectionLabel}>分组</span>
              <strong>分组</strong>
            </div>
            <Button
              onClick={() => {
                setEditingGroup(null);
                setGroupName("");
                setIsGroupModalOpen(true);
              }}
            >
              新建分组
            </Button>
          </div>

          <Input
            value={groupSearch}
            onChange={(event) => setGroupSearch(event.target.value)}
            placeholder="搜索分组"
            className={styles.searchInput}
          />

          <div className={styles.groupList}>
            {visibleGroups.map((group) => {
              const isActive = group.id === activeGroupId;
              const enabledCount = group.rules.filter((rule) => rule.enabled).length;
              return (
                <div
                  key={group.id}
                  className={classNames(
                    styles.groupItem,
                    isActive && styles.groupItemActive,
                    menuGroupId === group.id && styles.groupItemOpen,
                  )}
                >
                  <button
                    type="button"
                    className={styles.groupSelect}
                    onClick={() => handleSelectGroup(group.id)}
                    disabled={submitting}
                  >
                    <div className={styles.groupMain}>
                      <div className={styles.groupTitleRow}>
                        <span
                          className={classNames(
                            styles.groupStatusDot,
                            isActive && styles.groupStatusDotActive,
                          )}
                        />
                        <strong>{group.name}</strong>
                      </div>
                      <div className={styles.groupMeta}>{`${group.rules.length} 条规则`}</div>
                    </div>
                    <Tag
                      bordered={false}
                      className={classNames(
                        styles.statusBadge,
                        isActive ? styles.statusBadgeSuccess : styles.statusBadgeMuted,
                      )}
                    >
                      {isActive ? "生效中" : enabledCount > 0 ? "待生效" : "未生效"}
                    </Tag>
                  </button>

                  <Dropdown
                    menu={{ items: buildGroupMenu(group) }}
                    trigger={["click"]}
                    onOpenChange={(open) => setMenuGroupId(open ? group.id : null)}
                  >
                    <Button
                      className={classNames(styles.iconButton, styles.moreButton)}
                      onClick={(event) => event.stopPropagation()}
                    >
                      ...
                    </Button>
                  </Dropdown>
                </div>
              );
            })}
          </div>
        </aside>

        <section className={styles.main}>
          <div className={styles.overview}>
            <div className={styles.overviewCopy}>
              <div className={styles.overviewTitle}>
                <h2>{activeGroup?.name ?? "暂无分组"}</h2>
                <Tag
                  bordered={false}
                  className={classNames(
                    styles.statusBadge,
                    activeGroup ? styles.statusBadgeSuccess : styles.statusBadgeMuted,
                  )}
                >
                  {activeGroup ? "生效中" : "未生效"}
                </Tag>
              </div>
              <p>仅当前分组生效，切换分组即切换整组代理能力。</p>
            </div>

            <div className={styles.metricStrip}>
              <article className={styles.metricCard}>
                <span>规则总数</span>
                <strong>{overview.total}</strong>
              </article>
              <article className={styles.metricCard}>
                <span>启用规则</span>
                <strong>{overview.enabled}</strong>
              </article>
              <article className={styles.metricCard}>
                <span>今日命中</span>
                <strong>{overview.hits}</strong>
              </article>
              <article className={styles.metricCard}>
                <span>最近错误</span>
                <strong>{overview.errors}</strong>
              </article>
            </div>

            <div className={styles.overviewActions}>
              <Button type="primary" onClick={openCreateRule}>
                新建转发规则
              </Button>
              <Button
                onClick={() => {
                  if (!activeGroup) {
                    return;
                  }
                  setEditingGroup(activeGroup);
                  setGroupName(activeGroup.name);
                  setIsGroupModalOpen(true);
                }}
              >
                编辑分组
              </Button>
              <Dropdown
                open={headerMenuOpen}
                onOpenChange={setHeaderMenuOpen}
                menu={{
                  items: [
                    {
                      key: "refresh",
                      label: "刷新数据",
                      onClick: () => load().catch(console.error),
                    },
                  ],
                }}
                trigger={["click"]}
              >
                <Button
                  className={styles.iconButton}
                  onClick={(event) => event.stopPropagation()}
                >
                  ...
                </Button>
              </Dropdown>
            </div>
          </div>

          <Card className={styles.toolbarCard} bordered={false}>
            <div className={styles.toolbar}>
              <Input.Search
                allowClear
                value={ruleSearch}
                onChange={(event) => setRuleSearch(event.target.value)}
                placeholder="搜索站点或规则名称"
              />
              <Segmented<FilterMode>
                value={filterMode}
                onChange={(value) => setFilterMode(value)}
                options={[
                  { label: "全部", value: "all" },
                  { label: "启用中", value: "enabled" },
                  { label: "最近命中", value: "hits" },
                  { label: "有错误", value: "errors" },
                ]}
              />
              <Select<SortMode>
                value={sortMode}
                onChange={setSortMode}
                options={[
                  { label: "最近更新", value: "updated" },
                  { label: "最近命中", value: "hits" },
                  { label: "创建时间", value: "created" },
                ]}
              />
            </div>
          </Card>

          <div className={styles.rulePanel}>
            {urlBlocks.map((block) => {
              const collapsed = collapsedHosts[block.key] === true;
              return (
                <Card key={block.key} className={styles.urlBlock} bordered={false}>
                  <button
                    type="button"
                    className={styles.urlBlockHeader}
                    onClick={() =>
                      setCollapsedHosts((current) => ({
                        ...current,
                        [block.key]: !collapsed,
                      }))
                    }
                  >
                    <div className={styles.urlBlockCopy}>
                      <strong>{block.fullUrl}</strong>
                      <span>{block.host}</span>
                    </div>
                    <div className={styles.urlBlockMeta}>
                      <Tag bordered={false} className={styles.sectionBadge}>
                        {`${block.rules.length} 条规则`}
                      </Tag>
                      <span className={styles.collapseLabel}>
                        {collapsed ? "展开" : "收起"}
                      </span>
                    </div>
                  </button>

                  {!collapsed ? (
                    <div className={styles.ruleList}>
                      {block.rules.map((rule) => (
                        <div key={rule.id} className={styles.ruleRow}>
                          <div className={styles.ruleSwitch}>
                            <Switch
                              checked={rule.enabled}
                              onChange={(checked) => handleToggleRule(rule, checked)}
                            />
                          </div>

                          <div className={styles.ruleRequest}>
                            <div className={styles.ruleRequestTop}>
                              <Tag className={styles.methodTag} bordered={false}>
                                站点
                              </Tag>
                              <strong>{rule.name}</strong>
                            </div>
                            <span>{`https://${rule.pattern}/*`}</span>
                          </div>

                          <div className={styles.ruleColumn}>
                            <span className={styles.columnLabel}>匹配条件</span>
                            <strong>Host 匹配 · 查询继承原请求 · 请求头继承原请求 · 请求体继承原请求</strong>
                          </div>

                          <div className={styles.ruleColumn}>
                            <span className={styles.columnLabel}>转发动作</span>
                            <strong>
                              {rule.action === "proxy" ? "转发到 Polaris 代理链路" : "直连目标站点"}
                            </strong>
                            <small>
                              {rule.action === "proxy"
                                ? "保留原始 Host 与 Path"
                                : "不进入本地代理处理"}
                            </small>
                          </div>

                          <div className={styles.ruleColumn}>
                            <span className={styles.columnLabel}>运行状态</span>
                            <strong>{`今日命中 ${rule.hitCountToday}`}</strong>
                            <small>{`最近错误 ${rule.recentErrorCount} · 最近命中 ${formatTime(rule.lastHitAt)}`}</small>
                          </div>

                          <div className={styles.ruleActions}>
                            <Button onClick={() => openEditRule(rule)}>编辑</Button>
                            <Button onClick={() => setDrawerRule(rule)}>查看流量</Button>
                            <Dropdown menu={{ items: buildRuleMenu(rule) }} trigger={["click"]}>
                              <Button
                                className={styles.iconButton}
                                onClick={(event) => event.stopPropagation()}
                              >
                                ...
                              </Button>
                            </Dropdown>
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : null}
                </Card>
              );
            })}

            {urlBlocks.length === 0 ? (
              <Card className={styles.emptyCard} bordered={false}>
                <strong>暂无规则</strong>
                <p>可以先新建一个站点级转发规则，或切换到其他分组查看。</p>
              </Card>
            ) : null}
          </div>
        </section>
      </div>

      <Drawer
        width={540}
        open={!!drawerRule}
        onClose={() => setDrawerRule(null)}
        title={drawerRule ? `流量详情 · ${drawerRule.name}` : "流量详情"}
      >
        {drawerRule ? (
          <div className={styles.drawerBody}>
            <Card className={styles.drawerSection} bordered={false}>
              <div className={styles.drawerSectionHeader}>
                <span>命中概览</span>
                <Badge
                  status={drawerRule.recentErrorCount > 0 ? "error" : "success"}
                  text={drawerRule.recentErrorCount > 0 ? "最近有错误" : "运行正常"}
                />
              </div>
              <div className={styles.drawerMetaList}>
                <div>
                  <span>站点规则</span>
                  <strong>{drawerRule.pattern}</strong>
                </div>
                <div>
                  <span>转发动作</span>
                  <strong>{drawerRule.action === "proxy" ? "经 Polaris 转发" : "直连"}</strong>
                </div>
                <div>
                  <span>最近命中</span>
                  <strong>{formatTime(drawerRule.lastHitAt)}</strong>
                </div>
                <div>
                  <span>最近错误</span>
                  <strong>{drawerRule.recentErrorCount}</strong>
                </div>
              </div>
            </Card>

            <Card className={styles.drawerSection} bordered={false}>
              <div className={styles.drawerSectionHeader}>
                <span>最近一次请求</span>
              </div>
              <div className={styles.drawerMetaList}>
                <div>
                  <span>原始请求</span>
                  <strong>{drawerRule.latestRecord?.url ?? "暂无"}</strong>
                </div>
                <div>
                  <span>响应状态</span>
                  <strong>{drawerRule.latestRecord?.statusCode ?? "-"}</strong>
                </div>
                <div>
                  <span>请求耗时</span>
                  <strong>{drawerRule.latestRecord ? `${drawerRule.latestRecord.duration} ms` : "-"}</strong>
                </div>
                <div>
                  <span>来源</span>
                  <strong>{drawerRule.latestRecord?.source === "debug" ? "调试" : "代理"}</strong>
                </div>
              </div>
            </Card>

            <Card className={styles.drawerSection} bordered={false}>
              <div className={styles.drawerSectionHeader}>
                <span>转发后的请求头</span>
              </div>
              <div className={styles.headerList}>
                {drawerRule.latestRecord ? (
                  Object.entries(drawerRule.latestRecord.requestHeaders).map(([key, value]) => (
                    <div key={key} className={styles.headerRow}>
                      <span>{key}</span>
                      <strong>{String(value)}</strong>
                    </div>
                  ))
                ) : (
                  <p className={styles.emptyInline}>暂无请求头记录</p>
                )}
              </div>
            </Card>

            <Card className={styles.drawerSection} bordered={false}>
              <div className={styles.drawerSectionHeader}>
                <span>最近命中记录</span>
              </div>
              <div className={styles.trafficTimeline}>
                {drawerRule.recentRecords.length > 0 ? (
                  drawerRule.recentRecords.map((record) => (
                    <div key={record.id} className={styles.trafficItem}>
                      <div className={styles.trafficDot} />
                      <div className={styles.trafficCard}>
                        <div className={styles.trafficCardTop}>
                          <strong>{formatTime(record.createdAt)}</strong>
                          <Tag
                            bordered={false}
                            className={classNames(
                              styles.statusBadge,
                              record.statusCode >= 400
                                ? styles.statusBadgeDanger
                                : styles.statusBadgeSuccess,
                            )}
                          >
                            {record.statusCode}
                          </Tag>
                        </div>
                        <p>{record.url}</p>
                        <small>
                          {record.statusCode >= 400
                            ? "最近一次命中返回了错误响应"
                            : "请求已按当前代理规则完成转发"}
                        </small>
                      </div>
                    </div>
                  ))
                ) : (
                  <p className={styles.emptyInline}>暂无命中记录</p>
                )}
              </div>
            </Card>
          </div>
        ) : null}
      </Drawer>

      <Modal
        title={editingRule ? "编辑转发规则" : "新建转发规则"}
        open={isRuleModalOpen}
        onCancel={() => setIsRuleModalOpen(false)}
        onOk={handleSaveRule}
        okText={editingRule ? "保存修改" : "创建规则"}
        cancelText="取消"
        confirmLoading={submitting}
      >
        <div className={styles.modalForm}>
          <label className={styles.modalField}>
            <span>规则名称</span>
            <Input
              value={ruleForm.name}
              onChange={(event) =>
                setRuleForm((current) => ({ ...current, name: event.target.value }))
              }
              placeholder="例如：网关联调"
            />
          </label>
          <label className={styles.modalField}>
            <span>站点</span>
            <Input
              value={ruleForm.pattern}
              onChange={(event) =>
                setRuleForm((current) => ({ ...current, pattern: event.target.value }))
              }
              placeholder="例如：api.example.com"
            />
          </label>
          <label className={styles.modalField}>
            <span>转发动作</span>
            <Select
              value={ruleForm.action}
              onChange={(value) =>
                setRuleForm((current) => ({ ...current, action: value }))
              }
              options={[
                { label: "经 Polaris 转发", value: "proxy" },
                { label: "直连", value: "direct" },
              ]}
            />
          </label>
          <div className={styles.modalSwitchRow}>
            <div>
              <strong>规则状态</strong>
              <p>仅控制当前分组内这条规则是否启用。</p>
            </div>
            <Switch
              checked={ruleForm.enabled}
              onChange={(checked) =>
                setRuleForm((current) => ({ ...current, enabled: checked }))
              }
            />
          </div>
        </div>
      </Modal>

      <Modal
        title={editingGroup ? "编辑分组" : "新建分组"}
        open={isGroupModalOpen}
        onCancel={() => setIsGroupModalOpen(false)}
        onOk={handleSaveGroup}
        okText={editingGroup ? "保存修改" : "创建分组"}
        cancelText="取消"
      >
        <label className={styles.modalField}>
          <span>分组名称</span>
          <Input value={groupName} onChange={(event) => setGroupName(event.target.value)} />
        </label>
      </Modal>
    </div>
  );
}
