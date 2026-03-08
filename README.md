# Polaris

Polaris 是一个面向本地联调的 API 工作台。  
V1 聚焦四件核心事情：

- 抓到真实请求
- 把请求沉淀成可复用资产
- 为同一接口管理多个 Mock 方案
- 通过浏览器扩展快速切换代理和站点规则

当前仓库是一个 monorepo，包含 Core、Console、Extension 和共享包。

## 1. V1 能力范围

本项目当前只包含 V1 范围内的能力：

- Core
  - 本地 HTTP/HTTPS 代理骨架
  - 请求捕获与实时展示
  - 保存请求 CRUD
  - Mock 规则管理
  - Proxy Rule / PAC 管理
  - MCP 基础 tools / resources
- Console
  - 首页
  - 实时请求
  - 已保存请求
  - Mock
  - 调试
  - 设置
- Browser Extension
  - Core 服务状态
  - 代理模式切换
  - 当前站点快速加入规则
- MCP
  - `list_requests`
  - `get_request_detail`
  - `save_request`
  - `replay_request`
  - `create_mock_rule`
  - `enable_mock_rule`
  - `run_request`
  - `list_proxy_rules`

不包含：

- 项目 / 集合
- 历史版本
- 对比
- 分享
- 问题现场
- Safari / Firefox 扩展适配
- 完整 HTTPS MITM 解密

## 2. 目录说明

主要目录如下：

```text
apps/
  core/        本地代理、API、Mock、MCP
  console/     Web 控制台
  extension/   浏览器扩展
packages/
  shared-types/
  shared-contracts/
  mcp-contracts/
  shared-utils/
  extension-sdk/
scripts/
docs/
```

## 3. 环境要求

建议环境：

- Node.js 20+
- pnpm 10+
- Chromium 内核浏览器
  - Chrome
  - Edge
  - Arc

macOS 和 Windows 都可以使用。  
当前开发脚本已经做了跨平台处理。

## 4. 安装依赖

在仓库根目录执行：

```bash
pnpm install
```

## 5. 启动方式

### 5.1 一键启动

同时启动 Core 和 Console：

```bash
pnpm dev
```

### 5.2 分开启动

只启动 Core：

```bash
pnpm dev:core
```

只启动 Console：

```bash
pnpm dev:console
```

构建浏览器扩展：

```bash
pnpm --filter @polaris/extension build
```

## 6. 默认端口

- 本地代理：`9000`
- Core API：`9001`
- MCP HTTP：`9002`
- Console 开发服务器：`5173`

访问地址：

