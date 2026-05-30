# syntax=docker/dockerfile:1
# 后端：Express API + 飞书长连接(出站) + scheduler + Prisma/SQLite
# 用 node:20-slim（Debian），避开 Prisma 引擎在 Alpine/musl 上的 OpenSSL 坑
FROM node:20-slim

# Prisma 需要 openssl；ca-certificates 供出站 HTTPS（飞书 / 方舟 LLM / 火山 ASR）
RUN apt-get update && apt-get install -y --no-install-recommends openssl ca-certificates \
    && rm -rf /var/lib/apt/lists/*

RUN npm install -g pnpm@10
# 即便 --filter 没拦住，也兜底不下载 playwright 浏览器
ENV PLAYWRIGHT_SKIP_BROWSER_DOWNLOAD=1

WORKDIR /app
COPY . .

# 只装 server 及其工作区依赖(shared)，跳过 e2e/web 的 devDeps。
# --config.minimumReleaseAge=0：防御本仓库 pnpm 供应链策略（见 README，CLI flag 才覆盖得了）
RUN pnpm install --frozen-lockfile --config.minimumReleaseAge=0 --filter @teampilot/server...

# 构建期生成 Prisma Client；运行期 entrypoint 用 --skip-generate 不再生成
RUN cd packages/server && ./node_modules/.bin/prisma generate

WORKDIR /app/packages/server
EXPOSE 3000
# 直接用包内二进制，绕过 pnpm 运行前校验（见 README）
ENTRYPOINT ["sh", "/app/docker/entrypoint.sh"]
