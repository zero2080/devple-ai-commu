# ARCHITECTURE — 프론트엔드 아키텍처

> 문서 버전: 1.5 (2026-09-30, GRAPHICS.md 연결·닉네임 렌더 방식 확정)
> 상태: 확정
> 전제: PRD.md 1.1

---

## 1. 전체 구조

React SPA 안에 **게임 레이어(Canvas)** 와 **UI 레이어(React DOM)** 가 공존한다. 게임 레이어는 React 렌더 사이클과 분리된 자체 루프로 돌고, 둘은 **스토어**를 통해서만 데이터를 주고받는다.

```
┌─────────────────────────────────────────────────────┐
│ React UI (DOM)                                       │
│  로그인/가입 · 채팅 패널(DM/그룹) · 프로필 카드 · 운영자 콘솔 │
│  말풍선 오버레이 (DOM, Canvas 좌표에 동기화)            │
├─────────────────────────────────────────────────────┤
│ Store (Zustand)                                      │
│  authStore · worldStore(위치/접속자) · chatStore ·   │
│  uiStore                                             │
├──────────────────────┬──────────────────────────────┤
│ Game Engine (Canvas) │ Transport                    │
│  render loop         │  REST client (fetch)         │
│  input → 이동 예측   │  SSE client (EventSource)    │
│  tilemap · camera    │  api/*.ts (엔드포인트별)     │
│  sync: batcher·보간  │                              │
└──────────────────────┴──────────────────────────────┘
```

**레이어 규칙**
- UI 레이어는 Canvas를 직접 건드리지 않는다. 스토어를 통해서만 상태를 읽는다.
- Game Engine은 React 컴포넌트를 import하지 않는다. 순수 TS 모듈.
- Transport는 스토어에 쓰기만 하고, 도메인 판단(예: "범위 안인가")은 하지 않는다. 판단은 `domain/` 순수 함수가 담당.
- 위치 배칭(`game/sync/positionBatcher.ts`)과 보간은 Game Engine 소속이다. 배처는 타이밍·seq만 관리하고 전송은 `transport/api/me.ts`에 위임한다

## 2. 렌더링 (Canvas)

### 2.1 픽셀 아트 규칙
- 기본 타일 크기 **16×16px**, 캐릭터 스프라이트 16×32px (2타일 높이)
- 줌은 **정수 배율만** 허용 (2x, 3x, 4x). **기본 2x**. 비정수 배율은 픽셀이 뭉개진다
- `ctx.imageSmoothingEnabled = false`, CSS `image-rendering: pixelated`
- 스프라이트시트 1장 + JSON atlas. 애니메이션은 프레임 인덱스 배열
- 자산 규격·시트 배치·atlas 스키마는 **GRAPHICS.md 2~3장**이 기준 (캐릭터 16×32 4방향×4프레임 64×128 시트, 타일셋 256×256 16열, 32색 단일 팔레트). 스프라이트를 좌우 미러로 재사용하지 않는다

### 2.2 렌더 루프
- `requestAnimationFrame` 기반 고정 로직 틱(60Hz) + 가변 렌더
- 오프스크린 캔버스에 정적 맵 레이어를 1회 그려 캐싱, 매 프레임은 캐릭터/오브젝트만 다시 그림
- 그리기 순서: 바닥 → 오브젝트(y 정렬) → 캐릭터(y 정렬) → 상단 오브젝트

### 2.3 말풍선
- Canvas가 아닌 **DOM 오버레이**로 렌더 (텍스트 렌더 품질, 이모지, 줄바꿈 처리 때문)
- 매 프레임 캐릭터의 스크린 좌표를 계산해 `transform: translate()`로 위치 갱신
- 공개 말풍선과 DM 말풍선은 CSS 클래스로 배경색 구분
- 표시 시간: 텍스트 길이 비례 (기본 3초 + 글자당 50ms, 최대 8초). 링크 버튼이 있으면 최소 6초
- 본문은 **항상 plain text**로 렌더 (`textContent`, HTML 해석 없음)
- `links`가 있으면 말풍선 하단에 링크 열기 버튼(도메인만 표시, 예: `↗ example.com`). 버튼이 있는 말풍선은 마우스 호버/터치 중 사라지지 않음
- 폰트·크기·테두리·최대 폭·꼬리 위치는 **GRAPHICS 5.1~5.2** 참조 (픽셀 웹폰트, 폰트 기본 px × 줌 배율만, 최대 폭 12타일, `box-shadow` 픽셀 외곽선)
- **닉네임**: 5단계 플레이스홀더는 Canvas `fillText`. **12단계에서 DOM 오버레이로 전환**한다 (GRAPHICS 5.3 — 말풍선과 같은 레이어·폰트, 화면 밖 캐릭터의 노드는 만들지 않음). 확정

