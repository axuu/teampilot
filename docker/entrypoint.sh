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

# --- 一次性 Mock 数据导入（部署验证完成后由作者手动移除本段 + .deploy-import/）---
# 哨兵放在持久卷 /data 上：只在首次部署执行一次，之后重启自动跳过。
# 失败时事务回滚（数据不变）、不写哨兵、不阻断启动，错误打到日志，下次重启自动重试。
IMPORT_MARKER=/data/.mock-import-20260610.done
if [ -f .deploy-import/import-preserve-members.mjs ] && [ ! -f "$IMPORT_MARKER" ]; then
  echo "[entrypoint] >>> 一次性 Mock 导入：开始"
  if node .deploy-import/import-preserve-members.mjs .deploy-import/teampilot-import.json \
       --apply --target production --confirm-preserve-reset --confirm-prod-import \
       --backup-dir /data/import-backups; then
    touch "$IMPORT_MARKER"
    echo "[entrypoint] >>> 一次性 Mock 导入：完成（哨兵 $IMPORT_MARKER）"
  else
    echo "[entrypoint] >>> 一次性 Mock 导入：失败——数据已回滚未改变，服务器继续启动，请查看以上日志" >&2
  fi
fi
# --- 一次性导入结束 ---

echo "[entrypoint] starting server ..."
exec ./node_modules/.bin/tsx src/index.ts
