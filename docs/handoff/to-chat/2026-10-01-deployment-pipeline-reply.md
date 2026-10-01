---
id: 2026-10-01-deployment-pipeline-reply
from: code
to: chat
reply-to: 2026-10-01-deployment-pipeline
blocks: none
needs-user: true
---

## done
- ROADMAP 1.24 new step **D1** (deploy) per DEPLOYMENT 1.1: `Dockerfile` (+ `.dockerignore`), `nginx/default.conf` + `security-headers.conf`, `k8s/` (kustomization, deployment, service, `argocd/application.yaml`), `ci.yml` (`check` + prod build + `check:dist`; `deploy` job), base path `/commu/` (Vite `base` for `vite build` only, Router `basename` from `BASE_URL`, MSW worker URL from `BASE_URL`), `pnpm check:dist`.
- CLAUDE.md doc map + CONVENTIONS 1.7 sync table (DEPLOYMENT, chat-owned). ARCHITECTURE 1.24 §9 (prod build, dev vs prod base).
- Local verification (docker 29.8): §7.3 all match — `/healthz` 200, `/commu` 301 → `/commu/` (relative Location), `/commu/x/y` → index.html no-cache, `/commu/assets/*` immutable, missing static 404, `/commu/mockServiceWorker.js` 404, `/`·`/api/x`·`/api` 404 without CSP, gzip, uid 101. Headless Chromium on the image: login page, in-app link `/commu/signup`, deep-link reload, 0 CSP violations, no worker request, API at `/api/v1/…`.
- Report with the user's manual steps: `docs/report/2026-10-01-deployment-pipeline.html`.

## info
- **CSP finding (no doc change needed)**: zod 4 probes `new Function("")` on first parse; the swallowed throw is still reported under `script-src 'self'`. Fixed with `z.config({ jitless: true })` imported first in `main.tsx` (`src/shared/zodConfig.ts`). After the fix, 0 violations in Report-Only. Enforce switch waits for the user's check on the real deploy.
- Image is multi-arch `linux/amd64,linux/arm64`: GitHub runners are amd64 and the cluster arch is unknown to code. The build stage runs once on `$BUILDPLATFORM`; only the nginx stage is per-arch, so there is no emulation.
- nginx: `absolute_redirect off` so `/commu` → `/commu/` stays relative behind the tunnel (otherwise `http://…:8080` leaks). Missing hashed/static files under `/commu/` return 404 instead of HTML. Cache-Control is only on 2xx/3xx.
- Dev server and E2E keep base `/` (decision allowed by §3.1); recorded in ARCHITECTURE §9.
- The `ci.yml` commit cannot be pushed by code (token lacks `workflow` scope); the user pushes it or adds the scope. First `deploy` run is reported after that.
- Server FYI `2026-10-01-server-session-fyi` (refresh 401 retry once ≈300 ms for parallel tabs) is handled next in code; no contract change.
