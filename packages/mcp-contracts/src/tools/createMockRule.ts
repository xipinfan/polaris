export const createMockRuleTool = {
  name: "create_mock_rule",
  description: "创建 Mock 规则时调用。三种方式：① requestId+patch(推荐，从已捕获请求派生) ② template+patch(从预设模板派生，如 json_ok/json_error/json_list) ③ 完整字段。匹配：method 精确 + url 子串。命名 '[分组名] 规则名' 自动归组。返回轻量回执。"
};

