import { createMockRuleTool } from "../tools/createMockRule";
import { clearRequestsTool } from "../tools/clearRequests";
import { deleteMockRuleTool } from "../tools/deleteMockRule";
import { deleteSavedRequestTool } from "../tools/deleteSavedRequest";
import { enableMockRuleTool } from "../tools/enableMockRule";
import { getActiveMockGroupTool } from "../tools/getActiveMockGroup";
import { getCertificateInstallGuideTool } from "../tools/getCertificateInstallGuide";
import { getCertificateStatusTool } from "../tools/getCertificateStatus";
import { getProxyDecisionTool } from "../tools/getProxyDecision";
import { getMockRuleDetailTool } from "../tools/getMockRuleDetail";
import { getProxyRuleDetailTool } from "../tools/getProxyRuleDetail";
import { getProxyModeTool } from "../tools/getProxyMode";
import { getRequestDetailTool } from "../tools/getRequestDetail";
import { getRuntimeSettingsTool } from "../tools/getRuntimeSettings";
import { getSavedRequestDetailTool } from "../tools/getSavedRequestDetail";
import { getServiceHealthTool } from "../tools/getServiceHealth";
import { listMockRulesTool } from "../tools/listMockRules";
import { listProxyRulesTool } from "../tools/listProxyRules";
import { listRequestsTool } from "../tools/listRequests";
import { listSavedRequestsTool } from "../tools/listSavedRequests";
import { replayRequestTool } from "../tools/replayRequest";
import { runRequestTool } from "../tools/runRequest";
import { saveRequestTool } from "../tools/saveRequest";
import { setActiveMockGroupTool } from "../tools/setActiveMockGroup";
import { setProxyModeTool } from "../tools/setProxyMode";
import { updateMockRuleTool } from "../tools/updateMockRule";
import { updateSavedRequestTool } from "../tools/updateSavedRequest";
import { upsertProxyRuleTool } from "../tools/upsertProxyRule";
import { verifyHttpsInterceptionReadyTool } from "../tools/verifyHttpsInterceptionReady";
import { removeProxyRuleTool } from "../tools/removeProxyRule";
import { mockRuleListResource } from "../resources/mockRuleList";
import { proxyModeResource } from "../resources/proxyMode";
import { proxyRuleListResource } from "../resources/proxyRuleList";
import { requestListResource } from "../resources/requestList";
import { savedRequestListResource } from "../resources/savedRequestList";

export const mcpToolRegistry = [
  listRequestsTool,
  getRequestDetailTool,
  listSavedRequestsTool,
  getSavedRequestDetailTool,
  saveRequestTool,
  updateSavedRequestTool,
  deleteSavedRequestTool,
  replayRequestTool,
  clearRequestsTool,
  listMockRulesTool,
  getMockRuleDetailTool,
  createMockRuleTool,
  updateMockRuleTool,
  deleteMockRuleTool,
  enableMockRuleTool,
  getActiveMockGroupTool,
  setActiveMockGroupTool,
  runRequestTool,
  listProxyRulesTool,
  getProxyRuleDetailTool,
  getProxyModeTool,
  getProxyDecisionTool,
  setProxyModeTool,
  upsertProxyRuleTool,
  removeProxyRuleTool,
  getServiceHealthTool,
  getRuntimeSettingsTool,
  getCertificateStatusTool,
  getCertificateInstallGuideTool,
  verifyHttpsInterceptionReadyTool
];

export const mcpResourceRegistry = [
  requestListResource,
  savedRequestListResource,
  mockRuleListResource,
  proxyModeResource,
  proxyRuleListResource
];

export interface McpPackDefinition {
  id: string;
  name: string;
  description: string;
  toolNames: string[];
  resourceNames: string[];
}

const mockPackToolNames = [
  listMockRulesTool.name,
  getMockRuleDetailTool.name,
  createMockRuleTool.name,
  updateMockRuleTool.name,
  deleteMockRuleTool.name,
  enableMockRuleTool.name,
  getActiveMockGroupTool.name,
  setActiveMockGroupTool.name
];

const proxyPackToolNames = [
  listProxyRulesTool.name,
  getProxyRuleDetailTool.name,
  getProxyModeTool.name,
  getProxyDecisionTool.name,
  setProxyModeTool.name,
  upsertProxyRuleTool.name,
  removeProxyRuleTool.name
];

const requestPackToolNames = [
  listRequestsTool.name,
  getRequestDetailTool.name,
  listSavedRequestsTool.name,
  getSavedRequestDetailTool.name,
  saveRequestTool.name,
  updateSavedRequestTool.name,
  deleteSavedRequestTool.name,
  replayRequestTool.name,
  runRequestTool.name,
  clearRequestsTool.name
];

const opsPackToolNames = [
  getServiceHealthTool.name,
  getRuntimeSettingsTool.name,
  getCertificateStatusTool.name,
  getCertificateInstallGuideTool.name,
  verifyHttpsInterceptionReadyTool.name
];

export const mcpPackRegistry: McpPackDefinition[] = [
  {
    id: "mock_pack.v1",
    name: "Mock Pack",
    description: "Manage mock rules and active mock groups.",
    toolNames: mockPackToolNames,
    resourceNames: [mockRuleListResource.name]
  },
  {
    id: "proxy_pack.v1",
    name: "Proxy Pack",
    description: "Manage proxy mode, host rules, and proxy routing decisions.",
    toolNames: proxyPackToolNames,
    resourceNames: [proxyModeResource.name, proxyRuleListResource.name]
  },
  {
    id: "request_pack.v1",
    name: "Request Pack",
    description: "Inspect captured requests and run or replay saved requests.",
    toolNames: requestPackToolNames,
    resourceNames: [requestListResource.name, savedRequestListResource.name]
  },
  {
    id: "ops_pack.v1",
    name: "Ops Pack",
    description: "Read runtime health, settings, and HTTPS certificate readiness.",
    toolNames: opsPackToolNames,
    resourceNames: []
  }
];

const packAliasMap: Record<string, string> = {
  mock: "mock_pack.v1",
  "mock_pack.v1": "mock_pack.v1",
  proxy: "proxy_pack.v1",
  "proxy_pack.v1": "proxy_pack.v1",
  request: "request_pack.v1",
  requests: "request_pack.v1",
  "request_pack.v1": "request_pack.v1",
  ops: "ops_pack.v1",
  "ops_pack.v1": "ops_pack.v1"
};

export function resolveMcpPackId(input?: string | null): string | undefined {
  if (!input) {
    return undefined;
  }
  return packAliasMap[input.trim().toLowerCase()];
}

export function getMcpPackById(id: string): McpPackDefinition | undefined {
  return mcpPackRegistry.find((pack) => pack.id === id);
}

export function getMcpToolRegistryByPackId(id?: string): typeof mcpToolRegistry {
  if (!id) {
    return mcpToolRegistry;
  }
  const pack = getMcpPackById(id);
  if (!pack) {
    return [];
  }
  const toolNameSet = new Set(pack.toolNames);
  return mcpToolRegistry.filter((tool) => toolNameSet.has(tool.name));
}

export function getMcpResourceRegistryByPackId(id?: string): typeof mcpResourceRegistry {
  if (!id) {
    return mcpResourceRegistry;
  }
  const pack = getMcpPackById(id);
  if (!pack) {
    return [];
  }
  const resourceNameSet = new Set(pack.resourceNames);
  return mcpResourceRegistry.filter((resource) => resourceNameSet.has(resource.name));
}
