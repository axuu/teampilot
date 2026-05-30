# 火山引擎接入手册（豆包录音识别 ASR + 方舟 LLM）

> 记录 TeamPilot 接入**火山引擎**两项服务的真机踩坑与最终方案：
> - **豆包录音识别 2.0 极速版**（复盘录音转写，场景6 ASR）
> - **火山方舟（豆包）LLM**（AI 场景 1–5b）
>
> 凭证全部填在 `packages/server/.env`（已 gitignore，不提交）。`arkClient` / `volcAsrProvider` 都带
> `NODE_ENV==="test"` 守卫 —— 真实凭证只在跑服务时生效，不影响测试。

---

## 一、豆包录音识别 2.0 极速版（ASR）

### 1.1 最终方案（为什么这么选）

- 用**极速版 flash 同步接口** + **内联 base64 音频** —— 上传文件 → 后端把字节 base64 → 一个 HTTP 请求拿回转写文本 → 追加进复盘记录。
- **不需要 TOS / 对象存储 / 公网 URL / 异步轮询**。
- 原因：URL 异步方式要求音频放在火山服务器**能拉取**的地址（境外临时链接如 tmpfiles 会「audio download failed」）；内联 base64 直接把字节发过去，绕开托管可达性问题，也最契合「队长直接上传文件」的交互。

### 1.2 控制台开通（必需，且和别的 ASR 子产品分开）

1. 开通**「豆包录音识别 2.0 **极速版**」** —— 对应 resource `volc.bigasr.auc_turbo`。
   ⚠️ 它和「录音文件识别 `*.auc`」「流式 `*.sauc.*`」是**独立开通项**；只开了别的、没开极速版，会一直报 `45000030 requested resource not granted`。
2. 确认开通该资源的就是你 `.env` 里那个 **App ID**（一个账号可能多个 App，鉴权用的 App Key 必须是开通了该资源的那个）。
3. 拿到 **App ID** + **Access Token**（语音技术控制台）。

### 1.3 `.env` 配置（`packages/server/.env`）

```
VOLC_ASR_APP_ID=<App ID>
VOLC_ASR_ACCESS_TOKEN=<Access Token>      # 机密
# 可选，默认即极速版：
# VOLC_ASR_RESOURCE_ID=volc.bigasr.auc_turbo
```
（Secret Key 这个 HTTP 接口用不到，只用 App ID + Access Token 两个头。）

### 1.4 接口（已真机验证）

- **端点（同步）**：`POST https://openspeech.bytedance.com/api/v3/auc/bigmodel/recognize/flash`
- **鉴权头**：
  - `X-Api-App-Key`: App ID
  - `X-Api-Access-Key`: Access Token
  - `X-Api-Resource-Id`: `volc.bigasr.auc_turbo`
  - `X-Api-Request-Id`: 每次一个 UUID
  - `X-Api-Sequence`: `-1`
- **请求体**（内联 base64）：
  ```jsonc
  {
    "user": { "uid": "teampilot" },
    "audio": { "data": "<音频字节的 base64>", "format": "mp3" },
    "request": { "model_name": "bigmodel", "enable_itn": true, "enable_punc": true }
  }
  ```
- **判成功**：HTTP 200 且响应头 `X-Api-Status-Code === "20000000"`（`X-Api-Message: OK`）。失败时该头是别的码 + `X-Api-Message`。
- **取文本**：响应体 `result.text`（另有 `result.utterances[]` 分句）。
- **音频格式**：`mp3 / wav / ogg`（raw 也支持）。**m4a 不在支持列表** —— 上传 m4a 需先用 ffmpeg 转码（如 `ffmpeg -i in.m4a -ar 16000 -ac 1 in.mp3`），或在前端限制可选格式。

### 1.5 排错（本次踩过的坑）

| 现象 | 原因 / 解法 |
|---|---|
| `45000030 requested resource not granted` | 该 App **没开通**这个 resource。开通**极速版**（`volc.bigasr.auc_turbo`），并确认 App ID 与开通的 App 一致；开通后可能要几分钟生效。 |
| WS 端点报 `resourceId ... is not allowed` | `*.auc`（文件）走 REST、`*.sauc.*`（流式）走 WS —— 别用错端点 ×资源组合。极速版用 **REST `recognize/flash` + `auc_turbo`**。 |
| `21701 audio download failed`（HTTP 200） | URL 方式：火山国内服务器拉不到你给的（境外/临时）URL。**改用内联 base64** 即可绕过；否则音频要放在火山可达的地址（如 TOS）。 |
| 鉴权过了但一直 not granted | App Key/Access Key 能认证（不是 401），403 是「已认证但无该资源权限」→ 仍是开通/App 匹配问题。 |

### 1.6 代码位置

- `packages/server/src/asr/provider.ts` — `AsrProvider.transcribe(bytes, format)` + `volcAsrProvider`（真实 flash 调用，带 test 守卫）
- `packages/server/src/asr/service.ts` — `transcribeToReview(activityId, fileName, bytes, provider)`：格式校验 + 转写 + 原子追加进 `ActivityReview.rawNotes`
- `packages/server/src/reviews/routes.ts` — `POST /api/admin/activities/:id/review/transcribe`（`express.raw` 收字节，同步返回 `{text}`）
- 前端 `packages/web-admin/src/pages/tabs/ReviewTab.tsx` — 「+ 转写录音」上传文件，同步拿结果

---

## 二、火山方舟（豆包）LLM

### 2.1 `.env` 配置

```
ARK_API_KEY=<方舟 API Key>                          # 机密
ARK_BASE_URL=https://ark.cn-beijing.volces.com/api/v3
ARK_MODEL=<推理接入点 ID，形如 ep-xxxxxxxx>
```
用 `openai` 包指向方舟的 OpenAI 兼容接口。代码：`packages/server/src/ai/client.ts`（`arkClient`）。

### 2.2 控制台

开通方舟 → 创建**推理接入点**（接入一个豆包模型）→ 拿**接入点 ID**（`ep-...`）填 `ARK_MODEL`，以及 API Key。

### 2.3 排错（本次踩过的坑）

| 现象 | 原因 / 解法 |
|---|---|
| `InvalidEndpoint.ClosedEndpoint` | 接入点处于**关闭/停用**或区域与 `ARK_BASE_URL` 不一致 → 在控制台启用接入点 / 对齐区域。 |
| `response_format.type: json_object is not supported by this model` | 部分豆包模型/接入点**不支持** `response_format=json_object`。我们的解法：`arkClient` **不再传 `response_format`**，靠 system prompt 要求输出 JSON + `extractJsonText()` **健壮提取**（剥离 ```json 围栏、截取首个 `{…}` 片段）。所有场景输出仍是 JSON 文本，照常 zod 校验。 |
| 输出夹带推理过程/围栏 | reasoning 模型可能包裹输出 → `extractJsonText()` 已处理；`content` 字段取到的是最终 JSON。 |

---

## 三、本地起服务（速记）

```bash
cd packages/server
# .env 填好上述凭证；用 tsx 直接跑（本机 pnpm 有 minimumReleaseAge 供应链策略，绕过）
./node_modules/.bin/tsx --env-file=.env src/index.ts
# 看到 `server on :3000` 即就绪；AI/ASR 走 admin API 驱动
```

真机验收已全部通过：训练/比赛建议、AI 复盘、活动总结(A/B)、队长助理、队员 Bot、录音转写。
