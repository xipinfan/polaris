import type { ProxyRule } from "@polaris/shared-types";
import type { StoredGroup } from "../../pages/proxy-forward/types";

export type ProxyForwardGroupsData = {
  groups: StoredGroup[];
  activeGroupId: string;
};

export type SetActiveGroupInput = {
  group: StoredGroup;
};

export type UpsertSiteRuleInput = {
  host: string;
  action: ProxyRule["action"];
};

export type RemoveSiteRuleInput = {
  host: string;
};
