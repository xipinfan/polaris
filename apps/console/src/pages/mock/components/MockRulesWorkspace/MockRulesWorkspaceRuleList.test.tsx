import { act } from "react";
import { createRoot } from "react-dom/client";
import type { MockRule } from "@polaris/shared-types";
import { afterEach, describe, expect, it, vi } from "vitest";
import { MockRulesWorkspaceRuleList } from "./MockRulesWorkspaceRuleList";
import type { RuleUrlBlock } from "../../types";

Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });

const mountedRoots: Array<ReturnType<typeof createRoot>> = [];

afterEach(() => {
  for (const root of mountedRoots.splice(0)) {
    act(() => {
      root.unmount();
    });
  }
});

function renderRuleList() {
  const container = document.createElement("div");
  document.body.append(container);
  const root = createRoot(container);
  mountedRoots.push(root);

  const rule: MockRule = {
    id: "rule-1",
    name: "默认场景",
    method: "GET",
    url: "https://example.test/api/users",
    responseStatus: 200,
    responseHeaders: {},
    responseBody: "{}",
    enabled: true,
    hitCount: 0,
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-01T00:00:00.000Z",
  };

  const block: RuleUrlBlock = {
    key: "https://example.test/api/users",
    host: "example.test",
    label: "https://example.test/api/users",
    rules: [rule],
  };

  act(() => {
    root.render(
      <MockRulesWorkspaceRuleList
        collapsedBlocks={{}}
        defaultGroup="默认分组"
        filteredRuleBlocks={[block]}
        getMethodClass={() => "methodGet"}
        groupMenuName={null}
        hasVisibleRules
        onDeleteRule={vi.fn()}
        onDeleteUrlBlock={vi.fn()}
        onDuplicateRule={vi.fn()}
        onExportRule={vi.fn()}
        onOpenCreateModalForUrl={vi.fn()}
        onOpenEditModal={vi.fn()}
        onOpenMoveRule={vi.fn()}
        onSetDuplicateDraft={vi.fn()}
        onToggleBlock={vi.fn()}
        onToggleRule={vi.fn()}
        ruleMenuId={null}
        selectedRuleId={null}
        setGroupMenuName={vi.fn()}
        setRuleMenuId={vi.fn()}
        setSelectedRuleId={vi.fn()}
      />,
    );
  });

  return container;
}

describe("MockRulesWorkspaceRuleList", () => {
  it("renders URL block controls without nesting native buttons", () => {
    const container = renderRuleList();

    const buttonsWithNestedButtons = Array.from(
      container.querySelectorAll("button"),
    ).filter((button) => button.querySelector("button"));

    expect(buttonsWithNestedButtons).toHaveLength(0);
  });

  it("uses a dedicated collapse button for the URL block", () => {
    const container = renderRuleList();

    const collapseButton = Array.from(container.querySelectorAll("button")).find(
      (button) => button.textContent?.trim() === "收起",
    );

    expect(collapseButton).toBeDefined();
  });
});
