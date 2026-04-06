import { createContext, useContext, useMemo, type ReactNode } from "react";
import { consoleMessages, type ConsoleMessageKey } from "./messages";

export type TranslateParams = Record<string, string | number>;
export type TranslateFn = (
  key: ConsoleMessageKey,
  params?: TranslateParams,
) => string;

type I18nContextValue = {
  t: TranslateFn;
};

const I18nContext = createContext<I18nContextValue | null>(null);

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
  const value = useMemo<I18nContextValue>(
    () => ({
      t: (key, params) => {
        const message = consoleMessages[key] ?? key;
        return formatMessage(message, params);
      }
    }),
    []
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
