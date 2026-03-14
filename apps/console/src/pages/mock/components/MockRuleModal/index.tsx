import { classNames, getQueryCount } from "../../utils/mockHelpers";
import type { MockFormState } from "../../types";
import localStyles from "./index.module.less";

type MockRuleModalProps = {
  defaultGroup: string;
  editingId: string | null;
  form: MockFormState;
  groups: string[];
  isOpen: boolean;
  setForm: (updater: (current: MockFormState) => MockFormState) => void;
  setIsOpen: (value: boolean) => void;
  t: (key: any, params?: Record<string, string | number>) => string;
  onSave: () => Promise<void>;
  showToast: (message: string, type?: "success" | "error" | "info") => void;
};

export function MockRuleModal({
  editingId, form, groups, isOpen, setForm, setIsOpen, t, onSave, showToast,
}: MockRuleModalProps) {
  if (!isOpen) return null;

  return (
    <div className={classNames(localStyles.modalOverlay, localStyles.root)} onClick={() => setIsOpen(false)} role="presentation">
      <section aria-modal="true" className={localStyles.modalCard} onClick={(event) => event.stopPropagation()} role="dialog">
        <div className={localStyles.modalHeader}>
          <div className={localStyles.modalHeaderCopy}>
            <span className={localStyles.sectionBadge}>{editingId ? t("mock.modalEditTitle") : t("mock.modalCreateTitle")}</span>
            <h3>{editingId ? t("mock.modalEditTitle") : t("mock.modalCreateTitle")}</h3>
            <p>{t("mock.modalBody")}</p>
          </div>
          <button aria-label={t("mock.form.cancel")} className={localStyles.modalClose} onClick={() => setIsOpen(false)} type="button" />
        </div>

        <div className={localStyles.modalStatusCard}>
          <div className={localStyles.modalStatusCopy}><strong>{t("mock.form.ruleStatus")}</strong><span>{form.enabled ? t("mock.form.ruleEnabledHint") : t("mock.form.ruleDisabledHint")}</span></div>
          <label className={localStyles.switch}><input checked={form.enabled} onChange={(event) => setForm((current) => ({ ...current, enabled: event.target.checked }))} type="checkbox" /><span className={localStyles.switchTrack} /></label>
        </div>

        <div className={localStyles.modalSections}>
          <section className={localStyles.modalSection}>
            <div className={localStyles.modalSectionHeader}><div><strong>{t("mock.modalBasic")}</strong><p>{t("mock.form.basicHint")}</p></div></div>
            <div className={localStyles.modalGrid}>
              <label className={localStyles.field}><span>{t("mock.form.nameLabel")}</span><input className={localStyles.control} value={form.variant} onChange={(event) => setForm((current) => ({ ...current, variant: event.target.value }))} /></label>
              <label className={localStyles.field}><span>{t("mock.form.groupLabel")}</span><select className={localStyles.control} value={form.group} onChange={(event) => setForm((current) => ({ ...current, group: event.target.value }))}>{groups.map((group) => <option key={group} value={group}>{group}</option>)}</select></label>
              <label className={localStyles.field}><span>{t("mock.form.methodLabel")}</span><select className={localStyles.control} value={form.method} onChange={(event) => setForm((current) => ({ ...current, method: event.target.value }))}><option>GET</option><option>POST</option><option>PUT</option><option>PATCH</option><option>DELETE</option></select></label>
              <label className={classNames(localStyles.field, localStyles.fieldFull)}><span>{t("mock.form.urlLabel")}</span><input className={localStyles.control} value={form.url} onChange={(event) => setForm((current) => ({ ...current, url: event.target.value }))} /></label>
            </div>
          </section>

          <section className={localStyles.modalSection}>
            <div className={localStyles.modalSectionHeader}><div><strong>{t("mock.modalMatch")}</strong><p>{t("mock.form.matchSectionHint")}</p></div></div>
            <div className={localStyles.modalGrid}>
              <div className={localStyles.field}><span>{t("mock.form.matchModeLabel")}</span><div className={localStyles.staticValue}><strong>{t("mock.ruleMatchExactUrl")}</strong></div></div>
              <div className={localStyles.field}><span>{t("mock.form.queryLabel")}</span><div className={localStyles.staticValue}><strong>{t("mock.form.queryIncluded")}</strong><small>{t("mock.ruleMatchQueryCount", { count: getQueryCount(form.url) })}</small></div></div>
              <label className={localStyles.field}><span>{t("mock.form.statusLabel")}</span><input className={localStyles.control} type="number" value={form.responseStatus} onChange={(event) => setForm((current) => ({ ...current, responseStatus: Number(event.target.value) }))} /></label>
              <label className={classNames(localStyles.field, localStyles.fieldFull)}><span>{t("mock.form.headersLabel")}</span><textarea className={classNames(localStyles.codeEditor, localStyles.codeEditorCompact)} rows={4} value={form.responseHeaders} onChange={(event) => setForm((current) => ({ ...current, responseHeaders: event.target.value }))} /></label>
              <label className={classNames(localStyles.field, localStyles.fieldFull)}><span>{t("mock.form.bodyContentLabel")}</span><textarea className={classNames(localStyles.codeEditor, localStyles.codeEditorBody)} rows={10} value={form.responseBody} onChange={(event) => setForm((current) => ({ ...current, responseBody: event.target.value }))} /></label>
            </div>
          </section>
        </div>

        <div className={localStyles.modalActions}>
          <button className={localStyles.secondaryButton} onClick={() => setIsOpen(false)} type="button">{t("mock.form.cancel")}</button>
          <button className={localStyles.primaryButton} onClick={() => void onSave().catch((error) => showToast(error instanceof Error ? error.message : String(error), "error"))} type="button">{editingId ? t("mock.form.saveChanges") : t("mock.form.save")}</button>
        </div>
      </section>
    </div>
  );
}


