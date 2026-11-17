# Autofill Guard — 自动填充窃取检测服务

检测钓鱼页面滥用浏览器自动填充(autofill)的经典手法:页面只显示一个邮箱输入框,
但表单里藏着一堆声明了 `autocomplete` 类别的隐藏输入框。用户触发自动填充时,
浏览器/密码管理器会把姓名、地址、电话甚至卡号一起填进这些隐藏框,随表单提交出去。

## 组成

```
server/      NestJS 扫描服务 (端口 3000)
  POST /api/scan   { "url": "..." } → 检测报告(字段清单 + 截图 + 模拟填充结果)
  POST /api/echo   演示页面用的回显接口,显示"服务器实际收到了什么"
web/         React 前端 (Vite, 构建后由 Nest 在 / 提供)
demo-pages/  演示钓鱼页面,由 Nest 在 /demo/ 提供
```

## 运行

```bash
cd server && npm install && npx playwright install chromium && npm run build
cd ../web && npm install && npm run build
cd ../server && npm start
```

打开 http://localhost:3000 — 输入 URL 或点演示页面快捷按钮即可扫描。
演示页面本身在 http://localhost:3000/demo/ ,可以在真实浏览器里打开,
手动触发一次浏览器自动填充再提交,页面会显示服务器实际收到的全部字段。

## 检测的隐藏手法

- `type="hidden"`
- `display:none` / `visibility:hidden`(自身或祖先容器)
- `opacity ≈ 0`(自身或祖先)
- 移出视口(`left:-9999px` 等)
- 尺寸极小(< 2px)/ `font-size:0`
- `clip: rect(0,0,0,0)` / `clip-path: inset(50%+)`(visually-hidden 模式)
- 高度为 0 + `overflow:hidden` 的折叠容器
- `transform: scale(0)` 或超大位移
- 透明文字 + 透明背景
- 被其他元素完全遮挡(`elementFromPoint` 判定)

## 模拟自动填充

检测后,服务按 WHATWG autofill token(`cc-number`、`tel`、`address-line1` …)给每个字段
写入带 `CANARY` 标记的哨兵值(通过原生 setter + input/change 事件,兼容 React 等框架),
再读取每个表单的 `FormData`,精确列出"一次真实提交会带走哪些字段"。

## 风险评分

0–100 分:隐藏且敏感的字段(卡号、密码、电话、地址)每个 +30,其他隐藏字段 +10,
模拟填充成功写入隐藏字段 +15,使用多种隐藏手法 +10。

## 注意

- 这是本地演示/研究工具。公开部署前必须加 SSRF 防护(IP 黑白名单、DNS 固定、重定向检查)。
- 无头浏览器里无法触发真正的浏览器自动填充 UI,因此"模拟填充"是按 autocomplete
  token 的确定性重放,用来回答"如果用户点了自动填充,哪些数据会进这个表单"。
