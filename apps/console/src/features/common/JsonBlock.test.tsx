import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { act } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, describe, expect, it, vi } from "vitest";
import { ToastProvider } from "../feedback/ToastProvider";
import { JsonBlock } from "./JsonBlock";

const currentDir = dirname(fileURLToPath(import.meta.url));
Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });

function renderJsonBlock(value: unknown) {
  const host = document.createElement("div");
  document.body.appendChild(host);
  const root = createRoot(host);

  act(() => {
    root.render(
      <ToastProvider>
        <JsonBlock title="响应体" value={value} />
      </ToastProvider>
    );
  });

  return { host, root };
}

afterEach(() => {
  vi.restoreAllMocks();
  document.body.innerHTML = "";
});

describe("JsonBlock", () => {
  it("copies the full formatted JSON text", async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    Object.assign(navigator, {
      clipboard: { writeText }
    });

    const value = {
      nested: { enabled: true },
      longValue: "0123456789".repeat(20)
    };
    const { host, root } = renderJsonBlock(value);

    const button = host.querySelector<HTMLButtonElement>(".json-copy-button");
    expect(button).not.toBeNull();

    await act(async () => {
      button?.click();
    });

    expect(writeText).toHaveBeenCalledWith(JSON.stringify(value, null, 2));

    act(() => {
      root.unmount();
    });
  });

  it("uses an internal scrolling strategy that preserves JSON indentation", () => {
    const css = readFileSync(join(currentDir, "JsonBlock.module.css"), "utf8");

    expect(css).toContain("overflow: auto");
    expect(css).toContain("max-height");
    expect(css).toContain("white-space: pre");
    expect(css).not.toContain("white-space: pre-wrap");
    expect(css).not.toContain("word-break: break-word");
  });
});
