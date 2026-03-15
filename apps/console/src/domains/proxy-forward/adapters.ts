import type { ProxyRule } from "@polaris/shared-types";
import { readPersistence } from "../../lib/persistence";
import {
  activeGroupStorageKey,
  groupsStorageKey,
  normalizeGroups,
  syncActiveGroupRulesFromBackend,
} from "./state";
import type { ProxyForwardGroupsData, StoredGroup } from "./types";

export function buildProxyForwardGroupsData(backendRules: ProxyRule[]): ProxyForwardGroupsData {
  const normalized = normalizeGroups(
    readPersistence<StoredGroup[]>(groupsStorageKey, []),
    readPersistence<string | null>(activeGroupStorageKey, null),
    backendRules,
  );

  const groups = syncActiveGroupRulesFromBackend(
    normalized.groups,
    normalized.activeGroupId,
    backendRules,
  );

  return {
    groups,
    activeGroupId: normalized.activeGroupId,
  };
}
