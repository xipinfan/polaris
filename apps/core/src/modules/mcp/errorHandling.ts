import { ErrorCode, McpError } from "@modelcontextprotocol/sdk/types.js";

export interface PolarisErrorPayload {
  code: string;
  message: string;
  details?: unknown;
  retryable: boolean;
  suggestions?: string[];
  input?: unknown;
}

export class PolarisHandledError extends Error {
  constructor(
    public readonly status: number,
    public readonly rpcCode: ErrorCode,
    public readonly payload: PolarisErrorPayload
  ) {
    super(payload.message);
    this.name = "PolarisHandledError";
  }
}

export function createPolarisError(
  code: string,
  message: string,
  options: {
    status?: number;
    rpcCode?: ErrorCode;
    details?: unknown;
    retryable?: boolean;
    suggestions?: string[];
    input?: unknown;
  } = {}
): PolarisHandledError {
  const status = options.status ?? 500;
  return new PolarisHandledError(
    status,
    options.rpcCode ??
      (status === 404 ? ErrorCode.MethodNotFound : status === 400 ? ErrorCode.InvalidParams : ErrorCode.InternalError),
    {
      code,
      message,
      details: options.details,
      retryable: options.retryable ?? false,
      suggestions: options.suggestions,
      input: options.input
    }
  );
}

function buildHandledError(error: unknown): PolarisHandledError {
  if (error instanceof PolarisHandledError) {
    return error;
  }

  if (error instanceof McpError) {
    const data = (error.data ?? {}) as Record<string, unknown>;
    return new PolarisHandledError(400, error.code as ErrorCode, {
      code: typeof data.code === "string" ? data.code : "MCP_ERROR",
      message:
        typeof data.message === "string"
          ? data.message
          : error.message.replace(/^MCP error -?\d+:\s*/, ""),
      details: data.details ?? error.data,
      retryable: typeof data.retryable === "boolean" ? data.retryable : false
    });
  }

  const message = error instanceof Error ? error.message : "Unknown error";
  if (/not found/i.test(message)) {
    return createPolarisError("NOT_FOUND", message, {
      status: 404,
      rpcCode: ErrorCode.MethodNotFound
    });
  }

  if (/invalid|required|missing/i.test(message)) {
    return createPolarisError("INVALID_INPUT", message, {
      status: 400,
      rpcCode: ErrorCode.InvalidParams
    });
  }

  return createPolarisError("INTERNAL_ERROR", message, {
    status: 500,
    rpcCode: ErrorCode.InternalError
  });
}

export function toMcpError(error: unknown): McpError {
  const handled = buildHandledError(error);
  return new McpError(handled.rpcCode, handled.payload.message, handled.payload);
}

export function toLegacyErrorResponse(error: unknown): { status: number; error: PolarisErrorPayload } {
  const handled = buildHandledError(error);
  return {
    status: handled.status,
    error: handled.payload
  };
}

export function unknownToolError(tool: string): PolarisHandledError {
  return createPolarisError("UNKNOWN_TOOL", `Unknown tool: ${tool}`, {
    status: 404,
    rpcCode: ErrorCode.MethodNotFound
  });
}

export function unknownResourceError(resource: string): PolarisHandledError {
  return createPolarisError("UNKNOWN_RESOURCE", `Unknown resource: ${resource}`, {
    status: 404,
    rpcCode: ErrorCode.MethodNotFound
  });
}

export function unknownPackError(pack: string): PolarisHandledError {
  return createPolarisError("UNKNOWN_PACK", `Unknown MCP pack: ${pack}`, {
    status: 400,
    rpcCode: ErrorCode.InvalidParams
  });
}
