import { randomUUID } from "node:crypto";
import { existsSync } from "node:fs";
import { readdir, readFile, stat } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import type {
  CreateMockRuleInput,
  WhistleImportCandidate,
  WhistleImportConflictMode,
  WhistleImportExecuteInput,
  WhistleImportExecuteResponse,
  WhistleImportGroupSummary,
  WhistleImportProxyRule,
  WhistleImportResultItem,
  WhistleImportScanResponse,
  WhistleImportSkipReason,
  WhistleImportSource,
  WhistleImportWarning,
} from "@polaris/shared-contracts";
import type { JsonValue, MockRule } from "@polaris/shared-types";
import { MockService } from "../mock/mockService";

const defaultGroupName = "默认组";
const defaultRuleGroupName = "默认规则";
const supportedPlatforms = {
  win32: "windows",
  darwin: "macos",
} as const;

type WhistlePlatform = WhistleImportSource["platform"];

type LoadedStorageFile = {
  name: string;
  data: string;
};

type LoadedStorage = {
  files: LoadedStorageFile[];
  properties: Record<string, unknown>;
};

type GroupedRuleFile = {
  name: string;
  data: string;
  selected: boolean;
  groupName: string;
  sourceFileKind: "rule" | "defaultRule";
};

type ParsedOperator = {
  token: string;
  protocol: string;
  value: string;
};

type ParsedFilter = {
  kind: "method" | "body";
  value: string;
};

type ParsedRuleLine = {
  matcher: string;
  operators: ParsedOperator[];
  filters: ParsedFilter[];
  rawLine: string;
};

type ResolvedValue =
  | { kind: "resolved"; value: string }
  | { kind: "unsupported"; reason: WhistleImportSkipReason };

function getPlatform(): WhistlePlatform {
  return supportedPlatforms[process.platform as keyof typeof supportedPlatforms] ?? "macos";
}

function isObjectRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function isGroupFileName(name: string) {
  return name.startsWith("\r");
}

function normalizeGroupName(name: string | null | undefined) {
  const next = typeof name === "string" ? name.replace(/^\r/, "").trim() : "";
  return next || defaultGroupName;
}

function normalizeWhitespace(value: string) {
  return value.replace(/\s+/g, " ").trim();
}

function truncateSummary(value: string, maxLength = 120) {
  const next = normalizeWhitespace(value);
  if (next.length <= maxLength) {
    return next;
  }
  return `${next.slice(0, maxLength - 1)}…`;
}

function buildTitle(fileName: string, matcher: string) {
  return fileName.trim() || truncateSummary(matcher, 80);
}

function stripComment(line: string) {
  const commentIndex = line.indexOf("#");
  return (commentIndex >= 0 ? line.slice(0, commentIndex) : line).trim();
}

function parseMaybeJson(value: string): JsonValue | string {
  const trimmed = value.trim();
  if (!trimmed) {
    return "";
  }
  if (!/^(?:\{[\s\S]*\}|\[[\s\S]*\]|true|false|null|-?\d+(?:\.\d+)?)$/.test(trimmed)) {
    return value;
  }
  try {
    return JSON.parse(trimmed) as JsonValue;
  } catch {
    return value;
  }
}

function parseHeadersValue(raw: string): Record<string, string> | null {
  const trimmed = raw.trim();
  if (!trimmed) {
    return {};
  }
  try {
    const parsed = JSON.parse(trimmed) as unknown;
    if (isObjectRecord(parsed)) {
      return Object.fromEntries(
        Object.entries(parsed).map(([key, value]) => [key, value == null ? "" : String(value)]),
      );
    }
  } catch {
    // fall through
  }

  const headers: Record<string, string> = {};
  for (const line of trimmed.split(/\r?\n/)) {
    const separatorIndex = line.indexOf(":");
    if (separatorIndex <= 0) {
      return null;
    }
    headers[line.slice(0, separatorIndex).trim()] = line.slice(separatorIndex + 1).trim();
  }
  return headers;
}

function normalizeProtocol(protocol: string) {
  switch (protocol) {
    case "status":
    case "replaceStatus":
      return "statusCode";
    case "http-proxy":
    case "https-proxy":
    case "internal-https-proxy":
      return "proxy";
    default:
      return protocol;
  }
}

