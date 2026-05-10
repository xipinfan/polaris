import type { UpdateSavedRequestInput } from "@polaris/shared-contracts";
import { createPolarisError } from "./errorHandling";

export type WideStringMapValue = string | number | boolean | null;
export type WideQueryValue = WideStringMapValue | Array<string | number | boolean>;

export type UpdateSavedRequestMutationInput = Omit<UpdateSavedRequestInput, "headers" | "query"> & {
  headers?: Record<string, WideStringMapValue>;
  query?: Record<string, WideQueryValue>;
};

type ExistingMaps = {
  headers: Record<string, string>;
  query: Record<string, string>;
};

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function invalidField(path: string, value: unknown): never {
  const typeName = Array.isArray(value) ? "array" : value === null ? "null" : typeof value;
  throw createPolarisError("INVALID_REQUEST_FIELD", `${path} 必须是 string、number、boolean 或 null，不能是 ${typeName}。`, {
    status: 400,
    details: { field: path },
    suggestions: ["把该字段改成字符串", "如果要保存结构化数据，请放入 body"]
  });
}

function invalidQueryArrayItem(path: string, value: unknown): never {
  const typeName = Array.isArray(value) ? "array" : value === null ? "null" : typeof value;
  throw createPolarisError("INVALID_REQUEST_FIELD", `${path} 必须是 string、number 或 boolean，不能是 ${typeName}。`, {
    status: 400,
    details: { field: path },
    suggestions: ["把该 query 数组元素改成字符串", "如果要保存结构化数据，请放入 body"]
  });
}

function normalizeScalarMap(
  patch: Record<string, WideStringMapValue>,
  existing: Record<string, string>,
  scope: "headers" | "query"
): Record<string, string> {
  const next = { ...existing };
  for (const [key, value] of Object.entries(patch)) {
    const path = `${scope}.${key}`;
    if (value === null) {
      delete next[key];
      continue;
    }
    if (isPlainObject(value) || Array.isArray(value)) {
      invalidField(path, value);
    }
    next[key] = String(value);
  }
  return next;
}

function normalizeQueryMap(
  patch: Record<string, WideQueryValue>,
  existing: Record<string, string>
): Record<string, string> {
  const next = { ...existing };
  for (const [key, value] of Object.entries(patch)) {
    const path = `query.${key}`;
    if (value === null) {
      delete next[key];
      continue;
    }
    if (Array.isArray(value)) {
      next[key] = value
        .map((item, index) => {
          if (item === null || isPlainObject(item) || Array.isArray(item)) {
            invalidQueryArrayItem(`${path}[${index}]`, item);
          }
          return String(item);
        })
        .join(",");
      continue;
    }
    if (isPlainObject(value)) {
      invalidField(path, value);
    }
    next[key] = String(value);
  }
  return next;
}

export function normalizeUpdateSavedRequestInput(
  input: UpdateSavedRequestMutationInput,
  existing: ExistingMaps
): UpdateSavedRequestInput {
  const next: UpdateSavedRequestInput = {};

  if ("name" in input) next.name = input.name;
  if ("method" in input) next.method = input.method;
  if ("url" in input) next.url = input.url;
  if ("body" in input) next.body = input.body;
  if ("tags" in input) next.tags = input.tags;
  if (input.headers) next.headers = normalizeScalarMap(input.headers, existing.headers, "headers");
  if (input.query) next.query = normalizeQueryMap(input.query, existing.query);

  return next;
}
