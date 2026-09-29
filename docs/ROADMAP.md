# ROADMAP — 구현 순서와 완료 조건

> 문서 버전: 1.4 (2026-09-30, GRAPHICS.md 연결 — 7·12단계 상세화 시 포함할 것)
> 용도: Claude Code가 작업 단위를 고르고 완료 여부를 판단하는 기준. 각 단계는 독립된 PR 1개 이상으로 진행하며, 한 단계가 끝나면 이 문서의 체크박스를 갱신한다.
> 1차 목표: **Mock 데이터만으로 로그인 → 월드 진입 → 가짜 접속자 20명이 움직이는 화면**

---

## 진행 원칙

- 각 단계 시작 전 `CLAUDE.md`의 "코드 변경 전 리뷰 요청" 절차를 따른다: 변경 파일 목록과 전체 코드를 먼저 제시 → 승인 → 적용
- 한 단계 안에서도 파일 5개 이상이면 나눠서 승인 받는다. 단, 같은 틀로 반복되는 동종 파일(SSE 핸들러 16개, API 모듈 8개, MSW 핸들러 등)은 한 묶음으로 승인한다
- 완료 조건의 명령이 모두 통과해야 다음 단계로 간다
- 단계 진행 중 문서(PRD/ARCHITECTURE/DOMAIN/API_CONTRACT/CONVENTIONS)와 어긋나는 점이 나오면 코드를 우회하지 않고 **먼저 문서 변경을 제안**한다
- 단계 착수 전에 필요한 문서 결정은 아래 "선행 결정" 표로 관리한다. 2026-09-29 기준 전부 해소됨

## 선행 결정 (2026-09-29 전부 해소 — 결정 내용은 반영 문서 참조)

| 착수 전 | 결정 | 반영 문서 |
|---|---|---|
| 3단계 | ✅ `seq`는 `Date.now()` 밀리초 정수. 서버는 사용자 단위 마지막 seq 보관, 다중 탭은 같은 시계라 나중 요청이 이김 | API_CONTRACT 2.2, ARCHITECTURE 3.3 |
| 3단계 | ✅ 합성 타입 `DmConversationWithPeer`, `GroupListItem`, `GroupDetail`, `GroupMemberWithUser`, `ChatPublicEvent`, `ChatDmEvent`, `ChatGroupEvent`, `GroupUpdatedEvent` | DOMAIN 9장 |
| 3단계 | ✅ `positionBatcher`는 `game/sync/` | ARCHITECTURE 1·8 |
| 4단계 | ✅ `world.positions`는 본인 포함, 클라이언트는 본인 항목 무시. 보정은 `PUT /me/position` 응답으로만 | API_CONTRACT 3.3, ARCHITECTURE 3.4 |
| 6단계 | ✅ 이동 검증 `max(3, elapsedMs/100)` 타일. 채팅 입력창 포커스 시 키 이동 비활성, `Enter`/`Esc` 전환, 클릭 이동은 항상 | API_CONTRACT 2.2, PRD 5.3·6, ARCHITECTURE 3.1 |
| 8단계 | ✅ `ChatDmEvent = DmMessage & { sender, peerId }` (peerId는 수신자 관점 상대). 안 읽음 합계는 Query 캐시 파생 | API_CONTRACT 3.3, DOMAIN 9, ARCHITECTURE 7 |
| 9단계 | ✅ 그룹 read body `{ lastMessageId }`, `group.updated`는 `GroupMemberWithUser[]` | API_CONTRACT 2.7·3.3 |
| 10단계 | ✅ `presence.*`는 재전송 버퍼 제외 | API_CONTRACT 3.4 |
| 11단계 | ✅ 운영자 전용 `POST /admin/users/{id}/reissue-key`, 셀프 재발급 없음 | API_CONTRACT 2.8, PRD 5.1·5.9 |

---

## Phase 1 — Mock으로 실행 (1차 목표)

### 1단계: 프로젝트 초기화 `[x]`

현재 저장소에는 Vite 템플릿(React 19, Vite 8, TS 6, oxlint, npm)이 들어 있다. 새로 만들지 않고 **아래 정의에 맞게 갱신·정리**한다.

