# Docker Compose 部署（Coolify）设计

> 目标：用一份 `docker-compose.yml` 在 Coolify 上部署 TeamPilot（队长后台 + 队员 H5 + 后端），TLS/域名由 Coolify 托管。不改动现有应用代码，只新增部署基础设施文件。

## 背景与约束

TeamPilot 是 pnpm workspaces monorepo，部署形态由这些事实决定（见 `README.md`、`packages/server/src/app.ts`、`docs/smoke-test.md`）：

- **后端是长驻有状态进程**，不能 Serverless：
  - 飞书 `lark.WSClient` **长连接**常驻（卡片去/不去回调 + 队员 Bot）——注意是**出站**连接，无需公网 inbound 回调地址。
  - 进程内 `scheduler`（24h/2h 提醒、自动结束活动）。
  - **SQLite 文件**数据库（Prisma + SQLite），需持久磁盘。
- **数据库不是独立服务**：是嵌在后端进程里的 `.db` 文件。因此 compose 中**没有独立 DB 容器**，只需给后端挂一个持久卷存 `prod.db`。
- **前端是两个纯静态 SPA**（`web-admin` 队长后台、`web-h5` 队员入队），都用相对路径调 `/api` + `credentials:"include"` cookie 会话（见 `packages/web-admin/src/api.ts`）。
- **生产必须 HTTPS**：`cookie-session` 配置 `secure: NODE_ENV === "production"`，纯 HTTP 下 cookie 写不进 → 登录后立即掉线（`docs/smoke-test.md` D1）。H5 也必须公网 HTTPS 给飞书 webview 打开。

查证到的关键事实：

- `prisma/seed.ts` 全程 `upsert` → **幂等**，每次启动可安全运行。
- 仓库**无 `.npmrc`**：`pnpm` 的 `minimumReleaseAge` 是开发者本机全局配置，干净 Docker 构建中不触发；仍防御性传 `--config.minimumReleaseAge=0`。
- server **除 SQLite 外不写磁盘文件**（ASR 走内联 base64，无上传存储）→ 单个持久卷即可。
- `cookie-session` 的 `secure` 是静态布尔开关，不读 `req.secure` → **无需 `app.set("trust proxy")`**。浏览器只与 Coolify 的 HTTPS 域名交互，内部 hop 走 HTTP 不影响 Secure cookie。

## 架构

```
                Coolify (内置 Traefik：自动 HTTPS + 域名映射)
   admin.<域名> ──→ [web-admin]  nginx 静态 + /api 反代 ┐
   h5.<域名>    ──→ [web-h5]     nginx 静态 + /api 反代 ┤
                                                          ├──→ [server] :3000（仅内部网络）
                                                          │      · Express API (/api/*)
                                                          │      · 飞书长连接(出站) + scheduler
                                                          └──    · 卷 tp-data:/data (prod.db)
```

TLS 终止与证书续期完全由 Coolify 负责；compose 内不含 Caddy/nginx 做 TLS。

## 服务

| 服务 | 镜像构建 | Coolify 域名 | 端口 | 卷 |
|---|---|---|---|---|
| `server` | 多阶段：pnpm 装依赖 → `prisma generate` → 运行期 `tsx` | 不对外 | 内部 `expose 3000` | `tp-data:/data` |
| `web-admin` | 多阶段：`vite build` → nginx 托管 dist | `admin.<域名>` | 内部 `80` | — |
| `web-h5` | 多阶段：`vite build` → nginx 托管 dist | `h5.<域名>` | 内部 `80` | — |

**前端为何拆两个容器**：两个独立 SPA、都在根路径 `/` 提供页面；H5 必须有独立公网 HTTPS 地址（`H5_BASE_URL`）。各自容器内 nginx 同源反代 `/api` → `server:3000`，cookie 天然同源，无跨域。

**每个服务单一职责、接口清晰**：
- `server`：对外只暴露 `/api/*`（HTTP）+ 一条出站飞书长连接；依赖 = `tp-data` 卷 + 环境变量 + 外部服务（飞书/方舟/火山，出站）。
- `web-admin` / `web-h5`：对外只暴露 `:80`（静态 + `/api` 反代）；依赖 = `server` 的内部 DNS 名。

## 镜像与构建

构建上下文 = **仓库根**（monorepo 需要 `pnpm-workspace.yaml` 与 `@teampilot/shared`）。

**server.Dockerfile**（建议 `node:20-slim`，Debian 系避免 Prisma 在 musl 上的 OpenSSL 坑）：
1. 启用 corepack 固定 pnpm 版本。
2. 先复制 `package.json` / `pnpm-lock.yaml` / `pnpm-workspace.yaml` 与各包 `package.json`，`pnpm install --frozen-lockfile --config.minimumReleaseAge=0`（利用层缓存）。
3. 复制 `packages/server`、`packages/shared` 源码。
4. `pnpm --filter @teampilot/server exec prisma generate`。
5. 运行期 ENTRYPOINT 走 `docker/entrypoint.sh`。

