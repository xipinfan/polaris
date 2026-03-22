import Editor, { type Monaco, type OnMount } from "@monaco-editor/react";
import { Select } from "antd";
import { useEffect, useMemo, useRef, useState } from "react";
import type { editor as MonacoEditor } from "monaco-editor";
import type { MockFormState } from "../../types";
import { classNames } from "../../utils/mockHelpers";
import localStyles from "./index.module.less";

type EditorPane = "headers" | "body";

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

function closeFindWidget(editor: MonacoEditor.IStandaloneCodeEditor) {
  const controller = editor.getContribution("editor.contrib.findController") as
    | { closeFindWidget?: () => void }
    | undefined;
  controller?.closeFindWidget?.();
}

export function MockRuleModal({
  defaultGroup,
  editingId,
  form,
  groups,
  isOpen,
  setForm,
  setIsOpen,
  t,
  onSave,
  showToast,
}: MockRuleModalProps) {
  const [activePane, setActivePane] = useState<EditorPane>("body");
  const [isExpanded, setIsExpanded] = useState(false);
  const [editorError, setEditorError] = useState<string | null>(null);

  const headersEditorRef = useRef<MonacoEditor.IStandaloneCodeEditor | null>(null);
  const bodyEditorRef = useRef<MonacoEditor.IStandaloneCodeEditor | null>(null);

  useEffect(() => {
    if (!isOpen) return;
    const previousBodyOverflow = document.body.style.overflow;
    const previousHtmlOverflow = document.documentElement.style.overflow;
    document.body.style.overflow = "hidden";
    document.documentElement.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = previousBodyOverflow;
      document.documentElement.style.overflow = previousHtmlOverflow;
    };
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen) return;
    setEditorError(null);
    setActivePane("body");
  }, [isOpen, editingId]);

  const editorOptions = useMemo<MonacoEditor.IStandaloneEditorConstructionOptions>(
    () => ({
      automaticLayout: true,
      minimap: { enabled: false },
      lineNumbers: "on",
      scrollBeyondLastLine: false,
      tabSize: 2,
      wordWrap: "on",
      wrappingStrategy: "advanced",
      formatOnPaste: true,
      formatOnType: true,
      smoothScrolling: true,
      fontSize: 13,
      find: {
        addExtraSpaceOnTop: false,
        autoFindInSelection: "never",
        seedSearchStringFromSelection: "never",
      },
    }),
    [],
  );

  const bindEditorLifecycle = (editor: MonacoEditor.IStandaloneCodeEditor, monaco: Monaco) => {
    editor.addCommand(monaco.KeyCode.Escape, () => closeFindWidget(editor));
    editor.addCommand(monaco.KeyMod.Shift | monaco.KeyCode.Escape, () => closeFindWidget(editor));
  };

  const handleHeadersMount: OnMount = (editor, monaco) => {
    headersEditorRef.current = editor;
    bindEditorLifecycle(editor, monaco);
  };

  const handleBodyMount: OnMount = (editor, monaco) => {
    bodyEditorRef.current = editor;
    bindEditorLifecycle(editor, monaco);
  };

  const formatActiveJson = () => {
    const key = activePane === "headers" ? "responseHeaders" : "responseBody";
    const raw = form[key];
    try {
      const parsed = JSON.parse(raw || "{}");
      setForm((current) => ({ ...current, [key]: JSON.stringify(parsed, null, 2) }));
      setEditorError(null);
      showToast("JSON 已格式化", "success");
    } catch {
      const message = "JSON 格式不正确";
      setEditorError(message);
      showToast(message, "error");
    }
  };

  const saveWithValidation = async () => {
    try {
      JSON.parse(form.responseHeaders || "{}");
      JSON.parse(form.responseBody || "{}");
      setEditorError(null);
      await onSave();
    } catch (error) {
      const message = error instanceof Error ? error.message : "保存失败：JSON 格式不正确";
      setEditorError(message);
      showToast(message, "error");
    }
  };

  if (!isOpen) return null;

  const editorHeight = isExpanded ? 420 : 300;
  const codeEditorHeight = Math.max(editorHeight - 44, 180);
  const groupOptions = [defaultGroup, ...groups.filter((group) => group !== defaultGroup)].map((group) => ({
    label: group,
    value: group,
  }));
  const methodOptions = ["GET", "POST", "PUT", "PATCH", "DELETE"].map((method) => ({
    label: method,
    value: method,
  }));

  return (
    <div className={localStyles.modalOverlay} role="presentation">
      <section
        aria-modal="true"
        className={classNames(localStyles.modalCard, isExpanded && localStyles.modalCardExpanded)}
        role="dialog"
      >
        <header className={localStyles.modalHeader}>
          <div className={localStyles.modalHeaderCopy}>
            <h3>{editingId ? t("mock.modalEditTitle") : t("mock.modalCreateTitle")}</h3>
            <p>{t("mock.modalBody")}</p>
          </div>
          <button
            aria-label={t("mock.form.cancel")}
            className={localStyles.modalClose}
            onClick={() => setIsOpen(false)}
            type="button"
          />
        </header>

        <div className={localStyles.modalStatusCard}>
          <div className={localStyles.modalStatusCopy}>
            <strong>{t("mock.form.ruleStatus")}</strong>
            <span>{form.enabled ? t("mock.form.ruleEnabledHint") : t("mock.form.ruleDisabledHint")}</span>
          </div>
          <label className={localStyles.switch}>
            <input
              checked={form.enabled}
              onChange={(event) => setForm((current) => ({ ...current, enabled: event.target.checked }))}
              type="checkbox"
            />
            <span className={localStyles.switchTrack} />
          </label>
        </div>

        <div className={localStyles.modalSections}>
          <section className={localStyles.modalSection}>
            <div className={localStyles.modalSectionHeader}>
              <div>
                <strong>{t("mock.modalBasic")}</strong>
                <p>{t("mock.form.basicHint")}</p>
              </div>
            </div>
            <div className={localStyles.modalGrid}>
              <label className={localStyles.field}>
                <span>{t("mock.form.nameLabel")}</span>
                <input
                  className={localStyles.control}
                  onChange={(event) => setForm((current) => ({ ...current, variant: event.target.value }))}
                  value={form.variant}
                />
              </label>
              <label className={localStyles.field}>
                <span>{t("mock.form.groupLabel")}</span>
                <Select
                  className={localStyles.antSelect}
                  onChange={(value) => setForm((current) => ({ ...current, group: value }))}
                  options={groupOptions}
                  popupClassName={localStyles.antSelectDropdown}
                  value={form.group}
                />
              </label>
              <label className={localStyles.field}>
                <span>{t("mock.form.methodLabel")}</span>
                <Select
                  className={localStyles.antSelect}
                  onChange={(value) => setForm((current) => ({ ...current, method: value }))}
                  options={methodOptions}
                  popupClassName={localStyles.antSelectDropdown}
                  value={form.method}
                />
              </label>
              <label className={classNames(localStyles.field, localStyles.fieldFull)}>
                <span>{t("mock.form.urlLabel")}</span>
                <input
                  className={localStyles.control}
                  onChange={(event) => setForm((current) => ({ ...current, url: event.target.value }))}
                  value={form.url}
                />
              </label>
              <label className={classNames(localStyles.field, localStyles.fieldFull)}>
                <span>{t("mock.form.requestBodyKeyMatchLabel")}</span>
                <input
                  className={localStyles.control}
                  onChange={(event) =>
                    setForm((current) => ({ ...current, requestBodyKeyMatch: event.target.value }))
                  }
                  placeholder={t("mock.form.requestBodyKeyMatchPlaceholder")}
                  value={form.requestBodyKeyMatch}
                />
              </label>
            </div>
          </section>

          <section className={localStyles.modalSection}>
            <div className={localStyles.modalSectionHeader}>
              <div>
                <strong>{t("mock.modalReturn")}</strong>
                <p>{t("mock.form.responseSectionHint")}</p>
              </div>
            </div>
            <div className={localStyles.modalGrid}>
              <label className={localStyles.field}>
                <span>{t("mock.form.statusLabel")}</span>
                <input
                  className={localStyles.control}
                  min={100}
                  onChange={(event) =>
                    setForm((current) => ({ ...current, responseStatus: Number(event.target.value) || 200 }))
                  }
                  type="number"
                  value={form.responseStatus}
                />
              </label>
              <div className={localStyles.field}>
                <span>{t("mock.form.returnTypeLabel")}</span>
                <div className={localStyles.staticValue}>
                  <strong>{t("mock.ruleResponseStaticJson")}</strong>
                  <small>{t("mock.form.groupActiveHintLabel")}</small>
                </div>
              </div>
              <div className={classNames(localStyles.field, localStyles.fieldFull)}>
                <div className={localStyles.editorSection}>
                  <div className={localStyles.editorShell} style={{ height: editorHeight }}>
                    <div className={localStyles.editorToolbar}>
                      <div className={localStyles.editorTabs}>
                        <button
                          className={classNames(
                            localStyles.editorTab,
                            activePane === "headers" && localStyles.editorTabActive,
                          )}
                          onClick={() => setActivePane("headers")}
                          type="button"
                        >
                          {t("mock.form.headersLabel")}
                        </button>
                        <button
                          className={classNames(
                            localStyles.editorTab,
                            activePane === "body" && localStyles.editorTabActive,
                          )}
                          onClick={() => setActivePane("body")}
                          type="button"
                        >
                          {t("mock.form.bodyContentLabel")}
                        </button>
                      </div>
                      <div className={localStyles.editorActions}>
                        <button className={localStyles.secondaryButton} onClick={formatActiveJson} type="button">
                          格式化
                        </button>
                        <button
                          className={localStyles.secondaryButton}
                          onClick={() => setIsExpanded((value) => !value)}
                          type="button"
                        >
                          {isExpanded ? "还原编辑区" : "放大编辑区"}
                        </button>
                      </div>
                    </div>
                    <div className={localStyles.editorFrame}>
                      {activePane === "headers" ? (
                        <Editor
                          defaultLanguage="json"
                          height={codeEditorHeight}
                          onChange={(value) => setForm((current) => ({ ...current, responseHeaders: value ?? "{}" }))}
                          onMount={handleHeadersMount}
                          options={editorOptions}
                          saveViewState={false}
                          value={form.responseHeaders}
                        />
                      ) : (
                        <Editor
                          defaultLanguage="json"
                          height={codeEditorHeight}
                          onChange={(value) => setForm((current) => ({ ...current, responseBody: value ?? "{}" }))}
                          onMount={handleBodyMount}
                          options={editorOptions}
                          saveViewState={false}
                          value={form.responseBody}
                        />
                      )}
                    </div>
                  </div>
                  {editorError ? <div className={localStyles.editorError}>{editorError}</div> : null}
                </div>
              </div>
            </div>
          </section>
        </div>

        <div className={localStyles.modalActions}>
          <button className={localStyles.secondaryButton} onClick={() => setIsOpen(false)} type="button">
            {t("mock.form.cancel")}
          </button>
          <button className={localStyles.primaryButton} onClick={() => void saveWithValidation()} type="button">
            {editingId ? t("mock.form.saveChanges") : t("mock.form.save")}
          </button>
        </div>
      </section>
    </div>
  );
}
