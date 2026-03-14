import { Button, Dropdown, Tag } from "antd";
import localStyles from "./index.module.less";
import type { StoredGroup } from "../../types";
import { classNames } from "../../utils/proxyForwardHelpers";

type OverviewHeaderProps = {
  activeGroup: StoredGroup | null;
  activeGroupId: string;
  groups: StoredGroup[];
  headerMenuOpen: boolean;
  overview: { total: number; enabled: number; hits: number; errors: number };
  setGroupName: (value: string) => void;
  setEditingGroup: (value: StoredGroup | null) => void;
  setHeaderMenuOpen: (value: boolean) => void;
  setIsGroupModalOpen: (value: boolean) => void;
  onLoad: () => void;
  onOpenCreateRule: () => void;
};

export function OverviewHeader({
  activeGroup,
  activeGroupId,
  groups,
  headerMenuOpen,
  overview,
  setGroupName,
  setEditingGroup,
  setHeaderMenuOpen,
  setIsGroupModalOpen,
  onLoad,
  onOpenCreateRule,
}: OverviewHeaderProps) {
  return (
    <div className={classNames(localStyles.overview, localStyles.root)}>
      <div className={localStyles.overviewCopy}>
        <div className={localStyles.overviewTitle}>
          <h2>{activeGroup?.name ?? "暂无分组"}</h2>
          <Tag
            bordered={false}
            className={classNames(
              localStyles.statusBadge,
              activeGroup ? localStyles.statusBadgeSuccess : localStyles.statusBadgeMuted,
            )}
          >
            {activeGroup ? "生效中" : "未生效"}
          </Tag>
        </div>
        <p>仅当前分组生效，切换分组即切换整组代理能力。</p>
      </div>

      <div className={localStyles.metricStrip}>
        <article className={localStyles.metricCard}>
          <span>规则总数</span>
          <strong>{overview.total}</strong>
        </article>
        <article className={localStyles.metricCard}>
          <span>启用规则</span>
          <strong>{overview.enabled}</strong>
        </article>
        <article className={localStyles.metricCard}>
          <span>今日命中</span>
          <strong>{overview.hits}</strong>
        </article>
        <article className={localStyles.metricCard}>
          <span>最近错误</span>
          <strong>{overview.errors}</strong>
        </article>
      </div>

      <div className={localStyles.overviewActions}>
        <Button onClick={onOpenCreateRule} type="primary">
          新建转发规则
        </Button>
        <Button
          onClick={() => {
            const group = groups.find((item) => item.id === activeGroupId);
            if (!group) return;
            setEditingGroup(group);
            setGroupName(group.name);
            setIsGroupModalOpen(true);
          }}
        >
          编辑分组
        </Button>
        <Dropdown
          menu={{ items: [{ key: "refresh", label: "刷新数据", onClick: onLoad }] }}
          onOpenChange={setHeaderMenuOpen}
          open={headerMenuOpen}
          trigger={["click"]}
        >
          <Button className={localStyles.iconButton} onClick={(event) => event.stopPropagation()}>
            ...
          </Button>
        </Dropdown>
      </div>
    </div>
  );
}
