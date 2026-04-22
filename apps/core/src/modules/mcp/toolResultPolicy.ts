import type { DetailView } from "./payloads";

/**
 * text 字段策略：永不返回 "full"，避免 structuredContent 与 text 双倍上下文开销。
 * structuredContent 始终携带完整结构化数据，text 仅用于不支持 structuredContent 的客户端摘要/预览展示。
 */
export function resolveDetailTextMode(view?: DetailView): "summary" | "preview" {
  if (view === "summary" || view === "shape") {
    return "summary";
  }
  return "preview";
}
