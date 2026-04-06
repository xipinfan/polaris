import type { ColumnsType } from "antd/es/table";
import type { MockRule } from "@polaris/shared-types";
import { useMemo, useState } from "react";
import type { RuleUrlBlock } from "../../types";
import { getRuleScene } from "../../utils/mockHelpers";
import type { DuplicateUrlBlockDraft, ExportTableRecord } from "./types";

type UseMockRulesWorkspaceStateArgs = {
  currentGroupRules: MockRule[];
  defaultGroup: string;
  groups: string[];
  ruleBlocks: RuleUrlBlock[];
};

export function useMockRulesWorkspaceState({
  currentGroupRules,
  defaultGroup,
  groups,
  ruleBlocks,
}: UseMockRulesWorkspaceStateArgs) {
  const [moveRule, setMoveRule] = useState<MockRule | null>(null);
  const [movingGroup, setMovingGroup] = useState<string | null>(null);
  const [ruleSearch, setRuleSearch] = useState("");
  const [isEditGroupOpen, setIsEditGroupOpen] = useState(false);
  const [groupDescriptionInput, setGroupDescriptionInput] = useState("");
  const [isBatchExportOpen, setIsBatchExportOpen] = useState(false);
  const [batchSearch, setBatchSearch] = useState("");
  const [selectedExportKeys, setSelectedExportKeys] = useState<string[]>([]);
  const [duplicateDraft, setDuplicateDraft] = useState<DuplicateUrlBlockDraft | null>(null);
  const [isDuplicatingUrlBlock, setIsDuplicatingUrlBlock] = useState(false);

  const moveTargets = useMemo(() => {
    if (!moveRule) return [];
    const moveScene = getRuleScene(moveRule, defaultGroup);
    return groups.filter((group) => group !== moveScene.group);
  }, [defaultGroup, groups, moveRule]);

  const normalizedKeyword = ruleSearch.trim().toLowerCase();
  const filteredRuleBlocks = useMemo(() => {
    if (!normalizedKeyword) return ruleBlocks;
    return ruleBlocks
      .map((block) => ({
        ...block,
        rules: block.rules.filter((rule) => {
          const scene = getRuleScene(rule, defaultGroup);
          return (
            scene.variant.toLowerCase().includes(normalizedKeyword) ||
            rule.method.toLowerCase().includes(normalizedKeyword) ||
            rule.url.toLowerCase().includes(normalizedKeyword) ||
            block.key.toLowerCase().includes(normalizedKeyword)
          );
        }),
      }))
      .filter((block) => block.rules.length > 0);
  }, [defaultGroup, normalizedKeyword, ruleBlocks]);

  const exportRecords = useMemo<ExportTableRecord[]>(
    () =>
      currentGroupRules.map((rule) => {
        const scene = getRuleScene(rule, defaultGroup);
        return {
          key: rule.id,
          method: rule.method.toUpperCase(),
          name: scene.variant,
          rule,
          url: rule.url,
        };
      }),
    [currentGroupRules, defaultGroup],
  );

  const filteredExportRecords = useMemo(() => {
    const keyword = batchSearch.trim().toLowerCase();
    if (!keyword) {
      return exportRecords;
    }
    return exportRecords.filter((record) =>
      `${record.method} ${record.name} ${record.url}`.toLowerCase().includes(keyword),
    );
  }, [batchSearch, exportRecords]);

  const exportColumns = useMemo<ColumnsType<ExportTableRecord>>(
    () => [
      { dataIndex: "method", key: "method", title: "方法", width: 84 },
      { dataIndex: "name", key: "name", title: "规则名称" },
      { dataIndex: "url", key: "url", title: "URL" },
    ],
    [],
  );

  const selectedExportRules = useMemo(() => {
    const idSet = new Set(selectedExportKeys);
    return exportRecords.filter((record) => idSet.has(record.key)).map((record) => record.rule);
  }, [exportRecords, selectedExportKeys]);

  return {
    batchSearch,
    duplicateDraft,
    exportColumns,
    filteredExportRecords,
    filteredRuleBlocks,
    groupDescriptionInput,
    isBatchExportOpen,
    isDuplicatingUrlBlock,
    isEditGroupOpen,
    moveRule,
    moveTargets,
    movingGroup,
    ruleSearch,
    selectedExportKeys,
    selectedExportRules,
    setBatchSearch,
    setDuplicateDraft,
    setGroupDescriptionInput,
    setIsBatchExportOpen,
    setIsDuplicatingUrlBlock,
    setIsEditGroupOpen,
    setMoveRule,
    setMovingGroup,
    setRuleSearch,
    setSelectedExportKeys,
  };
}
