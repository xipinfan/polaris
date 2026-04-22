export const getMockRuleDetailTool = {
  name: "get_mock_rule_detail",
  description: "查看某条 Mock 规则详情时调用。五种视图递进使用：summary(默认，元数据+body统计) → preview(headers+body预览) → shape(responseBody结构骨架) → full(完整数据，超限自动降级) → diagnostic(排查不生效，需传 requestId)。大 responseBody 优先用 jsonPath/responsePath 过滤。"
};

