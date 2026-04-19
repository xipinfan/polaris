import { describe, expect, it } from "vitest";
import type { WhistleImportCandidate } from "@polaris/shared-contracts";
import type { StoredGroup } from "../../../domains/proxy-forward/types";
import {
  buildDefaultSelectedIds,
  buildExecutePayload,
  buildSelectionSummary,
  filterWhistleCandidates,
  formatExecuteSummary,
  getEffectiveConflictMode,
} from "./utils";

const mockCandidate: WhistleImportCandidate = {
  id: "mock-1",
  candidateType: "mock",
  groupName: "Mocks",
  title: "orders-mock",
  sourceFileName: "orders-mock",
  sourceFileKind: "rule",
  sourceSummary: "POST orders mock",
  rawLine: "raw mock line",
  matcher: "https://api.example.com/orders",
  enabled: true,
  selectedByDefault: true,
  compatible: true,
  conflictMode: "none",
  targetPreview: "POST https://api.example.com/orders -> 201",
  mockPayload: {
    name: "orders-mock",
    group: "Mocks",
    method: "POST",
    url: "https://api.example.com/orders",
    responseStatus: 201,
    responseHeaders: {},
    responseBody: { ok: true },
    enabled: true,
  },
};

const proxyCandidate: WhistleImportCandidate = {
  id: "proxy-1",
  candidateType: "proxy",
  groupName: "Proxy",
  title: "orders-proxy",
  sourceFileName: "orders-proxy",
  sourceFileKind: "rule",
  sourceSummary: "gateway proxy",
  rawLine: "raw proxy line",
  matcher: "https://gateway.example.com",
  enabled: true,
  selectedByDefault: true,
  compatible: true,
  conflictMode: "none",
  targetPreview: "gateway.example.com -> http://127.0.0.1:3000",
  proxyPayload: {
    id: "proxy-payload-1",
    name: "orders-proxy",
    pattern: "gateway.example.com",
    method: "GET",
    url: "https://gateway.example.com/",
    path: "/",
    priority: 100,
    action: "proxy",
    enabled: true,
    matchMode: "精确匹配",
    queryMatch: "继承原请求",
    headerMatch: "继承原请求",
    bodyMatch: "继承原请求",
    forwardMode: "rewriteTarget",
    targetUrl: "http://127.0.0.1:3000",
    rewriteHost: "gateway.example.com",
    rewritePath: "/",
    rewriteQuery: "",
    headerStrategy: "keep",
    requestHeaderPreview: "{}",
    responseHeaderPreview: "{}",
    responseDelay: 0,
    fallbackPolicy: "closed",
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-01T00:00:00.000Z",
  },
};

const unsupportedCandidate: WhistleImportCandidate = {
  id: "unsupported-1",
  candidateType: "unsupported",
  groupName: "Proxy",
  title: "plugin-rule",
  sourceFileName: "plugin-rule",
  sourceFileKind: "rule",
  sourceSummary: "plugin rule",
  rawLine: "plugin raw line",
  matcher: "https://plugin.example.com",
  enabled: true,
  selectedByDefault: false,
  compatible: false,
  conflictMode: "none",
  targetPreview: "",
  skipReason: "unsupported_plugin_rule",
};

const disabledMockCandidate: WhistleImportCandidate = {
  ...mockCandidate,
  id: "mock-disabled",
  title: "orders-mock-disabled",
  enabled: false,
};

const currentProxyGroups: StoredGroup[] = [
  {
    id: "g1",
    name: "Proxy",
    rules: [
      {
        ...proxyCandidate.proxyPayload,
        id: "existing-rule",
      },
    ],
  },
];

describe("whistle import utils", () => {
  it("builds default selection from compatible scope candidates", () => {
    const selectedIds = buildDefaultSelectedIds(
      [mockCandidate, disabledMockCandidate, proxyCandidate, unsupportedCandidate],
      "mock",
    );

    expect([...selectedIds]).toEqual(["mock-1"]);
  });

  it("includes both mock and proxy when scope is all", () => {
    const selectedIds = buildDefaultSelectedIds(
      [mockCandidate, proxyCandidate, unsupportedCandidate],
      "all",
    );

    expect([...selectedIds].sort()).toEqual(["mock-1", "proxy-1"]);
  });

  it("detects proxy conflicts from current groups", () => {
    expect(getEffectiveConflictMode(proxyCandidate, currentProxyGroups)).toBe("duplicate");
    expect(getEffectiveConflictMode(mockCandidate, currentProxyGroups)).toBe("none");
  });

  it("filters by scope, compatibility, search and group", () => {
    const filtered = filterWhistleCandidates({
      candidates: [mockCandidate, proxyCandidate, unsupportedCandidate],
      compatibility: "duplicate",
      currentProxyGroups,
      onlyCompatible: false,
      onlyEnabled: true,
      scope: "proxy",
      search: "gateway",
      selectedGroupName: "Proxy",
    });

    expect(filtered).toEqual([proxyCandidate]);
  });

  it("keeps unsupported candidates visible when all scope is selected", () => {
    const filtered = filterWhistleCandidates({
      candidates: [mockCandidate, proxyCandidate, unsupportedCandidate],
      compatibility: "unsupported",
      currentProxyGroups,
      onlyCompatible: false,
      onlyEnabled: false,
      scope: "all",
      search: "",
      selectedGroupName: null,
    });

    expect(filtered).toEqual([unsupportedCandidate]);
  });

  it("builds execute payload and selection summary", () => {
    const selectedIds = new Set(["mock-1", "proxy-1"]);
    const payload = buildExecutePayload({
      candidates: [mockCandidate, proxyCandidate, unsupportedCandidate],
      currentProxyActiveGroupId: "g1",
      currentProxyGroups,
      selectedIds,
    });

    expect(payload.mockRules).toHaveLength(1);
    expect(payload.proxyGroups).toHaveLength(1);
    expect(payload.proxyGroups[0]?.rules).toHaveLength(1);

    expect(
      buildSelectionSummary({
        candidates: [mockCandidate, proxyCandidate, unsupportedCandidate],
        currentProxyGroups,
        selectedIds,
      }),
    ).toEqual({
      selectedMockCount: 1,
      selectedProxyCount: 1,
      selectedGroupCount: 2,
      duplicatedCount: 1,
    });
  });

  it("formats execute summary text", () => {
    expect(
      formatExecuteSummary({
        createdMockCount: 1,
        createdProxyCount: 2,
        createdGroupCount: 1,
        duplicatedCount: 3,
        skippedCount: 0,
        warnings: [],
        items: [],
        nextProxyGroups: [],
        nextProxyActiveGroupId: null,
      }),
    ).toBe("新建 Mock 1 条，新建代理 2 条，新增分组 1 个，冲突复制 3 条");
  });
});