### 2.4 링크 처리 (말풍선 · 채팅 목록 공통)
- 본문 내 URL 텍스트는 클릭 불가, 서버가 준 `links[]`로만 버튼 생성
- 버튼 클릭 → `window.open(url, '_blank', 'noopener,noreferrer')`
- 버튼 라벨은 URL의 호스트명만 표시, 전체 URL은 `title` 툴팁
- 외부 이동 전 확인 다이얼로그 없음 (호스트명이 보이므로 충분). 필요 시 `uiStore.confirmExternalLink` 플래그로 추가 가능
- 링크 미리보기(OG 이미지 등)는 **하지 않음** — 바이너리 로딩 금지 원칙과 충돌

### 2.5 카메라 / 맵
- 카메라는 내 캐릭터 중심, 맵 경계에서 클램프
- 맵 데이터: JSON (`width, height, layers[], collision[]`). 단일 맵이지만 `mapId` 필드 포함
- 근접 범위 계산은 항상 **타일 좌표** 기준 (`domain/proximity.ts`), 줌과 무관

## 3. 이동 동기화

### 3.1 입력 방식
| 환경 | 입력 | 동작 |
|---|---|---|
| 데스크톱 | 방향키 / WASD | 누르는 동안 1타일씩 연속 이동 |
| 데스크톱 | 마우스 클릭 | 캐릭터 위 클릭 → 프로필 카드 / 빈 타일 클릭 → 경로 탐색 후 자동 이동 |
| 모바일 | 터치(탭) | 캐릭터 탭 → 프로필 카드 / 빈 타일 탭 → 경로 탐색 후 자동 이동 (가상 D-pad 없음) |

- 경로 탐색: **A\*** (4방향, 맨해튼 휴리스틱), `game/engine/pathfinding.ts`
- 목적지가 충돌 타일이면 가장 가까운 통행 가능 타일로 대체
- 이동 중 키 입력이 들어오면 자동 이동 취소
- 채팅 입력창에 포커스가 있으면 키보드 이동 비활성. `Enter`로 입력창 포커스, `Esc`로 캔버스 복귀. 클릭/터치 이동은 항상 가능 (PRD 5.3)
- 이동 속도: 타일당 150ms (약 6.7타일/초) — 키/클릭/터치 공통

### 3.2 로컬 (클라이언트 예측)
- 입력 즉시 로컬 캐릭터를 이동시킨다. 서버 응답을 기다리지 않는다
- 충돌 판정은 클라이언트가 맵 collision 데이터 + **다른 캐릭터 위치**로 수행. 서버도 동일 검증 (권위는 서버)
- 경로 자동 이동 중에도 서버에는 **현재 위치만** 배칭 전송 (경로 전체를 보내지 않음)

### 3.2.1 캐릭터 간 충돌 규칙
- **한 타일에 캐릭터 1명.** 다른 캐릭터가 점유한 타일은 벽과 동일한 차단 타일로 취급
- 점유 정보는 `worldStore`의 `Map<userId, Position>`에서 매 틱 읽어 `domain/occupancy.ts`의 순수 함수 `isOccupied(tile, presences, excludeUserId?)`에 넘긴다 (domain은 스토어를 읽지 않는다)
- **목적지가 점유됨** (클릭/터치 이동): 경로를 목적지까지 계산한 뒤, 마지막 타일을 제외하고 **바로 앞 타일까지만** 이동. 도착 후 목적지 방향으로 `dir` 설정
- **이동 중 경로가 막힘** (다른 캐릭터가 경로 위로 들어옴): 멈추지 않고 현재 타일에서 **A\* 재계산**. 재계산해도 도달 불가면 도달 가능한 가장 가까운 타일로 목적지 변경. 재계산 주기 최소 100ms(스로틀)
- **키 입력 이동**: 다음 타일이 점유되어 있으면 이동하지 않고 `dir`만 바꿈 (벽에 부딪힌 것과 동일)
- **동시 진입 경쟁**: 두 클라이언트가 같은 빈 타일로 동시에 이동하면 **서버가 먼저 수신한 쪽이 점유**. 나중 쪽은 `409 POSITION_REJECTED`를 받고 `details.position`(서버가 인정한 마지막 위치)으로 즉시 되돌아감 → 다음 틱 `world.positions`로 점유자를 인지 → 3.2.1 경로 재계산 규칙 적용
- **입장 시**: 스폰 타일이 점유되어 있으면 서버가 가장 가까운 빈 타일에 배치. 내 초기 위치는 항상 `world.snapshot`의 본인 Presence에서 읽는다 (클라이언트가 스폰 좌표를 가정하지 않음)