**갱신·생성**
- `package.json` — pnpm, 스크립트: `dev`(vite + mock SSE 서버 동시 실행), `dev:web`(vite만), `dev:sse`(mock SSE 서버만), `lint`, `typecheck`, `test`, `format`
- `tsconfig.json`(references) / `tsconfig.app.json` / `tsconfig.node.json`(`vite.config.ts` + `src/mocks/sse-server.ts`)
- `vite.config.ts` — `@/` alias, `/api/v1/sse`와 `/api/v1/sse/ticket`만 Express mock으로 프록시, vitest 설정(jsdom, `domain/` 커버리지 100%)
- `eslint.config.js` — flat config, `strictTypeChecked`, **레이어 경계 규칙**
- `.prettierrc`, `.nvmrc`(24), `.env.example`, `index.html`(`lang="ko"`, 제목)
- `README.md` — 템플릿 문구를 프로젝트 소개와 실행 방법으로 교체

**삭제**
- `.oxlintrc.json`, `package-lock.json` (pnpm으로 전환)
- 템플릿 잔재: `src/App.css`, `src/assets/hero.png`, `src/assets/react.svg`, `src/assets/vite.svg`, `public/icons.svg`. `src/App.tsx`는 빈 `App`만 남김

**의존성 (메이저 버전, 2026-09-29 npm 기준)**
| 용도 | 패키지 |
|---|---|
| 런타임 | react 19, react-dom 19, react-router 7, zustand 5, @tanstack/react-query 5, zod 4 |
| 개발 | vite 8, typescript ~6.0, vitest 5, jsdom, @testing-library/react 16, msw 3, express 5, tsx, concurrently, eslint 10, typescript-eslint 8, eslint-plugin-import-x, eslint-plugin-react-hooks 7, prettier 3 |

- TypeScript는 `~6.0`으로 고정 — typescript-eslint 8이 6.1 미만까지만 지원 (7.x 사용 불가)
- Vite 5·Vitest 2 조합은 쓰지 않는다 — vitest 5는 vite 6~8만, @vitejs/plugin-react 6은 vite 8만 지원
- Zustand v5: `useStore(selector, equalityFn)` 형태가 없어졌으므로 얕은 비교는 `useShallow` 사용
- react-router 7은 단일 패키지(`react-router`)에서 import. `react-router-dom` 설치 불필요
- msw 3은 신규 메이저 — 설치 시 2→3 변경점 확인
- `cors` 불필요 — REST는 MSW가 브라우저 안에서 처리, SSE는 Vite proxy로 같은 origin

**TS 옵션**: `strict`, `noUncheckedIndexedAccess`, `noUnusedLocals`, `noUnusedParameters`, `moduleResolution: bundler`, `paths: { "@/*": ["src/*"] }`
- `exactOptionalPropertyTypes`는 켜지 않는다 — zod `.optional()` 추론(`?: T | undefined`)이 DOMAIN 타입(`?: T`)과 호환되지 않아 3단계 타입 테스트가 실패한다

**ESLint 경계 규칙 (파일 glob별 override)**
| 대상 | 금지 | 구현 |
|---|---|---|
| 전체 | `enum` 선언, `any`, `@/features/*/*` (index만 허용) | `no-restricted-syntax`, `@typescript-eslint/no-explicit-any`, `no-restricted-imports` patterns |
| `src/game/**` | `react`, `react-dom`, `@/features/**`, `@/pages/**`, `@/app/**`, `@/shared/**` | `no-restricted-imports` patterns |
| `src/domain/**` | 같은 폴더 상대 import(`./*`) 외 전부 | `no-restricted-syntax` 셀렉터 `ImportDeclaration[source.value!=/^\.\//]`. gitignore식 부정 패턴은 상대 import와 베어 import를 구분하지 못해 쓰지 않는다 |
| `src/transport/**` | `@/features/**`, `@/pages/**`, `@/app/**` | `no-restricted-imports` patterns |
| `*.test.*`, `src/mocks/**`, `src/test/**` | 경계 규칙 해제 | override |

**완료 조건**
- [x] `pnpm install` 성공, `package-lock.json` 없음
- [x] `pnpm lint`, `pnpm typecheck` 통과 (빈 `App` 상태)
- [x] `src/game/x.ts`에 `import React from 'react'`를 넣으면 lint가 **실패**
- [x] `src/domain/x.ts`에 `import { z } from 'zod'`를 넣으면 lint가 **실패**하고, `import { a } from './y'`는 통과

