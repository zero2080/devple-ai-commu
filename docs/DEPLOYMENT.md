# DEPLOYMENT — 배포 토폴로지 계약 (프론트 · 서버 공통)

> 문서 버전: 1.1 (2026-10-01, 호스트명 `stories.devple.net` 공유 · Commu 화면 `/commu/`)
> 상태: 확정
> 소유: chat. 두 저장소가 **같은 이름·포트·경로를 쓰도록** 정하는 문서다. 구현(Dockerfile, 매니페스트, CI)은 각 저장소가 이 문서를 따라 만든다
> 관련: API_CONTRACT 1.1(경로)·1.2(쿠키)·2.1(refresh `Origin` 검사), 서버 `devple-stories/docs/commu/INFRA.md`

---

## 1. 전체 그림

Commu는 **Stories와 같은 호스트명 `stories.devple.net`을 경로로 나눠 쓴다** (사용자 결정 2026-10-01). Commu 화면은 `/commu/` 아래, Commu API는 `/api/v1/` 아래이고, 그 밖의 경로는 지금처럼 Stories로 간다.

```
브라우저 ──https──▶ Cloudflare ──터널──▶ cloudflared (ns devple)
                     stories.devple.net
                       ├─ ^/api/v1/      ─▶ svc/devple-commu:8080      Commu API   (서버 저장소 · ArgoCD "devple-stories")
                       ├─ ^/commu(/|$)   ─▶ svc/devple-commu-web:80    Commu 화면  (프론트 저장소 · ArgoCD "devple-commu-web")
                       └─ 그 밖 (기존)    ─▶ devple-api                 Stories     (변경 없음)

GitHub push(main) ─▶ GitHub Actions ─▶ GHCR 이미지 ─▶ 매니페스트 태그 갱신 커밋 ─▶ ArgoCD 자동 동기화
```

| 항목 | 서버 (Commu API) | 프론트 (Commu 화면) |
|---|---|---|
| 공개 URL | `https://stories.devple.net/api/v1/…` | **`https://stories.devple.net/commu/`** |
| 저장소 | `github.com/zero2080/devple-stories` | `github.com/zero2080/devple-ai-commu` |
| 이미지 | `ghcr.io/zero2080/devple-api:<sha7>` (Stories와 같은 이미지) | `ghcr.io/zero2080/devple-commu-web:<sha7>` |
| Deployment / Service | `devple-commu` / `devple-commu:8080` | `devple-commu-web` / `devple-commu-web:80` → 컨테이너 8080 |
| 매니페스트 위치 | 서버 저장소 `k8s/commu/` | 프론트 저장소 `k8s/` |
| ArgoCD Application | 기존 `devple-stories` (경로 `k8s`) | 신규 `devple-commu-web` (프론트 저장소 경로 `k8s`) |
| 네임스페이스 | `devple` | `devple` |
| 레플리카 | 1 고정 (실시간 상태) | 1 (정적 파일, 무상태 — 필요하면 늘려도 됨) |

### 1.1 같은 오리진 — 지켜야 할 값
- Refresh 쿠키 `SameSite=Strict`, `Path=/api/v1/auth`(API_CONTRACT 1.2)는 그대로다. 화면이 `/commu/`에 있어도 같은 오리진이라 쿠키가 전송된다
- 서버 설정 (서버 INFRA·ARCHITECTURE 9):
  | 설정 | 값 | 비고 |
  |---|---|---|
  | `devple.commu.allowed-origin` | `https://stories.devple.net` | refresh·logout의 `Origin` 검사. **오리진에는 경로가 없다** (`/commu` 붙이지 않음) |
  | `devple.commu.public-base-url` | `https://stories.devple.net/commu/` | 접근 키 메일의 로그인 링크 |
  | 로컬 개발 | `http://localhost:5173` | Vite 개발 서버 |
- API·SSE 경로는 **오리진 기준 절대 경로** `/api/v1/…`다. 화면 기준 경로(`/commu/`)를 붙이지 않는다

