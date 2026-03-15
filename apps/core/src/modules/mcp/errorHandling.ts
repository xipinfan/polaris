import { ErrorCode, McpError } from "@modelcontextprotocol/sdk/types.js";

export interface PolarisErrorPayload {
  code: string;
  message: string;
  details?: unknown;
  retryable: boolean;
}

class PolarisHandledError extends Error {
  constructor(
    public readonly status: number,
    public readonly rpcCode: ErrorCode,
    public readonly payload: PolarisErrorPayload
  ) {
    super(payload.message);
    this.name = "PolarisHandledError";
  }
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
    return new PolarisHandledError(404, ErrorCode.MethodNotFound, {
      code: "NOT_FOUND",
      message,
      retryable: false
    });
  }

  if (/invalid|required|missing/i.test(message)) {
    return new PolarisHandledError(400, ErrorCode.InvalidParams, {
      code: "INVALID_INPUT",
      message,
      retryable: false
    });
  }

  return new PolarisHandledError(500, ErrorCode.InternalError, {
    code: "INTERNAL_ERROR",
    message,
    retryable: false
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
  return new PolarisHandledError(404, ErrorCode.MethodNotFound, {
    code: "UNKNOWN_TOOL",
    message: `Unknown tool: ${tool}`,
    retryable: false
  });
}

export function unknownResourceError(resource: string): PolarisHandledError {
  return new PolarisHandledError(404, ErrorCode.MethodNotFound, {
    code: "UNKNOWN_RESOURCE",
    message: `Unknown resource: ${resource}`,
    retryable: false
  });
}

export function unknownPackError(pack: string): PolarisHandledError {
  return new PolarisHandledError(400, ErrorCode.InvalidParams, {
    code: "UNKNOWN_PACK",
    message: `Unknown MCP pack: ${pack}`,
    retryable: false
  });
}
