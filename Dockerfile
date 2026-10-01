# syntax=docker/dockerfile:1
# Commu Web 운영 이미지 (DEPLOYMENT 3장): 정적 빌드 → 비루트 nginx 8080.
# 빌드 단계는 빌드하는 기계의 아키텍처에서 한 번만 돌고($BUILDPLATFORM), 런타임 단계만 대상 아키텍처별로 만든다
# (결과가 정적 파일이라 amd64·arm64 멀티 아키텍처 이미지를 에뮬레이션 없이 만든다)

ARG NODE_VERSION=24
FROM --platform=$BUILDPLATFORM node:${NODE_VERSION}-alpine AS build
WORKDIR /app
COPY .nvmrc package.json pnpm-lock.yaml pnpm-workspace.yaml ./
# Node는 .nvmrc, pnpm은 package.json packageManager와 같아야 한다
RUN test "$(node -p 'process.versions.node.split(".")[0]')" = "$(cat .nvmrc)" \
 && npm install -g "pnpm@$(node -p 'require("./package.json").packageManager.split("@")[1]')" \
 && pnpm install --frozen-lockfile
COPY . .
# Vite는 빌드할 때 값이 박힌다. 운영 번들에는 Mock이 없어야 한다 (check:dist가 막는다)
ENV VITE_MOCK=false \
    VITE_API_BASE_URL=/api/v1
RUN pnpm build && pnpm check:dist

FROM nginxinc/nginx-unprivileged:1.30-alpine
COPY nginx/default.conf /etc/nginx/conf.d/default.conf
COPY nginx/security-headers.conf /etc/nginx/snippets/security-headers.conf
# 화면은 /commu/ 아래 (DEPLOYMENT 3.1 — Vite base와 같은 경로)
COPY --from=build /app/dist /usr/share/nginx/html/commu
EXPOSE 8080