### 1.2 오리진을 Stories와 공유하는 데 따른 위험 (수용)
- 같은 오리진이므로 Stories가 내보내는 페이지의 스크립트도 Commu API를 호출할 수 있다 (쿠키 `Path`는 스크립트 접근을 막지 못한다). 즉 **Stories 페이지는 Commu의 보안 경계 안에 있다**
- 현재 Stories의 서버 렌더링 페이지는 `/user/reset-password` 하나뿐이고 사용자 입력을 그리지 않아 위험은 작다. Stories에 HTML 페이지를 늘릴 때 이 점을 고려한다
- Commu 화면의 CSP는 `/commu/` 응답에만 붙는다. Stories 응답에는 영향 없음

## 2. 리소스 소유 규칙 (ArgoCD 충돌 방지)

두 ArgoCD Application이 같은 네임스페이스에 배포하므로, **한 리소스는 한 Application만** 관리한다. 둘이 같은 리소스를 선언하면 서로 덮어쓰거나 `prune`으로 지운다.

| 리소스 | 소유 |
|---|---|
| Namespace `devple`, ConfigMap `devple-config`, cloudflared, 모니터링 | 서버 저장소 (`devple-stories` app) |
| Secret `ghcr-secret`, `devple-secret`, `devple-commu-secret` | 클러스터에 수동 생성 (어느 app도 선언하지 않음) |
| `devple-commu` Deployment·Service | 서버 저장소 |
| `devple-commu-web` Deployment·Service | 프론트 저장소 |

- 프론트 `k8s/kustomization.yaml`은 **Namespace를 선언하지 않는다** (`namespace: devple` 필드로 대상만 지정)
- 프론트 이미지는 기존 `ghcr-secret`으로 pull한다 (같은 GitHub 계정. 토큰에 `read:packages` 권한 필요 — 정확도 중간, 첫 배포에서 확인)

## 3. 프론트 이미지 (`devple-commu-web`)

### 3.1 빌드
- 멀티 스테이지: Node(`.nvmrc` 버전) + pnpm(`packageManager` 버전)으로 `pnpm build` → nginx 런타임
- **기준 경로 `/commu/`**:
  - Vite `base: '/commu/'` (빌드 결과의 자산 URL이 `/commu/assets/…`)
  - React Router `basename="/commu"`. 앱 안의 링크·리다이렉트는 basename 기준
  - 코드에서 정적 파일을 절대 경로(`/maps/…`, `/fonts/…`)로 부르는 곳은 `import.meta.env.BASE_URL` 기준으로 바꾼다 (import로 가져오는 자산은 Vite가 처리)
  - API 기준 URL `VITE_API_BASE_URL=/api/v1`은 **오리진 절대 경로 그대로** (1.1)
  - 개발 서버(`pnpm dev`)도 같은 base로 맞출지는 프론트가 정한다. 맞추지 않으면 개발 URL과 운영 URL이 달라지는 점만 문서에 남긴다
- **빌드 시점 환경 변수**:
  | 변수 | 값 |
  |---|---|
  | `VITE_MOCK` | `false` |
  | `VITE_API_BASE_URL` | `/api/v1` |
  | `VITE_MOCK_BOT_MS` | 지정 안 함 |
- **운영 이미지에 Mock이 들어가면 안 된다**: `dist/`에 `mockServiceWorker.js`가 없어야 하고(지금은 `public/`에 있어 그대로 복사된다), 번들에 MSW·mock 핸들러 코드가 없어야 한다. 빌드 후 검사로 막는다
- 런타임 이미지: 비루트 nginx (`nginxinc/nginx-unprivileged` 계열, 포트 8080). 빌드 결과는 `<html root>/commu/` 아래에 둔다

