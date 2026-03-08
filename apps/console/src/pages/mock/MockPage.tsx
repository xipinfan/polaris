import { useEffect, useMemo, useRef, useState } from "react";
import { useLocation } from "react-router-dom";
import type { MockRule, RequestRecord } from "@polaris/shared-types";
import { JsonBlock } from "../../features/common/JsonBlock";
import { KeyValueBlock } from "../../features/common/KeyValueBlock";
import { UiSlotPlaceholder } from "../../features/slots/UiSlotPlaceholder";
import { useConsoleI18n } from "../../i18n/I18nProvider";
import { apiClient } from "../../services/apiClient";

const groupNamePattern = /^\[(.+?)\]\s*(.+)$/;
const groupsStorageKey = "polaris.console.mock.groups";
const activeGroupStorageKey = "polaris.console.mock.active-group";
const disabledRulesStorageKey = "polaris.console.mock.disabled-rules";

const emptyForm = {
  variant: "",
  method: "GET",
  url: "",
  responseStatus: 200,
  responseHeaders: "{}",
  responseBody: "{}",
  enabled: true,
};

type MockPageLocationState = {
  seedRequest?: RequestRecord;
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
    return {
      group: defaultGroup,
      variant: rule.name,
    };
  }

  return {
    group: match[1].trim() || defaultGroup,
    variant: match[2].trim() || rule.name,
  };
}

function buildRuleName(group: string, variant: string) {
  return `[${group.trim()}] ${variant.trim()}`;
}