### 3.3 서버로 전송 (배칭)
- 위치를 **200ms 주기**로 모아 REST 전송 (확정값, `game/sync/positionBatcher.ts`). 위치가 바뀌지 않았으면 전송 안 함
- 페이로드는 최종 위치 + 방향만 (중간 경로는 보내지 않음)
- `PUT /me/position { mapId, x, y, dir, seq }` — `seq`는 클라이언트가 `Date.now()` 밀리초 정수로 생성 (단조 증가, 다중 탭이 같은 시계를 공유). 서버는 사용자 단위 마지막 인정 seq보다 작거나 같으면 204로 무시
- 이동 중 페이지 이탈 시(`pagehide`) `fetch(url, { method: 'PUT', keepalive: true, headers: { Authorization } })`로 마지막 위치 전송. `navigator.sendBeacon`은 POST 전용이고 커스텀 헤더를 못 붙여 사용 불가 (정확도 높음, 표준 제약)

### 3.4 서버 → 다른 클라이언트
- 서버는 **200ms 틱**마다 변경된 위치를 하나의 SSE 이벤트 `world.positions`로 묶어 보냄
- 페이로드: `{ mapId, positions: [{ userId, x, y, dir }] }` — 변경된 사용자만
- 클라이언트는 원격 캐릭터를 목표 좌표로 **선형 보간**(200ms) 하여 끊김 없이 표시
- `world.positions`에는 본인 항목도 포함되지만 **클라이언트는 무시**한다. 내 위치 보정은 `PUT /me/position` 응답으로만: 204는 수락, 409는 `details.position`으로 즉시 스냅 후 경로 재계산 (API_CONTRACT 2.2·3.3)

### 3.5 자리비움 판정
- 키보드·마우스·터치 입력이 **5분간** 없으면 `PUT /me/presence { state: 'away' }`, 입력이 다시 들어오면 `online`
- 탭이 백그라운드로 가도(`visibilitychange`) 즉시 away로 바꾸지 않는다 (채팅 읽기만 하는 사용자 고려). 5분 규칙만 적용

### 3.6 근접 판정 위치
- 서버가 판정 (공개 메시지 수신 대상 결정). 클라이언트는 UI 표시용(말풍선 여부)으로만 계산
- 근접 반경 `proximityRadius`는 로그인 응답의 서버 설정값으로 받음

## 4. SSE 클라이언트

### 4.1 연결 정책
- 탭당 **EventSource 1개** (브라우저 HTTP/1.1 도메인당 연결 제한 6개 대응)
- 모든 실시간 이벤트를 이 한 연결에 다중화
- 서버 하트비트: 15초마다 `system.heartbeat` 이벤트 (SSE 주석은 `EventSource`가 JS에 전달하지 않아 관찰 불가). 클라이언트는 어떤 이벤트든 30초 무수신이면 `close()` 후 새 티켓으로 재연결 (`SseClient.idleTimeoutMs` 기본 30초)
- **재연결은 항상 수동**: 티켓이 1회용이라 EventSource의 자동 재연결(같은 URL 재요청)은 401로 실패한다. `onerror` → 기존 EventSource `close()` → `POST /sse/ticket` → 새 EventSource 생성
- 수동 재연결 시 브라우저는 `Last-Event-ID` 헤더를 보내지 않으므로(자동 재연결 때만 전송, 정확도 높음) 마지막 수신 `id`를 **쿼리 `lastEventId`** 로 넘긴다: `GET /sse?ticket=...&lastEventId=1234`
- 재연결 백오프: 1s → 2s → 4s → … 최대 30s, 지터 ±20%

### 4.2 이벤트 봉투
모든 이벤트는 동일한 형태:
```json
{ "id": "1234", "type": "chat.public", "ts": 1727600000000, "payload": { ... } }
```
- SSE `id:` 필드 = 서버 전역 단조 증가 시퀀스
- 재연결 시 마지막 `id`를 `lastEventId` 쿼리로 전송 → 서버는 그 이후 이벤트 재전송 (서버 버퍼 60초)
- 60초 초과 단절 시 서버는 `sync.required` 이벤트 → 클라이언트는 REST로 전체 상태 재조회

