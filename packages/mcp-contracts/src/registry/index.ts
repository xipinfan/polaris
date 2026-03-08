import { createMockRuleTool } from "../tools/createMockRule";
import { enableMockRuleTool } from "../tools/enableMockRule";
import { getRequestDetailTool } from "../tools/getRequestDetail";
import { listProxyRulesTool } from "../tools/listProxyRules";
import { listRequestsTool } from "../tools/listRequests";
import { replayRequestTool } from "../tools/replayRequest";
import { runRequestTool } from "../tools/runRequest";
import { saveRequestTool } from "../tools/saveRequest";
import { mockRuleListResource } from "../resources/mockRuleList";
import { proxyModeResource } from "../resources/proxyMode";
import { proxyRuleListResource } from "../resources/proxyRuleList";
import { requestListResource } from "../resources/requestList";
import { savedRequestListResource } from "../resources/savedRequestList";

export const mcpToolRegistry = [
  listRequestsTool,
  getRequestDetailTool,
  saveRequestTool,
  replayRequestTool,
  createMockRuleTool,
  enableMockRuleTool,
  runRequestTool,
  listProxyRulesTool
];

export const mcpResourceRegistry = [
  requestListResource,
  savedRequestListResource,
  mockRuleListResource,
  proxyModeResource,
  proxyRuleListResource
];
