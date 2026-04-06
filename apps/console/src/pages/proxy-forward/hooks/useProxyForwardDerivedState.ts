import { useMemo } from "react";
import type { RequestRecord } from "@polaris/shared-types";
import type { RuleView, SortMode, StoredGroup } from "../types";
import { buildRuleStats, sanitizeText } from "../utils/proxyForwardHelpers";

type UseProxyForwardDerivedStateArgs = {
  activeGroupId: string;
  filterMode: string;
  groupSearch: string;
  groups: StoredGroup[];
  requests: RequestRecord[];
  ruleSearch: string;
  sortMode: SortMode;
};

export function useProxyForwardDerivedState({
  activeGroupId,
  filterMode,
  groupSearch,
  groups,
  requests,
  ruleSearch,
  sortMode,
}: UseProxyForwardDerivedStateArgs) {
  const visibleGroups = useMemo(() => {
    const keyword = sanitizeText(groupSearch, "").toLowerCase();
    return groups.filter(
      (group) => !keyword || group.name.toLowerCase().includes(keyword),
    );
  }, [groupSearch, groups]);

  const activeGroup = useMemo(
    () => groups.find((group) => group.id === activeGroupId) ?? groups[0] ?? null,
    [activeGroupId, groups],
  );

  const rules = useMemo<RuleView[]>(
    () =>
      activeGroup
        ? activeGroup.rules.map((rule) => buildRuleStats(rule, requests))
        : [],
    [activeGroup, requests],
  );

  const filteredRules = useMemo(() => {
    const keyword = sanitizeText(ruleSearch, "").toLowerCase();
    const next = rules.filter((rule) => {
      if (
        keyword &&
        !`${rule.name} ${rule.pattern}`.toLowerCase().includes(keyword)
      ) {
        return false;
      }
      if (filterMode === "enabled" && !rule.enabled) {
        return false;
      }
      if (filterMode === "hits" && rule.hitCountToday === 0) {
        return false;
      }
      if (filterMode === "errors" && rule.recentErrorCount === 0) {
        return false;
      }
      return true;
    });

    next.sort((left, right) => {
      if (sortMode === "hits") {
        return right.hitCountToday - left.hitCountToday;
      }
      return (
        new Date(right.createdAt).getTime() - new Date(left.createdAt).getTime()
      );
    });

    return next;
  }, [filterMode, ruleSearch, rules, sortMode]);

  const overview = useMemo(() => {
    const total = activeGroup?.rules.length ?? 0;
    const enabled =
      activeGroup?.rules.filter((rule) => rule.enabled).length ?? 0;
    const hits = rules.reduce((sum, rule) => sum + rule.hitCountToday, 0);
    const errors = rules.reduce((sum, rule) => sum + rule.recentErrorCount, 0);

    return { total, enabled, hits, errors };
  }, [activeGroup, rules]);

  return {
    activeGroup,
    filteredRules,
    overview,
    rules,
    visibleGroups,
  };
}
