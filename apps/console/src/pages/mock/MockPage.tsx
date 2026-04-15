import type { MockRule } from "@polaris/shared-types";
import { Button } from "antd";
import { useState } from "react";
import { useLocation } from "react-router-dom";
import { asRecord, buildExportEnvelope, downloadJson, pickJsonFile } from "../../features/common/importExport";
import { WhistleImportModal } from "../../features/common/whistleImport/WhistleImportModal";
import { useToast } from "../../features/feedback/ToastProvider";
import { MockRuleModal } from "./components/MockRuleModal";
import { MockRulesWorkspace } from "./components/MockRulesWorkspace";
import { MockSidebar } from "./components/MockSidebar";
import { useMockWorkspace } from "./hooks/useMockWorkspace";
import type { MockPageLocationState } from "./types";
import styles from "./MockPage.module.less";

function getMethodClass(method: string) {
  switch (method.toUpperCase()) {
    case "POST":
      return styles.methodPost;
    case "PUT":
      return styles.methodPut;
    case "PATCH":
      return styles.methodPatch;
    case "DELETE":
      return styles.methodDelete;
    default:
      return styles.methodGet;
  }
}

export function MockPage() {
  const { showToast } = useToast();
  const [isWhistleImportOpen, setIsWhistleImportOpen] = useState(false);
  const location = useLocation();
  const locationState = location.state as MockPageLocationState | null;
  const defaultGroup = "默认组";

  const workspace = useMockWorkspace({
    defaultGroup,
    locationState,
    pathname: location.pathname,
    showToast,
  });

  const exportGroup = (groupName: string) => {
    const groupPayload = workspace.exportMockGroup(groupName);
    if (!groupPayload) {
      showToast("分组不存在，无法导出", "error");
      return;
    }
    const envelope = buildExportEnvelope("mock-group", {
      groups: [groupPayload],
    });
    downloadJson(`mock-group-${groupName}-${Date.now()}.json`, envelope);
    showToast(`分组「${groupName}」已导出`, "success");
  };

  const importGroups = async () => {
    const raw = await pickJsonFile();
    const record = asRecord(raw);
    if (!record || record.kind !== "mock-group") {
      throw new Error("文件类型不匹配，需要导入 mock-group");
    }
    const payload = asRecord(record.payload);
    const groups = (payload?.groups as unknown[]) ?? [];
    await workspace.importMockGroups(groups as any);
  };

  const exportSingleRule = (rule: MockRule) => {
    const envelope = buildExportEnvelope("mock-rules", {
      rules: workspace.exportSelectedMockRules([rule], false),
    });
    downloadJson(`mock-rule-${rule.id}.json`, envelope);
    showToast("规则已导出", "success");
  };

  const exportMultipleRules = (rules: MockRule[]) => {
    if (!rules.length) {
      showToast("请先选择规则", "info");
      return;
    }
    const envelope = buildExportEnvelope("mock-rules", {
      rules: workspace.exportSelectedMockRules(rules, true),
    });
    downloadJson(`mock-rules-${Date.now()}.json`, envelope);
    showToast("已导出选中规则", "success");
  };

  const importRulesToCurrentGroup = async () => {
    const raw = await pickJsonFile();
    const record = asRecord(raw);
    if (!record || record.kind !== "mock-rules") {
      throw new Error("文件类型不匹配，需要导入 mock-rules");
    }
    const payload = asRecord(record.payload);
    const rules = (payload?.rules as unknown[]) ?? [];
    await workspace.importRulesToCurrentGroup(rules as any);
  };

  return (
    <div className={styles.page}>
      <section className={styles.header}>
        <div className={styles.headerCopy}>
          <h2>{"模拟规则"}</h2>
          <p>{"仅当前分组生效，切换分组即切换整组规则。"}</p>
        </div>
        <Button onClick={() => setIsWhistleImportOpen(true)} type="primary">
          从 Whistle 导入
        </Button>
      </section>
      <section className={styles.workspace}>
        <MockSidebar
          currentGroup={workspace.currentGroup}
          defaultGroup={defaultGroup}
          filteredGroups={workspace.filteredGroups}
          groupSummaries={workspace.groupSummaries}
          groups={workspace.groups}
          setCustomGroups={workspace.setCustomGroups}
          showToast={showToast}
          onActivateGroup={workspace.activateGroup}
          onCopyGroup={workspace.copyGroup}
          onDeleteGroup={workspace.deleteGroup}
          onExportGroup={exportGroup}
          onImportGroups={() => {
            void importGroups().catch((error) =>
              showToast(error instanceof Error ? error.message : "导入失败", "error"),
            );
          }}
          onRenameGroup={workspace.renameGroup}
        />
        <MockRulesWorkspace
          currentGroup={workspace.currentGroup}
          currentGroupDescription={workspace.currentGroupDescription}
          currentGroupRules={workspace.currentGroupRules}
          defaultGroup={defaultGroup}
          groups={workspace.groups}
          getMethodClass={getMethodClass}
          isCurrentGroupEnabled={workspace.isCurrentGroupEnabled}
          onCopyGroup={workspace.copyGroup}
          onDeleteGroup={workspace.deleteGroup}
          onDuplicateRule={workspace.duplicateRule}
          onDuplicateUrlBlock={workspace.duplicateRulesForUrlBlock}
          onEditGroupDescription={workspace.editGroupDescription}
          onExportRule={exportSingleRule}
          onExportSelectedRules={exportMultipleRules}
          onImportRules={() => {
            void importRulesToCurrentGroup().catch((error) =>
              showToast(error instanceof Error ? error.message : "导入失败", "error"),
            );
          }}
          onMoveRule={workspace.moveRuleToGroup}
          onOpenCreateModalForUrl={workspace.openCreateModalForUrl}
          onOpenCreateModal={workspace.openCreateModal}
          onOpenEditModal={workspace.openEditModal}
          onRemoveRule={workspace.removeRule}
          onRemoveUrlBlock={workspace.removeRulesForUrlBlock}
          onToggleCurrentGroup={workspace.toggleCurrentGroup}
          onToggleRule={workspace.toggleRule}
          ruleBlocks={workspace.currentGroupRuleBlocks}
        />
      </section>
      <MockRuleModal
        defaultGroup={defaultGroup}
        editingId={workspace.editingId}
        form={workspace.form}
        groups={workspace.groups}
        isOpen={workspace.isModalOpen}
        onSave={workspace.saveRule}
        setForm={workspace.setForm}
        setIsOpen={workspace.setIsModalOpen}
        showToast={showToast}
      />
      <WhistleImportModal
        defaultScope="mock"
        onClose={() => setIsWhistleImportOpen(false)}
        open={isWhistleImportOpen}
      />
    </div>
  );
}


