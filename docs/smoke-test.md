# 真机 Smoke 测试清单

发布前在**真实环境**手动跑一遍，确认自动化够不到的部分仍然工作。

## 定位：这份清单补的是哪一块

- **自动化已覆盖（不必在此重复）**：`pnpm test`（101 项单测/集成）+ `pnpm e2e`（3 项浏览器 e2e）覆盖了 API 契约、前端组件逻辑、web-admin 核心 happy path、H5 入队的「页面→后端→DB」接线。这些用**确定性假外部服务**跑，是回归防护网——逻辑被改坏会自动发现。
- **本清单覆盖**：真飞书 / 真方舟 LLM / 真火山 ASR 的真实集成，以及真实部署环境（HTTPS / cookie / 长连接可达）。这些**天然无法自动化**（要真凭证、有真副作用、依赖飞书客户端），只能人工验、且通常一次即可。

**图例**：🧍 必须人工　🟡 可用脚本辅助单段排查　🤖 已被自动化覆盖（列出仅供参照，smoke 可跳过）

## 前置条件

1. `.env`（`packages/server/.env`）填好真实凭证：`FEISHU_APP_ID/SECRET`、`ARK_API_KEY/BASE_URL/MODEL`、`VOLC_ASR_APP_ID/ACCESS_TOKEN`、`TEAM_JOIN_TOKEN`、`H5_BASE_URL` 等。
2. 飞书自建应用配置就绪（事件订阅走长连接、卡片回调、网页应用免登 + 域名白名单、机器人已启用）——见 `docs/feishu-app-setup.md`、`docs/volc-asr-setup.md`。
3. 起真实服务（连真外部）：
   ```bash
   pnpm --filter @teampilot/server dev     # 启动 API + 定时器 + 飞书长连接（日志应出现 client ready）
   pnpm --filter @teampilot/web-admin dev   # 队长后台 :5173
   pnpm --filter @teampilot/web-h5 dev      # 队员 H5 :5174
   ```
   > 注意：`dev` 用 `NODE_ENV` 非 production，cookie `secure=false`，适合本地真机验收。生产环境另见 D 区。
4. 准备 2 个真实飞书账号：1 个队长（登录后台）+ 1 个队员（已通过 H5 入队、并打开过球队 Bot 会话，否则收不到通知）。

---

## A. 真飞书集成

| # | 步骤 | 预期 | |
|---|---|---|---|
| A1 | 后台建活动并**发布**（选上测试队员） | 队员飞书收到**活动卡片**（名称/时间/地点/报名按钮） | 🧍 |
| A2 | 队员在卡片点「去 / 不去」 | 卡片弹 toast「已记录：去」；后台「出勤情况」tab 该队员反馈更新；列表出勤概况变化 | 🧍 |
| A3 | 对**已取消/已结束/已开始**的活动点卡片按钮 | 提示「活动已取消/已结束，无法反馈」或「活动已开始或不可修改，当前反馈：…」 | 🧍 边界 |
| A4 | 后台**取消活动**（填原因） | 队员收到**取消卡片** | 🧍 |
| A5 | 提醒通知（活动开始前 24h / 2h，由定时器触发） | 到点队员收到**提醒卡片** | 🧍 时间相关，可临时调 `startTime` 落入提醒窗 |
| A6 | 队员给球队 **Bot 私信**一句中文问题（如「这周有训练吗」） | Bot 回一段 AI 答复（同时验证真方舟，见 B5） | 🧍 |
| A7 | 队员在**飞书内**打开 H5 入队链接 `H5_BASE_URL/?t=<TEAM_JOIN_TOKEN>` → 免登 → 填表 → 提交 | 显示「已加入球队」+ 提示打开 Bot；后台「队员管理」出现该队员 | 🧍 这是飞书 webview + 真免登的整段真实体验，自动化无法替代 |

> A7 仅排查「服务端用 code 换 open_id」这一段时，可用：
> ```bash
> cd packages/server && tsx --env-file=.env scripts/verify-feishu-code.ts <飞书免登code>
> ```
> 免登 code 单次有效、几分钟过期，拿到即跑。它**不能**替代 A7 的真实体验，只用于单段调试。

