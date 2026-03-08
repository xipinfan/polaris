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

      <section className="card-grid">
        <div className="panel">
          <span className="feature-badge">{t("mock.overview")}</span>
          <div className="stats-grid compact">
            <div className="stat-tile">
              <span>{t("mock.metric.total")}</span>
              <strong>{metrics.total}</strong>
            </div>
            <div className="stat-tile">
              <span>{t("mock.metric.enabled")}</span>
              <strong>{metrics.enabledCount}</strong>
            </div>
            <div className="stat-tile">
              <span>{t("mock.metric.hits")}</span>
              <strong>{metrics.totalHits}</strong>
            </div>
          </div>
        </div>
      </section>

      <div className="two-column mock-layout">
        <section className="table-card">
          <div className="panel-heading">
            <div>
              <h3>{t("mock.variantsTitle")}</h3>
              <p>{t("mock.variantsBody")}</p>
            </div>
          </div>
          <div className="list">
            {groupedRules.map(([group, items]) => (
              <article key={group} className="panel">
                <div className="panel-heading">
                  <div>
                    <h3>{group}</h3>
                    <p>{t("mock.variantCount", { count: items.length })}</p>
                  </div>
                </div>
                <div className="list">
                  {items.map((rule) => (
                    <div key={rule.id} className="list-item">
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
                      <div className="button-grid">
                        <button onClick={() => toggleRule(rule)}>{rule.enabled ? t("mock.disable") : t("mock.enable")}</button>
                        <button className="ghost-button" onClick={() => startEdit(rule)}>{t("mock.edit")}</button>
                        <button className="ghost-button" onClick={() => duplicate(rule)}>{t("mock.duplicate")}</button>
                        <button className="danger-button" onClick={() => removeRule(rule)}>{t("mock.delete")}</button>
                      </div>
                    </div>
                  ))}
                </div>
              </article>
            ))}
            {rules.length === 0 && (
              <div className="empty-card">
                <h3>{t("mock.noneTitle")}</h3>
                <p>{t("mock.noneBody")}</p>
              </div>
            )}
          </div>
        </section>

        <form
          className="form-grid"
          onSubmit={(event) => {
            event.preventDefault();
            submit().catch(console.error);
          }}
        >
          <div className="panel-heading">
            <div>
              <h3>{editingId ? t("mock.form.edit") : t("mock.form.new")}</h3>
              <p>{t("mock.form.body")}</p>
            </div>
          </div>
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
          <div className="button-grid">
            <button type="submit">{editingId ? t("mock.form.saveChanges") : t("mock.form.save")}</button>
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
    </div>
  );
}
