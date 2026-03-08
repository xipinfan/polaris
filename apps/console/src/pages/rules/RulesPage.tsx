import { useEffect, useMemo, useState } from "react";
import { useLocation } from "react-router-dom";
import type { RequestRecord, MockRule, ProxyRule, ProxyMode } from "@polaris/shared-types";
import { useConsoleI18n } from "../../i18n/I18nProvider";
import { UiSlotPlaceholder } from "../../features/slots/UiSlotPlaceholder";
import { apiClient } from "../../services/apiClient";

type RulesRouteState = {
  seedRequest?: RequestRecord;
  mode?: "mock" | "proxy";
  suggestedAction?: "proxy" | "direct";
};

const emptyMockForm = {
  name: "",
  method: "GET",
  url: "",
  responseStatus: 200,
  responseHeaders: "{}",
  responseBody: "{}",
  enabled: true
};

export function RulesPage() {
  const location = useLocation();
  const routeState = location.state as RulesRouteState | null;
  const [proxyMode, setProxyMode] = useState<ProxyMode>("direct");
  const [proxyRules, setProxyRules] = useState<ProxyRule[]>([]);
  const [mockRules, setMockRules] = useState<MockRule[]>([]);
  const [selectedProxyHost, setSelectedProxyHost] = useState<string | null>(null);
  const [selectedMockId, setSelectedMockId] = useState<string | null>(null);
  const [editingMockId, setEditingMockId] = useState<string | null>(null);
  const [routingHost, setRoutingHost] = useState("");
  const [routingAction, setRoutingAction] = useState<"proxy" | "direct">("proxy");
  const [mockForm, setMockForm] = useState(emptyMockForm);
  const [message, setMessage] = useState("");
  const { t } = useConsoleI18n();

  const load = async () => {
    const [status, nextProxyRules, nextMockRules] = await Promise.all([
      apiClient.health(),
      apiClient.listProxyRules(),
      apiClient.listMockRules()
    ]);
    setProxyMode(status.proxyMode);
    setProxyRules(nextProxyRules);
    setMockRules(nextMockRules);
  };

  useEffect(() => {
    load().catch(console.error);
  }, []);

  useEffect(() => {
    if (!routeState?.seedRequest) {
      return;
    }

    const request = routeState.seedRequest;
    setRoutingHost(request.host);
    setRoutingAction(routeState.suggestedAction ?? "proxy");
    setMockForm({
      name: `${request.method} ${request.path} mock`,
      method: request.method,
      url: request.url,
      responseStatus: request.statusCode,
      responseHeaders: JSON.stringify(request.responseHeaders ?? {}, null, 2),
      responseBody: JSON.stringify(request.responseBody ?? {}, null, 2),
      enabled: true
    });
    setMessage(
      routeState.mode === "proxy" ? t("rules.seededRouting") : t("rules.seededMock", { host: request.host })
    );
  }, [routeState, t]);

  useEffect(() => {
    if (proxyRules.length === 0) {
      setSelectedProxyHost(null);
      return;
    }
    if (!selectedProxyHost || !proxyRules.some((rule) => rule.pattern === selectedProxyHost)) {
      setSelectedProxyHost(proxyRules[0].pattern);
    }
  }, [proxyRules, selectedProxyHost]);

  useEffect(() => {
    if (mockRules.length === 0) {
      setSelectedMockId(null);
      return;
    }
    if (!selectedMockId || !mockRules.some((rule) => rule.id === selectedMockId)) {
      setSelectedMockId(mockRules[0].id);
    }
  }, [mockRules, selectedMockId]);

  const selectedProxyRule = useMemo(
    () => proxyRules.find((rule) => rule.pattern === selectedProxyHost) ?? proxyRules[0],
    [proxyRules, selectedProxyHost]
  );

  const selectedMockRule = useMemo(
    () => mockRules.find((rule) => rule.id === selectedMockId) ?? mockRules[0],
    [mockRules, selectedMockId]
  );

  const metrics = useMemo(() => {
    const enabledMocks = mockRules.filter((rule) => rule.enabled).length;
    const totalHits = mockRules.reduce((sum, rule) => sum + rule.hitCount, 0);
    const directRules = proxyRules.filter((rule) => rule.action === "direct").length;
    return {
      routingRules: proxyRules.length,
      directRules,
      enabledMocks,
      totalMocks: mockRules.length,
      totalHits
    };
  }, [mockRules, proxyRules]);

  const switchProxyMode = async (mode: ProxyMode) => {
    await apiClient.setProxyMode(mode);
    setProxyMode(mode);
    setMessage(t("rules.modeUpdated", { mode }));
  };

  const saveRoutingRule = async () => {
    if (!routingHost.trim()) {
      return;
    }
    await apiClient.upsertSiteRule(routingHost.trim(), routingAction);
    setMessage(t("rules.routingSaved", { host: routingHost.trim() }));
    await load();
  };

  const removeRoutingRule = async (host: string) => {
    await apiClient.removeSiteRule(host);
    setMessage(t("rules.routingRemoved", { host }));
    await load();
  };

  const submitMock = async () => {
    const payload = {
      name: mockForm.name,
      method: mockForm.method,
      url: mockForm.url,
      responseStatus: Number(mockForm.responseStatus),
      responseHeaders: JSON.parse(mockForm.responseHeaders || "{}"),
      responseBody: JSON.parse(mockForm.responseBody || "{}"),
      enabled: mockForm.enabled
    };

    if (editingMockId) {
      await apiClient.updateMockRule(editingMockId, payload);
      setMessage(t("common.mockUpdated", { name: mockForm.name }));
    } else {
      await apiClient.createMockRule(payload);
      setMessage(t("common.mockCreated", { name: mockForm.name }));
    }

    setEditingMockId(null);
    setMockForm(emptyMockForm);
    await load();
  };

  const startMockEdit = (rule: MockRule) => {
    setSelectedMockId(rule.id);
    setEditingMockId(rule.id);
    setMockForm({
      name: rule.name,
      method: rule.method,
      url: rule.url,
      responseStatus: rule.responseStatus,
      responseHeaders: JSON.stringify(rule.responseHeaders, null, 2),
      responseBody: JSON.stringify(rule.responseBody ?? {}, null, 2),
      enabled: rule.enabled
    });
  };

  const toggleMock = async (rule: MockRule) => {
    await apiClient.enableMockRule(rule.id, !rule.enabled);
    setMessage(rule.enabled ? t("common.mockDisabled", { name: rule.name }) : t("common.mockEnabled", { name: rule.name }));
    await load();
  };

  const removeMock = async (rule: MockRule) => {
    await apiClient.deleteMockRule(rule.id);
    setMessage(t("common.mockDeleted", { name: rule.name }));
    await load();
  };

  return (
    <div className="page-stack">
      <section className="page-header">
        <div>
          <h2>{t("rules.title")}</h2>
          <p>{t("rules.subtitle")}</p>
        </div>
        {message ? <div className="panel banner-panel">{message}</div> : null}
      </section>

      <section className="request-summary-bar panel">
        <div className="traffic-summary-strip">
          <span>{t("rules.metric.routing")} {metrics.routingRules}</span>
          <span>{t("rules.metric.direct")} {metrics.directRules}</span>
          <span>{t("rules.metric.mocks")} {metrics.totalMocks}</span>
          <span>{t("rules.metric.enabledMocks")} {metrics.enabledMocks}</span>
          <span>{t("rules.metric.hits")} {metrics.totalHits}</span>
        </div>
      </section>

      <section className="rules-workspace">
        <section className="panel rules-mode-panel">
          <div className="panel-heading">
            <div>
              <h3>{t("rules.modeTitle")}</h3>
              <p>{t("rules.modeBody")}</p>
            </div>
            <span className="feature-badge">{t("rules.currentMode", { mode: proxyMode })}</span>
          </div>
          <div className="rules-mode-grid">
            {(["direct", "rules", "global", "system"] as const).map((mode) => (
              <button
                key={mode}
                type="button"
                className={proxyMode === mode ? "primary-action" : "ghost-button"}
                onClick={() => switchProxyMode(mode)}
              >
                {mode}
              </button>
            ))}
          </div>
          <div className="flow-path compact">
            <div className="flow-step compact">
              <span>1</span>
              <strong>{t("rules.flow.route")}</strong>
              <small>{t("rules.flow.routeBody")}</small>
            </div>
            <div className="flow-step compact">
              <span>2</span>
              <strong>{t("rules.flow.capture")}</strong>
              <small>{t("rules.flow.captureBody")}</small>
            </div>
            <div className="flow-step compact">
              <span>3</span>
              <strong>{t("rules.flow.mock")}</strong>
              <small>{t("rules.flow.mockBody")}</small>
            </div>
          </div>
        </section>

        <section className="panel rules-routing-panel">
          <div className="panel-heading">
            <div>
              <h3>{t("rules.routingTitle")}</h3>
              <p>{t("rules.routingBody")}</p>
            </div>
          </div>
          <div className="rules-form-grid">
            <input
              value={routingHost}
              onChange={(event) => setRoutingHost(event.target.value)}
              placeholder={t("rules.routingHost")}
            />
            <select
              value={routingAction}
              onChange={(event) => setRoutingAction(event.target.value as "proxy" | "direct")}
            >
              <option value="proxy">{t("rules.routingAction.proxy")}</option>
              <option value="direct">{t("rules.routingAction.direct")}</option>
            </select>
            <button className="primary-action" type="button" onClick={saveRoutingRule}>
              {t("rules.routingSave")}
            </button>
          </div>
          <div className="list">
            {proxyRules.map((rule) => (
              <div key={rule.id} className={`list-item ${selectedProxyRule?.id === rule.id ? "active" : ""}`}>
                <div className="list-row">
                  <strong>{rule.pattern}</strong>
                  <span className={`status-badge ${rule.action === "proxy" ? "success" : "muted"}`}>{rule.action}</span>
                </div>
                <p>{t("rules.routingMeta", { time: new Date(rule.updatedAt).toLocaleString() })}</p>
                <div className="inline-actions">
                  <button type="button" className="ghost-button" onClick={() => {
                    setSelectedProxyHost(rule.pattern);
                    setRoutingHost(rule.pattern);
                    setRoutingAction(rule.action);
                  }}>
                    {t("rules.inspect")}
                  </button>
                  <button type="button" className="danger-button" onClick={() => removeRoutingRule(rule.pattern)}>
                    {t("rules.remove")}
                  </button>
                </div>
              </div>
            ))}
            {proxyRules.length === 0 ? (
              <div className="empty-card compact-empty">
                <h3>{t("rules.emptyRoutingTitle")}</h3>
                <p>{t("rules.emptyRoutingBody")}</p>
              </div>
            ) : null}
          </div>
        </section>

        <section className="panel rules-response-panel">
          <div className="panel-heading">
            <div>
              <h3>{t("rules.responseTitle")}</h3>
              <p>{t("rules.responseBody")}</p>
            </div>
          </div>

          {selectedMockRule ? (
            <div className="mock-context-card">
              <span>{t("rules.selectedResponse")}</span>
              <strong>{selectedMockRule.name}</strong>
              <small>
                {selectedMockRule.method} - {selectedMockRule.url}
              </small>
            </div>
          ) : null}

          <div className="list">
            {mockRules.map((rule) => (
              <div key={rule.id} className={`list-item ${selectedMockRule?.id === rule.id ? "active" : ""}`}>
                <div className="list-row">
                  <strong>{rule.name}</strong>
                  <span className={`status-badge ${rule.enabled ? "success" : "muted"}`}>
                    {rule.enabled ? t("mock.enabledState") : t("mock.disabledState")}
                  </span>
                </div>
                <p>{rule.method} - {rule.url}</p>
                <small>{t("mock.hitsSummary", {
                  count: rule.hitCount,
                  time: rule.lastHitAt ? new Date(rule.lastHitAt).toLocaleString() : t("mock.lastHitNever")
                })}</small>
                <div className="button-grid compact-actions two-up">
                  <button type="button" onClick={() => setSelectedMockId(rule.id)}>{t("rules.inspect")}</button>
                  <button type="button" className="ghost-button" onClick={() => startMockEdit(rule)}>{t("mock.edit")}</button>
                  <button type="button" onClick={() => toggleMock(rule)}>{rule.enabled ? t("mock.disable") : t("mock.enable")}</button>
                  <button type="button" className="danger-button" onClick={() => removeMock(rule)}>{t("mock.delete")}</button>
                </div>
              </div>
            ))}
            {mockRules.length === 0 ? (
              <div className="empty-card compact-empty">
                <h3>{t("rules.emptyResponseTitle")}</h3>
                <p>{t("rules.emptyResponseBody")}</p>
              </div>
            ) : null}
          </div>
        </section>

        <form
          className="form-grid panel rules-editor-panel"
          onSubmit={(event) => {
            event.preventDefault();
            submitMock().catch(console.error);
          }}
        >
          <div className="panel-heading">
            <div>
              <h3>{editingMockId ? t("mock.form.edit") : t("rules.editorTitle")}</h3>
              <p>{editingMockId ? t("mock.form.editing", { name: mockForm.name || "-" }) : t("rules.editorBody")}</p>
            </div>
          </div>
          <input value={mockForm.name} onChange={(event) => setMockForm({ ...mockForm, name: event.target.value })} placeholder={t("mock.form.name")} />
          <select value={mockForm.method} onChange={(event) => setMockForm({ ...mockForm, method: event.target.value })}>
            <option>GET</option>
            <option>POST</option>
            <option>PUT</option>
            <option>PATCH</option>
            <option>DELETE</option>
          </select>
          <input value={mockForm.url} onChange={(event) => setMockForm({ ...mockForm, url: event.target.value })} placeholder={t("mock.form.url")} />
          <input
            type="number"
            value={mockForm.responseStatus}
            onChange={(event) => setMockForm({ ...mockForm, responseStatus: Number(event.target.value) })}
            placeholder={t("mock.form.status")}
          />
          <textarea rows={5} value={mockForm.responseHeaders} onChange={(event) => setMockForm({ ...mockForm, responseHeaders: event.target.value })} placeholder={t("mock.form.headers")} />
          <textarea rows={10} value={mockForm.responseBody} onChange={(event) => setMockForm({ ...mockForm, responseBody: event.target.value })} placeholder={t("mock.form.bodyPlaceholder")} />
          <label className="checkbox-row">
            <input type="checkbox" checked={mockForm.enabled} onChange={(event) => setMockForm({ ...mockForm, enabled: event.target.checked })} />
            {t("mock.form.enableNow")}
          </label>
          <div className="button-grid compact-actions two-up">
            <button className="primary-action" type="submit">{editingMockId ? t("mock.form.saveChanges") : t("rules.editorSave")}</button>
            <button
              type="button"
              className="ghost-button"
              onClick={() => {
                setEditingMockId(null);
                setMockForm(emptyMockForm);
              }}
            >
              {t("mock.form.clear")}
            </button>
          </div>
        </form>
      </section>

      <UiSlotPlaceholder slot="rules-toolbar" />
    </div>
  );
}