---

### 2단계: 디렉토리 골격 + 도메인 `[x]`

**만들 것**
- ARCHITECTURE.md 8장 구조대로 디렉토리 + 각 `index.ts`
- `src/domain/types.ts` — **DOMAIN.md의 타입을 그대로** 옮김. 주석에 DOMAIN.md 섹션 번호 표기
- `src/domain/proximity.ts` — `isWithinRadius(a, b, radius)` : `max(|dx|,|dy|) <= radius`
- `src/domain/occupancy.ts` — `isOccupied(tile, presences, excludeUserId?)` (순수 함수. 스토어를 읽지 않고 인자로 받는다)
- `src/domain/dm.ts` — `peerIdOf(conversation, myId)`
- `src/domain/message.ts` — `bubbleDurationMs(content, hasLinks)` : 3000 + 코드 포인트당 50, 링크 있으면 최소 6000, 최대 8000. 글자 수는 DOMAIN 5.1과 같이 **코드 포인트** 기준
- `src/game/constants.ts` — `TILE_SIZE=16`, `MOVE_DURATION_MS=150`, `INTERPOLATION_MS=200`, `AWAY_TIMEOUT_MS=300000`, `DEFAULT_ZOOM=2`
- `src/test/setup.ts`

**순서**: 각 domain 함수는 **테스트 먼저** (`*.test.ts`), 경계값 포함 (radius 0, 대각선, 같은 타일)

**완료 조건**
- [x] `pnpm test` 통과, `domain/` 커버리지 100%
- [x] `types.ts`의 인터페이스 이름·필드가 DOMAIN.md와 1:1 (수동 대조)

---

### 3단계: Transport 뼈대 `[x]`

**만들 것**
- `src/transport/http.ts` — fetch 래퍼: base URL, JSON, Bearer 첨부, `401 AUTH_REQUIRED` 시 `POST /auth/refresh` 후 1회 재시도, `ApiError { code, message, details }`
    - refresh는 **단일 진행**: 동시에 여러 요청이 401을 받아도 refresh 요청은 1회만 보내고 나머지는 같은 promise를 기다린다. 쿠키가 회전되므로 두 번째 refresh는 실패한다
    - (선택) `expiresIn` 기반 만료 직전 선제 갱신
- `src/transport/api/endpoints.ts` — API_CONTRACT 2장의 엔드포인트 37개를 `{ method, path }` 상수 목록으로. api 모듈과 4단계 핸들러 수 검사가 공유
- `src/transport/schemas/*.ts` — zod 스키마, DOMAIN 타입과 1:1. `z.infer` 결과가 `domain/types.ts`와 일치하는지 타입 테스트
- `src/transport/api/` — `auth.ts`, `me.ts`, `users.ts`, `world.ts`, `chat.ts`, `dm.ts`, `groups.ts`, `admin.ts` (API_CONTRACT 2장 엔드포인트 전부, 함수 하나 = 엔드포인트 하나)
- `src/transport/sse/client.ts` — **수동 재연결**: `onerror` → `close()` → `POST /sse/ticket` → `new EventSource('/api/v1/sse?ticket=…&lastEventId=…')`, 백오프 1s→30s 지터 ±20%, 30초 무수신 감지
- `src/transport/sse/registry.ts` — `type → handler` 등록, zod 파싱 실패 시 `console.warn` + 무시
- `src/transport/sse/handlers/*.ts` — API_CONTRACT 3.3의 이벤트 전부(1.3 기준 17종, `system.heartbeat` 포함), 파일 1개씩. 이 단계에서는 스토어 갱신 로직 없이 파싱만
- `src/game/sync/positionBatcher.ts` — 200ms 배칭, 변경 없으면 미전송, `seq`는 `Date.now()` 밀리초 정수(API_CONTRACT 2.2), `pagehide` 시 `fetch keepalive`. 전송은 `transport/api/me.ts`를 호출