function tokenizeRuleLine(line: string) {
  const tokens: string[] = [];
  let current = "";
  let quote: string | null = null;
  let roundDepth = 0;
  let angleDepth = 0;
  let curlyDepth = 0;

  for (let index = 0; index < line.length; index += 1) {
    const char = line[index]!;
    const previous = index > 0 ? line[index - 1] : "";

    if (quote) {
      current += char;
      if (char === quote && previous !== "\\") {
        quote = null;
      }
      continue;
    }

    if (char === "\"" || char === "'" || char === "`") {
      quote = char;
      current += char;
      continue;
    }

    if (char === "(") roundDepth += 1;
    if (char === ")") roundDepth = Math.max(0, roundDepth - 1);
    if (char === "<") angleDepth += 1;
    if (char === ">") angleDepth = Math.max(0, angleDepth - 1);
    if (char === "{") curlyDepth += 1;
    if (char === "}") curlyDepth = Math.max(0, curlyDepth - 1);

    if (/\s/.test(char) && !quote && roundDepth === 0 && angleDepth === 0 && curlyDepth === 0) {
      if (current) {
        tokens.push(current);
        current = "";
      }
      continue;
    }

    current += char;
  }

  if (current) {
    tokens.push(current);
  }
  return tokens;
}

function parseFilter(token: string): ParsedFilter | null {
  const match = token.match(/^(?:filter|includeFilter):\/\/(m|method|b|body):(.+)$/i);
  if (!match) {
    return null;
  }
  return {
    kind: /^(?:m|method)$/i.test(match[1] ?? "") ? "method" : "body",
    value: (match[2] ?? "").trim(),
  };
}

function parseRuleLine(line: string): ParsedRuleLine | null {
  const cleaned = stripComment(line);
  if (!cleaned) {
    return null;
  }

  const tokens = tokenizeRuleLine(cleaned);
  if (tokens.length < 2) {
    return null;
  }

  const [matcher, ...restTokens] = tokens;
  const operators: ParsedOperator[] = [];
  const filters: ParsedFilter[] = [];

  for (const token of restTokens) {
    const filter = parseFilter(token);
    if (filter) {
      filters.push(filter);
      continue;
    }

    const operatorMatch = token.match(/^([\w.-]+):\/\/([\s\S]*)$/);
    if (!operatorMatch) {
      return {
        matcher,
        operators: [],
        filters,
        rawLine: cleaned,
      };
    }

    operators.push({
      token,
      protocol: normalizeProtocol(operatorMatch[1] ?? ""),
      value: operatorMatch[2] ?? "",
    });
  }

  return {
    matcher,
    operators,
    filters,
    rawLine: cleaned,
  };
}

function parseSourceMatcher(matcher: string) {
  const normalized = matcher.trim();
  if (!normalized) {
    return null;
  }

  const candidates = [normalized];
  if (!/^[a-z*]+:\/\//i.test(normalized) && !normalized.startsWith("//")) {
    candidates.push(`https://${normalized.replace(/^\/+/, "")}`);
  }

  for (const candidate of candidates) {
    try {
      const parsed = new URL(candidate);
      return {
        normalizedUrl: parsed.toString(),
        host: parsed.host.toLowerCase(),
        pathname: parsed.pathname || "/",
        search: parsed.search,
      };
    } catch {
      // continue
    }
  }

  return null;
}

function inferMethod(filters: ParsedFilter[]) {
  const methodFilter = filters.find((filter) => filter.kind === "method");
  return methodFilter?.value.trim().toUpperCase() ?? null;
}

function inferBodyFilters(filters: ParsedFilter[]) {
  const bodyFilters = filters.filter((filter) => filter.kind === "body");
  if (bodyFilters.length !== 1) {
    return { exact: null as string | null, key: null as string | null };
  }

  const raw = bodyFilters[0]!.value.trim();
  const keyMatch = raw.match(/^([a-zA-Z0-9_.[\]-]+)=/);
  if (keyMatch?.[1]) {
    return { exact: null, key: keyMatch[1] };
  }

  return { exact: raw || null, key: null };
}

async function isDirectory(targetPath: string) {
  try {
    return (await stat(targetPath)).isDirectory();
  } catch {
    return false;
  }
}

