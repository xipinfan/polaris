export const listProxyRulesTool = {
  name: "list_proxy_rules",
  description: "查看当前配置的代理转发规则时调用。返回轻量摘要(host/action/enabled)，支持 host/enabled/action 过滤。用返回的 ruleId 调 get_proxy_rule_detail 查看完整配置。"
};