**완료 조건**
- [x] `http.ts` 401 재시도 테스트 (MSW)
- [x] `http.ts` 동시 401 3건 → refresh 요청 1회, 3건 모두 재시도 성공 (MSW 요청 카운트)
- [x] `sse/client.ts` 재연결 테스트: 에러 → 새 티켓 발급 호출 → `lastEventId` 쿼리 포함 확인 (EventSource mock)
- [x] `positionBatcher` fake timers 테스트: 200ms 내 5회 이동 → 요청 1회, 마지막 위치만
- [x] `endpoints.ts` 항목 수 37 = api 모듈 export 함수 수 (테스트)

---

### 4단계: Mock 환경 `[x]`

**만들 것**
- `src/mocks/data/` — 고정 시드 데이터: 사용자 21명(본인 + 20), 맵 `main` 40×30, DM 대화 3개, 그룹 2개
- `src/mocks/handlers/*.ts` — MSW 핸들러, API_CONTRACT 2장 중 **Express가 담당하는 4개(티켓·`PUT /me/position`·`PUT /me/presence`·`GET /world/{mapId}/presences`)를 제외한 33개** (ARCHITECTURE 9장, 2026-09-30 결정). 예시 응답 그대로. `POST /auth/login`은 accessKey `DEMO-0000-0000`만 성공
- `src/mocks/browser.ts` — `VITE_MOCK=true`일 때만 워커 시작. `/api/v1/sse`로 시작하는 요청은 MSW가 건드리지 않고 통과(bypass)시켜 Vite proxy → Express로 간다
- `src/mocks/sse-server.ts` — Express, 포트 5174
    - `POST /api/v1/sse/ticket` → 30초 유효 **1회용** 티켓 발급 (MSW와 상태를 공유할 수 없으므로 티켓은 Express가 발급·검증한다)
    - `GET /api/v1/sse?ticket&lastEventId` → 티켓 검증(없음·만료·재사용이면 `401`), 즉시 `world.snapshot`, 200ms마다 `world.positions`(가짜 20명 랜덤 워크, **점유 규칙 준수**, collision 준수). `lastEventId`가 있으면 로그 출력
    - 15초 하트비트
    - 개발용 트리거: `POST /__mock/emit { type, payload }` 로 임의 이벤트 주입 (`chat.public`, `system.notice` 등), `POST /__mock/disconnect` 로 현재 연결 강제 종료 (재연결 경로 확인용)
- `src/mocks/maps/main.json` — 테두리 벽 + 내부 장애물 몇 개, `spawn: {20, 15}`

**완료 조건**
- [x] `pnpm dev:sse` 실행 후 `curl -X POST localhost:5174/api/v1/sse/ticket`로 티켓 발급 → `curl -N "localhost:5174/api/v1/sse?ticket=…"`로 스트림 확인 → 같은 티켓 재사용 시 `401`
- [x] MSW 핸들러 33개 + Express 4개(티켓·position·presence·presences) = `endpoints.ts` 37개 (테스트로 자동 검사)

---

### 5단계: 최소 실행 화면 `[x]`

**만들 것**
- `src/app/` — Router, QueryClientProvider, 인증 가드
- `src/store/authStore.ts`, `worldStore.ts` (chatStore/uiStore는 뼈대만)
- `src/pages/LoginPage.tsx` — 접근 키 입력 → `POST /auth/login`
- `src/pages/WorldPage.tsx` — `<canvas>` + 게임 엔진 마운트
- `src/game/engine/loop.ts` — rAF 고정 틱 60Hz
- `src/game/render/tilemap.ts` — collision 기준 벽=회색, 바닥=녹색 사각형 (플레이스홀더)
- `src/game/render/characters.ts` — **플레이스홀더**: 16×32 색 사각형 + 머리 위 닉네임. 닉네임은 Canvas `fillText`로 그린다 (말풍선이 아니므로 허용). 닉네임은 12단계에서 DOM 오버레이로 전환 (ARCHITECTURE 1.5·GRAPHICS 5.3에서 확정)
- `src/game/sync/interpolation.ts` — 원격 캐릭터 200ms 선형 보간
- `src/game/engine/camera.ts` — 내 캐릭터 중심, 맵 경계 클램프, 줌 2x
- SSE 핸들러 `world.snapshot`, `world.positions`, `presence.joined/left` → `worldStore` 갱신 (3단계 껍데기에 로직 채움). `world.positions`의 본인 항목은 무시한다 (API_CONTRACT 3.3)

