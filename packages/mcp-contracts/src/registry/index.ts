import { createMockRuleTool } from "../tools/createMockRule";
import { enableMockRuleTool } from "../tools/enableMockRule";
import { getProxyModeTool } from "../tools/getProxyMode";
import { getRequestDetailTool } from "../tools/getRequestDetail";
import { getSavedRequestDetailTool } from "../tools/getSavedRequestDetail";
import { listProxyRulesTool } from "../tools/listProxyRules";
import { listRequestsTool } from "../tools/listRequests";
import { listSavedRequestsTool } from "../tools/listSavedRequests";
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
  listSavedRequestsTool,
  getSavedRequestDetailTool,
  saveRequestTool,
  replayRequestTool,
  createMockRuleTool,
  enableMockRuleTool,
  runRequestTool,
  listProxyRulesTool,
  getProxyModeTool
];

export const mcpResourceRegistry = [
  requestListResource,
  savedRequestListResource,
  mockRuleListResource,
  proxyModeResource,
  proxyRuleListResource
];