async function discoverWhistleDir() {
  const platform = getPlatform();
  const configuredBaseDir = process.env.WHISTLE_PATH?.trim()
    ? path.resolve(process.env.WHISTLE_PATH.trim())
    : path.join(os.homedir(), ".WhistleAppData");
  const directCandidates = Array.from(
    new Set([
      path.join(configuredBaseDir, ".whistle"),
      configuredBaseDir,
    ]),
  );

  for (const candidate of directCandidates) {
    if (await isDirectory(candidate)) {
      return {
        platform,
        baseDir: configuredBaseDir,
        resolvedDir: candidate,
        autoDetected: true,
      };
    }
  }

  const customDirs = Array.from(
    new Set(directCandidates.map((candidate) => path.join(candidate, "custom_dirs"))),
  );
  for (const customDir of customDirs) {
    if (!(await isDirectory(customDir))) {
      continue;
    }
    const entries = await readdir(customDir, { withFileTypes: true });
    const firstStorageDir = entries.find((entry) => entry.isDirectory());
    if (firstStorageDir) {
      return {
        platform,
        baseDir: configuredBaseDir,
        resolvedDir: path.join(customDir, firstStorageDir.name),
        autoDetected: true,
      };
    }
  }

  return {
    platform,
    baseDir: configuredBaseDir,
    resolvedDir: null,
    autoDetected: false,
  };
}

async function readStorage(storageDir: string): Promise<LoadedStorage> {
  const filesDir = path.join(storageDir, "files");
  const propertiesFile = path.join(storageDir, "properties");
  const files: LoadedStorageFile[] = [];

  if (existsSync(filesDir)) {
    const fileEntries = await readdir(filesDir, { withFileTypes: true });
    for (const entry of fileEntries) {
      if (!entry.isFile()) {
        continue;
      }
      const match = entry.name.match(/^\d+\.(.+)$/);
      if (!match?.[1]) {
        continue;
      }
      let decodedName = match[1];
      try {
        decodedName = decodeURIComponent(decodedName);
      } catch {
        // keep raw name
      }
      const filePath = path.join(filesDir, entry.name);
      const data = isGroupFileName(decodedName) ? "" : await readFile(filePath, "utf8");
      files.push({
        name: decodedName,
        data,
      });
    }
  }

  let properties: Record<string, unknown> = {};
  if (existsSync(propertiesFile)) {
    try {
      const raw = await readFile(propertiesFile, "utf8");
      const parsed = JSON.parse(raw) as unknown;
      properties = isObjectRecord(parsed) ? parsed : {};
    } catch {
      properties = {};
    }
  }

  const filesOrder = Array.isArray(properties.filesOrder)
    ? properties.filesOrder.filter((item): item is string => typeof item === "string")
    : [];
  const orderLookup = new Map(filesOrder.map((name, index) => [name, index] as const));

  files.sort((left, right) => {
    const leftIndex = orderLookup.get(left.name);
    const rightIndex = orderLookup.get(right.name);
    if (leftIndex != null && rightIndex != null) {
      return leftIndex - rightIndex;
    }
    if (leftIndex != null) {
      return -1;
    }
    if (rightIndex != null) {
      return 1;
    }
    return left.name.localeCompare(right.name);
  });

  return {
    files,
    properties,
  };
}

function collectGroupedRuleFiles(storage: LoadedStorage) {
  const selectedList = Array.isArray(storage.properties.selectedList)
    ? storage.properties.selectedList.filter((item): item is string => typeof item === "string")
    : [];
  const selectedLookup = new Set(selectedList);
  const groupSummaries = new Map<string, WhistleImportGroupSummary>();
  const groupedFiles: GroupedRuleFile[] = [];
  let currentGroupName = defaultGroupName;
  let nextOrder = 0;

  for (const file of storage.files) {
    if (isGroupFileName(file.name)) {
      currentGroupName = normalizeGroupName(file.name);
      if (!groupSummaries.has(currentGroupName)) {
        groupSummaries.set(currentGroupName, {
          name: currentGroupName,
          order: nextOrder,
          selected: false,
          ruleCount: 0,
        });
        nextOrder += 1;
      }
      continue;
    }

    if (!groupSummaries.has(currentGroupName)) {
      groupSummaries.set(currentGroupName, {
        name: currentGroupName,
        order: nextOrder,
        selected: false,
        ruleCount: 0,
      });
      nextOrder += 1;
    }

    const summary = groupSummaries.get(currentGroupName)!;
    summary.ruleCount += 1;
    if (selectedLookup.has(file.name)) {
      summary.selected = true;
    }

    groupedFiles.push({
      name: file.name,
      data: file.data,
      selected: selectedLookup.has(file.name),
      groupName: currentGroupName,
      sourceFileKind: "rule",
    });
  }

  const defaultRules = typeof storage.properties.defalutRules === "string"
    ? storage.properties.defalutRules.trim()
    : "";
  if (defaultRules) {
    groupedFiles.unshift({
      name: "Default",
      data: defaultRules,
      selected: storage.properties.disabledDefalutRules !== true,
      groupName: defaultRuleGroupName,
      sourceFileKind: "defaultRule",
    });
  }

  return {
    groupedFiles,
    groupSummaries: [...groupSummaries.values()].sort((left, right) => left.order - right.order),
    enabledRuleFileCount:
      groupedFiles.filter((file) => file.selected && file.sourceFileKind === "rule").length,
  };
}

