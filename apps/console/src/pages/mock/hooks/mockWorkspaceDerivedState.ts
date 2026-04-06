import type { MockRule } from "@polaris/shared-types";
import type { RuleUrlBlock } from "../types";
import { getMethodWeight, getRuleScene, getUrlSummary } from "../utils/mockHelpers";

export function buildGroupedMockRules(rules: MockRule[], defaultGroup: string) {
  return rules.reduce<Record<string, MockRule[]>>((acc, rule) => {
    const { group } = getRuleScene(rule, defaultGroup);
    acc[group] = [...(acc[group] ?? []), rule];
    return acc;
  }, {});
}

export function buildCurrentGroupRules(
  groupedRules: Record<string, MockRule[]>,
  currentGroup: string,
  defaultGroup: string,
) {
  return [...(groupedRules[currentGroup] ?? [])].sort((left, right) => {
    const leftUrl = getUrlSummary(left.url);
    const rightUrl = getUrlSummary(right.url);
    const urlDiff = leftUrl.blockKey.localeCompare(rightUrl.blockKey, "zh-CN");
    if (urlDiff !== 0) return urlDiff;

    const methodDiff = getMethodWeight(left.method) - getMethodWeight(right.method);
    if (methodDiff !== 0) return methodDiff;

    const leftScene = getRuleScene(left, defaultGroup);
    const rightScene = getRuleScene(right, defaultGroup);
    const variantDiff = leftScene.variant.localeCompare(rightScene.variant, "zh-CN");
    if (variantDiff !== 0) return variantDiff;

    return new Date(right.updatedAt).getTime() - new Date(left.updatedAt).getTime();
  });
}

export function buildRuleBlocks(currentGroupRules: MockRule[]): RuleUrlBlock[] {
  return currentGroupRules.reduce<RuleUrlBlock[]>((blocks, rule) => {
    const summary = getUrlSummary(rule.url);
    const latestBlock = blocks[blocks.length - 1];

    if (!latestBlock || latestBlock.key !== summary.blockKey) {
      blocks.push({ key: summary.blockKey, host: summary.host, label: summary.label, rules: [rule] });
      return blocks;
    }

    latestBlock.rules.push(rule);
    return blocks;
  }, []);
}

export function buildGroupSummaries(
  groups: string[],
  groupedRules: Record<string, MockRule[]>,
  currentGroup: string,
) {
  return groups.map((group) => {
    const rulesInGroup = groupedRules[group] ?? [];
    return {
      group,
      count: rulesInGroup.length,
      enabledCount: rulesInGroup.filter((rule) => rule.enabled).length,
      active: group === currentGroup,
    };
  });
}
