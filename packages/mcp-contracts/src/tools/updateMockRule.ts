export const updateMockRuleTool = {
  name: "update_mock_rule",
  description: "修改 Mock 规则时调用。三种方式：① patch(推荐，只传变更字段) ② operations(JSON-patch 风格，支持 responseBody 内部路径如 responseBody.data.list[0]) ③ 完整字段替换。小改动用 patch，深层 body 修改用 operations。返回轻量回执含 changedFields。"
};

