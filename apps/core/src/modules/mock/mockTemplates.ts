import type { CreateMockRuleInput } from "@polaris/shared-contracts";

export const mockTemplates: Record<string, Omit<CreateMockRuleInput, "name">> = {
  json_ok: {
    group: "templates",
    method: "GET",
    url: "https://example.com/api/template",
    requestBodyExactMatch: null,
    requestBodyKeyMatch: null,
    responseStatus: 200,
    responseHeaders: { "content-type": "application/json" },
    responseBody: { ok: true },
    enabled: true
  }
};
