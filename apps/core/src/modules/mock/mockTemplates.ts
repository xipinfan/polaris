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
  },
  json_error: {
    group: "templates",
    method: "GET",
    url: "https://example.com/api/error",
    requestBodyExactMatch: null,
    requestBodyKeyMatch: null,
    responseStatus: 400,
    responseHeaders: { "content-type": "application/json" },
    responseBody: { error: "Bad Request", code: "INVALID_PARAMS" },
    enabled: true
  },
  json_list: {
    group: "templates",
    method: "GET",
    url: "https://example.com/api/list",
    requestBodyExactMatch: null,
    requestBodyKeyMatch: null,
    responseStatus: 200,
    responseHeaders: { "content-type": "application/json" },
    responseBody: { code: 0, data: { list: [], total: 0, page: 1, pageSize: 20 } },
    enabled: true
  },
  json_detail: {
    group: "templates",
    method: "GET",
    url: "https://example.com/api/detail",
    requestBodyExactMatch: null,
    requestBodyKeyMatch: null,
    responseStatus: 200,
    responseHeaders: { "content-type": "application/json" },
    responseBody: { code: 0, data: { id: "1", name: "example" } },
    enabled: true
  },
  json_post_ok: {
    group: "templates",
    method: "POST",
    url: "https://example.com/api/post",
    requestBodyExactMatch: null,
    requestBodyKeyMatch: null,
    responseStatus: 200,
    responseHeaders: { "content-type": "application/json" },
    responseBody: { code: 0, message: "success" },
    enabled: true
  },
  not_found: {
    group: "templates",
    method: "GET",
    url: "https://example.com/api/not-found",
    requestBodyExactMatch: null,
    requestBodyKeyMatch: null,
    responseStatus: 404,
    responseHeaders: { "content-type": "application/json" },
    responseBody: { error: "Not Found" },
    enabled: true
  },
  unauthorized: {
    group: "templates",
    method: "GET",
    url: "https://example.com/api/unauthorized",
    requestBodyExactMatch: null,
    requestBodyKeyMatch: null,
    responseStatus: 401,
    responseHeaders: { "content-type": "application/json" },
    responseBody: { error: "Unauthorized", code: "AUTH_REQUIRED" },
    enabled: true
  },
  empty_ok: {
    group: "templates",
    method: "GET",
    url: "https://example.com/api/empty",
    requestBodyExactMatch: null,
    requestBodyKeyMatch: null,
    responseStatus: 204,
    responseHeaders: { "content-type": "application/json" },
    responseBody: null,
    enabled: true
  }
};
