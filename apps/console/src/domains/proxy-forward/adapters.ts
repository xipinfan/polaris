import type { ProxyRule } from "@polaris/shared-types";
import { readPersistence } from "../../lib/persistence";
import type { StoredGroup } from "../../pages/proxy-forward/types";
import {
  activeGroupStorageKey,
  groupsStorageKey,
  normalizeGroups,
} from "../../pages/proxy-forward/utils/proxyForwardHelpers";
import type { ProxyForwardGroupsData } from "./types";

export function buildProxyForwardGroupsData(backendRules: ProxyRule[]): ProxyForwardGroupsData {
  const normalized = normalizeGroups(
    readPersistence<StoredGroup[]>(groupsStorageKey, []),
    backendRules,
    readPersistence<string | null>(activeGroupStorageKey, null),
  );

  return {
    groups: normalized.groups,
    activeGroupId: normalized.activeGroupId,
  };
}
