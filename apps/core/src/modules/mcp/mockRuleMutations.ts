import type { CreateMockRuleInput, UpdateMockRuleInput } from "@polaris/shared-contracts";
import type { MockRule, RequestRecord } from "@polaris/shared-types";
import { mockTemplates } from "../mock/mockTemplates";

type MockRulePatch = Partial<CreateMockRuleInput>;
type MockRuleOperationPath = keyof CreateMockRuleInput;

type MockRuleOperation = {
  op: "replace" | "remove";
  path: MockRuleOperationPath;
  value?: unknown;
};

type CreateMockRuleFromRequestInput = {
  name: string;
  requestId: string;
  patch?: MockRulePatch;
};

type CreateMockRuleFromTemplateInput = {
  name: string;
  template: keyof typeof mockTemplates | string;
  patch?: MockRulePatch;
};

type UpdateMockRulePatchInput = {
  id: string;
  patch: MockRulePatch;
};

type UpdateMockRuleOperationsInput = {
  id: string;
  operations: MockRuleOperation[];
};

export type CreateMockRuleArgs = CreateMockRuleInput | CreateMockRuleFromRequestInput | CreateMockRuleFromTemplateInput;
export type UpdateMockRuleArgs = ({ id: string } & UpdateMockRuleInput) | UpdateMockRulePatchInput | UpdateMockRuleOperationsInput;

function isFullCreateInput(args: CreateMockRuleArgs): args is CreateMockRuleInput {
  return "method" in args && "url" in args && "responseStatus" in args;
}

function isFullUpdateInput(args: UpdateMockRuleArgs): args is { id: string } & UpdateMockRuleInput {
  return "name" in args && "method" in args && "url" in args && "responseStatus" in args;
}

function applyPatch(base: CreateMockRuleInput, patch?: MockRulePatch): CreateMockRuleInput {
  return {
    ...base,
    ...(patch ?? {})
  };
}

function applyOperations(base: CreateMockRuleInput, operations: MockRuleOperation[]): CreateMockRuleInput {
  return operations.reduce<CreateMockRuleInput>((current, operation) => {
    if (operation.op === "remove") {
      return {
        ...current,
        [operation.path]: null
      } as CreateMockRuleInput;
    }

    return {
      ...current,
      [operation.path]: operation.value
    } as CreateMockRuleInput;
  }, base);
}

function fromRequestRecord(name: string, record: RequestRecord): CreateMockRuleInput {
  return {
    name,
    method: record.method,
    url: record.url,
    requestBodyExactMatch: null,
    requestBodyKeyMatch: null,
    responseStatus: record.statusCode,
    responseHeaders: record.responseHeaders,
    responseBody: record.responseBody,
    enabled: true
  };
}

function fromExistingRule(rule: MockRule): CreateMockRuleInput {
  return {
    name: rule.name,
    method: rule.method,
    url: rule.url,
    requestBodyExactMatch: rule.requestBodyExactMatch ?? null,
    requestBodyKeyMatch: rule.requestBodyKeyMatch ?? null,
    responseStatus: rule.responseStatus,
    responseHeaders: rule.responseHeaders,
    responseBody: rule.responseBody,
    enabled: rule.enabled
  };
}

export function buildCreateMockRuleInput(
  args: CreateMockRuleArgs,
  context: { requestRecord?: RequestRecord }
): CreateMockRuleInput {
  if (isFullCreateInput(args)) {
    return args;
  }

  if ("requestId" in args) {
    if (!context.requestRecord) {
      throw new Error("Request not found");
    }

    return applyPatch(fromRequestRecord(args.name, context.requestRecord), args.patch);
  }

  const template = mockTemplates[args.template];
  if (!template) {
    throw new Error("Mock template not found");
  }

  return applyPatch(
    {
      name: args.name,
      ...template
    },
    args.patch
  );
}

export function buildUpdateMockRuleInput(existingRule: MockRule, args: UpdateMockRuleArgs): UpdateMockRuleInput {
  if (isFullUpdateInput(args)) {
    const { id: _id, ...input } = args;
    return input;
  }

  const base = fromExistingRule(existingRule);
  if ("patch" in args) {
    return applyPatch(base, args.patch);
  }

  return applyOperations(base, args.operations);
}