async function resolveFileLikeValue(
  rawValue: string,
  valueMap: Map<string, string>,
  resolvedDir: string,
): Promise<ResolvedValue> {
  const trimmed = rawValue.trim();
  const valueReferenceMatch = trimmed.match(/^\{([^{}]+)\}$/);
  if (valueReferenceMatch?.[1]) {
    const resolved = valueMap.get(valueReferenceMatch[1]);
    if (resolved == null) {
      return { kind: "unsupported", reason: "unresolved_value_reference" };
    }
    return { kind: "resolved", value: resolved };
  }

  const inlineValueMatch = trimmed.match(/^\(([\s\S]*)\)$/);
  if (inlineValueMatch) {
    return { kind: "resolved", value: inlineValueMatch[1] ?? "" };
  }

  const tempValueMatch = trimmed.match(/^<([\s\S]+)>$/);
  if (tempValueMatch) {
    return { kind: "unsupported", reason: "unsupported_dynamic_value" };
  }

  const looksLikePath =
    /^[./\\]/.test(trimmed) ||
    /^[a-zA-Z]:[\\/]/.test(trimmed) ||
    trimmed.startsWith("~/");
  if (looksLikePath) {
    const candidatePath = trimmed.startsWith("~/")
      ? path.join(os.homedir(), trimmed.slice(2))
      : path.isAbsolute(trimmed)
        ? trimmed
        : path.resolve(resolvedDir, trimmed);
    if (!existsSync(candidatePath)) {
      return { kind: "unsupported", reason: "unsupported_dynamic_value" };
    }
    return {
      kind: "resolved",
      value: await readFile(candidatePath, "utf8"),
    };
  }

  return { kind: "resolved", value: trimmed };
}

function buildContentTypeHeader(protocol: string, currentHeaders: Record<string, string>) {
  if (Object.keys(currentHeaders).some((key) => key.toLowerCase() === "content-type")) {
    return currentHeaders;
  }

  switch (protocol) {
    case "htmlBody":
      return { ...currentHeaders, "content-type": "text/html; charset=utf-8" };
    case "jsBody":
      return { ...currentHeaders, "content-type": "application/javascript; charset=utf-8" };
    case "cssBody":
      return { ...currentHeaders, "content-type": "text/css; charset=utf-8" };
    default:
      return currentHeaders;
  }
}

function buildMockTargetPreview(payload: CreateMockRuleInput) {
  return `${payload.method} ${payload.url} -> ${payload.responseStatus}`;
}

function buildProxyTargetPreview(payload: WhistleImportProxyRule) {
  if (payload.forwardMode === "rewriteHost") {
    return `${payload.pattern} -> ${payload.rewriteHost}`;
  }
  return `${payload.pattern} -> ${payload.targetUrl}`;
}

function buildExistingMockNameSet(rules: MockRule[]) {
  return new Set(rules.map((rule) => rule.name.trim().toLowerCase()));
}

function buildFullMockName(input: CreateMockRuleInput) {
  const group = typeof input.group === "string" ? input.group.trim() : "";
  const name = input.name.trim();
  return group ? `[${group}] ${name}` : name;
}

function getConflictMode(hasConflict: boolean): WhistleImportConflictMode {
  return hasConflict ? "duplicate" : "none";
}

export class WhistleImportService {
  constructor(private readonly mockService: MockService) {}

