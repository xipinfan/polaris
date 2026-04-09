export const getMockRuleDetailTool = {
  name: "get_mock_rule_detail",
  description:
    "Get one mock rule by id. Defaults to view='summary'. Supports view='preview', 'shape', 'full', and 'diagnostic'. Use jsonPath or responsePath to query nested response data, include requestId for diagnostic matching, and prefer summary -> preview/shape -> full when investigating."
};