export function MockPage() {
  const [rules, setRules] = useState<MockRule[]>([]);
  const [selectedGroup, setSelectedGroup] = useState<string>("");
  const [customGroups, setCustomGroups] = useState<string[]>([]);
  const [disabledRuleIdsByGroup, setDisabledRuleIdsByGroup] =
    useState<Record<string, string[]>>({});
  const [selectedRuleId, setSelectedRuleId] = useState<string | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [newGroupName, setNewGroupName] = useState("");
  const [message, setMessage] = useState("");
  const { t } = useConsoleI18n();
  const location = useLocation();
  const locationState = location.state as MockPageLocationState | null;
  const initialSyncDoneRef = useRef(false);
  const defaultGroup = t("mock.defaultGroup");

  const load = () =>
    apiClient.listMockRules().then(setRules).catch(console.error);

  useEffect(() => {
    setCustomGroups(readStorage<string[]>(groupsStorageKey, []));
    setDisabledRuleIdsByGroup(
      readStorage<Record<string, string[]>>(disabledRulesStorageKey, {}),
    );

    const storedActiveGroup = readStorage<string>(
      activeGroupStorageKey,
      defaultGroup,
    );
    setSelectedGroup(storedActiveGroup || defaultGroup);
    load();
  }, [defaultGroup]);

  useEffect(() => {
    writeStorage(groupsStorageKey, customGroups);
  }, [customGroups]);

  useEffect(() => {
    writeStorage(disabledRulesStorageKey, disabledRuleIdsByGroup);
  }, [disabledRuleIdsByGroup]);

  const groupedRules = useMemo(() => {
    return rules.reduce<Record<string, MockRule[]>>((acc, rule) => {
      const { group } = getRuleScene(rule, defaultGroup);
      acc[group] = [...(acc[group] ?? []), rule];
      return acc;
    }, {});
  }, [defaultGroup, rules]);

  const groups = useMemo(() => {
    const discoveredGroups = Object.keys(groupedRules);
    return Array.from(
      new Set([defaultGroup, ...customGroups, ...discoveredGroups]),
    );
  }, [customGroups, defaultGroup, groupedRules]);

  useEffect(() => {
    if (groups.length === 0) {
      return;
    }

    if (!selectedGroup || !groups.includes(selectedGroup)) {
      setSelectedGroup(defaultGroup);
    }
  }, [defaultGroup, groups, selectedGroup]);

  const currentGroup = groups.includes(selectedGroup)
    ? selectedGroup
    : defaultGroup;
  const activeGroupRules = [...(groupedRules[currentGroup] ?? [])].sort(
    (left, right) =>
      new Date(right.updatedAt).getTime() - new Date(left.updatedAt).getTime(),
  );
  const selectedRule =
    activeGroupRules.find((rule) => rule.id === selectedRuleId) ??
    activeGroupRules[0];
  const selectedScene = selectedRule
    ? getRuleScene(selectedRule, defaultGroup)
    : null;

  useEffect(() => {
    if (activeGroupRules.length === 0) {
      setSelectedRuleId(null);
      return;
    }

    if (!selectedRuleId || !activeGroupRules.some((rule) => rule.id === selectedRuleId)) {
      setSelectedRuleId(activeGroupRules[0].id);
    }
  }, [activeGroupRules, selectedRuleId]);

  const metrics = useMemo(() => {
    const enabledCount = rules.filter((rule) => rule.enabled).length;
    const totalHits = rules.reduce((sum, rule) => sum + rule.hitCount, 0);
    return {
      groups: groups.length,
      total: rules.length,
      enabledCount,
      totalHits,
      currentGroupCount: activeGroupRules.length,
    };
  }, [activeGroupRules.length, groups.length, rules]);

  const syncGroupState = async (groupName: string) => {
    const disabledIds = new Set(disabledRuleIdsByGroup[groupName] ?? []);

    await Promise.all(
      rules.map(async (rule) => {
        const ruleGroup = getRuleScene(rule, defaultGroup).group;
        const shouldEnable =
          ruleGroup === groupName && !disabledIds.has(rule.id);

        if (rule.enabled === shouldEnable) {
          return;
        }

        await apiClient.enableMockRule(rule.id, shouldEnable);
      }),
    );

    writeStorage(activeGroupStorageKey, groupName);
    await load();
  };

  useEffect(() => {
    if (initialSyncDoneRef.current || rules.length === 0 || !currentGroup) {
      return;
    }

    initialSyncDoneRef.current = true;
    syncGroupState(currentGroup).catch(console.error);
  }, [currentGroup, rules]);

  useEffect(() => {
    const seedRequest = locationState?.seedRequest;
    if (!seedRequest) {
      return;
    }

    setEditingId(null);
    setForm({
      variant: `${seedRequest.method} ${seedRequest.path}`,
      method: seedRequest.method,
      url: seedRequest.url,
      responseStatus: seedRequest.statusCode,
      responseHeaders: JSON.stringify(seedRequest.responseHeaders, null, 2),
      responseBody: JSON.stringify(seedRequest.responseBody ?? {}, null, 2),
      enabled: true,
    });
    setMessage(t("mock.seeded", { host: seedRequest.host, group: currentGroup }));
    window.history.replaceState(
      window.history.state,
      document.title,
      location.pathname,
    );
  }, [currentGroup, location.pathname, locationState?.seedRequest, t]);

  const switchGroup = async (groupName: string) => {
    setSelectedGroup(groupName);
    await syncGroupState(groupName);
    setMessage(t("mock.groupSwitched", { name: groupName }));
  };

  const submit = async () => {
    try {
      const payload = {
        name: buildRuleName(currentGroup, form.variant),
        method: form.method,
        url: form.url,
        responseStatus: Number(form.responseStatus),
        responseHeaders: JSON.parse(form.responseHeaders || "{}"),
        responseBody: JSON.parse(form.responseBody || "{}"),
        enabled: form.enabled,
      };

      if (editingId) {
        await apiClient.updateMockRule(editingId, payload);
        setMessage(t("common.mockUpdated", { name: form.variant }));
      } else {
        await apiClient.createMockRule(payload);
        setMessage(
          t("common.mockCreatedInGroup", {
            name: form.variant,
            group: currentGroup,
          }),
        );
      }

      if (!form.enabled) {
        setDisabledRuleIdsByGroup((current) => {
          const next = new Set(current[currentGroup] ?? []);
          return { ...current, [currentGroup]: [...next] };
        });
      }

      setEditingId(null);
      setForm(emptyForm);
      await load();
      await syncGroupState(currentGroup);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : String(error));
    }
  };

  const startEdit = (rule: MockRule) => {
    const scene = getRuleScene(rule, defaultGroup);
    setSelectedRuleId(rule.id);
    setEditingId(rule.id);
    setForm({
      variant: scene.variant,
      method: rule.method,
      url: rule.url,
      responseStatus: rule.responseStatus,
      responseHeaders: JSON.stringify(rule.responseHeaders, null, 2),
      responseBody: JSON.stringify(rule.responseBody ?? {}, null, 2),
      enabled: rule.enabled,
    });
  };

  const duplicate = async (rule: MockRule) => {
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

    setDisabledRuleIdsByGroup((current) => {
      const next = new Set(current[currentGroup] ?? []);
      return { ...current, [currentGroup]: [...next] };
    });
    setMessage(t("common.mockDuplicated", { name: scene.variant }));
    await load();
    await syncGroupState(currentGroup);
  };

  const toggleRule = async (rule: MockRule) => {
    const scene = getRuleScene(rule, defaultGroup);
    const nextEnabled = !rule.enabled;

    await apiClient.enableMockRule(rule.id, nextEnabled);
    setDisabledRuleIdsByGroup((current) => {
      const next = new Set(current[currentGroup] ?? []);
      if (nextEnabled) {
        next.delete(rule.id);
      } else {
        next.add(rule.id);
      }
      return { ...current, [currentGroup]: [...next] };
    });

    setMessage(
      nextEnabled
        ? t("common.mockEnabled", { name: scene.variant })
        : t("common.mockDisabled", { name: scene.variant }),
    );
    await load();
  };

  const removeRule = async (rule: MockRule) => {
    const scene = getRuleScene(rule, defaultGroup);
    await apiClient.deleteMockRule(rule.id);
    setDisabledRuleIdsByGroup((current) => {
      const next = new Set(current[currentGroup] ?? []);
      next.delete(rule.id);
      return { ...current, [currentGroup]: [...next] };
    });
    setMessage(t("common.mockDeleted", { name: scene.variant }));
    await load();
  };

  const createGroup = async () => {
    const normalized = newGroupName.trim();
    if (!normalized || groups.includes(normalized)) {
      return;
    }

    setCustomGroups((current) => [...current, normalized]);
    setNewGroupName("");
    setSelectedGroup(normalized);
    await syncGroupState(normalized);
    setMessage(t("mock.groupCreated", { name: normalized }));
  };

  return (
    <div className="page-stack mock-page-shell">
      <section className="page-header">
        <div>
          <h2>{t("mock.title")}</h2>
          <p>{t("mock.subtitle")}</p>
        </div>
        {message ? <div className="panel banner-panel">{message}</div> : null}
      </section>

      <UiSlotPlaceholder slot="mock-toolbar" />

      <section className="panel mock-current-group-bar">
        <div className="panel-heading">
          <div>
            <h3>{t("mock.currentGroupTitle")}</h3>
            <p>{t("mock.currentGroupBody")}</p>
          </div>
          <div className="mock-current-group-meta">
            <span className="status-badge">{currentGroup}</span>
            <span className="status-badge muted">
              {t("mock.metric.enabled")} {metrics.enabledCount}
            </span>
          </div>
        </div>
        <div className="mock-group-switcher">
          {groups.map((group) => (
            <button
              key={group}
              type="button"
              className={`workspace-list-item mock-group-chip ${group === currentGroup ? "active" : ""}`}
              onClick={() => switchGroup(group).catch(console.error)}
            >
              <strong>{group}</strong>
              <small>
                {t("mock.groupRequestCount", {
                  count: groupedRules[group]?.length ?? 0,
                })}
              </small>
            </button>
          ))}
        </div>
        <div className="toolbar toolbar-grid mock-group-create">
          <input
            value={newGroupName}
            onChange={(event) => setNewGroupName(event.target.value)}
            placeholder={t("mock.groupPlaceholder")}
          />
          <button
            type="button"
            className="primary-action"
            onClick={() => createGroup().catch(console.error)}
          >
            {t("mock.groupCreate")}
          </button>
        </div>
      </section>

      <section className="request-summary-bar panel">
        <div className="traffic-summary-strip">
          <span>{t("mock.metric.groups")} {metrics.groups}</span>
          <span>{t("mock.metric.total")} {metrics.total}</span>
          <span>{t("mock.metric.currentGroup")} {metrics.currentGroupCount}</span>
          <span>{t("mock.metric.enabled")} {metrics.enabledCount}</span>
          <span>{t("mock.metric.hits")} {metrics.totalHits}</span>
        </div>
      </section>

      <section className="workspace-shell mock-workspace mock-pane-shell mock-shell-v2">
        <section className="panel mock-variant-pane">
          <div className="panel-heading">
            <div>
              <h3>{currentGroup}</h3>
              <p>{t("mock.workflowBody")}</p>
            </div>
          </div>
          {activeGroupRules.length === 0 ? (
            <div className="empty-card mock-empty-card">
              <h3>{t("mock.groupEmptyTitle")}</h3>
              <p>{t("mock.groupEmptyBody")}</p>
            </div>
          ) : (
            <div className="list">
              {activeGroupRules.map((rule) => {
                const scene = getRuleScene(rule, defaultGroup);
                return (
                  <div
                    key={rule.id}
                    className={`list-item mock-variant-card ${selectedRule?.id === rule.id ? "active" : ""}`}
                  >
                    <div className="list-row">
                      <strong>{scene.variant}</strong>
                      <span
                        className={`status-badge ${rule.enabled ? "" : "muted"}`}
                      >
                        {rule.enabled
                          ? t("mock.enabledState")
                          : t("mock.disabledState")}
                      </span>
                    </div>
                    <p>{rule.method} - {rule.url}</p>
                    <p>
                      {t("mock.hitsSummary", {
                        count: rule.hitCount,
                        time: rule.lastHitAt
                          ? new Date(rule.lastHitAt).toLocaleString()
                          : t("mock.lastHitNever"),
                      })}
                    </p>
                    <div className="button-grid compact-actions two-up">
                      <button
                        type="button"
                        className="ghost-button"
                        onClick={() => setSelectedRuleId(rule.id)}
                      >
                        {t("mock.inspect")}
                      </button>
                      <button
                        type="button"
                        onClick={() => toggleRule(rule).catch(console.error)}
                      >
                        {rule.enabled ? t("mock.disable") : t("mock.enable")}
                      </button>
                      <button
                        type="button"
                        className="ghost-button"
                        onClick={() => startEdit(rule)}
                      >
                        {t("mock.edit")}
                      </button>
                      <button
                        type="button"
                        className="ghost-button"
                        onClick={() => duplicate(rule).catch(console.error)}
                      >
                        {t("mock.duplicate")}
                      </button>
                      <button
                        type="button"
                        className="danger-button"
                        onClick={() => removeRule(rule).catch(console.error)}
                      >
                        {t("mock.delete")}
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </section>

        <div className="mock-editor-layout">
          <form
            className="form-grid mock-form-panel mock-editor-pane"
            onSubmit={(event) => {
              event.preventDefault();
              submit().catch(console.error);
            }}
          >
            <div className="panel-heading">
              <div>
                <h3>{editingId ? t("mock.form.edit") : t("mock.form.new")}</h3>
                <p>
                  {editingId
                    ? t("mock.form.editing", { name: form.variant || "-" })
                    : t("mock.form.body")}
                </p>
              </div>
            </div>
            <div className="mock-context-card">
              <span>{t("mock.form.group")}</span>
              <strong>{currentGroup}</strong>
              <small>{t("mock.form.groupBody")}</small>
            </div>
            <input
              value={form.variant}
              onChange={(event) =>
                setForm({ ...form, variant: event.target.value })
              }
              placeholder={t("mock.form.name")}
            />
            <select
              value={form.method}
              onChange={(event) =>
                setForm({ ...form, method: event.target.value })
              }
            >
              <option>GET</option>
              <option>POST</option>
              <option>PUT</option>
              <option>PATCH</option>
              <option>DELETE</option>
            </select>
            <input
              value={form.url}
              onChange={(event) => setForm({ ...form, url: event.target.value })}
              placeholder={t("mock.form.url")}
            />
            <input
              type="number"
              value={form.responseStatus}
              onChange={(event) =>
                setForm({
                  ...form,
                  responseStatus: Number(event.target.value),
                })
              }
              placeholder={t("mock.form.status")}
            />
            <textarea
              rows={5}
              value={form.responseHeaders}
              onChange={(event) =>
                setForm({ ...form, responseHeaders: event.target.value })
              }
              placeholder={t("mock.form.headers")}
            />
            <textarea
              rows={10}
              value={form.responseBody}
              onChange={(event) =>
                setForm({ ...form, responseBody: event.target.value })
              }
              placeholder={t("mock.form.bodyPlaceholder")}
            />
            <label className="checkbox-row">
              <input
                type="checkbox"
                checked={form.enabled}
                onChange={(event) =>
                  setForm({ ...form, enabled: event.target.checked })
                }
              />
              {t("mock.form.enableNow")}
            </label>
            <div className="button-grid compact-actions two-up">
              <button className="primary-action" type="submit">
                {editingId ? t("mock.form.saveChanges") : t("mock.form.save")}
              </button>
              <button
                type="button"
                className="ghost-button"
                onClick={() => {
                  setEditingId(null);
                  setForm(emptyForm);
                }}
              >
                {t("mock.form.clear")}
              </button>
            </div>
          </form>

          <section className="panel mock-preview-stack">
            <div className="panel-heading">
              <div>
                <h3>{t("mock.previewTitle")}</h3>
                <p>{t("mock.previewBody")}</p>
              </div>
            </div>
            {selectedRule ? (
              <>
                <div className="mock-context-card">
                  <span>{t("mock.selectedRule")}</span>
                  <strong>{selectedScene?.variant}</strong>
                  <small>{currentGroup}</small>
                </div>
                <div className="mock-preview-stat-grid">
                  <div className="mock-preview-stat">
                    <span>{t("traffic.column.method")}</span>
                    <strong>{selectedRule.method}</strong>
                  </div>
                  <div className="mock-preview-stat">
                    <span>{t("traffic.column.status")}</span>
                    <strong>{selectedRule.responseStatus}</strong>
                  </div>
                  <div className="mock-preview-stat">
                    <span>{t("mock.metric.enabled")}</span>
                    <strong>
                      {selectedRule.enabled
                        ? t("mock.enabledState")
                        : t("mock.disabledState")}
                    </strong>
                  </div>
                </div>
                <div className="mock-preview-url">{selectedRule.url}</div>
                <KeyValueBlock
                  title={t("mock.previewHeaders")}
                  value={selectedRule.responseHeaders}
                  copyMode="row"
                />
                <JsonBlock
                  title={t("mock.previewBodyTitle")}
                  value={selectedRule.responseBody}
                />
              </>
            ) : (
              <div className="empty-card mock-empty-card">
                <h3>{t("mock.previewEmptyTitle")}</h3>
                <p>{t("mock.previewEmptyBody")}</p>
              </div>
            )}
          </section>
        </div>
      </section>
    </div>
  );
}