  async scan(): Promise<WhistleImportScanResponse> {
    const discovery = await discoverWhistleDir();
    const warnings: WhistleImportWarning[] = [];

    if (!discovery.resolvedDir) {
      warnings.push({
        code: "not_found",
        message: "未检测到本机 Whistle 数据目录",
        detail: discovery.baseDir,
      });
      return {
        source: {
          ...discovery,
          hasRules: false,
          hasValues: false,
          hasProperties: false,
          ruleFileCount: 0,
          valueFileCount: 0,
          groupCount: 0,
          enabledRuleFileCount: 0,
          scanWarnings: warnings,
        },
        groupSummaries: [],
        candidates: [],
      };
    }

    const rulesDir = path.join(discovery.resolvedDir, "rules");
    const valuesDir = path.join(discovery.resolvedDir, "values");
    const propertiesDir = path.join(discovery.resolvedDir, "properties");
    const hasRules = await isDirectory(rulesDir);
    const hasValues = await isDirectory(valuesDir);
    const hasProperties = await isDirectory(propertiesDir);

    if (!hasRules) {
      warnings.push({
        code: "missing_rules_dir",
        message: "Whistle rules 目录不存在",
        detail: rulesDir,
      });
    }
    if (!hasValues) {
      warnings.push({
        code: "missing_values_dir",
        message: "Whistle values 目录不存在",
        detail: valuesDir,
      });
    }
    if (!hasProperties) {
      warnings.push({
        code: "missing_properties_dir",
        message: "Whistle properties 目录不存在",
        detail: propertiesDir,
      });
    }

    const rulesStorage = hasRules ? await readStorage(rulesDir) : { files: [], properties: {} };
    const valuesStorage = hasValues ? await readStorage(valuesDir) : { files: [], properties: {} };
    const { groupedFiles, groupSummaries, enabledRuleFileCount } = collectGroupedRuleFiles(rulesStorage);
    const valueMap = new Map(valuesStorage.files.map((file) => [file.name, file.data] as const));
    const existingMockNames = buildExistingMockNameSet(this.mockService.list());
    const candidates: WhistleImportCandidate[] = [];

    for (const sourceFile of groupedFiles) {
      const lines = sourceFile.data.split(/\r?\n/);
      for (const line of lines) {
        const parsedLine = parseRuleLine(line);
        if (!parsedLine) {
          continue;
        }

        const candidate = await this.mapRuleLineToCandidate({
          existingMockNames,
          parsedLine,
          sourceFile,
          valueMap,
          resolvedDir: discovery.resolvedDir,
        });
        if (candidate) {
          candidates.push(candidate);
        }
      }
    }

    return {
      source: {
        ...discovery,
        hasRules,
        hasValues,
        hasProperties,
        ruleFileCount: rulesStorage.files.filter((file) => !isGroupFileName(file.name)).length,
        valueFileCount: valuesStorage.files.filter((file) => !isGroupFileName(file.name)).length,
        groupCount: groupSummaries.length,
        enabledRuleFileCount,
        scanWarnings: warnings,
      },
      groupSummaries,
      candidates,
    };
  }

  async execute(input: WhistleImportExecuteInput): Promise<WhistleImportExecuteResponse> {
    const warnings: WhistleImportWarning[] = [];
    const items: WhistleImportResultItem[] = [];
    let createdMockCount = 0;
    let createdProxyCount = 0;
    let createdGroupCount = 0;
    let duplicatedCount = 0;

    const existingMockNames = buildExistingMockNameSet(this.mockService.list());
    for (const importedMock of input.mockRules) {
      const { payload, duplicated } = this.prepareMockImport(importedMock, existingMockNames);
      await this.mockService.create(payload);
      existingMockNames.add(buildFullMockName(payload).toLowerCase());
      createdMockCount += 1;
      if (duplicated) {
        duplicatedCount += 1;
      }
      items.push({
        type: "mock",
        title: payload.name,
        groupName: payload.group ?? defaultGroupName,
        status: duplicated ? "duplicated" : "created",
        message: duplicated ? "已保留现有 Mock 并复制导入" : "已创建 Mock 规则",
      });
    }

    const nextProxyGroups = input.currentProxyGroups.map((group) => ({
      ...group,
      rules: [...group.rules],
    }));
    for (const importedGroup of input.proxyGroups) {
      let targetGroup = nextProxyGroups.find(
        (group) => group.name.trim().toLowerCase() === importedGroup.name.trim().toLowerCase(),
      );
      if (!targetGroup) {
        targetGroup = {
          id: importedGroup.id || randomUUID(),
          name: importedGroup.name,
          rules: [],
        };
        nextProxyGroups.push(targetGroup);
        createdGroupCount += 1;
      }

      for (const importedRule of importedGroup.rules) {
        const { rule, duplicated } = this.prepareProxyImport(importedRule, targetGroup.rules);
        targetGroup.rules.unshift(rule);
        createdProxyCount += 1;
        if (duplicated) {
          duplicatedCount += 1;
        }
        items.push({
          type: "proxy",
          title: rule.name,
          groupName: targetGroup.name,
          status: duplicated ? "duplicated" : "created",
          message: duplicated ? "已保留现有代理规则并复制导入" : "已创建代理规则",
        });
      }
    }

    return {
      createdMockCount,
      createdProxyCount,
      createdGroupCount,
      duplicatedCount,
      skippedCount: 0,
      warnings,
      items,
      nextProxyGroups,
      nextProxyActiveGroupId: input.currentProxyActiveGroupId,
    };
  }

