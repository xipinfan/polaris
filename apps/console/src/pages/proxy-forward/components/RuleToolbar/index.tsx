import { Card, Input, Segmented, Select } from "antd";
import { uiSelectors } from "../../../../stores/selectors";
import { useUiStore } from "../../../../stores/uiStore";
import localStyles from "./index.module.less";
import type { FilterMode, SortMode } from "../../types";
import { classNames } from "../../utils/proxyForwardHelpers";

type RuleToolbarProps = {
  filteredCount: number;
};

export function RuleToolbar({ filteredCount }: RuleToolbarProps) {
  const filterMode = useUiStore(uiSelectors.proxyFilterMode);
  const ruleSearch = useUiStore(uiSelectors.proxyRuleSearch);
  const sortMode = useUiStore(uiSelectors.proxySortMode);
  const setFilterMode = useUiStore((state) => state.setProxyFilterMode);
  const setRuleSearch = useUiStore((state) => state.setProxyRuleSearch);
  const setSortMode = useUiStore((state) => state.setProxySortMode);

  return (
    <Card bordered={false} className={classNames(localStyles.toolbarCard, localStyles.root)}>
      <div className={localStyles.toolbarHeader}>
        <div>
          <span className={localStyles.sectionLabel}>规则工具栏</span>
          <strong>筛选与排序</strong>
        </div>
        <span className={localStyles.toolbarMeta}>{`当前 ${filteredCount} 条规则`}</span>
      </div>
      <div className={localStyles.toolbar}>
        <Input.Search
          allowClear
          onChange={(event) => setRuleSearch(event.target.value)}
          placeholder="搜索站点或规则名称"
          value={ruleSearch}
        />
        <Segmented<FilterMode>
          onChange={(value) => setFilterMode(value)}
          options={[
            { label: "全部", value: "all" },
            { label: "启用中", value: "enabled" },
            { label: "最近命中", value: "hits" },
            { label: "有错误", value: "errors" },
          ]}
          value={filterMode}
        />
        <Select<SortMode>
          onChange={setSortMode}
          options={[
            { label: "创建时间", value: "created" },
            { label: "最近命中", value: "hits" },
          ]}
          value={sortMode}
        />
      </div>
    </Card>
  );
}
