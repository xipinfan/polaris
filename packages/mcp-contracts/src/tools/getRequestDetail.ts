export const getRequestDetailTool = {
  name: "get_request_detail",
  description: "查看某条已捕获请求的详情时调用。视图递进使用：summary(默认，元数据) → preview(headers+body预览) → shape(body结构骨架) → full(完整数据，超限自动降级)。大 body 优先用 jsonPath/responsePath 过滤。"
};