### 4.3 이벤트 종류
전체 목록과 payload는 **API_CONTRACT.md 3.3**이 기준이다. 분류만 요약:
| 분류 | type |
|---|---|
| 월드 | `world.snapshot`, `world.positions` |
| 접속 상태 | `presence.joined`, `presence.left`, `presence.updated` |
| 채팅 | `chat.public`, `chat.dm`, `chat.dm.recalled`, `chat.dm.read`, `chat.group` |
| 그룹 | `group.joined`, `group.updated`, `group.removed` |
| 시스템 | `system.notice`, `system.suspended`, `system.heartbeat`, `sync.required` |

### 4.4 인증
- `EventSource`는 커스텀 헤더를 보낼 수 없다 (브라우저 표준 제약)
- 방식: `POST /sse/ticket` → 30초 유효 일회용 티켓 → `GET /sse?ticket=...&lastEventId=...`
- JWT 자체를 URL에 싣지 않음 (로그 노출 방지)

## 5. REST 클라이언트

- `fetch` 래퍼 1개 (`transport/http.ts`): base URL, JSON 직렬화, Access 토큰 첨부, 401 시 Refresh 후 1회 재시도
- Refresh는 **단일 진행**: 동시에 여러 요청이 401을 받아도 `POST /auth/refresh`는 1회만 호출하고 나머지는 같은 promise를 기다린다. 쿠키가 회전되므로 두 번째 refresh는 실패한다
- 에러 응답은 계약된 형식 `{ code, message, details? }`로 통일, `ApiError` 클래스로 throw
- 서버 상태 캐싱/재조회는 **TanStack Query** (DM 대화 목록, 그룹 목록, 메시지 히스토리, 사용자 프로필)
- 실시간 이벤트 수신 시 해당 Query 캐시를 직접 갱신 (`setQueryData`), 재요청하지 않음

## 6. 인증 흐름

```
가입 신청 ──▶ (운영자 승인) ──▶ 이메일 접근 키
                                      │
접근 키 입력 ──▶ POST /auth/login ──▶ { accessToken, expiresIn, me, config }
                                      + Set-Cookie: refreshToken (httpOnly)
Access 만료 ──▶ POST /auth/refresh (쿠키 자동 첨부) ──▶ 새 accessToken
```
- Access 토큰: **메모리에만** 보관 (XSS 대비). 새로고침 시 `POST /auth/refresh` → `GET /me`로 세션 복구
- Refresh 토큰: httpOnly + Secure + SameSite 쿠키 — 백엔드 구현 필수 사항
- 로그아웃: `POST /auth/logout` → 쿠키 삭제, SSE 종료, 스토어 초기화

## 7. 상태 관리

| 스토어 | 내용 | 갱신 주체 |
|---|---|---|
| `authStore` | 토큰, 내 정보, 서버 설정 | REST |
| `worldStore` | 접속자 위치 맵 (`Map<userId, Position>`), 내 위치 | SSE, Game Engine |
| `chatStore` | 활성 말풍선, 근접 대화 로그(세션 한정), 안 읽음 수 합계, 전송 중 메시지 상태 | SSE, REST |
| `uiStore` | 열린 패널, 선택된 DM 대상, 줌 배율 | UI |

- `worldStore`의 위치 데이터는 **60Hz로 갱신**되므로 React 구독 대상이 아니다. Game Engine이 `getState()`로 직접 읽는다
- React 컴포넌트는 선택자(selector)로 필요한 최소 조각만 구독
- **서버 원본 목록**(DM 대화 목록, 그룹 목록, 메시지 히스토리, 프로필)은 스토어가 아니라 **TanStack Query 캐시**에만 둔다. SSE 수신 시 `setQueryData`로 캐시를 갱신하고, `chatStore`는 캐시에 없는 휘발성·UI 상태만 가진다 (이중 저장 금지)
- DM 식별: 서버 이벤트는 `conversationId`, REST 경로는 상대 `userId`를 쓴다. 매핑은 `DmConversation.participantIds`로 하며 `domain/dm.ts: peerIdOf(conv, myId)`

## 8. 디렉토리 구조