**완료 조건 (= Phase 1 목표)** — 검증 자산: `e2e/phase1.spec.ts` (`pnpm test:e2e`, headless Chromium)
- [x] `pnpm dev` → 로그인 페이지 → `DEMO-0000-0000` 입력 → 월드 진입
- [x] 가짜 접속자 20명이 끊김 없이 움직이는 게 보임
- [x] 아무도 같은 타일에 겹치지 않음
- [x] 브라우저 콘솔에 에러 0건, zod warn 0건
- [x] 개발자 도구에서 SSE 연결 1개만 존재
- [x] `POST /__mock/disconnect` 후 새 티켓 발급 요청이 나가고 자동 복구되며, 연결은 여전히 1개

---

## Phase 2 — 상호작용

### 6단계: 내 캐릭터 이동 `[x]`

**만들 것**
- `src/domain/pathfinding.ts` — A\* 4방향·맨해튼 휴리스틱 `findPath(grid, from, to)`. 차단 = 정적 `collision` + 동적 점유(`positions`, 본인 제외). 목적지가 벽이면 가장 가까운 통행 가능 타일로 대체, 목적지가 점유면 경로의 마지막 타일을 제외해 **직전 타일까지** (ARCHITECTURE 3.1·3.2.1)
- `src/domain/movement.ts` — `stepTile(tile, dir)`, `directionTo(from, to)` 순수 함수
- `src/game/engine/input.ts` — 키보드(방향키/WASD, 누르는 동안 연속), 포인터(클릭/탭 → 화면 좌표), `enabled` 스위치(채팅 입력 포커스 시 키 이동 비활성, PRD 5.3. 입력창은 7단계라 이번엔 스위치만)
- `src/game/world/localPlayer.ts` — 클라이언트 예측 이동: 타일당 `MOVE_DURATION_MS`(150ms) 보간, 다음 타일이 벽·점유면 이동 없이 `dir`만, 자동 이동(경로 추종)은 키 입력이 들어오면 취소, 이동 중 막히면 현재 타일에서 A\* 재계산(스로틀 100ms), 재계산해도 도달 불가면 가장 가까운 타일. 타일 도착마다 `PositionBatcher.push`
- `worldStore.myPosition`(예측 위치) 추가. `presences[me]`는 서버 기준(스냅샷)으로 유지하고 `world.positions`의 본인 항목은 계속 무시
- WorldGame 연결: 카메라는 예측 픽셀 추종, 캔버스 클릭 → `screenToWorld` → 타일 → 경로, `PositionBatcher` 시작(`ServerConfig.positionBatchMs`), 409 `collision|too_far|occupied` → `details.position`으로 즉시 스냅 + 경로 재계산 (ARCHITECTURE 11장 "한 칸 튕김 허용")
- Express mock: `PUT /me/position`을 실제 월드 상태로 검증(collision → `max(3, elapsed/100)` → 선착순 점유), 내 이동을 `world.positions`에 본인 포함으로 방송

**완료 조건** — 검증 자산: `e2e/phase2-move.spec.ts`
- [x] pathfinding 테스트: 직선, 우회, 도달 불가 → 가장 가까운 타일, 목적지 점유 → 직전 타일, 경계값(시작=목적지, 맵 밖)
- [x] localPlayer 테스트(fake time): 150ms/타일, 벽·점유 시 dir만 변경, 키 입력이 자동 이동 취소, 막히면 100ms 스로틀로 재계산, 409 스냅
- [x] E2E: 방향키 → 내 위치가 바뀌고 Express `/__mock/state`에 `u_me` 위치가 반영됨, 벽 방향으로는 이동 불가, 클릭 이동으로 목적지 도착, 가짜 접속자가 내 타일로 들어오지 않음

### 7~12단계 (각 단계 착수 전에 3~6단계 형식으로 상세화)

- 7단계: 근접 대화 + 말풍선 DOM 오버레이 + 링크 버튼
    - 상세화 시 명시: 말풍선·링크 버튼 CSS는 **GRAPHICS 5.1~5.2** 기준. 픽셀 웹폰트를 `src/assets/fonts/`에 동봉하고 라이선스 파일을 함께 둔다. 폰트 채택 전 OFL 원문 확인. 폰트 크기는 기본 px × 줌 배율만
    - `POST /chat/public`은 근접 판정 브로드캐스트를 위해 Express mock으로 이관 (ARCHITECTURE 9장)
