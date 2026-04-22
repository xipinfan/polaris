# MCP 接入说明

这份文档只解决一件事：

- 怎么把 Polaris 接到常见 AI / 代码工具里

如果你希望模型默认按低上下文方式使用 Polaris，再看：

- `docs/mcp-efficient-usage.md`
- `docs/skills/polaris-efficient-mcp/SKILL.md`

如果你只想最快接上，先看前两节。

## 第一步：启动 Polaris

```bash
polaris start
```

## 第二步：拿到 MCP 地址

```bash
polaris mcp-url
```

你会得到一个地址，通常像这样：

```text
http://127.0.0.1:19602/mcp
```

以后文档里的示例地址，都可以直接替换成你这里实际输出的地址。

---

## 先记住两个入口

### 全量入口

```text
http://127.0.0.1:19602/mcp
```

适合：

- 想把 Polaris 全部能力都给工具

### 只接请求能力

```text
http://127.0.0.1:19602/mcp/request
```

适合：

- 第一次接入
- 只想看请求、重放请求、保存请求

如果你拿不准，**优先先接 `/mcp/request`**。

---

## 如果工具支持填 URL

直接填：

```text
http://127.0.0.1:19602/mcp
```

或者更推荐先填：

```text
http://127.0.0.1:19602/mcp/request
```

---

## 如果工具只支持命令启动

用这个命令：

```bash
polaris mcp-stdio
```

只想暴露请求能力：

```bash
polaris mcp-stdio --pack request
```

---

## 常见工具怎么配

下面只保留最常见、最好抄的配置方式。

### Cursor

常见配置文件：

- 全局：`~/.cursor/mcp.json`
- 项目内：`.cursor/mcp.json`

建议优先用项目内配置。

示例：

```json
{
  "mcpServers": {
    "polaris-request": {
      "url": "http://127.0.0.1:19602/mcp/request"
    }
  }
}
```

### Claude Desktop

如果 Claude 支持添加远程 MCP 地址，直接填：

```text
http://127.0.0.1:19602/mcp/request
```

如果你想接全量能力，再改成：

```text
http://127.0.0.1:19602/mcp
```

### Gemini CLI

最简单的方式：

```bash
gemini mcp add --transport http polaris-request http://127.0.0.1:19602/mcp/request
```

如果想接全量：

```bash
gemini mcp add --transport http polaris http://127.0.0.1:19602/mcp
```

### Cline

最简单的方式：

```bash
cline mcp add polaris-request http://127.0.0.1:19602/mcp/request --type http
```

如果想接全量：

```bash
cline mcp add polaris http://127.0.0.1:19602/mcp --type http
```

### Windsurf

常见配置文件：

- `~/.codeium/windsurf/mcp_config.json`

示例：

```json
{
  "mcpServers": {
    "polaris-request": {
      "serverUrl": "http://127.0.0.1:19602/mcp/request"
    }
  }
}
```

### VS Code

常见项目内配置文件：

- `.vscode/mcp.json`

示例：

```json
{
  "servers": {
    "polaris-request": {
      "type": "http",
      "url": "http://127.0.0.1:19602/mcp/request"
    }
  }
}
```

---

## Polaris 还有哪些入口

如果你后面需要，再用这些：

- Mock：`http://127.0.0.1:19602/mcp/mock`
- Proxy：`http://127.0.0.1:19602/mcp/proxy`
- Ops：`http://127.0.0.1:19602/mcp/ops`

建议不要第一次就全接，先接 `request` 最稳。

---

## 最推荐的接入策略

### 普通用户

先接：

```text
http://127.0.0.1:19602/mcp/request
```

### 想把所有能力都给模型

接：

```text
http://127.0.0.1:19602/mcp
```

### 工具不支持 URL

用：

```bash
polaris mcp-stdio --pack request
```

---

## 常见问题

### 接不上

先检查：

```bash
polaris status
```

确认：

- Polaris 是否在线
- MCP 地址是什么

### 不知道该接哪个

直接接这个：

```text
http://127.0.0.1:19602/mcp/request
```

### 为什么地址不是 19602

因为端口可能被占用，Polaris 会自动换端口。  
所以不要死记默认端口，直接看：

```bash
polaris mcp-url
```

---

## 还想看别的文档

- [README](../README.md)
- [Web Console 使用说明](./console.md)
- [浏览器扩展使用说明](./extension.md)

---

## Tool 结果怎么看最稳

Polaris 的 MCP tool result 同时有两层：

- `structuredContent`：给模型稳定读取的结构化 JSON
- `content`：给人和通用 MCP 客户端看的文本

现在 detail 类工具会按 `view` 自动切换文本可见性策略：

- `summary`：只给摘要文字，适合低上下文快速判断
- `preview` 或未传 `view`：摘要 + 预览行，方便先看关键字段
- `full` / `diagnostic`：文本给预览，完整结构仍在 `structuredContent.result`
- `shape`：文本给摘要，结构骨架在 `structuredContent.result`

所以如果你看到 `content` 很短，不代表服务端没返回数据；很多详细信息可能在 `structuredContent.result` 里。

## 推荐的 detail 工作流

建议按渐进式方式查：

1. 先 `query_*({ action: "list" })`
2. 再 `query_*({ action: "detail", ... })` 默认 `summary`
3. 需要看字段内容时用 `preview`
4. 需要看结构时用 `shape`
5. 真要完整原文或排查匹配问题时再用 `full` / `diagnostic`

如果响应体很深，不要一上来就读全量 JSON，可以先：

- 用 `responsePath` 或 `jsonPath` 精准定位
- 再配合 `includePaths` / `excludePaths`
- 必要时加 `topLevelOnly`

这样最省上下文，也最不容易漏看重点。

## stdio MCP 和 legacy /invoke 有什么区别

两条路都会走到 Polaris 的同一套核心 payload 生成逻辑，但定位不同：

- stdio / SDK MCP：标准 MCP 返回 `structuredContent` + `content`
- legacy `/invoke`：只返回 HTTP JSON `data`

如果你在支持标准 MCP 的客户端里使用 Polaris，优先走 MCP，因为它会保留文本可见性策略、结构化结果和更稳定的工具体验。`/invoke` 更适合兼容旧脚本或临时调试。
