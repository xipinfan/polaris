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

export function sanitizeText(value: unknown, fallback: string) {
  const next =
    typeof value === "string"
      ? value.trim()
      : value == null
        ? ""
        : String(value).trim();
  if (!next || next.toLowerCase() === "undefined" || next.toLowerCase() === "null") {
    return fallback;
  }
  return next;
}

export function derivePath(source: unknown) {
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

export function parseSourceUrl(input: unknown): {
  host: string;
  path: string;
  normalizedUrl: string;
} | null {
  const raw = sanitizeText(input, "");
  if (!raw) {
    return null;
  }

  const candidates = [raw];
  if (!/^[a-z][a-z0-9+.-]*:\/\//i.test(raw)) {
    candidates.push(`https://${raw.replace(/^\/+/, "")}`);
  }

  for (const candidate of candidates) {
    try {
      const parsed = new URL(candidate);
      const host = sanitizeText(parsed.host, "").toLowerCase();
      if (!host) {
        continue;
      }
      const path = derivePath(parsed.pathname || "/");
      return {
        host,
        path,
        normalizedUrl: `https://${host}${path}`,
      };
    } catch {
      // try next candidate
    }
  }

  // Fallback for host/path or host-only text.
  const withoutProtocol = raw.replace(/^[a-z][a-z0-9+.-]*:\/\//i, "");
  const slashIndex = withoutProtocol.indexOf("/");
  const hostPart = slashIndex >= 0 ? withoutProtocol.slice(0, slashIndex) : withoutProtocol;
  const pathPart = slashIndex >= 0 ? withoutProtocol.slice(slashIndex) : "/";
  const host = sanitizeText(hostPart, "").toLowerCase();
  if (!host) {
    return null;
  }

  const path = derivePath(pathPart);
  return {
    host,
    path,
    normalizedUrl: `https://${host}${path}`,
  };
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
  const parsedSource = parseSourceUrl(current?.url ?? "");
  const pattern = derivePattern(current?.pattern ?? rule.pattern, parsedSource?.normalizedUrl, current?.targetUrl);
  const path = derivePath(current?.path ?? parsedSource?.path ?? "/");
  const targetUrl = sanitizeText(current?.targetUrl, `http://127.0.0.1:3000${path}`);
  return {
    id: rule.id,
    name: sanitizeText(current?.name, pattern),
    pattern,
    method: sanitizeText(current?.method, "GET").toUpperCase(),
    url: buildRuleUrl(pattern, path, parsedSource?.normalizedUrl ?? current?.url),
    path,
    priority: current?.priority ?? 100,
    action: rule.action,
    enabled: rule.enabled,
    matchMode: sanitizeText(current?.matchMode, defaultMatchMode),
    queryMatch: sanitizeText(current?.queryMatch, defaultMatchValue),
    headerMatch: sanitizeText(current?.headerMatch, defaultMatchValue),
    bodyMatch: sanitizeText(current?.bodyMatch, defaultMatchValue),
    forwardMode: rule.forwardMode ?? current?.forwardMode ?? (rule.action === "direct" ? "direct" : "rewriteTarget"),
    targetUrl: sanitizeText(rule.targetUrl, targetUrl),
    rewriteHost: sanitizeText(rule.rewriteHost, sanitizeText(current?.rewriteHost, pattern)),
    rewritePath: derivePath(rule.rewritePath ?? current?.rewritePath ?? path),
    rewriteQuery: sanitizeText(current?.rewriteQuery, ""),
    headerStrategy: current?.headerStrategy ?? "keep",
    requestHeaderPreview: current?.requestHeaderPreview ?? '{\n  "x-env": "local"\n}',
    responseHeaderPreview: current?.responseHeaderPreview ?? '{\n  "x-proxy-source": "polaris"\n}',
    responseDelay: current?.responseDelay ?? 0,
    fallbackPolicy: current?.fallbackPolicy ?? "closed",
    // Keep local timeline stable so list ordering does not jump after backend sync.
    createdAt: sanitizeText(current?.createdAt, rule.createdAt),
    updatedAt: sanitizeText(current?.updatedAt, rule.updatedAt),
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
  const sourceUrl = `https://${pattern}/v1/resource`;
  return {
    id: createId("proxy-rule"),
    name: sourceUrl,
    pattern,
    method: "GET",
    url: sourceUrl,
    path: "/v1/resource",
    priority: 100,
    action: "proxy",
    enabled: true,
    matchMode: defaultMatchMode,
    queryMatch: defaultMatchValue,
    headerMatch: defaultMatchValue,
    bodyMatch: defaultMatchValue,
    forwardMode: "rewriteTarget",
    targetUrl: "http://127.0.0.1:3000/v1/resource",
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

function coerceStoredRule(input: unknown, groupName: string): StoredForwardRule {
  const fallback = buildEmptyRule(groupName);
  const candidate = typeof input === "object" && input ? (input as Record<string, unknown>) : {};
  const parsedSource = parseSourceUrl(candidate.url);
  const pattern = sanitizeText(candidate.pattern, parsedSource?.host ?? fallback.pattern).toLowerCase();
  const path = derivePath(candidate.path ?? parsedSource?.path ?? candidate.url);

  return {
    ...fallback,
    id: sanitizeText(candidate.id, fallback.id),
    name: sanitizeText(candidate.name, pattern),
    pattern,
    method: sanitizeText(candidate.method, fallback.method).toUpperCase(),
    path,
    url: sanitizeText(candidate.url, `https://${pattern}${path}`),
    action: candidate.action === "direct" ? "direct" : "proxy",
    enabled: Boolean(candidate.enabled),
    matchMode: sanitizeText(candidate.matchMode, fallback.matchMode),
    queryMatch: sanitizeText(candidate.queryMatch, fallback.queryMatch),
    headerMatch: sanitizeText(candidate.headerMatch, fallback.headerMatch),
    bodyMatch: sanitizeText(candidate.bodyMatch, fallback.bodyMatch),
    forwardMode:
      candidate.forwardMode === "direct" ||
      candidate.forwardMode === "rewriteHost" ||
      candidate.forwardMode === "rewritePath"
        ? candidate.forwardMode
        : "rewriteTarget",
    targetUrl: sanitizeText(candidate.targetUrl, fallback.targetUrl),
    rewriteHost: sanitizeText(candidate.rewriteHost, pattern),
    rewritePath: derivePath(candidate.rewritePath ?? path),
    rewriteQuery: sanitizeText(candidate.rewriteQuery, ""),
    headerStrategy:
      candidate.headerStrategy === "inject" ||
      candidate.headerStrategy === "override" ||
      candidate.headerStrategy === "remove"
        ? candidate.headerStrategy
        : "keep",
    requestHeaderPreview: sanitizeText(candidate.requestHeaderPreview, fallback.requestHeaderPreview),
    responseHeaderPreview: sanitizeText(candidate.responseHeaderPreview, fallback.responseHeaderPreview),
    responseDelay:
      typeof candidate.responseDelay === "number" && Number.isFinite(candidate.responseDelay)
        ? candidate.responseDelay
        : fallback.responseDelay,
    fallbackPolicy:
      candidate.fallbackPolicy === "directOnFail" || candidate.fallbackPolicy === "ignoreOnMiss"
        ? candidate.fallbackPolicy
        : "closed",
    createdAt: sanitizeText(candidate.createdAt, fallback.createdAt),
    updatedAt: sanitizeText(candidate.updatedAt, fallback.updatedAt),
  };
}

function coerceStoredGroups(input: StoredGroup[]): StoredGroup[] {
  if (!Array.isArray(input)) {
    return [];
  }

  return input
    .map((group) => {
      const candidate = typeof group === "object" && group ? (group as Record<string, unknown>) : {};
      const name = sanitizeText(candidate.name, defaultGroupLabel);
      const ruleCandidates = Array.isArray(candidate.rules) ? candidate.rules : [];
      const rules = ruleCandidates.map((rule) => coerceStoredRule(rule, name));

      return {
        id: sanitizeText(candidate.id, createId("proxy-group")),
        name,
        rules,
      };
    })
    .filter((group) => group.id);
}

export function normalizeGroups(
  storedGroups: StoredGroup[],
  storedActiveGroupId: string | null,
  fallbackRules: ProxyRule[] = [],
) {
  const safeStoredGroups = coerceStoredGroups(storedGroups);

  if (safeStoredGroups.length === 0) {
    const defaultGroup = buildGroupFromRules(defaultGroupLabel, fallbackRules);
    return {
      groups: [defaultGroup],
      activeGroupId: defaultGroup.id,
    };
  }
  const activeGroupId =
    storedActiveGroupId && safeStoredGroups.some((group) => group.id === storedActiveGroupId)
      ? storedActiveGroupId
      : safeStoredGroups[0].id;
  return { groups: safeStoredGroups, activeGroupId };
}

export function syncActiveGroupRulesFromBackend(
  groups: StoredGroup[],
  activeGroupId: string,
  backendRules: ProxyRule[],
) {
  const backendByPattern = new Map(
    backendRules.map((rule) => [sanitizeText(rule.pattern, "").toLowerCase(), rule]),
  );

  return groups.map((group) => {
    if (group.id !== activeGroupId) {
      return group;
    }

    const existingByPattern = new Map(
      group.rules.map((rule) => [sanitizeText(rule.pattern, "").toLowerCase(), rule] as const),
    );

    const syncedFromBackend = backendRules.map((backendRule) =>
      buildStoredRuleFromBackend(
        backendRule,
        existingByPattern.get(sanitizeText(backendRule.pattern, "").toLowerCase()),
      ),
    );

    const localOnlyRules = group.rules
      .filter((rule) => !backendByPattern.has(sanitizeText(rule.pattern, "").toLowerCase()))
      .map((rule) => ({ ...rule, enabled: false }));

    const rules = [...syncedFromBackend, ...localOnlyRules];

    return { ...group, rules };
  });
}

export function buildRuleStats(rule: StoredForwardRule, requests: RequestRecord[]): RuleView {
  const normalizedRuleHost = sanitizeText(rule.pattern, "").toLowerCase();
  const normalizedRulePath = derivePath(rule.path);
  const normalizedRuleMethod = sanitizeText(rule.method, "GET").toUpperCase();

  const recentRecords = requests
    .filter((request) => {
      const hostMatched = sanitizeText(request.host, "").toLowerCase() === normalizedRuleHost;
      if (!hostMatched) {
        return false;
      }

      const requestPath = derivePath(request.path);
      if (requestPath !== normalizedRulePath) {
        return false;
      }

      return sanitizeText(request.method, "GET").toUpperCase() === normalizedRuleMethod;
    })
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
