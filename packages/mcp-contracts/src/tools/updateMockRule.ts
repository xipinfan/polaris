export const updateMockRuleTool = {
  name: "update_mock_rule",
  description:
    "Update a mock rule by id. Prefer patch or operations for small changes instead of resending the full rule. Set body matchers to null or use operations remove to clear them. Returns a lightweight receipt with changedFields."
};
