# Web Console 使用说明

## 启动与打开

```bash
polaris start
polaris console-url
```

或查看：

```bash
polaris status
```

## 页面总览（当前实现）

### 首页 `/`

- 查看服务在线状态、代理模式、最近请求、Mock 概况、MCP 状态
- 提供到流量、Mock、调试、设置的快捷入口

### 实时请求 `/traffic`

- 查看抓包请求
- 关键词、Method、Host、状态码筛选
- 关键词搜索覆盖 URL、Host、Path、Header、Query、请求体、响应体和处理结果
- Host 过滤支持输入域名或主机片段
- 空结果表示当前关键词和筛选条件在上述搜索范围内均未命中
- 查看请求详情
- 复制 `curl`
- 保存请求或从请求创建 Mock

### 代理转发 `/proxy-forward`

- 管理站点规则与分组
- 设置 `proxy/direct` 行为
- 编辑转发目标与规则属性

### Mock `/mock`

- 管理 Mock 规则（创建、编辑、启停、分组）
- 管理已保存请求资产

说明：历史路径 `/requests`、`/rules` 当前会重定向到 `/mock`。

### 调试 `/debug`

- 手动构造请求并发送
- 查看响应结果
- 保存请求、复制 `curl`

### 设置 `/settings`

- 查看端口、在线状态
- 查看/切换代理相关状态
- 系统代理开关
- HTTPS 证书状态与安装说明
- 局域网代理信息与二维码
- MCP 接入说明

## 推荐工作流

### 浏览器抓包

1. 启动 Polaris
2. 加载扩展
3. 扩展切到 `规则代理`
4. 把当前站点加入规则
5. 在 `/traffic` 查看流量

### 从真实请求创建 Mock

1. 在 `/traffic` 找到请求
2. 创建 Mock
3. 在 `/mock` 调整并启用

### 手机接入

1. 打开 `/settings`
2. 查看局域网地址和代理端口
3. 手机访问 `http://polaris.local`
4. 按提示安装证书并配置代理
