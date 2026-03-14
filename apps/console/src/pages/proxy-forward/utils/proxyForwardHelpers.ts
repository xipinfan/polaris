import type { ProxyRule, RequestRecord } from "@polaris/shared-types";
import { persistenceKeys } from "../../../lib/persistence";
import type { RuleView, StoredForwardRule, StoredGroup } from "../types";

export const groupsStorageKey = persistenceKeys.proxyForward.groups;
export const activeGroupStorageKey = persistenceKeys.proxyForward.activeGroup;
export const defaultGroupLabel = "默认组";
export const defaultMatchMode = "精确匹配";
export const defaultMatchValue = "继承原请求";

export function classNames(...values: Array<string | false | null | undefined>) {
  return values.filter(Boolean).join(" ");
}

export function createId(prefix: string) {
  return `${prefix}-${Math.random().toString(36).slice(2, 10)}`;
}

export function sanitizeText(value: string | null | undefined, fallback: string) {
  const next = (value ?? "").trim();
  if (!next || next.toLowerCase() === "undefined" || next.toLowerCase() === "null") {
    return fallback;
  }
  return next;
}

export function derivePath(source: string | null | undefined) {
  const next = sanitizeText(source, "/");
  if (next.startsWith("/")) {
    return next;
  }
  try {
    return new URL(next).pathname || "/";
  } catch {
    return "/";
  }
}

export function derivePattern(
  pattern: string | null | undefined,
  sourceUrl?: string | null | undefined,
  targetUrl?: string | null | undefined,
) {
  const safePattern = sanitizeText(pattern, "");
  if (safePattern) {
    return safePattern;
  }
  for (const candidate of [sourceUrl, targetUrl]) {
    const safeCandidate = sanitizeText(candidate, "");
    if (!safeCandidate) {
      continue;
    }
    try {
      return new URL(safeCandidate).host;
    } catch {
      continue;
    }
  }
  return "api.example.com";
}

export function buildRuleUrl(pattern: string, path: string, sourceUrl?: string | null | undefined) {
  const safeSourceUrl = sanitizeText(sourceUrl, "");
  if (safeSourceUrl) {
    return safeSourceUrl;
  }
  return `https://${pattern}${derivePath(path)}`;
}

export function formatTime(value: string | null | undefined) {
  if (!value) {
    return "暂无";
  }
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return value;
  }
  return new Intl.DateTimeFormat("zh-CN", {
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
}

function isToday(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return false;
  }
  const now = new Date();
  return (
    date.getFullYear() === now.getFullYear() &&
    date.getMonth() === now.getMonth() &&
    date.getDate() === now.getDate()
  );
}

export function buildStoredRuleFromBackend(
  rule: ProxyRule,
  current?: Partial<StoredForwardRule>,
): StoredForwardRule {
  const pattern = derivePattern(current?.pattern ?? rule.pattern, current?.url, current?.targetUrl);
  const path = derivePath(current?.path ?? current?.url ?? "/");
  const targetUrl = sanitizeText(current?.targetUrl, `http://127.0.0.1:9000${path}`);
  return {
    id: rule.id,
    name: sanitizeText(current?.name, pattern),
    pattern,
    method: sanitizeText(current?.method, "GET").toUpperCase(),
    url: buildRuleUrl(pattern, path, current?.url),
    path,
    priority: current?.priority ?? 100,
    action: rule.action,
    enabled: rule.enabled,
    matchMode: sanitizeText(current?.matchMode, defaultMatchMode),
    queryMatch: sanitizeText(current?.queryMatch, defaultMatchValue),
    headerMatch: sanitizeText(current?.headerMatch, defaultMatchValue),
    bodyMatch: sanitizeText(current?.bodyMatch, defaultMatchValue),
    forwardMode: current?.forwardMode ?? (rule.action === "direct" ? "direct" : "rewriteTarget"),
    targetUrl,
    rewriteHost: sanitizeText(current?.rewriteHost, pattern),
    rewritePath: derivePath(current?.rewritePath ?? path),
    rewriteQuery: sanitizeText(current?.rewriteQuery, ""),
    headerStrategy: current?.headerStrategy ?? "keep",
    requestHeaderPreview: current?.requestHeaderPreview ?? '{\n  "x-env": "local"\n}',
    responseHeaderPreview: current?.responseHeaderPreview ?? '{\n  "x-proxy-source": "polaris"\n}',
    responseDelay: current?.responseDelay ?? 0,
    fallbackPolicy: current?.fallbackPolicy ?? "closed",
    createdAt: rule.createdAt,
    updatedAt: rule.updatedAt,
  };
}

