# devple-ai-commu

90년대 2D 도트 아트 가상공간에서 회원들이 캐릭터로 이동하며 근접 대화·DM·그룹 채팅을 하는 폐쇄형 웹 서비스의 **프론트엔드**(React + Vite + TypeScript SPA)입니다. 백엔드는 `docs/API_CONTRACT.md`를 기준으로 별도 구현됩니다.

## 문서

| 질문                                          | 문서                   |
| --------------------------------------------- | ---------------------- |
| 이 기능이 범위 안인가? 어떻게 동작해야 하나?  | `docs/PRD.md`          |
| 어느 레이어에 코드를 두나? 통신·렌더 구조는?  | `docs/ARCHITECTURE.md` |
| 타입 정의, 필드 의미, 불변 조건은?            | `docs/DOMAIN.md`       |
| API 경로, 요청/응답, SSE 이벤트, 에러 코드는? | `docs/API_CONTRACT.md` |
| 네이밍, 디렉토리, 테스트, 커밋 규칙은?        | `docs/CONVENTIONS.md`  |
| 지금 무엇을 만들 차례인가? 완료 조건은?       | `docs/ROADMAP.md`      |

문서와 코드가 다르면 문서가 기준입니다. AI 작업 지침은 `CLAUDE.md`에 있습니다.

## 요구 사항

- Node 24 (`.nvmrc`)
- pnpm 12 — `corepack enable` 후 `pnpm -v`로 확인 (`package.json`의 `packageManager` 필드가 버전을 고정)

## 시작하기

```sh
pnpm install
cp .env.example .env
pnpm dev          # Vite(5173) + Mock SSE 서버(5174) 동시 실행
```

브라우저에서 `http://localhost:5173`을 열고 접근 키 `DEMO-0000-0000`으로 입장하면 가짜 접속자 20명이 움직이는 월드가 보입니다 (Phase 1).

Mock 모드(`VITE_MOCK=true`)에서는 REST는 브라우저 안의 MSW가, SSE 스트림과 접속 티켓은 `src/mocks/sse-server.ts`(Express)가 처리합니다. Vite dev 서버가 `/api/v1/sse`로 시작하는 요청만 Express로 프록시합니다.

Mock SSE 서버는 기본 5174 포트를 씁니다. 다른 개발 서버가 점유하고 있으면 `MOCK_SSE_PORT=5199 pnpm dev`처럼 바꾸면 Vite 프록시와 서버가 같은 값을 읽습니다. 개발용 트리거: `POST /__mock/emit { type, payload }`(임의 이벤트 주입), `POST /__mock/disconnect`(강제 끊김), `POST /__mock/reset`(월드 초기 배치로), `GET /__mock/state`.

## 스크립트

| 명령                                | 설명                                       |
| ----------------------------------- | ------------------------------------------ |
| `pnpm dev`                          | 웹 + Mock SSE 서버 동시 실행               |
| `pnpm dev:web` / `pnpm dev:sse`     | 각각 따로 실행                             |
| `pnpm lint`                         | ESLint (타입 인식 규칙 + 레이어 경계 규칙) |
| `pnpm typecheck`                    | `tsc -b`                                   |
| `pnpm test` / `pnpm test:coverage`  | Vitest (`domain/` 커버리지 100% 요구)      |
| `pnpm test:e2e` | Playwright (headless Chromium). Mock SSE 5199 + Vite 5180을 자동으로 띄워 Phase 1 시나리오 검증. 최초 1회 `pnpm exec playwright install chromium` |
| `pnpm format` / `pnpm format:check` | Prettier                                   |
| `pnpm build`                        | 타입 검사 후 프로덕션 빌드                 |

## 구조

`docs/ARCHITECTURE.md` 8장 기준입니다.

```
src/
├── app/            # 라우팅, 프로바이더, 진입점
├── pages/          # 라우트 단위 페이지
├── features/       # 기능 단위 UI + 훅
├── game/           # Canvas 엔진 (React 의존 없음)
├── domain/         # 순수 함수·타입
├── transport/      # http, sse, api/*.ts, schemas/
├── store/          # zustand 스토어
├── mocks/          # MSW 핸들러 + SSE mock 서버
└── shared/         # 공용 컴포넌트, 유틸
```

레이어 경계는 `eslint.config.js`가 강제합니다. `game/`은 React를, `domain/`은 같은 폴더 밖의 어떤 것도 import할 수 없습니다.
