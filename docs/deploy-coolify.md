# Coolify 部署（docker-compose）

用一份 `docker-compose.yml` 在 [Coolify](https://coolify.io) 上部署 TeamPilot。设计依据见 `docs/superpowers/specs/2026-05-31-docker-compose-coolify-deploy-design.md`。

## 拓扑

```
              Coolify (Traefik：自动 HTTPS + 域名映射)
  admin.<域名> ─→ [web-admin]  nginx 静态 + /api 反代 ┐
  h5.<域名>    ─→ [web-h5]     nginx 静态 + /api 反代 ┤
                                                       ├─→ [server] :3000（仅内部）
                                                       │     · Express API
                                                       │     · 飞书长连接(出站) + scheduler
                                                       └─    · 卷 tp-data:/data (prod.db)
```

要点：
- **没有独立数据库容器**：数据库是 SQLite 文件，存在命名卷 `tp-data`（Coolify 跨部署保留）。
- **server 不对外**：只在 compose 内部网络暴露 `:3000`；两个前端 nginx 同源反代 `/api` 过去。
- **TLS 由 Coolify 负责**：你只需给 `web-admin`、`web-h5` 两个服务各分配一个域名。
- **飞书长连接是出站**，无需公网回调地址。

## 前置条件

- 一台装好 Coolify 的服务器，能访问外网（飞书 / 火山方舟 / 火山 ASR）。
- 两个域名（或子域）解析到该服务器：`admin.<域名>`、`h5.<域名>`。
- 准备好凭证：飞书 `APP_ID/SECRET`、方舟 `ARK_API_KEY/MODEL`、火山 ASR `APP_ID/ACCESS_TOKEN`（获取见 `docs/feishu-app-setup.md`、`docs/volc-asr-setup.md`）。

## 步骤

### 1. 新建 Compose 资源
Coolify → 项目 → **New Resource → Docker Compose**，源选这个 Git 仓库，Compose 文件路径填 `docker-compose.yml`（在仓库根）。

### 2. 配置环境变量
在该资源的 **Environment Variables** 里填（Secrets）：

| 变量 | 说明 |
|---|---|
| `CAPTAIN_USERNAME` / `CAPTAIN_PASSWORD` | 队长登录账号（首次启动 seed 写入） |
| `SESSION_SECRET` | 随机长串，会话签名 |
| `TEAM_JOIN_TOKEN` | 随机长串，队员入队链接令牌 |
| `TEAM_DEFAULT_LOCATION` | 默认活动地点 |
| `TEAM_TZ` | 时区，默认 `Asia/Shanghai` |
| `FEISHU_APP_ID` / `FEISHU_APP_SECRET` | 飞书自建应用 |
| `ARK_API_KEY` / `ARK_MODEL` | 方舟 LLM（`ARK_BASE_URL` 有默认值） |
| `VOLC_ASR_APP_ID` / `VOLC_ASR_ACCESS_TOKEN` | 火山豆包 ASR |
| `H5_BASE_URL` | **先留空/占位，拿到 h5 域名后回填**（见下） |

`NODE_ENV`、`PORT`、`DATABASE_URL` 已在 compose 写死，无需设置。

### 3. 给两个前端服务设置域名
在 Coolify 资源的服务列表里：
- `web-admin` → 设置域名 `https://admin.<域名>`
- `web-h5` → 设置域名 `https://h5.<域名>`
- `server` → **不设域名**（保持内部）

Coolify 会自动为这两个域名签发并续期 Let's Encrypt 证书。

> 不同 Coolify 版本入口略有差异：有的在服务卡片直接填 “Domains”，有的用魔法变量 `SERVICE_FQDN_WEBADMIN_80` / `SERVICE_FQDN_WEBH5_80`。compose 注释里给了后者示例。

### 4. 回填 `H5_BASE_URL` 并部署
把第 3 步 h5 的公网地址（`https://h5.<域名>`）填回环境变量 `H5_BASE_URL`，然后 **Deploy**。

构建会跑：装依赖（`pnpm --filter ...`）→ server 生成 Prisma Client、前端 `vite build`。首次启动 server 容器的 entrypoint 自动 `prisma db push`(建表) → `seed`(幂等) → 起服务。

就绪标志：server 日志出现 `server on :3000` 与 `ws client ready`。

### 5. 飞书侧（一次性）
- 开放平台后台 → **网页应用 → 重定向 URL 白名单** 加入 `https://h5.<域名>`（否则 H5 免登失败）。
- 确认事件订阅为**长连接**模式（无需填回调 URL）。
- 详见 `docs/feishu-app-setup.md`。

### 6. 验收
按 `docs/smoke-test.md` **D 区 + 真机清单**人工验：
- 打开 `https://admin.<域名>` 用队长账号登录，刷新后**不掉线**（验证 HTTPS + secure cookie）。
- 建活动 → 发布 → 飞书收到卡片 → 点去/不去 → 后台实时回写。
- 飞书内打开 `https://h5.<域名>/?t=<TEAM_JOIN_TOKEN>` → 免登入队。
- Bot 问答、AI 复盘/建议、录音转写。

## 运维

- **备份**：定期复制卷里的 `/data/prod.db`（Coolify 卷或宿主机层快照）。
- **更新**：推代码后在 Coolify 点 Redeploy；命名卷 `tp-data` 会保留，数据不丢。
- **改队长密码**：改 `CAPTAIN_PASSWORD` 后重部署——seed 用 upsert，但 `update:{}` 不会改密码哈希；如需改密请在应用内改或手动清理后重 seed。

## 本地用 docker compose 试跑（可选）

```bash
# 在仓库根放一个 .env（变量同上；本地试跑可把 H5_BASE_URL 设为 http://localhost:8081）
docker compose up --build
```
注意：本地纯 HTTP 下 `NODE_ENV=production` 的 secure cookie 写不进，登录会掉线——本地试跑仅用于验证镜像能否构建与起服务，正式登录态需在 Coolify 的 HTTPS 域名下验。需要的话可临时在 compose 把 server 的 `NODE_ENV` 改为非 production 再试登录。