- 8단계: 프로필 카드, DM 패널, 회수
- 9단계: 그룹 채팅 패널
- 10단계: 자리비움, 재동기화(`sync.required`), 정지 처리
- 11단계: 운영자 콘솔
- 12단계: 실제 도트 아트 자산 교체 (스프라이트시트 + atlas) — 완료 조건은 GRAPHICS.md 8장 검수 체크리스트
    - `MapData.tileset` 대응: `transport/schemas` mapData 스키마와 `main.json`은 반영 완료(1.4). `game/assets/loader.ts`에 `loadTileset`·`loadCharacterAtlas` 추가
    - `game/render/sprite.ts`: atlas 기반 프레임 좌표 `(frame*16, rowOf(dir)*32)`, 걷기 `1→2→3→0` 75ms/프레임(150ms/타일 = 2프레임), away는 idle + 알파 0.5
    - `tilemap.ts` 플레이스홀더 → 타일셋 렌더, 레이어 `floor`/`objects`(below) → 캐릭터 → `overhead`(above)
    - 닉네임 Canvas `fillText` → DOM 오버레이 전환 (화면 밖 캐릭터 노드 생성 금지, 말풍선과 같은 레이어·폰트)
    - `scripts/check-assets.ts` 검수 자동화(크기·알파·팔레트·여백, GRAPHICS 8장) + CI
    - `src/assets/LICENSES.md`, `src/assets/palette.json`
    - 완료 조건: 아바타 8종 시트가 검수 스크립트 통과, 가짜 접속자 20명 걷기 애니메이션에서 rAF 프레임 간격 p95 ≤ 20ms (60fps 유지의 측정 가능한 대리 지표)

## Phase 3 — 백엔드 연동
- `VITE_MOCK=false` 전환, 실서버 계약 검증, E2E(Playwright)

---

## 결정 이력

| 날짜 | 결정 |
|---|---|
| 2026-09-29 | 1.0 작성. Phase 1을 5단계로 분할, 1차 목표는 Mock 월드 화면 |
| 2026-09-29 | 1.1: 스택을 2026-09 npm 최신 메이저로 확정 (React 19, Vite 8, TS ~6.0, Vitest 5, Zustand 5, zod 4, MSW 3, Express 5, ESLint 10). 기존 템플릿은 다운그레이드하지 않고 갱신 |
| 2026-09-29 | 1.1: `exactOptionalPropertyTypes` 제외, domain 경계는 AST 셀렉터, refresh 단일 진행, `positionBatcher`는 `game/sync/`, SSE 티켓 발급·검증은 Express mock, 선행 결정 표 신설 |
| 2026-09-29 | 1.2: 선행 결정 전부 해소 (API_CONTRACT·DOMAIN·PRD 1.2). `seq`=`Date.now()`, 합성 타입 DOMAIN 9장, positions 본인 무시, `reissue-key` 추가로 엔드포인트 37개 |
| 2026-09-30 | 1.3: Phase 1 결정 리포트 높음 2건 반영 — `system.heartbeat` 이벤트(17종), Mock 월드 REST 3개를 Express로(MSW 33 + Express 4). 6단계 상세화 |
| 2026-09-30 | 1.4: GRAPHICS.md 1.0 연결 (handoff 2026-09-30-graphics). 7단계 말풍선 CSS·폰트, 12단계 자산 교체 항목 명시. `MapData.tileset`을 코드에 반영 |

---

## Claude Code 첫 프롬프트 (복사용)

```
CLAUDE.md와 docs/ROADMAP.md를 읽고, ROADMAP 1단계(프로젝트 초기화)를 진행해줘.
CLAUDE.md의 "코드 변경 전 리뷰 요청" 규칙대로, 파일을 만들기 전에
생성할 파일 목록과 각 파일의 전체 내용을 먼저 보여주고 승인을 기다려.
승인 후 생성하고, 1단계 완료 조건 4개를 실제로 실행해서 결과를 보고해줘.
```
