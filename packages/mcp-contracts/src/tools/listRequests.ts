export const listRequestsTool = {
  name: "list_requests",
  description: "查看最近抓包流量时调用。返回请求摘要列表(method/url/status)，支持 keyword/method/host/statusCode 过滤，默认返回 20 条。用返回的 id 调 get_request_detail，优先 summary 或 preview 视图。"
};

