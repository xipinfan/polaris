import Editor, { type Monaco, type OnMount } from "@monaco-editor/react";
import { Select } from "antd";
import { useEffect, useMemo, useRef, useState } from "react";
import type { editor as MonacoEditor } from "monaco-editor";
import type { MockFormState } from "../../types";
import { classNames } from "../../utils/mockHelpers";
import localStyles from "./index.module.less";

type EditorPane = "headers" | "body";
type ModalTab = "basic" | "response";

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

function validateExactBodyMatch(value: string): string | null {
  const text = value.trim();
  if (!text) {
    return null;
  }

  const entries = text
    .split(/[\n;]+/)
    .map((part) => part.trim())
    .filter(Boolean);

  for (const entry of entries) {
    const separatorIndex = entry.indexOf(":");
    if (separatorIndex <= 0) {
      return '格式错误：请使用 path:"value"，例如 name:"xxx"';
    }

    const path = entry.slice(0, separatorIndex).trim();
    const valueLiteral = entry.slice(separatorIndex + 1).trim();
    if (!path || !valueLiteral) {
      return '格式错误：请使用 path:"value"，例如 name:"xxx"';
    }

    if (!(valueLiteral.startsWith('"') && valueLiteral.endsWith('"'))) {
      return '值必须使用双引号包裹，例如 name:"xxx"';
    }

    try {
      const parsed = JSON.parse(valueLiteral);
      if (typeof parsed !== "string") {
        return '值必须是字符串，例如 name:"xxx"';
      }
    } catch {
      return "字符串格式非法，请检查转义字符";
    }
  }

  return null;
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
  const [activeTab, setActiveTab] = useState<ModalTab>("basic");
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
    setActiveTab("basic");
  }, [isOpen, editingId]);

  const exactMatchError = useMemo(
    () => validateExactBodyMatch(form.requestBodyExactMatch),
    [form.requestBodyExactMatch],
  );

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
    if (exactMatchError) {
      setActiveTab("basic");
      showToast(exactMatchError, "error");
      return;
    }

    try {
      JSON.parse(form.responseHeaders || "{}");
      JSON.parse(form.responseBody || "{}");
      setEditorError(null);
      await onSave();
    } catch (error) {
      const message = error instanceof Error ? error.message : "保存失败，JSON 格式不正确";
      setEditorError(message);
      showToast(message, "error");
    }
  };

  if (!isOpen) return null;

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

        <div className={localStyles.modalTabs}>
          <button
            className={classNames(localStyles.modalTabButton, activeTab === "basic" && localStyles.modalTabButtonActive)}
            onClick={() => setActiveTab("basic")}
            type="button"
          >
            基本信息
          </button>
          <button
            className={classNames(localStyles.modalTabButton, activeTab === "response" && localStyles.modalTabButtonActive)}
            onClick={() => setActiveTab("response")}
            type="button"
          >
            返回配置
          </button>
        </div>

        <div className={localStyles.modalSections}>
          {activeTab === "basic" ? (
            <section className={localStyles.modalSection}>
              <div className={localStyles.modalSectionHeader}>
                <div>
                  <strong>{t("mock.modalBasic")}</strong>
                  <p>{t("mock.form.basicHint")}</p>
                </div>
              </div>
              <div className={localStyles.modalGrid}>
                <label className={classNames(localStyles.field, localStyles.fieldFull)}>
                  <span>{t("mock.form.ruleStatus")}</span>
                  <div className={localStyles.modalStatusCard}>
                    <div className={localStyles.modalStatusCopy}>
                      <strong>{form.enabled ? "已启用" : "未启用"}</strong>
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
                </label>

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
                  <span>Body 精确匹配（可选）</span>
                  <input
                    className={localStyles.control}
                    onChange={(event) =>
                      setForm((current) => ({ ...current, requestBodyExactMatch: event.target.value }))
                    }
                    placeholder={'例如 name:"xxx" 或 user.id:"123"'}
                    value={form.requestBodyExactMatch}
                  />
                  <small className={localStyles.fieldHint}>
                    支持多条条件：每行一条或用分号分隔，例如 `name:"xxx"; user.id:"123"`。
                  </small>
                  {exactMatchError ? <div className={localStyles.editorError}>{exactMatchError}</div> : null}
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
          ) : (
            <section className={localStyles.modalSection}>
              <div className={localStyles.editorSection}>
                <div className={localStyles.editorShell}>
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
                          height="100%"
                          onChange={(value) => setForm((current) => ({ ...current, responseHeaders: value ?? "{}" }))}
                          onMount={handleHeadersMount}
                          options={editorOptions}
                          saveViewState={false}
                          value={form.responseHeaders}
                        />
                      ) : (
                        <Editor
                          defaultLanguage="json"
                          height="100%"
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
            </section>
          )}
        </div>

        <div className={localStyles.modalActions}>
          <button className={localStyles.secondaryButton} onClick={() => setIsOpen(false)} type="button">
            {t("mock.form.cancel")}
          </button>
          <button
            className={localStyles.primaryButton}
            disabled={Boolean(exactMatchError)}
            onClick={() => void saveWithValidation()}
            type="button"
          >
            {editingId ? t("mock.form.saveChanges") : t("mock.form.save")}
          </button>
        </div>
      </section>
    </div>
  );
}
