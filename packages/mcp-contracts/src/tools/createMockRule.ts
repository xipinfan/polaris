export const createMockRuleTool = {
  name: "create_mock_rule",
  description:
    "Create a mock rule. Matches by method (exact) + url (substring). Optional body matching: requestBodyExactMatch uses DSL 'path: \"value\"' (string values only, ';' to combine), requestBodyKeyMatch checks key existence via dot-path."
};