  private async mapRuleLineToCandidate(params: {
    existingMockNames: Set<string>;
    parsedLine: ParsedRuleLine;
    sourceFile: GroupedRuleFile;
    valueMap: Map<string, string>;
    resolvedDir: string;
  }): Promise<WhistleImportCandidate | null> {
    const { existingMockNames, parsedLine, sourceFile, valueMap, resolvedDir } = params;
    const matcherInfo = parseSourceMatcher(parsedLine.matcher);
    const basePayload = {
      id: randomUUID(),
      groupName: sourceFile.groupName,
      title: buildTitle(sourceFile.name, parsedLine.matcher),
      sourceFileName: sourceFile.name,
      sourceFileKind: sourceFile.sourceFileKind,
      sourceSummary: truncateSummary(parsedLine.rawLine),
      rawLine: parsedLine.rawLine,
      matcher: parsedLine.matcher,
      enabled: sourceFile.selected,
      selectedByDefault: sourceFile.selected,
      compatible: false as const,
      conflictMode: "none" as const,
      targetPreview: "",
    };

    if (!parsedLine.operators.length) {
      return {
        ...basePayload,
        candidateType: "unsupported",
        skipReason: "no_supported_mapping",
      };
    }

    const unsupportedProtocol = parsedLine.operators.find((operator) =>
      ["plugin", "rulesFile", "reqScript", "resScript"].includes(operator.protocol) ||
      operator.protocol.startsWith("whistle.") ||
      operator.protocol.startsWith("plugin."),
    );
    if (unsupportedProtocol) {
      return {
        ...basePayload,
        candidateType: "unsupported",
        skipReason:
          unsupportedProtocol.protocol === "plugin" ||
            unsupportedProtocol.protocol.startsWith("whistle.") ||
            unsupportedProtocol.protocol.startsWith("plugin.")
            ? "unsupported_plugin_rule"
            : "unsupported_script_rule",
      };
    }

    if (!matcherInfo) {
      return {
        ...basePayload,
        candidateType: "unsupported",
        skipReason: "invalid_matcher",
      };
    }

    const hasProxyOperator = parsedLine.operators.some((operator) =>
      ["host", "proxy", "internal-proxy"].includes(operator.protocol),
    );
    const proxyCandidate = await this.tryMapProxyCandidate(parsedLine, sourceFile, matcherInfo);
    if (proxyCandidate) {
      return {
        ...basePayload,
        candidateType: "proxy",
        compatible: true,
        conflictMode: "none",
        targetPreview: buildProxyTargetPreview(proxyCandidate),
        proxyPayload: proxyCandidate,
      };
    }
    if (hasProxyOperator) {
      return {
        ...basePayload,
        candidateType: "unsupported",
        skipReason: parsedLine.operators.some((operator) => !operator.value.trim())
          ? "missing_target"
          : "unsupported_proxy_granularity",
      };
    }

    const mockCandidate = await this.tryMapMockCandidate({
      parsedLine,
      sourceFile,
      matcherInfo,
      valueMap,
      resolvedDir,
    });
    if (mockCandidate.type === "mock") {
      const conflictMode = getConflictMode(
        existingMockNames.has(buildFullMockName(mockCandidate.payload).toLowerCase()),
      );
      return {
        ...basePayload,
        candidateType: "mock",
        compatible: true,
        conflictMode,
        targetPreview: buildMockTargetPreview(mockCandidate.payload),
        mockPayload: mockCandidate.payload,
      };
    }

    return {
      ...basePayload,
      candidateType: "unsupported",
      skipReason: mockCandidate.reason,
    };
  }

