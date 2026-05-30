#!/bin/sh
# server 容器启动时序（全幂等）：
#   建表(已存在则跳过) → 种子(upsert 队长/球队设置) → 起服务(API + 飞书长连接 + scheduler)
# 直接用包内二进制，绕过 pnpm 运行前校验（见 README）
set -e
cd /app/packages/server

echo "[entrypoint] prisma db push ..."
./node_modules/.bin/prisma db push --skip-generate

echo "[entrypoint] seed (upsert) ..."
./node_modules/.bin/tsx prisma/seed.ts

echo "[entrypoint] starting server ..."
exec ./node_modules/.bin/tsx src/index.ts
