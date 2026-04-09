import type { DetailView } from "./payloads";

export function resolveDetailTextMode(view?: DetailView): "summary" | "preview" | "full" {
  if (view === "summary") {
    return "summary";
  }

  if (view === "full" || view === "shape" || view === "diagnostic") {
    return "full";
  }

  return "preview";
}