---

## B. 真方舟 LLM（重点验：真模型输出能被 zod 解析）

| # | 步骤 | 预期 | |
|---|---|---|---|
| B1 | 概要页点「生成训练建议 / 生成比赛建议」 | 返回结构化建议（训练：goal/plan；比赛：strategy/starting/bench），页面正常渲染 | 🧍 |
| B2 | 复盘页填写记录后点「生成复盘」 | 返回结构化复盘（训练：整体总结/目标完成/主要问题/改进；比赛少 goalDone） | 🧍 |
| B3 | 活动总结（发布后「时机A」自动生成 / 复盘后「时机B」追加） | 概要页「活动总结」有内容；后端日志无「时机A/B 生成失败」 | 🧍 |
| B4 | 队长 AI 助理页提问 | 返回 judgment + basis | 🧍 |
| B5 | 队员 Bot 提问（同 A6） | 收到合理答复，后端日志无「memberBot 处理失败」 | 🧍 |

> 关键验证点：真模型可能不输出纯 JSON。`extractJsonText` 负责剥离 ```json 围栏、截取 `{…}`；若 zod 解析失败，后端会报错并对应接口返回 500/降级。**跑 B 区时盯一眼后端日志**有无解析失败。

---

## C. 真火山 ASR

| # | 步骤 | 预期 | |
|---|---|---|---|
| C1 | 复盘页「+ 转写录音」上传一段**真录音**（mp3/wav/ogg/m4a，≤60MB） | 转写文本追加到「我的复盘记录」，toast「转写完成」 | 🧍 |
| C2 | 上传不支持的格式（如 .txt） | 提示「仅支持 mp3/wav/ogg/m4a」 | 🤖 已单测，可跳过 |

---

## D. 真实部署环境（生产）

| # | 检查 | 预期 | |
|---|---|---|---|
| D1 | 生产 `NODE_ENV=production` 时 cookie `secure=true` | 必须 **HTTPS** 才能保持登录态（纯 HTTP 下 cookie 不写入 → 登录后立即掉登录） | 🧍 |
| D2 | 前端域名 → `/api` 的同源/CORS + cookie domain | 登录态在真实域名下保持；跨子域时 cookie 可达 | 🧍 |
| D3 | 构建产物部署后可访问 | web-admin / web-h5 build 后页面与接口正常 | 🤖 e2e 已用 `vite preview` 验过 admin 构建产物；h5 同链路 |
| D4 | 飞书长连接在线、回调可达 | 服务启动日志有 `client ready`；卡片点击/Bot 消息有响应（即 A2/A6 能通） | 🧍 |

---

## 失败排查速查

| 现象 | 先查 |
|---|---|
| 卡片没收到 | 队员 `feishuOpenId` 是否正确；应用消息发送权限；队员是否打开过 Bot 会话；长连接是否在线 |
| 卡片点击无反应 | 应用是否订阅 `card.action.trigger`；卡片回调配置；长连接日志 |
| AI 报错 / 空白 | `ARK_API_KEY/MODEL`；后端「场景X 失败」日志；模型输出是否非 JSON（看 `extractJsonText` 是否截到） |
| 转写失败 | `VOLC_ASR_APP_ID/ACCESS_TOKEN`；音频格式与大小（≤60MB） |
| H5 免登失败 | 网页应用免登配置；重定向域名白名单；code 是否过期；`TEAM_JOIN_TOKEN` 是否匹配 |
| 登录后立即掉线 | 生产是否 HTTPS（secure cookie）；cookie domain / 反代是否透传 cookie |

---

## 执行记录模板

每次发布前跑一遍，记录结果：

| 日期 | 版本/commit | A 飞书 | B 方舟 | C ASR | D 环境 | 备注 |
|---|---|---|---|---|---|---|
| YYYY-MM-DD | `<sha>` | ✅/❌ | ✅/❌ | ✅/❌ | ✅/❌ | |
