export type JsonPathToken =
  | { type: "property"; key: string }
  | { type: "index"; index: number }
  | { type: "wildcard" }
  | { type: "recursive"; key: string };

export type WritableJsonPathToken = Extract<JsonPathToken, { type: "property" | "index" }>;

type JsonPathMatch = {
  value: unknown;
  path: string;
};

export type JsonPathExecutionResult = {
  normalizedPath: string;
  matchedPaths: string[];
  matchedValues: unknown[];
};

export function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isSimpleKey(key: string): boolean {
  return /^[A-Za-z_$][A-Za-z0-9_$]*$/.test(key);
}

function escapeQuotedKey(key: string): string {
  return key.replace(/\\/g, "\\\\").replace(/"/g, '\\"');
}

function appendPropertyPath(basePath: string, key: string): string {
  return isSimpleKey(key) ? `${basePath}.${key}` : `${basePath}["${escapeQuotedKey(key)}"]`;
}

function appendIndexPath(basePath: string, index: number): string {
  return `${basePath}[${index}]`;
}

function walkRecursiveMatches(value: unknown, path: string, key: string, matches: JsonPathMatch[]): void {
  if (Array.isArray(value)) {
    value.forEach((item, index) => {
      walkRecursiveMatches(item, appendIndexPath(path, index), key, matches);
    });
    return;
  }

  if (!isPlainObject(value)) {
    return;
  }

  for (const [childKey, childValue] of Object.entries(value)) {
    const childPath = appendPropertyPath(path, childKey);
    if (childKey === key) {
      matches.push({ path: childPath, value: childValue });
    }
    walkRecursiveMatches(childValue, childPath, key, matches);
  }
}

function normalizePathLikeInput(path: string): string {
  const trimmed = path.trim();
  if (!trimmed) {
    return "$";
  }
  if (trimmed.startsWith("$")) {
    return trimmed;
  }

  let normalized = "$";
  let index = 0;
  while (index < trimmed.length) {
    const char = trimmed[index]!;
    if (char === ".") {
      index += 1;
      continue;
    }

    if (char === "[") {
      const end = trimmed.indexOf("]", index);
      if (end === -1) {
        normalized += trimmed.slice(index);
        break;
      }
      normalized += trimmed.slice(index, end + 1);
      index = end + 1;
      continue;
    }

    let end = index;
    while (end < trimmed.length && trimmed[end] !== "." && trimmed[end] !== "[") {
      end += 1;
    }
    const part = trimmed.slice(index, end);
    if (/^\d+$/.test(part)) {
      normalized += `[${part}]`;
    } else if (isSimpleKey(part)) {
      normalized += `.${part}`;
    } else {
      normalized += `["${escapeQuotedKey(part)}"]`;
    }
    index = end;
  }

  return normalized;
}

export function normalizeToJsonPath(path?: string): string | undefined {
  if (!path) {
    return undefined;
  }
  return normalizePathLikeInput(path);
}

export function parseNormalizedJsonPath(path: string): JsonPathToken[] {
  if (!path.startsWith("$")) {
    throw new Error(`JSONPath must start with $: ${path}`);
  }

  const tokens: JsonPathToken[] = [];
  let index = 1;
  while (index < path.length) {
    if (path.startsWith("..", index)) {
      index += 2;
      const start = index;
      while (index < path.length && /[A-Za-z0-9_$-]/.test(path[index]!)) {
        index += 1;
      }
      const key = path.slice(start, index);
      if (!key) {
        throw new Error(`Invalid recursive JSONPath segment: ${path}`);
      }
      tokens.push({ type: "recursive", key });
      continue;
    }

    if (path[index] === ".") {
      index += 1;
      const start = index;
      while (index < path.length && /[A-Za-z0-9_$-]/.test(path[index]!)) {
        index += 1;
      }
      const key = path.slice(start, index);
      if (!key) {
        throw new Error(`Invalid JSONPath property segment: ${path}`);
      }
      tokens.push({ type: "property", key });
      continue;
    }

    if (path[index] === "[") {
      const end = path.indexOf("]", index);
      if (end === -1) {
        throw new Error(`Unterminated JSONPath bracket segment: ${path}`);
      }
      const inner = path.slice(index + 1, end).trim();
      if (inner === "*") {
        tokens.push({ type: "wildcard" });
      } else if (/^\d+$/.test(inner)) {
        tokens.push({ type: "index", index: Number(inner) });
      } else if (
        (inner.startsWith('"') && inner.endsWith('"')) ||
        (inner.startsWith("'") && inner.endsWith("'"))
      ) {
        tokens.push({ type: "property", key: inner.slice(1, -1) });
      } else {
        throw new Error(`Unsupported JSONPath bracket segment: ${path}`);
      }
      index = end + 1;
      continue;
    }

    throw new Error(`Unsupported JSONPath token near "${path.slice(index)}"`);
  }

  return tokens;
}

export function executeJsonPath(value: unknown, inputPath: string): JsonPathExecutionResult {
  const normalizedPath = normalizeToJsonPath(inputPath) ?? "$";
  const tokens = parseNormalizedJsonPath(normalizedPath);

  let nodes: JsonPathMatch[] = [{ path: "$", value }];
  for (const token of tokens) {
    const nextNodes: JsonPathMatch[] = [];
    for (const node of nodes) {
      if (token.type === "property") {
        if (isPlainObject(node.value) && token.key in node.value) {
          nextNodes.push({
            path: appendPropertyPath(node.path, token.key),
            value: node.value[token.key]
          });
        }
        continue;
      }

      if (token.type === "index") {
        if (Array.isArray(node.value) && token.index in node.value) {
          nextNodes.push({
            path: appendIndexPath(node.path, token.index),
            value: node.value[token.index]
          });
        }
        continue;
      }

      if (token.type === "wildcard") {
        if (Array.isArray(node.value)) {
          node.value.forEach((item, nextIndex) => {
            nextNodes.push({ path: appendIndexPath(node.path, nextIndex), value: item });
          });
        } else if (isPlainObject(node.value)) {
          for (const [key, child] of Object.entries(node.value)) {
            nextNodes.push({ path: appendPropertyPath(node.path, key), value: child });
          }
        }
        continue;
      }

      if (token.type === "recursive") {
        walkRecursiveMatches(node.value, node.path, token.key, nextNodes);
      }
    }
    nodes = nextNodes;
  }

  return {
    normalizedPath,
    matchedPaths: nodes.map((node) => node.path),
    matchedValues: nodes.map((node) => node.value)
  };
}

export function cloneJsonValue<T>(value: T): T {
  if (value === undefined) {
    return value;
  }
  return JSON.parse(JSON.stringify(value)) as T;
}

export function extractWritableJsonPathTokens(inputPath: string): WritableJsonPathToken[] {
  const normalizedPath = normalizeToJsonPath(inputPath) ?? "$";
  const tokens = parseNormalizedJsonPath(normalizedPath);
  if (tokens.some((token) => token.type === "wildcard" || token.type === "recursive")) {
    throw new Error(`Writable JSONPath does not support wildcard or recursive segments: ${inputPath}`);
  }
  return tokens as WritableJsonPathToken[];
}

export function assignPathValue(target: unknown, tokens: WritableJsonPathToken[], value: unknown): unknown {
  if (tokens.length === 0) {
    return cloneJsonValue(value);
  }

  const [head, ...rest] = tokens;
  if (head.type === "index") {
    const arrayTarget = Array.isArray(target) ? [...target] : [];
    arrayTarget[head.index] = assignPathValue(arrayTarget[head.index], rest, value);
    return arrayTarget;
  }

  const objectTarget = isPlainObject(target) ? { ...target } : {};
  objectTarget[head.key] = assignPathValue(objectTarget[head.key], rest, value);
  return objectTarget;
}

export function removePathValue(target: unknown, tokens: WritableJsonPathToken[]): unknown {
  if (tokens.length === 0) {
    return undefined;
  }

  const [head, ...rest] = tokens;
  if (head.type === "index" && Array.isArray(target)) {
    const next = [...target];
    if (rest.length === 0) {
      next.splice(head.index, 1);
    } else if (head.index in next) {
      next[head.index] = removePathValue(next[head.index], rest);
    }
    return next;
  }

  if (head.type === "property" && isPlainObject(target)) {
    const next: Record<string, unknown> = { ...target };
    if (rest.length === 0) {
      delete next[head.key];
    } else if (head.key in next) {
      next[head.key] = removePathValue(next[head.key], rest);
    }
    return next;
  }

  return target;
}

export function buildEmptyLike(value: unknown): unknown {
  if (Array.isArray(value)) {
    return [];
  }
  if (isPlainObject(value)) {
    return {};
  }
  return null;
}