export function buildGroupFromRules(name: string, rules: ProxyRule[]): StoredGroup {
  return {
    id: createId("proxy-group"),
    name,
    rules: rules.map((rule) => buildStoredRuleFromBackend(rule)),
  };
}

export function buildEmptyRule(activeGroupName: string): StoredForwardRule {
  const pattern = "api.example.com";
  return {
    id: createId("proxy-rule"),
    name: "",
    pattern,
    method: "GET",
    url: `https://${pattern}/v1/resource`,
    path: "/v1/resource",
    priority: 100,
    action: "proxy",
    enabled: true,
    matchMode: defaultMatchMode,
    queryMatch: defaultMatchValue,
    headerMatch: defaultMatchValue,
    bodyMatch: defaultMatchValue,
    forwardMode: "rewriteTarget",
    targetUrl: "http://127.0.0.1:9000/v1/resource",
    rewriteHost: pattern,
    rewritePath: "/v1/resource",
    rewriteQuery: "",
    headerStrategy: "keep",
    requestHeaderPreview: '{\n  "x-group": "' + activeGroupName + '"\n}',
    responseHeaderPreview: '{\n  "x-proxy-source": "polaris"\n}',
    responseDelay: 0,
    fallbackPolicy: "closed",
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
}

export function normalizeGroups(
  storedGroups: StoredGroup[],
  backendRules: ProxyRule[],
  storedActiveGroupId: string | null,
) {
  if (storedGroups.length === 0) {
    const defaultGroup = buildGroupFromRules(defaultGroupLabel, backendRules);
    return { groups: [defaultGroup], activeGroupId: defaultGroup.id };
  }
  const activeGroupId =
    storedActiveGroupId && storedGroups.some((group) => group.id === storedActiveGroupId)
      ? storedActiveGroupId
      : storedGroups[0].id;
  const groups = storedGroups.map((group) => {
    if (group.id !== activeGroupId) {
      return group;
    }
    const backendByPattern = new Map(backendRules.map((rule) => [rule.pattern, rule]));
    const rules = group.rules.map((rule) => {
      const next = backendByPattern.get(rule.pattern);
      if (!next) {
        return { ...rule, enabled: false };
      }
      backendByPattern.delete(rule.pattern);
      return buildStoredRuleFromBackend(next, rule);
    });
    backendByPattern.forEach((rule) => {
      rules.push(buildStoredRuleFromBackend(rule));
    });
    return { ...group, rules };
  });
  return { groups, activeGroupId };
}

export function buildRuleStats(rule: StoredForwardRule, requests: RequestRecord[]): RuleView {
  const recentRecords = requests
    .filter((request) => request.host === rule.pattern)
    .sort((left, right) => {
      return new Date(right.createdAt).getTime() - new Date(left.createdAt).getTime();
    });
  return {
    ...rule,
    hitCountToday: recentRecords.filter((record) => isToday(record.createdAt)).length,
    recentErrorCount: recentRecords.filter((record) => record.statusCode >= 400).length,
    lastHitAt: recentRecords[0]?.createdAt ?? null,
    latestRecord: recentRecords[0] ?? null,
    recentRecords: recentRecords.slice(0, 10),
  };
}