**web-admin.Dockerfile / web-h5.Dockerfile**（多阶段）：
- builder 阶段：装依赖 → `pnpm --filter @teampilot/web-admin build`（或 h5）→ 产物在 `packages/web-*/dist`。前端用相对 `/api`，**无需任何 build-time API 地址变量**。
- 运行阶段：`nginx:alpine`，复制 dist 到 `/usr/share/nginx/html` + 对应 `nginx-*.conf`。

**nginx-admin.conf / nginx-h5.conf**（同结构）：
```
server {
  listen 80;
  root /usr/share/nginx/html;
  location /api/ {
    proxy_pass http://server:3000;
    proxy_set_header Host $host;
    proxy_set_header X-Forwarded-For $remote_addr;
    proxy_set_header X-Forwarded-Proto $scheme;
  }
  location / { try_files $uri /index.html; }   # SPA 前端路由回退
}
```
`server` 通过 compose 内部网络 DNS 解析。

## 启动时序（server entrypoint，全幂等）

```
prisma db push            # 建表，已存在则无操作
tsx prisma/seed.ts        # upsert 队长 + 球队设置，幂等
exec tsx src/index.ts     # 起服务 + 飞书长连接 + scheduler
```
日志出现 `server on :3000` 与 `ws client ready` 即就绪。

## 环境变量

- 在 **Coolify UI** 维护 secrets，compose 用 `${VAR}` 引用：`SESSION_SECRET`、`TEAM_JOIN_TOKEN`、`CAPTAIN_USERNAME`、`CAPTAIN_PASSWORD`、`TEAM_DEFAULT_LOCATION`、`TEAM_TZ`、`FEISHU_APP_ID`、`FEISHU_APP_SECRET`、`ARK_API_KEY`、`ARK_BASE_URL`、`ARK_MODEL`、`VOLC_ASR_APP_ID`、`VOLC_ASR_ACCESS_TOKEN`、`H5_BASE_URL`。
- compose 写死：`NODE_ENV=production`、`PORT=3000`、`DATABASE_URL=file:/data/prod.db`。
- `H5_BASE_URL` 必须等于 Coolify 给 `web-h5` 分配的公网域名（`https://h5.<域名>`）。

## 持久化与备份

- 命名卷 `tp-data` → `/data`，Coolify 跨部署保留。
- 备份 = 复制 `/data/prod.db`（可在 Coolify 卷或宿主机层做定期快照）。

## 健康检查

`server` 健康检查打 `GET /api/health`（`app.ts` 已有，返回 `{ok:true}`）；前端 nginx 用默认 `:80` 探活。Coolify 据此判断服务就绪。

## 上线后（人工，一次性）

1. 飞书开放平台：**网页应用免登重定向白名单**加入 `https://h5.<域名>`；确认事件订阅走**长连接**（无需填回调 URL）——见 `docs/feishu-app-setup.md`。
2. 按 `docs/smoke-test.md` **D 区 + 真机清单**验收：admin 登录不掉线（HTTPS+secure cookie）、建活动→发布→飞书卡片→去/不去实时回写、H5 飞书内免登入队、Bot 问答、AI 复盘/建议、录音转写。

## 交付物（新增文件，不改现有应用代码）

```
docker-compose.yml
docker/server.Dockerfile
docker/entrypoint.sh
docker/web-admin.Dockerfile
docker/web-h5.Dockerfile
docker/nginx-admin.conf
docker/nginx-h5.conf
docker/.dockerignore
docs/deploy-coolify.md      # Coolify 操作步骤 + 飞书白名单 + 验收清单引用
```

## 不做（YAGNI / 范围外）

- 不引入独立 Postgres/MySQL 容器（保持 SQLite）。
- 不改动应用代码（不让 server 自托管静态、不加 CORS、不加 trust proxy——均无必要）。
- 不做单域名子路径方案（需改 vite `base`，且 H5 仍需独立公网地址）。
- 不在 compose 内做 TLS（Coolify 负责）。

## 风险与缓解

| 风险 | 缓解 |
|---|---|
| Prisma 引擎在 Alpine/musl 上 OpenSSL 报错 | server 用 `node:20-slim`（Debian） |
| Coolify 不同版本域名映射方式有别（UI 设域名 vs `SERVICE_FQDN_*` 魔法变量） | `docs/deploy-coolify.md` 说明在 Coolify UI 为 `web-admin`/`web-h5` 各设一个域名；server 不设域名 |
| 首启 DB 未建表导致 500 | entrypoint 在起服务前先 `prisma db push` |
| `H5_BASE_URL` 与实际 h5 域名不一致 → 免登失败 | 部署文档明确：先在 Coolify 拿到 h5 域名，再回填该变量并重部署 |
