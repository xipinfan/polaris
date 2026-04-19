import type {
  WhistleImportCandidate,
  WhistleImportConflictMode,
  WhistleImportExecuteInput,
  WhistleImportExecuteResponse,
  WhistleImportProxyGroup,
} from "@polaris/shared-contracts";
import type { StoredGroup } from "../../../domains/proxy-forward/types";

export type WhistleImportScope = "all" | "mock" | "proxy";
export type WhistleCompatibilityFilter = "all" | "compatible" | "duplicate" | "unsupported";

type FilterCandidatesInput = {
  candidates: WhistleImportCandidate[];
  compatibility: WhistleCompatibilityFilter;
  currentProxyGroups: StoredGroup[];
  onlyCompatible: boolean;
  onlyEnabled: boolean;
  scope: WhistleImportScope;
  search: string;
  selectedGroupName: string | null;
};

function normalizeText(value: string | null | undefined) {
  return (value ?? "").trim().toLowerCase();
}

function matchesScope(candidate: WhistleImportCandidate, scope: WhistleImportScope) {
  if (scope === "all") {
    return true;
  }
  return candidate.candidateType === scope;
}

export function getEffectiveConflictMode(
  candidate: WhistleImportCandidate,
  currentProxyGroups: StoredGroup[],
): WhistleImportConflictMode {
  if (candidate.candidateType !== "proxy") {
    return candidate.conflictMode;
  }

  const targetGroup = currentProxyGroups.find(
    (group) => normalizeText(group.name) === normalizeText(candidate.groupName),
  );
  if (!targetGroup) {
    return candidate.conflictMode;
  }

  const hasConflict = targetGroup.rules.some((rule) =>
    normalizeText(rule.pattern) === normalizeText(candidate.proxyPayload.pattern) ||
    normalizeText(rule.name) === normalizeText(candidate.proxyPayload.name),
  );
  return hasConflict ? "duplicate" : candidate.conflictMode;
}

export function filterWhistleCandidates(input: FilterCandidatesInput) {
  const keyword = normalizeText(input.search);

  return input.candidates.filter((candidate) => {
    if (!matchesScope(candidate, input.scope)) {
      return false;
    }
    if (input.onlyCompatible && !candidate.compatible) {
      return false;
    }
    if (input.onlyEnabled && !candidate.enabled) {
      return false;
    }
    if (input.selectedGroupName && candidate.groupName !== input.selectedGroupName) {
      return false;
    }

    const effectiveConflictMode = getEffectiveConflictMode(candidate, input.currentProxyGroups);
    if (input.compatibility === "compatible" && !candidate.compatible) {
      return false;
    }
    if (input.compatibility === "duplicate" && effectiveConflictMode !== "duplicate") {
      return false;
    }
    if (input.compatibility === "unsupported" && candidate.compatible) {
      return false;
    }

    if (!keyword) {
      return true;
    }

    const searchFields = [
      candidate.title,
      candidate.sourceFileName,
      candidate.sourceSummary,
      candidate.matcher,
      candidate.targetPreview,
      candidate.groupName,
    ];
    if (candidate.candidateType === "proxy") {
      searchFields.push(candidate.proxyPayload.pattern, candidate.proxyPayload.targetUrl);
    }
    if (candidate.candidateType === "mock") {
      searchFields.push(candidate.mockPayload.url, candidate.mockPayload.method);
    }

    return searchFields.some((value) => normalizeText(value).includes(keyword));
  });
}

export function buildDefaultSelectedIds(
  candidates: WhistleImportCandidate[],
  scope: WhistleImportScope,
) {
  return new Set(
    candidates
      .filter((candidate) => candidate.compatible && candidate.enabled && matchesScope(candidate, scope))
      .map((candidate) => candidate.id),
  );
}

export function buildExecutePayload(params: {
  candidates: WhistleImportCandidate[];
  currentProxyActiveGroupId: string | null;
  currentProxyGroups: StoredGroup[];
  selectedIds: Set<string>;
}): WhistleImportExecuteInput {
  const mockRules = params.candidates
    .filter(
      (candidate): candidate is Extract<WhistleImportCandidate, { candidateType: "mock" }> =>
        candidate.candidateType === "mock" && params.selectedIds.has(candidate.id),
    )
    .map((candidate) => candidate.mockPayload);

  const proxyGroupMap = new Map<string, WhistleImportProxyGroup>();
  for (const candidate of params.candidates) {
    if (candidate.candidateType !== "proxy" || !params.selectedIds.has(candidate.id)) {
      continue;
    }

    const groupKey = normalizeText(candidate.groupName) || candidate.groupName;
    const existingGroup = proxyGroupMap.get(groupKey);
    if (existingGroup) {
      existingGroup.rules.push(candidate.proxyPayload);
      continue;
    }

    proxyGroupMap.set(groupKey, {
      id: `whistle-import-${groupKey || "default"}`,
      name: candidate.groupName,
      rules: [candidate.proxyPayload],
    });
  }

  return {
    mockRules,
    proxyGroups: [...proxyGroupMap.values()],
    currentProxyGroups: params.currentProxyGroups as WhistleImportProxyGroup[],
    currentProxyActiveGroupId: params.currentProxyActiveGroupId,
  };
}

export function buildSelectionSummary(params: {
  candidates: WhistleImportCandidate[];
  currentProxyGroups: StoredGroup[];
  selectedIds: Set<string>;
}) {
  let selectedMockCount = 0;
  let selectedProxyCount = 0;
  let duplicatedCount = 0;
  const groupNames = new Set<string>();

  for (const candidate of params.candidates) {
    if (!params.selectedIds.has(candidate.id)) {
      continue;
    }
    groupNames.add(candidate.groupName);
    if (candidate.candidateType === "mock") {
      selectedMockCount += 1;
    }
    if (candidate.candidateType === "proxy") {
      selectedProxyCount += 1;
    }
    if (getEffectiveConflictMode(candidate, params.currentProxyGroups) === "duplicate") {
      duplicatedCount += 1;
    }
  }

  return {
    selectedMockCount,
    selectedProxyCount,
    selectedGroupCount: groupNames.size,
    duplicatedCount,
  };
}

export function formatExecuteSummary(result: WhistleImportExecuteResponse) {
  const parts = [
    `新建 Mock ${result.createdMockCount} 条`,
    `新建代理 ${result.createdProxyCount} 条`,
  ];
  if (result.createdGroupCount > 0) {
    parts.push(`新增分组 ${result.createdGroupCount} 个`);
  }
  if (result.duplicatedCount > 0) {
    parts.push(`冲突复制 ${result.duplicatedCount} 条`);
  }
  if (result.skippedCount > 0) {
    parts.push(`跳过 ${result.skippedCount} 条`);
  }
  return parts.join("，");
}
