import localStyles from "./index.module.less";
import type { StoredGroup } from "../../types";
import { classNames } from "../../utils/proxyForwardHelpers";

type OverviewHeaderProps = {
  activeGroup: StoredGroup | null;
  overview: { total: number; enabled: number; hits: number; errors: number };
};

export function OverviewHeader({ activeGroup, overview }: OverviewHeaderProps) {
  return (
    <div className={classNames(localStyles.overview, localStyles.root)}>
      <div className={localStyles.overviewCopy}>
        <div className={localStyles.overviewTitle}>
          <h2>{activeGroup?.name ?? "\u6682\u65e0\u5206\u7ec4"}</h2>
          <span
            className={classNames(
              localStyles.statusBadge,
              activeGroup ? localStyles.statusBadgeSuccess : localStyles.statusBadgeMuted,
            )}
          >
            {activeGroup ? "\u751f\u6548\u4e2d" : "\u672a\u751f\u6548"}
          </span>
        </div>
        <p>
          {
            "\u4ec5\u5f53\u524d\u5206\u7ec4\u751f\u6548\uff0c\u5207\u6362\u5206\u7ec4\u5373\u5207\u6362\u6574\u7ec4\u4ee3\u7406\u80fd\u529b\u3002"
          }
        </p>
      </div>

      <div className={localStyles.overviewAside}>
        <div className={localStyles.metricStrip}>
          <article className={localStyles.metricCard}>
            <span>{"\u89c4\u5219\u603b\u6570"}</span>
            <strong>{overview.total}</strong>
          </article>
          <article className={localStyles.metricCard}>
            <span>{"\u542f\u7528\u89c4\u5219"}</span>
            <strong>{overview.enabled}</strong>
          </article>
          <article className={localStyles.metricCard}>
            <span>{"\u4eca\u65e5\u547d\u4e2d"}</span>
            <strong>{overview.hits}</strong>
          </article>
          <article className={localStyles.metricCard}>
            <span>{"\u6700\u8fd1\u9519\u8bef"}</span>
            <strong>{overview.errors}</strong>
          </article>
        </div>
      </div>
    </div>
  );
}
