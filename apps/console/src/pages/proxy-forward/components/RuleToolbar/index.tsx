import { memo } from "react";
import { Card, Dropdown, Input } from "antd";
import type { MenuProps } from "antd";
import { uiSelectors } from "../../../../stores/selectors";
import { useUiStore } from "../../../../stores/uiStore";
import localStyles from "./index.module.less";
import { classNames } from "../../utils/proxyForwardHelpers";

type RuleToolbarProps = {
  canEditGroup: boolean;
  headerMenuOpen: boolean;
  onLoad: () => void;
  onOpenCreateRule: () => void;
  onOpenEditGroup: () => void;
  setHeaderMenuOpen: (value: boolean) => void;
};

export const RuleToolbar = memo(function RuleToolbar({
  canEditGroup,
  headerMenuOpen,
  onLoad,
  onOpenCreateRule,
  onOpenEditGroup,
  setHeaderMenuOpen,
}: RuleToolbarProps) {
  const ruleSearch = useUiStore(uiSelectors.proxyRuleSearch);
  const setRuleSearch = useUiStore((state) => state.setProxyRuleSearch);

  const menuItems: MenuProps["items"] = [
    {
      key: "refresh",
      label: "\u5237\u65b0\u6570\u636e",
      onClick: onLoad,
    },
  ];

  return (
    <Card variant="borderless" className={classNames(localStyles.toolbarCard, localStyles.root)}>
      <div className={localStyles.toolbarHeader}>
        <strong>{"\u7b5b\u9009\u4e0e\u6392\u5e8f"}</strong>
      </div>
      <div className={localStyles.toolbar}>
        <div className={localStyles.searchSlot}>
          <Input.Search
            allowClear
            enterButton={"\u2315"}
            onChange={(event) => setRuleSearch(event.target.value)}
            placeholder={"\u641c\u7d22\u7ad9\u70b9\u6216\u89c4\u5219\u540d\u79f0"}
            value={ruleSearch}
          />
        </div>

        <div className={localStyles.actionSlot}>
          <button className={localStyles.primaryButton} onClick={onOpenCreateRule} type="button">
            {"\u65b0\u5efa\u8f6c\u53d1\u89c4\u5219"}
          </button>
          <button
            className={localStyles.secondaryButton}
            disabled={!canEditGroup}
            onClick={onOpenEditGroup}
            type="button"
          >
            {"\u7f16\u8f91\u5206\u7ec4"}
          </button>
          <Dropdown
            menu={{ items: menuItems }}
            onOpenChange={setHeaderMenuOpen}
            open={headerMenuOpen}
            trigger={["click"]}
          >
            <button className={localStyles.iconButton} onClick={(event) => event.stopPropagation()} type="button">
              ...
            </button>
          </Dropdown>
        </div>
      </div>
    </Card>
  );
});
