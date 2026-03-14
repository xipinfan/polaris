import { useLocation } from "react-router-dom";
import { useToast } from "../../features/feedback/ToastProvider";
import { useConsoleI18n } from "../../i18n/I18nProvider";
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
  const { t } = useConsoleI18n();
  const { showToast } = useToast();
  const location = useLocation();
  const locationState = location.state as MockPageLocationState | null;
  const defaultGroup = t("mock.defaultGroup");

  const workspace = useMockWorkspace({
    defaultGroup,
    locationState,
    pathname: location.pathname,
    showToast,
    t,
  });

  return (
    <div className={styles.page}>
      <section className={styles.header}>
        <div className={styles.headerCopy}>
          <span className={styles.pageEyebrow}>{t("mock.title")}</span>
          <h2>{t("mock.title")}</h2>
          <p>{t("mock.currentGroupBody")}</p>
        </div>
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
          t={t}
          onActivateGroup={workspace.activateGroup}
          onCopyGroup={workspace.copyGroup}
          onDeleteGroup={workspace.deleteGroup}
          onRenameGroup={workspace.renameGroup}
        />
        <MockRulesWorkspace
          currentGroup={workspace.currentGroup}
          currentGroupEnabledRules={workspace.currentGroupEnabledRules}
          currentGroupRules={workspace.currentGroupRules}
          defaultGroup={defaultGroup}
          getMethodClass={getMethodClass}
          isCurrentGroupEnabled={workspace.isCurrentGroupEnabled}
          onCopyGroup={workspace.copyGroup}
          onDeleteGroup={workspace.deleteGroup}
          onDuplicateRule={workspace.duplicateRule}
          onEditGroupDescription={workspace.editGroupDescription}
          onOpenCreateModal={workspace.openCreateModal}
          onOpenEditModal={workspace.openEditModal}
          onRemoveRule={workspace.removeRule}
          onToggleCurrentGroup={workspace.toggleCurrentGroup}
          onToggleRule={workspace.toggleRule}
          ruleBlocks={workspace.currentGroupRuleBlocks}
          t={t}
        />
      </section>
      <MockRuleModal
        defaultGroup={defaultGroup}
        editingId={workspace.editingId}
        form={workspace.form}
        groups={workspace.groups}
        isOpen={workspace.isModalOpen}
        setForm={workspace.setForm}
        setIsOpen={workspace.setIsModalOpen}
        showToast={showToast}
        t={t}
        onSave={workspace.saveRule}
      />
    </div>
  );
}
