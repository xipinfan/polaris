# E2E 与视觉测试

这份文档是给 Polaris 开发者看的，不是给普通使用者看的。

如果你只是想安装和使用 Polaris，可以跳过这份文档。

---

## 这份文档讲什么

当前项目使用 Playwright 做两类测试：

- 交互测试：模拟真实用户点击、输入、切换页面
- 视觉测试：把页面截图和本地基线图比较

覆盖范围主要包括：

- Web Console
- 浏览器扩展 Popup

---

## 先安装浏览器运行时

```bash
corepack pnpm test:e2e:install
```

---

## 最常用命令

运行全部 E2E：

```bash
corepack pnpm test:e2e
```

生成或刷新本地视觉基线：

```bash
corepack pnpm test:e2e:baseline
```

更新快照：

```bash
corepack pnpm test:e2e:update
```

打开 Playwright UI：

```bash
corepack pnpm test:e2e:ui
```

---

## 单页视觉检查

检查单个页面：

```bash
corepack pnpm test:e2e:page -- --page home
```

更新单个页面的基线：

```bash
corepack pnpm test:e2e:page:baseline -- --page settings
```

支持的页面 key：

- `home`
- `traffic`
- `proxy-forward`
- `mock`
- `debug`
- `settings`
- `popup`

---

## 推荐使用顺序

如果你刚改完 UI，建议这样跑：

1. 先生成当前基线
2. 再执行 E2E
3. 如果只是看某一页，优先跑单页命令

也就是：

```bash
corepack pnpm test:e2e:baseline
corepack pnpm test:e2e
```

---

## 当前稳定性说明

- 测试会自动启动 Core 和 Console
- API 端口是动态探测的，不写死
- 扩展测试会读取 `apps/extension/dist` 里的构建产物

所以如果你改了扩展相关代码，记得先确保扩展已经正确构建。
