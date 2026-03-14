import { toUserMessage } from "../../services/apiErrors";

export const queryStaleTime = {
  highFrequency: 3_000,
  medium: 30_000,
  baseConfig: 5 * 60_000,
} as const;

export function getErrorMessage(error: unknown, fallback: string) {
  if (error instanceof Error && error.message.trim()) {
    return error.message;
  }
  return fallback;
}

type ShowToast = (message: string, tone?: "success" | "error" | "info") => void;

export function toastQueryError(showToast: ShowToast, error: unknown, fallback: string) {
  showToast(toUserMessage(error, fallback), "error");
}
