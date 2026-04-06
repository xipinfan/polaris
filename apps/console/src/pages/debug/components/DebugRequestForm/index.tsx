import { buildCurl } from "../../../../features/common/curl";
import localStyles from "./index.module.css";

type DebugRequestFormProps = {
  method: string;
  name: string;
  url: string;
  body: string;
  currentDraft: {
    name: string;
    method: string;
    url: string;
    headers: Record<string, string>;
    query: Record<string, string>;
    body: unknown;
    tags: string[];
  };
  setName: (value: string) => void;
  setMethod: (value: string) => void;
  setUrl: (value: string) => void;
  setBody: (value: string) => void;
  onRun: () => void;
  onSave: () => void;
  onReset: () => void;
  onCopyCurl: (curlText: string) => void;
};

export function DebugRequestForm({
  method,
  name,
  url,
  body,
  currentDraft,
  setName,
  setMethod,
  setUrl,
  setBody,
  onRun,
  onSave,
  onReset,
  onCopyCurl,
}: DebugRequestFormProps) {
  return (
    <form
      className={localStyles.form}
      data-testid="debug-request-form"
      onSubmit={(event) => {
        event.preventDefault();
        onRun();
      }}
    >
      <div className={localStyles.panelHeading}>
        <div>
          <h3>{"请求草稿"}</h3>
        </div>
      </div>
      <input
        data-testid="debug-name-input"
        onChange={(event) => setName(event.target.value)}
        placeholder={"请求名称（可选）"}
        value={name}
      />
      <select data-testid="debug-method-select" onChange={(event) => setMethod(event.target.value)} value={method}>
        <option>GET</option>
        <option>POST</option>
        <option>PUT</option>
        <option>DELETE</option>
      </select>
      <input
        data-testid="debug-url-input"
        onChange={(event) => setUrl(event.target.value)}
        placeholder={"完整 URL"}
        value={url}
      />
      <textarea
        data-testid="debug-body-input"
        onChange={(event) => setBody(event.target.value)}
        placeholder={"请求体 JSON"}
        rows={12}
        value={body}
      />
      <div className={localStyles.buttonGrid}>
        <button className={localStyles.primaryAction} data-testid="debug-send-button" type="submit">
          {"发送请求"}
        </button>
        <button className={localStyles.ghostButton} data-testid="debug-save-button" onClick={onSave} type="button">
          {"保存请求"}
        </button>
        <button className={localStyles.ghostButton} data-testid="debug-clear-button" onClick={onReset} type="button">
          {"清空"}
        </button>
        <button
          className={localStyles.ghostButton}
          data-testid="debug-copy-curl-button"
          onClick={() => onCopyCurl(buildCurl(currentDraft))}
          type="button"
        >
          {"复制 curl"}
        </button>
      </div>
    </form>
  );
}