### 3.2 nginx 규칙
| 경로 | 동작 |
|---|---|
| `/commu` | `301` → `/commu/` |
| `/commu/assets/*` (Vite 해시 파일) | `Cache-Control: public, max-age=31536000, immutable` |
| `/commu/index.html`, 해시 없는 파일 | `Cache-Control: no-cache` |
| `/commu/*` 그 밖 | SPA 폴백 → `/commu/index.html` |
| `/healthz` | `200` (k8s 프로브 — 클러스터 내부 전용, 외부에는 라우팅되지 않음) |
| 그 밖 전부 (`/api/*` 포함) | **`404`** — 이 서비스까지 오면 터널 라우팅 오류다. SPA 폴백을 주면 프론트가 HTML을 API 응답으로 파싱해 원인을 알기 어렵다 |
- `gzip`: js·css·json·svg. `woff2`는 이미 압축됨
- 보안 헤더(`/commu/` 응답): `X-Content-Type-Options: nosniff`, `Referrer-Policy: strict-origin-when-cross-origin`, CSP:
  ```
  default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline';
  img-src 'self' data: blob:; font-src 'self'; connect-src 'self';
  object-src 'none'; base-uri 'self'; frame-ancestors 'none'
  ```
  `style-src 'unsafe-inline'`은 React 인라인 스타일·DOM 오버레이 위치 계산 때문 (정확도 중간 — 첫 배포는 `Content-Security-Policy-Report-Only`로 내보내 콘솔 위반이 없는지 확인한 뒤 강제로 바꾼다). 링크 버튼의 `window.open`은 CSP 영향 없음

### 3.3 매니페스트 (프론트 저장소 `k8s/`)
```
k8s/
├── kustomization.yaml       # namespace: devple, resources: deployment, service
├── deployment.yaml          # image 태그는 CI가 갱신
├── service.yaml             # port 80 → targetPort 8080, ClusterIP
└── argocd/
    └── application.yaml     # kustomization에 넣지 않는다 (1회 수동 적용)
```
- Deployment: `replicas: 1`, `strategy: RollingUpdate`(`maxUnavailable: 0`, `maxSurge: 1`), `imagePullSecrets: ghcr-secret`, 프로브 `/healthz`, 리소스 requests `10m/32Mi`, limits `128Mi`
- ArgoCD Application `devple-commu-web`: `repoURL: https://github.com/zero2080/devple-ai-commu`, `path: k8s`, `targetRevision: HEAD`, `destination.namespace: devple`, `syncPolicy.automated: { prune: true, selfHeal: true }`, Slack 알림 어노테이션은 기존 `devple-stories` app과 같게. **`CreateNamespace`는 쓰지 않는다** (2장)
- 저장소가 비공개면 ArgoCD에 저장소 자격 증명을 한 번 등록해야 한다

## 4. 프론트 CI (자동 배포)
- 기존 `ci.yml`의 `check` 잡이 통과한 뒤에만 배포한다: 같은 워크플로에 `deploy` 잡(`needs: check`, `if: push && main`)
- 단계: GHCR 로그인(`GITHUB_TOKEN`, 잡 권한 `packages: write`, `contents: write`) → 이미지 빌드·푸시(`<sha7>`, `latest`) → `k8s/deployment.yaml` 태그를 `sed -i`로 갱신(Ubuntu 러너 — GNU sed) → `ci: update image tag to <sha7>` 커밋·푸시
- 무한 루프 방지: `GITHUB_TOKEN`으로 푸시한 커밋은 새 워크플로를 트리거하지 않는다 (GitHub 규칙, 정확도 높음). 추가로 `push` 트리거에 `paths-ignore: ['k8s/**']`
- main에 브랜치 보호 규칙이 있으면 봇 푸시가 막힌다 → 예외 설정 필요
- 서버 CI(`devple-stories/.github/workflows/deploy.yml`, self-hosted 러너)와 독립. 프론트는 GitHub 호스트 러너로 충분하다 (배포는 ArgoCD가 끌어오는 방식)

## 5. 배포 순서와 호환성
- 프론트와 서버는 **따로** 배포된다. 계약이 바뀌면 먼저 나간 쪽이 상대 구버전과 잠시 함께 돈다
- 규칙:
  - **하위 호환 변경**(필드 추가, 새 엔드포인트, 새 이벤트 타입)은 순서 무관. 프론트는 모르는 이벤트 타입을 무시한다
  - **호환 깨짐 변경**(필드 제거·이름 변경·의미 변경)은 **서버가 새 것과 옛 것을 함께 지원하는 기간**을 둔다: 서버 배포 → 프론트 배포 → 서버에서 옛 것 제거. chat이 계약 결정 이력에 "호환 깨짐"을 표시하면 이 절차를 따른다
