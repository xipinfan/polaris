import type { QueryObserverResult } from "@tanstack/react-query";
import {
  createId,
  derivePath,
  parseSourceUrl,
  sanitizeText,
} from "./proxyForwardHelpers";
import type { StoredForwardRule, StoredGroup } from "../types";

type RefetchResult = PromiseSettledResult<
  QueryObserverResult<unknown, Error> | QueryObserverResult<unknown, unknown>
>;

type BuildSavedRuleError = {
  error: string;
};

type BuildSavedRuleSuccess = {
  nextRule: StoredForwardRule;
  previousPattern: string | null;
  patternChanged: boolean;
};

type NormalizedRuleIdentity = {
  normalizedMethod: string;
  normalizedPath: string;
  parsedSource: ReturnType<typeof parseSourceUrl>;
  pattern: string;
  sourceUrlInput: string;
};

export function hasRefetchFailure(results: RefetchResult[]) {
  return results.some(
    (result) =>
      result.status === "rejected" ||
      (result.status === "fulfilled" && Boolean(result.value.error)),
  );
}

export function updateGroupRules(
  groups: StoredGroup[],
  activeGroupId: string,
  updater: (rules: StoredForwardRule[]) => StoredForwardRule[],
) {
  return groups.map((group) =>
    group.id === activeGroupId ? { ...group, rules: updater(group.rules) } : group,
  );
}

export function hasOtherEnabledRuleWithPattern(
  pattern: string,
  excludeRuleId: string,
  candidateRules: StoredForwardRule[],
) {
  const normalizedPattern = sanitizeText(pattern, "").toLowerCase();
  return candidateRules.some(
    (item) =>
      item.id !== excludeRuleId &&
      item.enabled &&
      sanitizeText(item.pattern, "").toLowerCase() === normalizedPattern,
  );
}

export function normalizeRuleHost(host: unknown) {
  return sanitizeText(host, "").toLowerCase();
}

function normalizeRuleIdentity(ruleForm: StoredForwardRule): NormalizedRuleIdentity {
  const sourceUrlInput = sanitizeText(ruleForm.url, "");
  const parsedSource = parseSourceUrl(sourceUrlInput);

  return {
    normalizedMethod: sanitizeText(ruleForm.method, "GET").toUpperCase(),
    normalizedPath: parsedSource?.path ?? derivePath(ruleForm.path),
    parsedSource,
    pattern: parsedSource?.host ?? sanitizeText(ruleForm.pattern, "").toLowerCase(),
    sourceUrlInput,
  };
}

function findCollidedRule(params: {
  activeRules: StoredForwardRule[];
  editingRule: StoredForwardRule | null;
  normalizedMethod: string;
  normalizedPath: string;
  pattern: string;
}) {
  const { activeRules, editingRule, normalizedMethod, normalizedPath, pattern } = params;
  return activeRules.find(
    (rule) =>
      rule.id !== editingRule?.id &&
      sanitizeText(rule.pattern, "").toLowerCase() === pattern &&
      derivePath(rule.path) === normalizedPath &&
      sanitizeText(rule.method, "GET").toUpperCase() === normalizedMethod,
  );
}

function createSavedRule(params: {
  collidedRule: StoredForwardRule | undefined;
  editingRule: StoredForwardRule | null;
  identity: NormalizedRuleIdentity;
  ruleForm: StoredForwardRule;
}) {
  const { collidedRule, editingRule, identity, ruleForm } = params;
  const { normalizedMethod, normalizedPath, parsedSource, pattern, sourceUrlInput } = identity;

  return {
    ...ruleForm,
    id: editingRule?.id ?? collidedRule?.id ?? createId("proxy-rule"),
    name: sanitizeText(ruleForm.name, "") || parsedSource?.normalizedUrl || sourceUrlInput || pattern,
    method: normalizedMethod,
    pattern,
    url: parsedSource?.normalizedUrl ?? (sourceUrlInput || `https://${pattern}${normalizedPath}`),
    path: normalizedPath,
    createdAt: editingRule?.createdAt ?? new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
}

export function buildSavedRule(params: {
  ruleForm: StoredForwardRule;
  editingRule: StoredForwardRule | null;
  activeRules: StoredForwardRule[];
}): BuildSavedRuleError | BuildSavedRuleSuccess {
  const { activeRules, editingRule, ruleForm } = params;
  const identity = normalizeRuleIdentity(ruleForm);
  const { normalizedMethod, normalizedPath, pattern } = identity;

  if (!pattern) {
    return {
      error: "请填写有效的来源 URL，例如 https://api.example.com/v1/resource",
    };
  }

  const collidedRule = findCollidedRule({
    activeRules,
    editingRule,
    normalizedMethod,
    normalizedPath,
    pattern,
  });
  const nextRule = createSavedRule({
    collidedRule,
    editingRule,
    identity,
    ruleForm,
  });

  return {
    nextRule,
    previousPattern: editingRule?.pattern ?? null,
    patternChanged: Boolean(editingRule && editingRule.pattern !== nextRule.pattern),
  };
}
