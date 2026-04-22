export const upsertProxyRuleTool = {
  name: "upsert_proxy_rule",
  description: "创建或更新一条基于 host 的代理规则时调用。传 host + action(proxy/direct)，可选 forwardMode + targetUrl 做域名级转发。host 已存在则更新。"
};

