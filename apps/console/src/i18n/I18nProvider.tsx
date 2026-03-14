import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { consoleMessages, type ConsoleLocale, type ConsoleMessageKey } from "./messages";
import { persistenceKeys, readPersistence, writePersistence } from "../lib/persistence";

export type TranslateParams = Record<string, string | number>;
export type TranslateFn = (
  key: ConsoleMessageKey,
  params?: TranslateParams,
) => string;

type I18nContextValue = {
  locale: ConsoleLocale;
  setLocale: (locale: ConsoleLocale) => void;
  t: TranslateFn;
};

const I18nContext = createContext<I18nContextValue | null>(null);

function detectInitialLocale(): ConsoleLocale {
  if (typeof window === "undefined") {
    return "zh-CN";
  }

  const stored = readPersistence<ConsoleLocale | null>(persistenceKeys.locale, null);
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

export function ConsoleI18nProvider({ children }: { children: ReactNode }) {
  const [locale, setLocale] = useState<ConsoleLocale>(detectInitialLocale);

  useEffect(() => {
    writePersistence(persistenceKeys.locale, locale);
  }, [locale]);

  const value = useMemo<I18nContextValue>(
    () => ({
      locale,
      setLocale,
      t: (key, params) => {
        const message = consoleMessages[locale][key] ?? consoleMessages["en-US"][key] ?? key;
        return formatMessage(message, params);
      }
    }),
    [locale]
  );

  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}

export function useConsoleI18n() {
  const context = useContext(I18nContext);
  if (!context) {
    throw new Error("useConsoleI18n must be used within ConsoleI18nProvider");
  }

  return context;
}
