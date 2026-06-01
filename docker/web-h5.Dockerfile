# syntax=docker/dockerfile:1
# 队员入队 H5 SPA（飞书内打开、免登）：构建静态产物 → nginx 托管 + 同源反代 /api
FROM node:20-slim AS build
RUN npm install -g pnpm@10.29.2
ENV PLAYWRIGHT_SKIP_BROWSER_DOWNLOAD=1
WORKDIR /app
COPY . .
RUN pnpm install --frozen-lockfile --config.minimumReleaseAge=0 --filter @teampilot/web-h5...
# 沿用包自身 build（tsc --noEmit && vite build），用二进制绕过 pnpm 运行前校验
RUN cd packages/web-h5 && ./node_modules/.bin/tsc --noEmit && ./node_modules/.bin/vite build

FROM nginx:alpine
COPY docker/nginx-h5.conf /etc/nginx/conf.d/default.conf
COPY --from=build /app/packages/web-h5/dist /usr/share/nginx/html
EXPOSE 80
