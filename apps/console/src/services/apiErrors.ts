export type ApiErrorCode =
  | "NETWORK_ERROR"
  | "HTTP_ERROR"
  | "PARSE_ERROR"
  | "UNKNOWN_ERROR";

export class ApiError extends Error {
  code: ApiErrorCode;
  status?: number;
  path: string;
  details?: unknown;

  constructor(params: {
    message: string;
    code: ApiErrorCode;
    path: string;
    status?: number;
    details?: unknown;
  }) {
    super(params.message);
    this.name = "ApiError";
    this.code = params.code;
    this.status = params.status;
    this.path = params.path;
    this.details = params.details;
  }
}

export function mapApiError(error: unknown, fallbackPath: string): ApiError {
  if (error instanceof ApiError) {
    return error;
  }

  if (error instanceof Error) {
    return new ApiError({
      message: error.message || "Request failed",
      code: "UNKNOWN_ERROR",
      path: fallbackPath,
      details: error,
    });
  }

  return new ApiError({
    message: "Request failed",
    code: "UNKNOWN_ERROR",
    path: fallbackPath,
    details: error,
  });
}

export function toUserMessage(error: unknown, fallback: string) {
  const mapped = mapApiError(error, "unknown");
  if (mapped.code === "NETWORK_ERROR") {
    return "网络连接失败，请检查本地服务";
  }
  if (mapped.status === 401 || mapped.status === 403) {
    return "请求未授权，请重新连接";
  }
  if (mapped.status && mapped.status >= 500) {
    return "服务暂不可用，请稍后重试";
  }
  return mapped.message || fallback;
}