- 첫 공개 전(서버 S10 전)에는 적용하지 않는다

## 6. 공개 전환 (Cloudflare)
- Cloudflare Zero Trust → Tunnel → Public Hostname에서 `stories.devple.net`의 **기존 규칙(→ Stories)보다 위에** 두 규칙을 추가한다. 규칙은 위에서부터 처음 맞는 것이 적용된다:
  1. `stories.devple.net`, path `^/api/v1/` → `http://devple-commu.devple.svc.cluster.local:8080`
  2. `stories.devple.net`, path `^/commu(/|$)` → `http://devple-commu-web.devple.svc.cluster.local:80`
  3. (기존) `stories.devple.net` → Stories — **손대지 않는다**
- 경로 정규식 지원·규칙 순서 조정은 대시보드에서 확인 (정확도 중간)
- 전환 시점: 서버 `devple-commu` Deployment가 뜬 뒤(서버 ROADMAP S10). 규칙을 넣기 전에는 `/api/v1`·`/commu` 요청이 기존 Stories로 가고, Stories Pod에서는 Commu가 꺼져 있어 404가 난다 — 안전한 기본값
- **공개 전 시험 기간의 Cloudflare Access는 경로 범위로만** 건다 (`stories.devple.net/commu`, `stories.devple.net/api/v1`). 호스트명 전체에 걸면 **Stories가 막힌다** (정확도 중간 — Access 애플리케이션의 경로 지정 방식 확인)
- SSE 주의(서버 INFRA 3): Cloudflare는 데이터 없는 연결을 100초 안팎에 끊는다. 15초 하트비트로 유지

## 7. 확인 절차
1. 프론트 main 머지 → CI `check` 통과 → `deploy` 잡이 이미지 푸시 + 태그 커밋
2. ArgoCD `devple-commu-web` Synced/Healthy, `devple-commu-web-*` Ready, 기존 `devple-api`·`devple-commu` 영향 없음
3. 클러스터 안에서 `devple-commu-web.devple.svc`: `/healthz` 200, `/commu` → 301, `/commu/some/route` → index.html, `/api/x` 404, `/` 404
4. 공개 전환 후: `https://stories.devple.net/commu/` 로그인 → 새로고침해도 로그인 유지 → 월드 진입 → SSE 하트비트 수신 → CSP 위반 없음
5. **Stories 회귀**: `https://stories.devple.net/api/auth/user/login`, `/user/reset-password`, `/swagger-ui.html`이 전환 전과 같게 동작
6. 운영 번들에 Mock 없음: 네트워크 탭에 `mockServiceWorker.js` 요청 없음

## 8. 결정 이력

| 날짜 | 결정 |
|---|---|
| 2026-10-01 | 1.0: 프론트도 ArgoCD 자동 배포에 포함 (사용자 요청). 프론트 저장소에 `k8s/` + 별도 ArgoCD app `devple-commu-web`, 이미지 `ghcr.io/zero2080/devple-commu-web`, 비루트 nginx 8080, 같은 오리진 경로 라우팅(Cloudflare), 리소스 소유 분리, Mock 배제 빌드 검사, 배포 순서 규칙 |
| 2026-10-01 | 1.1: 호스트명을 **`stories.devple.net` 공유**로 확정(사용자, `commu.devple.net` 제안 폐기). Commu 화면은 **`/commu/` 아래**(사용자 결정 — Stories 경로에 영향 없음). Vite `base`·Router `basename`, API는 오리진 절대 경로 유지, `allowed-origin`은 경로 없는 오리진, Cloudflare 규칙은 기존 Stories 규칙 위에 2개 추가, Access는 경로 범위로만, Stories와 오리진 공유 위험 기록 |
