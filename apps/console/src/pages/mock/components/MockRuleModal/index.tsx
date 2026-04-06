import type { Monaco, OnMount } from "@monaco-editor/react";
import { Select } from "antd";
import { useEffect, useMemo, useRef, useState } from "react";
import type { editor as MonacoEditor } from "monaco-editor";
import { LazyMonacoEditor } from "../../../../features/editor/LazyMonacoEditor";
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
  onSave,
  showToast,
}: MockRuleModalProps) {
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

  if (!isOpen) return null;

  return (
    <MockRuleModalContent
      key={editingId ?? "create"}
      defaultGroup={defaultGroup}
      editingId={editingId}
      form={form}
      groups={groups}
      onSave={onSave}
      setForm={setForm}
      setIsOpen={setIsOpen}
      showToast={showToast}
    />
  );
}

type MockRuleModalContentProps = Omit<MockRuleModalProps, "isOpen">;

function MockRuleModalContent({
  defaultGroup,
  editingId,
  form,
  groups,
  setForm,
  setIsOpen,
  onSave,
  showToast,
}: MockRuleModalContentProps) {
  const [activePane, setActivePane] = useState<EditorPane>("body");
  const [activeTab, setActiveTab] = useState<ModalTab>("basic");
  const [isExpanded, setIsExpanded] = useState(false);
  const [editorError, setEditorError] = useState<string | null>(null);

  const headersEditorRef = useRef<MonacoEditor.IStandaloneCodeEditor | null>(null);
  const bodyEditorRef = useRef<MonacoEditor.IStandaloneCodeEditor | null>(null);

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
            <h3>{editingId ? "编辑请求规则" : "新建请求规则"}</h3>
            <p>编辑当前规则的请求与返回配置。</p>
          </div>
          <button
            aria-label="取消"
            className={localStyles.modalClose}
            onClick={() => setIsOpen(false)}
            type="button"
          />
        </header>

        <div className={localStyles.modalTabs}>
          <button
            className={classNames(
              localStyles.modalTabButton,
              activeTab === "basic" && localStyles.modalTabButtonActive,
            )}
            onClick={() => setActiveTab("basic")}
            type="button"
          >
            基本信息
          </button>
          <button
            className={classNames(
              localStyles.modalTabButton,
              activeTab === "response" && localStyles.modalTabButtonActive,
            )}
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
                  <strong>基本信息</strong>
                  <p>配置规则基本属性与所属分组。</p>
                </div>
              </div>
              <div className={localStyles.modalGrid}>
                <label className={classNames(localStyles.field, localStyles.fieldFull)}>
                  <span>规则状态</span>
                  <div className={localStyles.modalStatusCard}>
                    <div className={localStyles.modalStatusCopy}>
                      <strong>{form.enabled ? "已启用" : "未启用"}</strong>
                      <span>
                        {form.enabled
                          ? "在所属分组生效时参与命中。"
                          : "保留在所属分组中，但不参与命中。"}
                      </span>
                    </div>
                    <label className={localStyles.switch}>
                      <input
                        checked={form.enabled}
                        onChange={(event) =>
                          setForm((current) => ({ ...current, enabled: event.target.checked }))
                        }
                        type="checkbox"
                      />
                      <span className={localStyles.switchTrack} />
                    </label>
                  </div>
                </label>

                <label className={localStyles.field}>
                  <span>规则名称</span>
                  <input
                    className={localStyles.control}
                    onChange={(event) => setForm((current) => ({ ...current, variant: event.target.value }))}
                    value={form.variant}
                  />
                </label>
                <label className={localStyles.field}>
                  <span>所属分组</span>
                  <Select
                    className={localStyles.antSelect}
                    onChange={(value) => setForm((current) => ({ ...current, group: value }))}
                    options={groupOptions}
                    popupClassName={localStyles.antSelectDropdown}
                    value={form.group}
                  />
                </label>
                <label className={localStyles.field}>
                  <span>请求方法</span>
                  <Select
                    className={localStyles.antSelect}
                    onChange={(value) => setForm((current) => ({ ...current, method: value }))}
                    options={methodOptions}
                    popupClassName={localStyles.antSelectDropdown}
                    value={form.method}
                  />
                </label>
                <label className={classNames(localStyles.field, localStyles.fieldFull)}>
                  <span>完整地址</span>
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
                  <span>请求 Body 属性匹配（可选）</span>
                  <input
                    className={localStyles.control}
                    onChange={(event) =>
                      setForm((current) => ({ ...current, requestBodyKeyMatch: event.target.value }))
                    }
                    placeholder="例如 user.id 或 payload.token"
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
                        响应头
                      </button>
                      <button
                        className={classNames(
                          localStyles.editorTab,
                          activePane === "body" && localStyles.editorTabActive,
                        )}
                        onClick={() => setActivePane("body")}
                        type="button"
                      >
                        响应体
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
                      <LazyMonacoEditor
                        height="100%"
                        language="json"
                        onChange={(value) =>
                          setForm((current) => ({ ...current, responseHeaders: value ?? "{}" }))
                        }
                        onMount={handleHeadersMount}
                        options={editorOptions}
                        value={form.responseHeaders}
                      />
                    ) : (
                      <LazyMonacoEditor
                        height="100%"
                        language="json"
                        onChange={(value) =>
                          setForm((current) => ({ ...current, responseBody: value ?? "{}" }))
                        }
                        onMount={handleBodyMount}
                        options={editorOptions}
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
            取消
          </button>
          <button
            className={localStyles.primaryButton}
            disabled={Boolean(exactMatchError)}
            onClick={() => void saveWithValidation()}
            type="button"
          >
            {editingId ? "保存修改" : "保存模拟"}
          </button>
        </div>
      </section>
    </div>
  );
}
