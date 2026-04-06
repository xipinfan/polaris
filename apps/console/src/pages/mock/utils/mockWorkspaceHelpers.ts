import type { MockRule } from "@polaris/shared-types";
import type { MockFormState } from "../types";
import { buildMockRulePayload, type MockRulePayload } from "./mockImportExport";
import { buildUniqueVariantName, getRuleScene } from "./mockHelpers";

export function validateExactBodyMatchExpression(expression: string): string | null {
  const text = expression.trim();
  if (!text) {
    return null;
  }

  const entries = text
    .split(/[\n;]+/)
    .map((part) => part.trim())
    .filter(Boolean);

  for (const entry of entries) {
    const separatorIndex = entry.indexOf(":");
    if (separatorIndex <= 0) {
      return "Body 精确匹配格式错误，请使用 path:\"value\"";
    }

    const path = entry.slice(0, separatorIndex).trim();
    const valueLiteral = entry.slice(separatorIndex + 1).trim();
    if (!path || !(valueLiteral.startsWith("\"") && valueLiteral.endsWith("\""))) {
      return "Body 精确匹配格式错误，请使用 path:\"value\"";
    }

    try {
      const parsed = JSON.parse(valueLiteral);
      if (typeof parsed !== "string") {
        return "Body 精确匹配的值必须为字符串";
      }
    } catch {
      return "Body 精确匹配字符串格式非法";
    }
  }

  return null;
}

export function buildMockPayloadFromForm(form: MockFormState): MockRulePayload | null {
  return buildMockRulePayload(form.group, {
    variant: form.variant,
    method: form.method,
    url: form.url,
    requestBodyExactMatch: form.requestBodyExactMatch,
    requestBodyKeyMatch: form.requestBodyKeyMatch,
    responseStatus: Number(form.responseStatus),
    responseHeaders: JSON.parse(form.responseHeaders || "{}"),
    responseBody: JSON.parse(form.responseBody || "{}"),
    enabled: form.enabled,
  });
}

export function buildNextDuplicateVariant(
  rule: MockRule,
  currentGroupRules: MockRule[],
  defaultGroup: string,
) {
  const scene = getRuleScene(rule, defaultGroup);
  const existingVariants = currentGroupRules.map((item) => getRuleScene(item, defaultGroup).variant);
  return {
    nextVariant: buildUniqueVariantName(`${scene.variant} 副本`, existingVariants),
    scene,
  };
}