- Console: [http://127.0.0.1:5173](http://127.0.0.1:5173)
- Core 健康检查: [http://127.0.0.1:9001/api/health](http://127.0.0.1:9001/api/health)

## 7. 首次使用流程

推荐第一次按下面顺序走。

### 7.1 启动服务

```bash
pnpm dev
```

启动后看到 Console 和 Core 都正常即可。

### 7.2 打开控制台

浏览器访问：

[http://127.0.0.1:5173](http://127.0.0.1:5173)

默认界面是中文。  
如果需要英文，可以在“设置”页切换语言。

### 7.3 构建并加载扩展

先构建：

```bash
pnpm --filter @polaris/extension build
```

然后在 Chromium 浏览器中：

1. 打开扩展管理页
2. 开启“开发者模式”
3. 选择“加载已解压的扩展程序”
4. 选择目录 [apps/extension/dist](/E:/code/polaris/apps/extension/dist)

加载后，扩展弹窗可以做三件事：

- 查看 Core 是否在线
- 切换代理模式
- 把当前站点加入规则代理

### 7.4 切到规则代理模式

建议优先使用“规则代理”模式，而不是“全局代理”。

原因：

- 不会把所有网站流量都带进来
- 更适合日常联调
- 更容易聚焦目标站点

你可以在两处切换：

- Console 首页
- 浏览器扩展弹窗

### 7.5 打开目标网站并观察实时请求

访问你要联调的目标站点后，去 Console 的“实时请求”页查看：

[http://127.0.0.1:5173/traffic](http://127.0.0.1:5173/traffic)

这里可以：

- 按方法筛选
- 按状态码筛选
- 按 Host 筛选
- 搜索 URL / 请求体
- 保存请求
- 重放请求
- 创建 Mock
- 带入调试
- 复制 curl

## 8. 关键页面怎么用

### 8.1 首页

首页主要看：

- Core 是否在线
- 当前代理模式
- 最近请求
- 已保存请求数量
- Mock 数量

适合做快速入口，不适合做细操作。

### 8.2 实时请求

页面地址：

[http://127.0.0.1:5173/traffic](http://127.0.0.1:5173/traffic)

这是最核心的页面。  
你应该在这里完成：

- 看目标接口有没有被抓到
- 看状态码和耗时
- 选中请求后查看详情
- 直接把请求保存为资产
- 直接重放
- 直接创建 Mock
- 一键带入调试页

### 8.3 已保存请求

页面地址：

[http://127.0.0.1:5173/requests](http://127.0.0.1:5173/requests)

适合管理“已经确认有价值”的请求资产。

支持：

- 编辑名称
- 重放
- 带入调试
- 创建 Mock
- 复制 curl
- 删除

### 8.4 Mock

页面地址：

[http://127.0.0.1:5173/mock](http://127.0.0.1:5173/mock)

适合管理接口的多个固定响应方案。

支持：

- 按接口分组查看
- 启用 / 停用方案
- 编辑方案
- 复制方案
- 删除方案
- 手动创建新 Mock

V1 的原则是：

- 一个接口可以有多个方案
- 但同一时刻建议只启用一个

### 8.5 调试

页面地址：

[http://127.0.0.1:5173/debug](http://127.0.0.1:5173/debug)

这里用于手动发请求。  
当前已经去掉了大部分演示默认值，页面默认是空白输入状态。

建议只保留一个关键示例用于首次验证：

```text
方法: GET
URL: http://127.0.0.1:9001/api/health
```

发送后，如果 Core 正常，你会看到健康检查响应。

调试页支持：

- 手动发送请求
- 查看响应头 / 响应体
- 保存为请求资产
- 复制 curl

### 8.6 设置

页面地址：

[http://127.0.0.1:5173/settings](http://127.0.0.1:5173/settings)

这里主要看：

- 本地端口
- 当前代理模式
- MCP 状态
- HTTPS 说明
- 扩展边界说明
- 中英文切换

## 9. 浏览器扩展怎么用

扩展只做轻量控制，不承载核心业务逻辑。

弹窗里主要功能：

- 显示 Core 在线 / 离线
- 切换 `direct / global / rules / system`
- 当前站点快速加入规则
- 打开 Console
- 打开设置页

建议工作流：

1. 先打开目标网站
2. 打开扩展弹窗
3. 选择“规则代理”
4. 点击“仅代理当前站点”
5. 回到 Console 的实时请求页观察流量

## 10. MCP 怎么用

MCP 服务默认端口是 `9002`。

当前提供的 tools：

- `list_requests`
- `get_request_detail`
- `save_request`
- `replay_request`
- `create_mock_rule`
- `enable_mock_rule`
- `run_request`
- `list_proxy_rules`

当前提供的 resources 为 V1 基础集合。  
如果你只是本地验证，先确认下面地址能访问即可：

```text
http://127.0.0.1:9002/tools
http://127.0.0.1:9002/resources
```

## 11. 自检命令

如果你要确认整套系统是否正常，执行：

```bash
pnpm verify:v1
```

它会自动做：

- 全仓 typecheck
- 全仓 build
- 启动隔离端口下的 Core
- 验证健康检查
- 验证 Mock
- 验证请求重放
- 验证代理规则
- 验证 PAC
- 验证 MCP tools/resources

如果只是做快速检查，也可以用：

```bash
pnpm test:smoke
```

## 12. 常见问题

### 12.1 `EADDRINUSE: address already in use`

说明端口已经被占用，最常见的是之前的 Polaris Core 还没退出。

Windows 下可以先查：

```powershell
Get-NetTCPConnection -LocalPort 9001 -State Listen
```

再结束进程：

```powershell
Stop-Process -Id <PID>
```

然后重新执行：

```bash
pnpm dev
```

### 12.2 打开 Console 后没有请求

常见原因：

- Core 没启动
- 代理模式还是直连
- 当前站点没有加入规则
- 浏览器扩展没有加载成功

建议排查顺序：

1. 访问 [http://127.0.0.1:9001/api/health](http://127.0.0.1:9001/api/health)
2. 打开扩展，看 Core 是否在线
3. 切成“规则代理”
4. 把当前站点加入规则
5. 刷新目标页面

### 12.3 调试页发请求失败

先检查：

- URL 是否完整
- Core 是否在线
- 目标站点本身是否可访问

第一次建议先测：

```text
GET http://127.0.0.1:9001/api/health
```

### 12.4 HTTPS 为什么还不能完整解密

因为 V1 当前只做到了：

- HTTP 代理
- HTTPS CONNECT 隧道

还没有做完整的：

- 证书生成
- 证书安装引导
- MITM 解密链路

所以当前 HTTPS 更适合做代理流转和规则控制，而不是完整明文抓包。

## 13. macOS 说明

当前脚本已兼容 macOS。

可以直接使用：

```bash
pnpm dev
pnpm verify:v1
pnpm test:smoke
```

注意：

- 浏览器扩展基于 Chromium `chrome.proxy`
- 如果未来启用 HTTPS 解密，macOS 仍需要在 Keychain Access 中手动信任开发证书

## 14. 当前推荐的最短上手路径

如果你只想最快看到效果，按下面做：

1. `pnpm install`
2. `pnpm dev`
3. `pnpm --filter @polaris/extension build`
4. 加载 [apps/extension/dist](/E:/code/polaris/apps/extension/dist)
5. 浏览器打开 [http://127.0.0.1:5173](http://127.0.0.1:5173)
6. 扩展里切到“规则代理”
7. 把当前站点加入规则
8. 去“实时请求”页看流量
9. 选一条请求，保存 / 重放 / 创建 Mock / 带入调试

这就是 Polaris V1 当前最核心的使用闭环。