  private async tryMapMockCandidate(params: {
    parsedLine: ParsedRuleLine;
    sourceFile: GroupedRuleFile;
    matcherInfo: NonNullable<ReturnType<typeof parseSourceMatcher>>;
    valueMap: Map<string, string>;
    resolvedDir: string;
  }): Promise<
    | { type: "mock"; payload: CreateMockRuleInput }
    | { type: "unsupported"; reason: WhistleImportSkipReason }
  > {
    const { parsedLine, sourceFile, matcherInfo, valueMap, resolvedDir } = params;
    const supportedProtocols = new Set([
      "method",
      "statusCode",
      "resHeaders",
      "resBody",
      "file",
      "htmlBody",
      "jsBody",
      "cssBody",
      "resType",
    ]);

    if (!parsedLine.operators.every((operator) => supportedProtocols.has(operator.protocol))) {
      return {
        type: "unsupported",
        reason: "no_supported_mapping",
      };
    }

    let method = inferMethod(parsedLine.filters);
    const bodyFilters = inferBodyFilters(parsedLine.filters);
    const headers: Record<string, string> = {};
    let responseStatus = 200;
    let responseBody: JsonValue | string | null = null;

    for (const operator of parsedLine.operators) {
      switch (operator.protocol) {
        case "method": {
          method = operator.value.trim().toUpperCase();
          break;
        }
        case "statusCode": {
          const status = Number(operator.value);
          if (!Number.isFinite(status)) {
            return { type: "unsupported", reason: "no_supported_mapping" };
          }
          responseStatus = status;
          break;
        }
        case "resHeaders": {
          const resolved = await resolveFileLikeValue(operator.value, valueMap, resolvedDir);
          if (resolved.kind === "unsupported") {
            return { type: "unsupported", reason: resolved.reason };
          }
          const parsedHeaders = parseHeadersValue(resolved.value);
          if (!parsedHeaders) {
            return { type: "unsupported", reason: "unsupported_dynamic_value" };
          }
          Object.assign(headers, parsedHeaders);
          break;
        }
        case "resBody":
        case "file":
        case "htmlBody":
        case "jsBody":
        case "cssBody": {
          const resolved = await resolveFileLikeValue(operator.value, valueMap, resolvedDir);
          if (resolved.kind === "unsupported") {
            return { type: "unsupported", reason: resolved.reason };
          }
          responseBody = parseMaybeJson(resolved.value);
          Object.assign(headers, buildContentTypeHeader(operator.protocol, headers));
          break;
        }
        case "resType": {
          if (!Object.keys(headers).some((key) => key.toLowerCase() === "content-type")) {
            headers["content-type"] = operator.value.includes("/")
              ? operator.value
              : operator.value === "json"
                ? "application/json; charset=utf-8"
                : operator.value;
          }
          break;
        }
        default:
          return { type: "unsupported", reason: "unsupported_multi_operator_rule" };
      }
    }

    if (!method) {
      return {
        type: "unsupported",
        reason: "no_supported_mapping",
      };
    }

    if (responseBody == null && responseStatus === 200 && Object.keys(headers).length === 0) {
      return {
        type: "unsupported",
        reason: "no_supported_mapping",
      };
    }

    return {
      type: "mock",
      payload: {
        name: buildTitle(sourceFile.name, parsedLine.matcher),
        group: sourceFile.groupName === defaultGroupName ? null : sourceFile.groupName,
        method,
        url: matcherInfo.normalizedUrl,
        requestBodyExactMatch: bodyFilters.exact,
        requestBodyKeyMatch: bodyFilters.key,
        responseStatus,
        responseHeaders: headers,
        responseBody,
        enabled: sourceFile.selected,
      },
    };
  }

