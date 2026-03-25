import type { MockRule } from "@polaris/shared-types";
import type { TranslateFn } from "../../../i18n/I18nProvider";
import { persistenceKeys } from "../../../lib/persistence";
import type { MockFormState } from "../types";

const groupNamePattern = /^\[(.+?)\]\s*(.+)$/;
export const groupsStorageKey = persistenceKeys.mock.groups;
export const groupMetaStorageKey = persistenceKeys.mock.groupMeta;

export function classNames(...values: Array<string | false | null | undefined>) {
  return values.filter(Boolean).join(" ");
}

export function getRuleScene(rule: MockRule, defaultGroup: string) {
  const match = rule.name.match(groupNamePattern);
  if (!match) return { group: defaultGroup, variant: rule.name };
  return { group: match[1].trim() || defaultGroup, variant: match[2].trim() || rule.name };
}

export function buildRuleName(group: string, variant: string) {
  return `[${group.trim()}] ${variant.trim()}`;
}

export function buildUniqueGroupName(baseName: string, existing: string[]) {
  if (!existing.includes(baseName)) return baseName;
  let index = 2;
  let nextName = `${baseName} ${index}`;
  while (existing.includes(nextName)) {
    index += 1;
    nextName = `${baseName} ${index}`;
  }
  return nextName;
}

export function buildUniqueVariantName(baseName: string, existing: Iterable<string>) {
  const existingNames = new Set(Array.from(existing, (value) => value.trim()));
  if (!existingNames.has(baseName)) {
    return baseName;
  }

  let index = 2;
  let nextName = `${baseName} ${index}`;
  while (existingNames.has(nextName)) {
    index += 1;
    nextName = `${baseName} ${index}`;
  }
  return nextName;
}

export function buildEmptyForm(group: string): MockFormState {
  return {
    group,
    variant: "",
    method: "GET",
    url: "",
    requestBodyExactMatch: "",
    requestBodyKeyMatch: "",
    responseStatus: 200,
    responseHeaders: "{}",
    responseBody: "{}",
    enabled: true,
    allowProxy: false,
    delayMs: 0,
    priority: 100,
  };
}

export function buildFormFromRule(rule: MockRule, group: string, defaultGroup: string): MockFormState {
  const scene = getRuleScene(rule, defaultGroup);
  return {
    group,
    variant: scene.variant,
    method: rule.method,
    url: rule.url,
    requestBodyExactMatch: rule.requestBodyExactMatch ?? "",
    requestBodyKeyMatch: rule.requestBodyKeyMatch ?? "",
    responseStatus: rule.responseStatus,
    responseHeaders: JSON.stringify(rule.responseHeaders ?? {}, null, 2),
    responseBody: JSON.stringify(rule.responseBody ?? {}, null, 2),
    enabled: rule.enabled,
    allowProxy: false,
    delayMs: 0,
    priority: 100,
  };
}

export function getQueryCount(url: string) {
  try {
    return Array.from(new URL(url).searchParams.keys()).length;
  } catch {
    return 0;
  }
}

export function getMethodWeight(method: string) {
  const order = ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS", "HEAD"];
  const index = order.indexOf(method.toUpperCase());
  return index === -1 ? order.length : index;
}

export function getUrlSummary(url: string) {
  const normalizedUrl = url.trim();
  try {
    const parsed = new URL(normalizedUrl);
    return {
      blockKey: normalizedUrl,
      host: parsed.host,
      label: normalizedUrl,
      full: normalizedUrl,
    };
  } catch {
    return { blockKey: normalizedUrl, host: "", label: normalizedUrl, full: normalizedUrl };
  }
}

export function getResponseKind(rule: MockRule, t: TranslateFn) {
  const contentType = rule.responseHeaders["content-type"] ?? rule.responseHeaders["Content-Type"] ?? "";
  if (typeof rule.responseBody === "object" && rule.responseBody !== null) return t("mock.ruleResponseStaticJson");
  if (String(contentType).toLowerCase().includes("json")) return t("mock.ruleResponseStaticJson");
  if (typeof rule.responseBody === "string") return t("mock.ruleResponseStaticText");
  return t("mock.ruleResponseFixed");
}

export function getMatchSummary(queryCount: number, t: TranslateFn) {
  return [
    t("mock.ruleMatchMode"),
    t("mock.ruleMatchQueryCount", { count: queryCount }),
    t("mock.ruleMatchHeaderCount", { count: 0 }),
    t("mock.ruleMatchBodyCount", { count: 0 }),
  ].join(" · ");
}
