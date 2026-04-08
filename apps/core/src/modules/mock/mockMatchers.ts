type ExactBodyCondition = { path: string; expected: string };

export function getRuleGroupName(name: string): string | null {
  const match = name.match(/^\[(.+?)\]\s*(.+)$/);
  return match?.[1]?.trim() || null;
}

export function hasBodyKeyPath(value: unknown, keyPath: string): boolean {
  if (value === null || value === undefined || typeof value !== "object") {
    return false;
  }

  const segments = keyPath
    .split(".")
    .map((part) => part.trim())
    .filter(Boolean);

  let current: unknown = value;
  for (const segment of segments) {
    if (Array.isArray(current)) {
      const index = Number(segment);
      if (!Number.isInteger(index) || index < 0 || index >= current.length) {
        return false;
      }
      current = current[index];
      continue;
    }

    if (current === null || typeof current !== "object") {
      return false;
    }

    if (!(segment in (current as Record<string, unknown>))) {
      return false;
    }

    current = (current as Record<string, unknown>)[segment];
  }

  return true;
}

export function getBodyPathValue(value: unknown, keyPath: string): { found: boolean; value?: unknown } {
  if (value === null || value === undefined || typeof value !== "object") {
    return { found: false };
  }

  const segments = keyPath
    .split(".")
    .map((part) => part.trim())
    .filter(Boolean);

  let current: unknown = value;
  for (const segment of segments) {
    if (Array.isArray(current)) {
      const index = Number(segment);
      if (!Number.isInteger(index) || index < 0 || index >= current.length) {
        return { found: false };
      }
      current = current[index];
      continue;
    }

    if (current === null || typeof current !== "object") {
      return { found: false };
    }

    if (!(segment in (current as Record<string, unknown>))) {
      return { found: false };
    }

    current = (current as Record<string, unknown>)[segment];
  }

  return { found: true, value: current };
}

export function parseExactBodyMatch(expression?: string | null): ExactBodyCondition[] | null {
  if (!expression) {
    return [];
  }

  const conditions: ExactBodyCondition[] = [];
  const entries = expression
    .split(/[\n;]+/)
    .map((part) => part.trim())
    .filter(Boolean);

  for (const entry of entries) {
    const separatorIndex = entry.indexOf(":");
    if (separatorIndex <= 0) {
      return null;
    }

    const path = entry.slice(0, separatorIndex).trim();
    const expectedLiteral = entry.slice(separatorIndex + 1).trim();
    if (!path || !expectedLiteral) {
      return null;
    }

    if (!(expectedLiteral.startsWith("\"") && expectedLiteral.endsWith("\""))) {
      return null;
    }

    const expected = JSON.parse(expectedLiteral);
    if (typeof expected !== "string") {
      return null;
    }

    conditions.push({ path, expected });
  }

  return conditions;
}

export function matchesExactBodyExpression(requestBody: unknown, expression?: string | null): boolean {
  const conditions = parseExactBodyMatch(expression);
  if (conditions === null) {
    return false;
  }

  for (const condition of conditions) {
    const resolved = getBodyPathValue(requestBody, condition.path);
    if (!resolved.found) {
      return false;
    }
    if (typeof resolved.value !== "string" || resolved.value !== condition.expected) {
      return false;
    }
  }

  return true;
}
