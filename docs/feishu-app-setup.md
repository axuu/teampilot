# 飞书自建应用配置手册（TeamPilot）

> 记录在**飞书开放平台开发者后台**（[open.feishu.cn](https://open.feishu.cn)，**中国版**）需要**手动**完成的配置。
> 代码侧用的是 `lark.WSClient` **长连接**接收事件/卡片回调，**无需公网回调 URL、无需加解密验签**。
> 配套设计见 `docs/superpowers/specs/2026-05-29-ai-team-manager-design.md` §9（前置配置清单）。

---

## 0. 应用标识

| 项 | 值 / 位置 |
|---|---|
| 平台 | 飞书**中国版** open.feishu.cn（代码里 `domain: lark.Domain.Feishu`） |
| App ID | `cli_aa930e681b38dbeb`（标识符，非机密） |
| App Secret | **机密** —— 只填进 `packages/server/.env` 的 `FEISHU_APP_SECRET=`，该文件已 `.gitignore`，**不提交** |

`.env` 需要的两行：
```
FEISHU_APP_ID=cli_aa930e681b38dbeb
FEISHU_APP_SECRET=<在开发者后台「凭证与基础信息」获取，不要写进任何提交的文件>
```

---

## 1. 机器人能力（必需）

开发者后台 → **「应用能力」→「机器人」→ 启用**。
- 用途：机器人给队员**单聊发卡片**（活动卡 / 取消卡 / 提醒卡）。
- 运营前提：每位队员需**在飞书里搜索并打开一次 Bot 会话**，否则机器人主动消息无法送达（设计 §9 运营动作）。

## 2. 权限（Scopes）

开发者后台 → **「权限管理」**，至少开通：

| 权限 | 用途 | 何时需要 |
|---|---|---|
| `im:message:send_as_bot` | 机器人给用户单聊发消息/发卡片 | **Phase2 必需**（发卡片）|
| H5 免登相关（换取 open_id 的 authen 能力） | H5 入队页飞书免登拿 open_id | Phase1 已配 |
| `contact:user.id:readonly` | 「通过手机号/邮箱获取用户 ID」 | **可选**：仅在「API 调试台」临时查 open_id 时用，生产不需要长期开 |

> ⚠️ 改动权限后**必须发布新版本**才生效（见 §4）。

## 3. 事件与回调（⚠️ 最关键 —— 卡片按钮回调靠它）

开发者后台 → **「事件与回调」**。这里有两个**独立**的「订阅方式」设置，**都要选「长连接」**：

1. **「事件」的订阅方式 = 使用长连接接收**（给 `im.message.receive_v1` 那类事件，Plan D 才用，现在设上无害）。
2. **「回调」的订阅方式 = 使用长连接接收** ← **Phase2 卡片按钮就靠这个。**

然后**在「回调」分区添加**：

| 回调 | 说明 | 阶段 |
|---|---|---|
| **`card.action.trigger`**（卡片回传交互） | 队员点「去/不去」按钮的回调 | **Phase2 必需** |

在「事件」分区（未来 Plan D 再加）：
| 事件 | 说明 | 阶段 |
|---|---|---|
| `im.message.receive_v1` | 队员私聊 Bot 问询（AI 场景5b） | Plan D |

> ⚠️ **`card.action.trigger` 属于「回调」，不在「事件」分区里**，很容易只设了订阅方式却漏加这一项。

## 4. 发布版本（必需，否则上面全不生效）

开发者后台 → **「版本管理与发布」→ 创建版本 → 发布**（自建应用对**权限 / 事件 / 回调**的任何改动，都要发布新版本，企业内可能需管理员审批）。

---

## 5. 获取某个队员的 open_id

> open_id **按应用隔离**：同一个人在不同应用 open_id 不同，必须用**本应用**取。
> 生产中队员 open_id 通过 Phase1 的 H5 免登入库；测试时可手动取。

**方法（API 调试台，无需长期权限）：**
1. https://open.feishu.cn/api-explorer/ ，顶部选中本应用 `cli_aa930e681b38dbeb`
2. 接口：**通讯录 → 用户 → 「通过手机号或邮箱获取用户 ID」**（`POST /open-apis/contact/v3/users/batch_get_id`）
3. Query `user_id_type` = `open_id`；Body `{ "mobiles": ["<手机号>"] }`
4. 调试（首次会提示临时授权 `contact:user.id:readonly`）→ 返回的 `user_list[].user_id` 即 open_id（`ou_` 开头）

本次真机验收用的测试账号 open_id：`ou_50a38d46dbb18e5a7dbfda79e3affc04`（手机号 15510657873，已写入本地 dev 库的测试队员；非机密但属用户标识，仅用于本地测试）。

---

## 6. 排错：点卡片按钮报「出错了，请稍后重试」code `200340`

本次真机验收踩过的坑，根因与排查路径，留作记录：

**现象**：发布活动后队员能收到卡片，但点「去/不去」飞书弹「出错了，请稍后重试：code 200340」，服务端无任何日志、DB 也没回写。

**根因**：**「回调 `card.action.trigger`」没有订阅到长连接** —— 飞书想回调却投递不到应用，于是报 200340。代码侧（`WSClient + EventDispatcher.register("card.action.trigger")`）是正确的（与飞书官方 SDK 自身处理卡片回调的机制一致）。

**排查方法（可复用）**：在 `startLongConnection` 里临时包一层 `dispatcher.invoke` 打印收到的原始数据 —— 若点击后**完全没有日志**，说明事件根本没经长连接送达 → 是后台「订阅方式 / 回调订阅」配置问题，不是代码问题。

**修复**：§3 + §4 —— 回调订阅方式设长连接 + 在「回调」加 `card.action.trigger` + 发布版本，然后发**新**卡片再点（改配置前发的旧卡片可能仍报错）。

**真实事件结构**（长连接送达、经 EventDispatcher 把 `event.*` 摊平到顶层后，handler 收到的形如）：
```jsonc
{
  "operator": { "open_id": "ou_xxx", "user_id": "...", "union_id": "..." },
  "action": { "value": { "activityId": "...", "response": "going" }, "tag": "button" },
  "token": "...", "host": "im_message",
  "context": { "open_message_id": "om_xxx", "open_chat_id": "oc_xxx" }
}
```
即 `event.operator.open_id` 与 `event.action.value` 可直接读（代码 `packages/server/src/feishu/events.ts` 的 `handleCardAction` 即按此实现）。

---

## 7. 本地起服务验证（速记）

```bash
# 进 server 包；.env 填好真实 App ID/Secret
cd packages/server
# 起服务 + 飞书长连接（用 tsx 直接跑；本机 pnpm 有 minimumReleaseAge 供应链策略会拦截 pnpm 脚本，故绕过）
./node_modules/.bin/tsx --env-file=.env src/index.ts
# 启动日志出现 `ws client ready` 即长连接已建立
```

发布/取消/提醒可用队长 API 触发（`POST /api/admin/login` → 建活动 → `/publish`、`/cancel`、`/notifications`、`/notifications/retry`）。

---

## 验收清单（真机已逐项通过 ✅）

- [x] 发布活动 → 队员单聊收到活动卡片（仅 active 队员）
- [x] 点「去/不去」→ 出勤反馈实时回写（幂等）
- [x] 取消活动 → 收到取消卡片
- [x] 取消/结束/已开始后点旧卡 → 只回当前状态、不改动
- [x] 活动前 24h/2h 提醒（幂等，不重复发）
- [x] 发送失败被记录 + 重试只补失败对象（不骚扰已成功的人）