  private async tryMapProxyCandidate(
    parsedLine: ParsedRuleLine,
    sourceFile: GroupedRuleFile,
    matcherInfo: NonNullable<ReturnType<typeof parseSourceMatcher>>,
  ): Promise<WhistleImportProxyRule | null> {
    const proxyOperators = parsedLine.operators.filter((operator) =>
      ["host", "proxy", "internal-proxy"].includes(operator.protocol),
    );
    if (proxyOperators.length === 0) {
      return null;
    }
    if (proxyOperators.length !== parsedLine.operators.length || proxyOperators.length !== 1) {
      return null;
    }
    if (parsedLine.filters.length > 0) {
      return null;
    }
    if (matcherInfo.pathname !== "/" || matcherInfo.search) {
      return null;
    }

    const operator = proxyOperators[0]!;
    const now = new Date().toISOString();
    const baseRule: WhistleImportProxyRule = {
      id: randomUUID(),
      name: buildTitle(sourceFile.name, parsedLine.matcher),
      pattern: matcherInfo.host,
      method: "GET",
      url: matcherInfo.normalizedUrl,
      path: "/",
      priority: 100,
      action: "proxy",
      enabled: sourceFile.selected,
      matchMode: "精确匹配",
      queryMatch: "继承原请求",
      headerMatch: "继承原请求",
      bodyMatch: "继承原请求",
      forwardMode: "rewriteTarget",
      targetUrl: "",
      rewriteHost: matcherInfo.host,
      rewritePath: "/",
      rewriteQuery: "",
      headerStrategy: "keep",
      requestHeaderPreview: '{\n  "x-import-source": "whistle"\n}',
      responseHeaderPreview: '{\n  "x-import-source": "whistle"\n}',
      responseDelay: 0,
      fallbackPolicy: "closed",
      createdAt: now,
      updatedAt: now,
    };

    if (operator.protocol === "host") {
      const hostTarget = operator.value.replace(/^[a-z]+:\/\//i, "").trim();
      if (!hostTarget) {
        return null;
      }
      return {
        ...baseRule,
        forwardMode: "rewriteHost",
        targetUrl: `https://${hostTarget}/`,
        rewriteHost: hostTarget,
      };
    }

    const target = operator.value.trim();
    if (!/^https?:\/\//i.test(target)) {
      return null;
    }

    return {
      ...baseRule,
      forwardMode: "rewriteTarget",
      targetUrl: target,
    };
  }

  private prepareMockImport(
    payload: CreateMockRuleInput,
    existingNames: Set<string>,
  ): { payload: CreateMockRuleInput; duplicated: boolean } {
    const nextPayload = {
      ...payload,
      responseHeaders: payload.responseHeaders ?? {},
    };
    const fullName = buildFullMockName(nextPayload).toLowerCase();
    if (!existingNames.has(fullName)) {
      return {
        payload: nextPayload,
        duplicated: false,
      };
    }

    return {
      payload: {
        ...nextPayload,
        name: this.buildDuplicateName(nextPayload.name, (candidateName) => {
          const candidatePayload = { ...nextPayload, name: candidateName };
          return existingNames.has(buildFullMockName(candidatePayload).toLowerCase());
        }),
      },
      duplicated: true,
    };
  }

  private prepareProxyImport(
    payload: WhistleImportProxyRule,
    existingRules: WhistleImportProxyRule[],
  ): { rule: WhistleImportProxyRule; duplicated: boolean } {
    const now = new Date().toISOString();
    const hasConflict = existingRules.some((rule) =>
      rule.pattern.trim().toLowerCase() === payload.pattern.trim().toLowerCase() ||
      rule.name.trim().toLowerCase() === payload.name.trim().toLowerCase(),
    );

    if (!hasConflict) {
      return {
        duplicated: false,
        rule: {
          ...payload,
          id: randomUUID(),
          createdAt: now,
          updatedAt: now,
        },
      };
    }

    return {
      duplicated: true,
      rule: {
        ...payload,
        id: randomUUID(),
        name: this.buildDuplicateName(
          payload.name,
          (candidateName) =>
            existingRules.some(
              (rule) => rule.name.trim().toLowerCase() === candidateName.trim().toLowerCase(),
            ),
        ),
        createdAt: now,
        updatedAt: now,
      },
    };
  }

  private buildDuplicateName(baseName: string, exists: (name: string) => boolean) {
    const normalizedBase = baseName.trim() || "Whistle 规则";
    const suffix = "（Whistle 导入）";
    let attempt = `${normalizedBase}${suffix}`;
    let index = 2;
    while (exists(attempt)) {
      attempt = `${normalizedBase}${suffix} ${index}`;
      index += 1;
    }
    return attempt;
  }
}
