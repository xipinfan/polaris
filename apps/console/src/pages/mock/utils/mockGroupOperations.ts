import type { MockRule } from "@polaris/shared-types";
import type { GroupMetaMap } from "../types";
import { buildUniqueGroupName } from "./mockHelpers";
import { buildMockRulePayloadFromRule } from "./mockImportExport";

type CreateRule = (payload: ReturnType<typeof buildMockRulePayloadFromRule>) => Promise<unknown>;
type UpdateRule = (id: string, payload: ReturnType<typeof buildMockRulePayloadFromRule>) => Promise<unknown>;
type DeleteRule = (id: string) => Promise<unknown>;

type RenameMockGroupArgs = {
  defaultGroup: string;
  groupName: string;
  groupRules: MockRule[];
  nextName: string;
  updateRule: UpdateRule;
};

type CopyMockGroupArgs = {
  createRule: CreateRule;
  defaultGroup: string;
  groupName: string;
  groupRules: MockRule[];
  groups: string[];
};

type DeleteMockGroupArgs = {
  deleteRule: DeleteRule;
  groupRules: MockRule[];
};

export function renameMockGroupMeta(groupMeta: GroupMetaMap, groupName: string, nextName: string) {
  const next = { ...groupMeta };
  next[nextName] = next[groupName];
  delete next[groupName];
  return next;
}

export async function renameMockGroup({
  defaultGroup,
  groupRules,
  nextName,
  updateRule,
}: RenameMockGroupArgs) {
  await Promise.all(
    groupRules.map((rule) =>
      updateRule(rule.id, buildMockRulePayloadFromRule(rule, nextName, defaultGroup)),
    ),
  );
}

export async function copyMockGroup({
  createRule,
  defaultGroup,
  groupName,
  groupRules,
  groups,
}: CopyMockGroupArgs) {
  const nextName = buildUniqueGroupName(`${groupName} 副本`, groups);

  await Promise.all(
    groupRules.map((rule) =>
      createRule(buildMockRulePayloadFromRule(rule, nextName, defaultGroup, { enabled: false })),
    ),
  );

  return nextName;
}

export async function deleteMockGroup({ deleteRule, groupRules }: DeleteMockGroupArgs) {
  await Promise.all(groupRules.map((rule) => deleteRule(rule.id)));
}
