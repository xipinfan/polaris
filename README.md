# Polaris

Polaris 是一个本地接口工作台。

你可以把它理解成一套放在自己电脑上的调试中枢，用来做这些事：

- 把浏览器或手机流量接到本机
- 查看真实请求和响应
- 保存请求，之后重复使用
- 给接口做固定返回的 Mock
- 管理代理规则和转发规则
- 把这些能力通过 MCP 暴露给 AI 工具

如果你只是想“装上就用”，先看下面这段。

## 3 分钟上手

### 1. 安装

```bash
npm i -g polaris-workbench
```

安装完成后会提供全局命令：

```bash
polaris
```

### 2. 启动

```bash
polaris start
```

查看当前运行状态：

```bash
polaris status
```

如果你只记一个命令，记住 `polaris status` 就够了。  
它会告诉你当前服务是否在线、用了哪些端口、Console 地址和 MCP 地址是什么。

### 3. 打开 Web Console

可以直接运行：

```bash
polaris console-url
```

或者直接看 `polaris status` 输出的地址。

默认情况下通常会是：

- Console: `http://127.0.0.1:19601`

但请以你机器上的实际输出为准，因为端口被占用时 Polaris 会自动换端口。

### 4. 开始抓请求

最常见的使用方式是：

1. 启动 Polaris
2. 加载浏览器扩展
3. 在扩展里切到 `规则代理` 或 `全局代理`
4. 打开目标网站
5. 回到 Console 的“实时请求”页查看流量

---

## Polaris 能做什么

### 给浏览器抓包

- 支持 `直连 / 全局代理 / 规则代理 / 跟随系统`
- 可以把“当前站点”快速加入规则
- 适合前后端联调、页面请求排查、接口重放

### 给手机抓包

- 支持同一局域网下的手机接入本机代理
- 可以通过 `http://polaris.local` 打开手机接入引导页
- 支持下载根证书并查看 HTTPS 就绪状态

### 保存和复用请求

- 实时请求可以直接保存
- 保存后可以再次发送
- 可以带入调试页继续改参数
- 可以复制成 `curl`

### 做基础 Mock

- 支持固定返回 Mock
- 支持启用 / 停用
- 支持分组切换
- 可以从真实请求一键生成

### 管理代理和转发规则

- 支持站点规则
- 支持 PAC
- 支持代理转发工作台
- 支持改写目标地址、Host、Path

### 接给 AI 工具

- 支持 Streamable HTTP MCP
- 支持 stdio MCP
- 支持按能力包暴露工具：`request / mock / proxy / ops`

---

## 适合谁

如果你符合下面任意一种情况，Polaris 基本就能帮上忙：

- 你想快速抓浏览器请求，但不想先学一套很重的抓包工具
- 你想把真实请求保存下来，后面反复调试
- 你经常需要临时做接口 Mock
- 你想让 Cursor、Cline、Claude Desktop、Gemini CLI 之类的工具接入本地请求能力
- 你需要让手机走你电脑上的代理做联调

---

## 常用命令

### 服务管理

启动：

```bash
polaris start
```

查看状态：

```bash
polaris status
```

停止：

```bash
polaris stop
```

### 查看入口地址

Console 地址：

```bash
polaris console-url
```

MCP 地址：

```bash
polaris mcp-url
```

浏览器扩展目录：

```bash
polaris extension-path
```

### 启动 stdio MCP

```bash
polaris mcp-stdio
```

只暴露某个能力包：

```bash
polaris mcp-stdio --pack request
```

---

## 默认端口

Polaris 默认优先尝试：

- 代理端口：`19600`
- API / Console 端口：`19601`
- MCP 端口：`19602`

如果这些端口被占用，Polaris 会自动换到下一个可用端口。  
所以实际使用时，**不要死记默认端口，优先看 `polaris status` 输出**。

---

## 最常见的使用场景

### 场景 1：只想抓浏览器请求

1. `polaris start`
2. 运行 `polaris extension-path`
3. 把扩展加载到 Chrome / Edge
4. 在扩展里切到 `规则代理`
5. 把当前站点加入规则
6. 打开 Console 的 `/traffic`

### 场景 2：只想接 MCP 给 AI

1. `polaris start`
2. 运行 `polaris mcp-url`
3. 把输出地址填进你的 MCP 客户端

如果客户端不支持 HTTP MCP，就改用：

```bash
polaris mcp-stdio
```

### 场景 3：只想让手机走本机代理

1. `polaris start`
2. 在 Console 设置页查看局域网地址和代理端口
3. 手机连到同一个 Wi-Fi
4. 在手机 Wi-Fi 里手动配置 HTTP 代理
5. 用手机访问 `http://polaris.local`
6. 按页面提示安装证书

---

## 文档怎么选

如果你只是来使用 Polaris，优先看这几份：

- [Web Console 使用说明](./docs/console.md)
- [浏览器扩展使用说明](./docs/extension.md)
- [MCP 接入说明](./docs/mcp.md)

如果你要参与开发，再看：

- [开发说明](./docs/development.md)
- [E2E 与视觉测试](./docs/e2e-testing.md)

---

## 常见问题

### 为什么我启动了，但打不开页面

先运行：

```bash
polaris status
```

确认：

- 服务是否在线
- Console 地址是什么
- 当前端口是否已经自动切换

### 为什么扩展显示离线

优先检查：

- Polaris 是否已经启动
- 你加载的是不是最新扩展目录
- 扩展有没有重新加载

### 为什么接了规则代理却没抓到请求

优先检查：

- 当前站点是否已经加入规则
- 浏览器是否真的切到了 `规则代理`
- 页面是否已经刷新

### 为什么 MCP 接不上

优先检查：

- 你接的是 HTTP MCP 还是 stdio
- 地址是否来自 `polaris mcp-url`
- Polaris 是否仍在运行

---

## 给开发者

如果你是要修改 Polaris 本身，而不是单纯使用它：

```bash
corepack pnpm install
corepack pnpm dev
```

更多内容见：

- [开发说明](./docs/development.md)
