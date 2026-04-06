import { useEffect, useMemo, useState } from "react";
import { useLocation } from "react-router-dom";
import type { RequestRecord } from "@polaris/shared-types";
import { useRunDebugRequestMutation, useSaveDebugRequestMutation } from "../../domains/debug/mutations";
import { useToast } from "../../features/feedback/ToastProvider";
import { UiSlotPlaceholder } from "../../features/slots/UiSlotPlaceholder";
import { toastQueryError } from "../../lib/query/queryOptions";
import { copyTextToClipboard } from "../../utils/clipboard";
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

type DebugDraftFields = {
  name: string;
  method: string;
  url: string;
  body: string;
};

type DebugPageContentProps = {
  initialDraft: DebugDraftFields;
};

function buildInitialDraftFields(routeState: DebugDraftState | null): DebugDraftFields {
  const draft = routeState?.draft;
  return {
    name: draft?.name ?? "",
    method: draft?.method ?? "GET",
    url: draft?.url ?? "",
    body: draft ? JSON.stringify(draft.body ?? {}, null, 2) : "",
  };
}

function parseDebugRequestBody(method: string, body: string) {
  if (method === "GET") {
    return {
      value: undefined as unknown,
      error: null as Error | null,
    };
  }

  try {
    return {
      value: JSON.parse(body || "{}") as unknown,
      error: null,
    };
  } catch (error) {
    return {
      value: undefined,
      error: error instanceof Error ? error : new Error("请求体 JSON 无法解析"),
    };
  }
}

export function DebugPage() {
  const location = useLocation();
  const routeState = location.state as DebugDraftState | null;
  const { showToast } = useToast();

  useEffect(() => {
    if (!routeState?.draft) {
      return;
    }

    showToast("已带入一条请求草稿，你可以继续修改后发送。");
  }, [routeState?.draft, showToast]);

  return (
    <DebugPageContent
      key={location.key}
      initialDraft={buildInitialDraftFields(routeState)}
    />
  );
}

function DebugPageContent({ initialDraft }: DebugPageContentProps) {
  const [method, setMethod] = useState(() => initialDraft.method);
  const [url, setUrl] = useState(() => initialDraft.url);
  const [body, setBody] = useState(() => initialDraft.body);
  const [name, setName] = useState(() => initialDraft.name);
  const [response, setResponse] = useState<RequestRecord | null>(null);
  const runRequestMutation = useRunDebugRequestMutation();
  const saveRequestMutation = useSaveDebugRequestMutation();
  const { showToast } = useToast();

  const parsedBody = useMemo(() => parseDebugRequestBody(method, body), [body, method]);

  const currentDraft = useMemo(
    () => ({
      name: name || "debug-request",
      method,
      url,
      headers: {},
      query: {},
      body: method === "GET" ? null : parsedBody.value,
      tags: ["debug"],
    }),
    [method, name, parsedBody.value, url],
  );

  const runRequest = async () => {
    if (parsedBody.error) {
      showToast(parsedBody.error.message, "error");
      return;
    }

    try {
      const result = await runRequestMutation.mutateAsync({
        method,
        url,
        body: parsedBody.value,
      });
      setResponse(result);
      showToast(`请求已发送，状态码 ${result.statusCode}`);
    } catch (error) {
      toastQueryError(showToast, error, "请求发送失败");
    }
  };

  const saveDraft = async () => {
    if (parsedBody.error) {
      showToast(parsedBody.error.message, "error");
      return;
    }

    try {
      await saveRequestMutation.mutateAsync(currentDraft);
      showToast(`已保存请求：${currentDraft.name}`);
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
    showToast("已清空调试表单");
  };

  return (
    <div className={styles.page}>
      <section className={styles.header}>
        <div>
          <h2>{"调试"}</h2>
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
            void copyTextToClipboard(curlText)
              .then(() => {
                showToast("已复制 curl 命令");
              })
              .catch(() => {
                showToast("复制失败", "error");
              });
          }}
          onReset={resetDraft}
          onRun={() => void runRequest()}
          onSave={() => void saveDraft()}
          setBody={setBody}
          setMethod={setMethod}
          setName={setName}
          setUrl={setUrl}
          url={url}
        />
        <DebugResponsePanel response={response} />
      </div>
    </div>
  );
}
