# Phantopteryx Divination（紫微 · 易经子模块）

与 **Image Editor** 完全隔离；页面 **复用** [`../image-editor/index.html`](../image-editor/index.html) 同款三栏骨架（`editor-root` / `bar` / `canvas-wrap` / `tool-sidebar` / `editor-dock` + `tools-grid`），样式来自 [`../image-editor/styles/editor.css`](../image-editor/styles/editor.css)，并由 [`styles/divination-layout.css`](styles/divination-layout.css) 调整：**列顺序**为左参数 · 中 dock · **右命盘**；**配色**为侧栏与 dock 保持与 Image Editor 一致的黑底白字，**右侧命盘／卦象区**单独白底黑字（与编辑器画布「全黑」对调）。

## 目录结构（`apps/divination/`）

| 路径 | 用途 |
|------|------|
| **`divination.html`** | 占卜应用入口（壳 + 脚本引用）；**不叫 `index.html`**，与仓库根目录 **`toolbox.html`**（开始页；根 **`index.html`** 仅重定向）区分。 |
| `styles/` | 布局与主题覆盖（`divination-layout.css`、`divination.css`） |
| `scripts/core/` | 标签与壳逻辑、公历简批、视口门控（`app.js`、`calendar.js`、`divination-viewport-gate.js`） |
| `scripts/ziwei/` | 紫微排盘与助手（`ziwei-engine.js`、`ziwei.js`、`ziwei-analyst.js`） |
| `scripts/iching/` | 易经起卦、卦数据、解析与天纪占位加载（`iching*.js`、`tianji-yi-loader.js`） |
| `data/` | 静态 JSON（`tianji-yi.json`） |
| `vendor/` | 第三方浏览器脚本（`lunar.js`） |

## 功能说明（当前版本）

### 紫微斗数（Tab「紫微斗数」）

- 公历 → 农历：内置 [lunar-javascript](https://www.npmjs.com/package/lunar-javascript)（`vendor/lunar.js`，请阅其许可证）。
- **命盘骨架**：命宫、身宫 **地支**；顺时针十二宫（命宫、兄弟…父母）与宫支；**十四正曜与其它安星尚未实现**，界面占位「后续版本」。
- **安命 / 安身（MVP 口诀）**：寅上起正月顺至生月；命宫由该宫 **逆数** 生时；身宫由该宫 **顺数** 生时。闰月暂按与本月同序处理，与部分流派处理不同，以师承为准。
- 若与手工盘不一致，优先核对 **农历月**、**时辰地支** 与口诀版本。

### 易经（Tab「易经」）

- 铜钱六次起卦，本卦 / 动爻 / 变卦；卦表来源见下。
- **天纪向解说**：`data/tianji-yi.json`（卦号为字符串 key `"1"`…`"64"`）；由 `scripts/iching/tianji-yi-loader.js` 异步加载（相对 `divination.html` 的 `data/tianji-yi.json`）。
- **卦象解析器**（白栏下方）：起卦后展示结构化初读；下方为聊天区、**三个可轮换的预设问题** + **「其他问题…」**（换一批预设）；可自填发送。默认使用**本地模板答覆**（非真实端侧大模型）；若填写 **OpenAI 兼容** Base URL + API Key + Model（仅存 `localStorage`），将调用 `/v1/chat/completions`（浏览器直连可能受 CORS 限制，需自建代理或允许跨域的网关）。

### 公历简批

- 生肖（公历年近似）、西方星座、时辰地支；与紫微农历换算无关。

## 本地预览

仓库根目录：

```bash
npm run serve
```

浏览器打开 **`/apps/divination/divination.html`**（勿依赖 `file://`，以便脚本与 `fetch('data/tianji-yi.json')` 相对当前页路径正常工作）。

## 与主项目合并

1. 本目录已位于 `apps/divination/`；复制时请保持 `styles/`、`scripts/`、`data/`、`vendor/` 与 **`divination.html`** 同级。
2. 仓库根目录 **`toolbox.html`** 为开始页（根 **`index.html`** 重定向到该页）；主导航链到 **`apps/divination/divination.html`**；勿把占卜脚本挂进 **`apps/image-editor/index.html`**。

## 数据与授权

- 六十四卦：`scripts/iching/iching-data.js` 字段来自 [adamblvck/iching-wilhelm-dataset](https://github.com/adamblvck/iching-wilhelm-dataset)，请阅其 **LICENSE**。
- 农历：`lunar-javascript` 见 npm 页及仓库许可证。
