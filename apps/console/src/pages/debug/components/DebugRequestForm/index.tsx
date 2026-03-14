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
  t: (key: any, params?: Record<string, string | number>) => string;
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
  t,
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
      onSubmit={(event) => {
        event.preventDefault();
        onRun();
      }}
    >
      <div className={localStyles.panelHeading}>
        <div>
          <h3>{t("debug.formTitle")}</h3>
        </div>
      </div>
      <input
        onChange={(event) => setName(event.target.value)}
        placeholder={t("debug.namePlaceholder")}
        value={name}
      />
      <select onChange={(event) => setMethod(event.target.value)} value={method}>
        <option>GET</option>
        <option>POST</option>
        <option>PUT</option>
        <option>DELETE</option>
      </select>
      <input
        onChange={(event) => setUrl(event.target.value)}
        placeholder={t("debug.urlPlaceholder")}
        value={url}
      />
      <textarea
        onChange={(event) => setBody(event.target.value)}
        placeholder={t("debug.bodyPlaceholder")}
        rows={12}
        value={body}
      />
      <div className={localStyles.buttonGrid}>
        <button className={localStyles.primaryAction} type="submit">
          {t("debug.send")}
        </button>
        <button className={localStyles.ghostButton} onClick={onSave} type="button">
          {t("debug.save")}
        </button>
        <button className={localStyles.ghostButton} onClick={onReset} type="button">
          {t("debug.clear")}
        </button>
        <button
          className={localStyles.ghostButton}
          onClick={() => onCopyCurl(buildCurl(currentDraft))}
          type="button"
        >
          {t("debug.copyCurl")}
        </button>
      </div>
    </form>
  );
}
