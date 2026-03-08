import { useEffect, useMemo, useState } from "react";
import type { MockRule } from "@polaris/shared-types";
import { useConsoleI18n } from "../../i18n/I18nProvider";
import { UiSlotPlaceholder } from "../../features/slots/UiSlotPlaceholder";
import { apiClient } from "../../services/apiClient";

const emptyForm = {
  name: "",
  method: "GET",
  url: "",
  responseStatus: 200,
  responseHeaders: "{}",
  responseBody: "{}",
  enabled: true
};

export function MockPage() {
  const [rules, setRules] = useState<MockRule[]>([]);
  const [selectedGroup, setSelectedGroup] = useState<string | null>(null);
  const [selectedRuleId, setSelectedRuleId] = useState<string | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [message, setMessage] = useState("");
  const { t } = useConsoleI18n();

  const groupedRules = useMemo(() => {
    return Object.entries(
      rules.reduce<Record<string, MockRule[]>>((acc, rule) => {
        const key = `${rule.method} ${rule.url}`;
        acc[key] = [...(acc[key] ?? []), rule];
        return acc;
      }, {})
    );
  }, [rules]);

  const metrics = useMemo(() => {
    const enabledCount = rules.filter((rule) => rule.enabled).length;
    const totalHits = rules.reduce((sum, rule) => sum + rule.hitCount, 0);
    return {
      total: rules.length,
      enabledCount,
      totalHits
    };
  }, [rules]);

  const load = () => apiClient.listMockRules().then(setRules).catch(console.error);

  useEffect(() => {
    load();
  }, []);

  useEffect(() => {
    if (groupedRules.length === 0) {
      setSelectedGroup(null);
      return;
    }

    if (!selectedGroup || !groupedRules.some(([group]) => group === selectedGroup)) {
      setSelectedGroup(groupedRules[0][0]);
    }
  }, [groupedRules, selectedGroup]);

  const activeGroupRules = groupedRules.find(([group]) => group === selectedGroup)?.[1] ?? [];
  const selectedRule = activeGroupRules.find((rule) => rule.id === selectedRuleId) ?? activeGroupRules[0];

  useEffect(() => {
    if (activeGroupRules.length === 0) {
      setSelectedRuleId(null);
      return;
    }

    if (!selectedRuleId || !activeGroupRules.some((rule) => rule.id === selectedRuleId)) {
      setSelectedRuleId(activeGroupRules[0].id);
    }
  }, [activeGroupRules, selectedRuleId]);

  const submit = async () => {
    const payload = {
      name: form.name,
      method: form.method,
      url: form.url,
      responseStatus: Number(form.responseStatus),
      responseHeaders: JSON.parse(form.responseHeaders || "{}"),
      responseBody: JSON.parse(form.responseBody || "{}"),
      enabled: form.enabled
    };

    if (editingId) {
      await apiClient.updateMockRule(editingId, payload);
      setMessage(t("common.mockUpdated", { name: form.name }));
    } else {
      await apiClient.createMockRule(payload);
      setMessage(t("common.mockCreated", { name: form.name }));
    }

    setEditingId(null);
    setForm(emptyForm);
    load();
  };

  const startEdit = (rule: MockRule) => {
    setSelectedRuleId(rule.id);
    setEditingId(rule.id);
    setForm({
      name: rule.name,
      method: rule.method,
      url: rule.url,
      responseStatus: rule.responseStatus,
      responseHeaders: JSON.stringify(rule.responseHeaders, null, 2),
      responseBody: JSON.stringify(rule.responseBody ?? {}, null, 2),
      enabled: rule.enabled
    });
  };

  const duplicate = async (rule: MockRule) => {
    await apiClient.createMockRule({
      name: `${rule.name} - copy`,
      method: rule.method,
      url: rule.url,
      responseStatus: rule.responseStatus,
      responseHeaders: rule.responseHeaders,
      responseBody: rule.responseBody,
      enabled: false
    });
    setMessage(t("common.mockDuplicated", { name: rule.name }));
    load();
  };

  const toggleRule = async (rule: MockRule) => {
    await apiClient.enableMockRule(rule.id, !rule.enabled);
    setMessage(rule.enabled ? t("common.mockDisabled", { name: rule.name }) : t("common.mockEnabled", { name: rule.name }));
    load();
  };

  const removeRule = async (rule: MockRule) => {
    await apiClient.deleteMockRule(rule.id);
    setMessage(t("common.mockDeleted", { name: rule.name }));
    load();
  };

  return (
    <div className="page-stack">
      <section className="page-header">
        <div>
          <h2>{t("mock.title")}</h2>
          <p>{t("mock.subtitle")}</p>
        </div>
        {message ? <div className="panel banner-panel">{message}</div> : null}
      </section>

      <UiSlotPlaceholder slot="mock-toolbar" />

      <section className="request-summary-bar panel">
        <div className="traffic-summary-strip">
          <span>{t("mock.metric.total")} {metrics.total}</span>
          <span>{t("mock.metric.enabled")} {metrics.enabledCount}</span>
          <span>{t("mock.metric.hits")} {metrics.totalHits}</span>
        </div>
      </section>

      {rules.length === 0 ? (
        <div className="empty-card">
          <h3>{t("mock.noneTitle")}</h3>
          <p>{t("mock.noneBody")}</p>
        </div>
      ) : (
        <section className="workspace-shell mock-workspace mock-pane-shell">
          <aside className="workspace-sidebar panel">
            <div className="panel-heading">
              <div>
                <h3>{t("mock.variantsTitle")}</h3>
                <p>{t("mock.variantsBody")}</p>
              </div>
            </div>
            <div className="workspace-list">
              {groupedRules.map(([group, items]) => (
                <button
                  key={group}
                  type="button"
                  className={`workspace-list-item ${selectedGroup === group ? "active" : ""}`}
                  onClick={() => setSelectedGroup(group)}
                >
                  <div className="workspace-list-topline">
                    <strong>{group}</strong>
                    <span className="status-badge muted">{t("mock.variantCount", { count: items.length })}</span>
                  </div>
                  <p>{items[0]?.name}</p>
                </button>
              ))}
            </div>
          </aside>

          <div className="workspace-detail mock-detail-grid">
            <section className="panel mock-variant-pane">
              <div className="panel-heading">
                <div>
                  <h3>{selectedGroup ?? t("mock.variantsTitle")}</h3>
                  <p>{t("mock.workflowBody")}</p>
                </div>
              </div>
              {selectedRule ? (
                <div className="mock-context-card">
                  <span>{t("mock.selectedRule")}</span>
                  <strong>{selectedRule.name}</strong>
                  <small>{t("mock.hitsSummary", {
                    count: selectedRule.hitCount,
                    time: selectedRule.lastHitAt ? new Date(selectedRule.lastHitAt).toLocaleString() : t("mock.lastHitNever")
                  })}</small>
                </div>
              ) : null}
              <div className="list">
                {activeGroupRules.map((rule) => (
                  <div key={rule.id} className={`list-item ${selectedRule?.id === rule.id ? "active" : ""}`}>
                    <div className="list-row">
                      <strong>{rule.name}</strong>
                      <span className={`status-badge ${rule.enabled ? "" : "muted"}`}>
                        {rule.enabled ? t("mock.enabledState") : t("mock.disabledState")}
                      </span>
                    </div>
                    <p>{t("mock.hitsSummary", {
                      count: rule.hitCount,
                      time: rule.lastHitAt ? new Date(rule.lastHitAt).toLocaleString() : t("mock.lastHitNever")
                    })}</p>
                    <div className="inline-actions action-inline">
                      <button className="ghost-button" onClick={() => setSelectedRuleId(rule.id)}>{t("mock.inspect")}</button>
                    </div>
                    <div className="button-grid compact-actions two-up">
                      <button onClick={() => toggleRule(rule)}>{rule.enabled ? t("mock.disable") : t("mock.enable")}</button>
                      <button className="ghost-button" onClick={() => startEdit(rule)}>{t("mock.edit")}</button>
                      <button className="ghost-button" onClick={() => duplicate(rule)}>{t("mock.duplicate")}</button>
                      <button className="danger-button" onClick={() => removeRule(rule)}>{t("mock.delete")}</button>
                    </div>
                  </div>
                ))}
              </div>
            </section>

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
                  <p>{editingId ? t("mock.form.editing", { name: form.name || "-" }) : t("mock.form.body")}</p>
                </div>
              </div>
              <div className="flow-path compact">
                <div className="flow-step compact">
                  <span>1</span>
                  <strong>{t("mock.flow.group")}</strong>
                  <small>{t("mock.flow.groupBody")}</small>
                </div>
                <div className="flow-step compact">
                  <span>2</span>
                  <strong>{t("mock.flow.variant")}</strong>
                  <small>{t("mock.flow.variantBody")}</small>
                </div>
                <div className="flow-step compact">
                  <span>3</span>
                  <strong>{t("mock.flow.response")}</strong>
                  <small>{t("mock.flow.responseBody")}</small>
                </div>
              </div>
              {selectedRule ? (
                <div className="mock-context-card">
                  <span>{t("mock.selectedRule")}</span>
                  <strong>{selectedRule.name}</strong>
                  <small>{selectedRule.method} - {selectedRule.url}</small>
                </div>
              ) : null}
              <input value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} placeholder={t("mock.form.name")} />
              <select value={form.method} onChange={(event) => setForm({ ...form, method: event.target.value })}>
                <option>GET</option>
                <option>POST</option>
                <option>PUT</option>
                <option>DELETE</option>
              </select>
              <input value={form.url} onChange={(event) => setForm({ ...form, url: event.target.value })} placeholder={t("mock.form.url")} />
              <input
                type="number"
                value={form.responseStatus}
                onChange={(event) => setForm({ ...form, responseStatus: Number(event.target.value) })}
                placeholder={t("mock.form.status")}
              />
              <textarea rows={5} value={form.responseHeaders} onChange={(event) => setForm({ ...form, responseHeaders: event.target.value })} placeholder={t("mock.form.headers")} />
              <textarea rows={10} value={form.responseBody} onChange={(event) => setForm({ ...form, responseBody: event.target.value })} placeholder={t("mock.form.bodyPlaceholder")} />
              <label className="checkbox-row">
                <input type="checkbox" checked={form.enabled} onChange={(event) => setForm({ ...form, enabled: event.target.checked })} />
                {t("mock.form.enableNow")}
              </label>
              <div className="button-grid compact-actions two-up">
                <button className="primary-action" type="submit">{editingId ? t("mock.form.saveChanges") : t("mock.form.save")}</button>
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
          </div>
        </section>
      )}
    </div>
  );
}