```
src/
├── app/            # 라우팅, 프로바이더, 진입점
├── pages/          # 라우트 단위 페이지 (login, signup, world, admin)
├── features/       # 기능 단위 UI + 훅 (chat, profile, admin, auth)
├── game/           # Canvas 엔진 (React 의존 없음)
│   ├── engine/     # loop, camera, input
│   ├── render/     # tilemap, sprite, layers
│   └── sync/       # positionBatcher, interpolation
├── domain/         # 순수 함수·타입 (proximity, message, user)
├── transport/      # http.ts, api/*.ts (엔드포인트별), sse/(client, registry, handlers/<type>.ts), schemas/ (zod)
├── store/          # zustand 스토어
├── mocks/          # MSW 핸들러 + SSE mock 서버
├── assets/         # 스프라이트, 맵 JSON
└── shared/         # 공용 컴포넌트, 유틸
```

## 9. Mock / 개발 환경

- REST: **MSW** (Mock Service Worker) — `API_CONTRACT.md`의 예시 응답을 그대로 핸들러로. 단, **티켓(`POST /sse/ticket`)과 월드 REST(`PUT /me/position`, `PUT /me/presence`, `GET /world/{mapId}/presences`)는 Express mock이 담당**한다 — 실시간 위치·점유 상태와 티켓은 SSE를 보내는 곳(Express)에 있어야 선착순 점유 검증과 본인 포함 `world.positions` 방송이 맞아떨어진다. Vite proxy가 `/api/v1/sse`, `/api/v1/me/position`, `/api/v1/me/presence`, `/api/v1/world` 접두 요청을 Express로 넘기고, MSW는 이 경로를 통과시킨다. 티켓 발급 시 Bearer 토큰으로 사용자를 바인딩한다(mock은 사용자 1명이라 항상 본인). 실시간 이벤트를 유발하는 나머지 엔드포인트(공개·DM·그룹 메시지 전송, 공지)는 해당 단계(7~9·11)에서 Express로 옮긴다
- SSE: MSW로 스트림 모킹이 제한적이므로 **Express 기반 소형 mock SSE 서버** (`mocks/sse-server.ts`) — 가짜 접속자 20명이 랜덤 이동하고 메시지를 보냄
- `.env`: `VITE_API_BASE_URL`, `VITE_MOCK=true`

## 10. 확장 고려 (구현하지 않되 막지 않음)
- `mapId`를 위치·공개 메시지·스냅샷 모든 곳에 포함 → 다중 맵 전환 시 계약 변경 없음
- SSE 이벤트 봉투가 고정이므로 새 이벤트 타입 추가는 하위 호환
- 렌더 레이어는 배열이므로 맵 레이어 추가 가능

## 11. 결정 이력

| 날짜 | 결정 |
|---|---|
| 2026-09-29 | 클릭/터치 이동 포함, A* 경로 탐색 |
| 2026-09-29 | 이동 배칭 200ms, 서버 틱 200ms |
| 2026-09-29 | 기본 줌 2x |
| 2026-09-29 | 모바일은 탭 이동, 가상 D-pad 없음 |
| 2026-09-29 | 친구 기능 제거, DM은 userId 기반 (캐릭터 클릭/닉네임 검색) |
| 2026-09-29 | 그룹 최대 10명 |
| 2026-09-29 | 캐릭터 간 충돌: 타일당 1명, 목적지 점유 시 직전 타일까지, 이동 중 막히면 경로 재계산, 경쟁은 서버 선착순 |
| 2026-09-29 | 교차 검토: SSE 재연결은 수동 + `lastEventId` 쿼리, 이탈 시 `fetch keepalive`, 자리비움 5분, 서버 목록은 Query 캐시 단일 저장 |
| 2026-09-29 | 예측/서버 불일치는 "즉시 보정 + 경로 재계산"으로 처리 (한 칸 튕김 허용, 부드러운 되감기 안 함) |
| 2026-09-29 | 1.2: position batcher는 `game/sync/` 소속(1장 그림 정정), `isOccupied`는 presences를 인자로 받는 순수 함수, refresh 단일 진행, `transport/` 하위 구조를 CONVENTIONS와 일치 |
| 2026-09-29 | 1.3: `seq`는 `Date.now()`, `world.positions` 본인 항목 무시(보정은 PUT 응답으로만), 채팅 입력 포커스 규칙, Mock 티켓은 Express |
| 2026-09-30 | 1.4: 하트비트를 `system.heartbeat` 이벤트로(무수신 감시 30초 기본 활성). Mock 월드 REST 3개를 Express로 일원화하고 티켓에 사용자 바인딩 (Phase 1 결정 리포트 1·2) |
| 2026-09-30 | 1.5: 자산 규격은 GRAPHICS.md(2.1·2.3 참조 추가). 닉네임 렌더는 12단계에서 Canvas fillText → DOM 오버레이로 확정 |
