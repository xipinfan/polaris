import { createContext, useContext, useMemo, useState, type ReactNode } from "react";
import { extensionMessages, type ExtensionLocale, type ExtensionMessageKey } from "./messages";

type TranslateParams = Record<string, string | number>;

type I18nContextValue = {
  locale: ExtensionLocale;
  t: (key: ExtensionMessageKey, params?: TranslateParams) => string;
};

const STORAGE_KEY = "polaris.extension.locale";

const I18nContext = createContext<I18nContextValue | null>(null);

function detectInitialLocale(): ExtensionLocale {
  if (typeof window === "undefined") {
    return "zh-CN";
  }

  const stored = window.localStorage.getItem(STORAGE_KEY);
  if (stored === "zh-CN" || stored === "en-US") {
    return stored;
  }

  return "zh-CN";
}

function formatMessage(template: string, params?: TranslateParams) {
  if (!params) {
    return template;
  }

  return Object.entries(params).reduce(
    (result, [key, value]) => result.replaceAll(`{${key}}`, String(value)),
    template
  );
}

export function ExtensionI18nProvider({ children }: { children: ReactNode }) {
  const [locale] = useState<ExtensionLocale>(detectInitialLocale);

  const value = useMemo<I18nContextValue>(
    () => ({
      locale,
      t: (key, params) => {
        const message = extensionMessages[locale][key] ?? extensionMessages["en-US"][key] ?? key;
        return formatMessage(message, params);
      }
    }),
    [locale]
  );

  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}

export function useExtensionI18n() {
  const context = useContext(I18nContext);
  if (!context) {
    throw new Error("useExtensionI18n must be used within ExtensionI18nProvider");
  }

  return context;
}
