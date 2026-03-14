import { useEffect, useMemo, useState } from "react";
import { useLocation } from "react-router-dom";
import type { RequestRecord } from "@polaris/shared-types";
import { useRunDebugRequestMutation, useSaveDebugRequestMutation } from "../../domains/debug/mutations";
import { useToast } from "../../features/feedback/ToastProvider";
import { useConsoleI18n } from "../../i18n/I18nProvider";
import { toastQueryError } from "../../lib/query/queryOptions";
import { UiSlotPlaceholder } from "../../features/slots/UiSlotPlaceholder";
import { DebugRequestForm } from "./components/DebugRequestForm";
import { DebugResponsePanel } from "./components/DebugResponsePanel";
import styles from "./DebugPage.module.css";

type DebugDraftState = {
  draft?: {
    name?: string;
    method: string;
    url: string;
    headers?: Record<string, string>;
    query?: Record<string, string>;
    body?: unknown;
  };
};

export function DebugPage() {
  const location = useLocation();
  const routeState = location.state as DebugDraftState | null;
  const [method, setMethod] = useState("GET");
  const [url, setUrl] = useState("");
  const [body, setBody] = useState("");
  const [name, setName] = useState("");
  const [response, setResponse] = useState<RequestRecord | null>(null);
  const runRequestMutation = useRunDebugRequestMutation();
  const saveRequestMutation = useSaveDebugRequestMutation();
  const { t } = useConsoleI18n();
  const { showToast } = useToast();

  useEffect(() => {
    if (!routeState?.draft) {
      return;
    }

    const draft = routeState.draft;
    setName(draft.name ?? "");
    setMethod(draft.method);
    setUrl(draft.url);
    setBody(JSON.stringify(draft.body ?? {}, null, 2));
    showToast(t("common.draftLoaded"));
  }, [routeState, showToast, t]);

  const parsedBody = () => {
    if (method === "GET") {
      return undefined;
    }
    return JSON.parse(body || "{}");
  };

  const currentDraft = useMemo(
    () => ({
      name: name || "debug-request",
      method,
      url,
      headers: {},
      query: {},
      body: method === "GET" ? null : parsedBody(),
      tags: ["debug"],
    }),
    [body, method, name, url],
  );

  const runRequest = async () => {
    try {
      const result = await runRequestMutation.mutateAsync({
        method,
        url,
        body: parsedBody(),
      });
      setResponse(result);
      showToast(t("common.requestSent", { status: result.statusCode }));
    } catch (error) {
      toastQueryError(showToast, error, "请求发送失败");
    }
  };

  const saveDraft = async () => {
    try {
      await saveRequestMutation.mutateAsync(currentDraft);
      showToast(t("common.savedRequest", { name: currentDraft.name }));
    } catch (error) {
      toastQueryError(showToast, error, "保存失败");
    }
  };

  const resetDraft = () => {
    setName("");
    setMethod("GET");
    setUrl("");
    setBody("");
    setResponse(null);
    showToast(t("common.debugCleared"));
  };

  return (
    <div className={styles.page}>
      <section className={styles.header}>
        <div>
          <h2>{t("debug.title")}</h2>
        </div>
      </section>

      <UiSlotPlaceholder slot="debug-header" />

      <div className={styles.layout}>
        <DebugRequestForm
          body={body}
          currentDraft={currentDraft}
          method={method}
          name={name}
          onCopyCurl={(curlText) => {
            void navigator.clipboard.writeText(curlText).then(() => showToast(t("common.curlCopied")));
          }}
          onReset={resetDraft}
          onRun={() => void runRequest()}
          onSave={() => void saveDraft()}
          setBody={setBody}
          setMethod={setMethod}
          setName={setName}
          setUrl={setUrl}
          t={t}
          url={url}
        />
        <DebugResponsePanel response={response} t={t} />
      </div>
    </div>
  );
}
