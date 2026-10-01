# CONVENTIONS — 개발 규칙

> 문서 버전: 1.5 (2026-10-01, 문서 동기화 표에 계약 자산 → to-server 추가)
> 상태: 확정
> 적용 범위: 프론트엔드 저장소 전체. AI(Claude)와 사람 모두 동일하게 따른다.

---

## 1. 도구 · 버전

| 항목 | 선택 |
|---|---|
| 패키지 매니저 | pnpm |
| 빌드 | Vite 8 |
| 언어 | TypeScript ~6.0 (typescript-eslint 지원 범위), `strict: true`, `noUncheckedIndexedAccess: true` |
| UI | React 19 (함수 컴포넌트만) |
| 라우팅 | React Router 7 (`react-router` 단일 패키지) |
| 상태 | Zustand 5 (클라이언트, 얕은 비교는 `useShallow`) · TanStack Query 5 (서버 상태) |
| 스타일 | CSS Modules (`*.module.css`). 게임 UI 특성상 유틸리티 프레임워크 미사용 |
| 린트/포맷 | ESLint 10 flat config (typescript-eslint 8 `strictTypeChecked`, react-hooks, import-x 순서, 레이어 경계) + Prettier 3 |
| 테스트 | Vitest 5 + React Testing Library 16 · Playwright (E2E) |
| Mock | MSW 3 (REST) · Express 5 (SSE mock) |
| Node | 24 LTS (`.nvmrc`) |

- 메이저 버전의 기준은 ROADMAP 1단계 의존성 표다. 버전을 올리면 두 문서를 같은 PR에서 갱신한다

## 2. 네이밍

| 대상 | 규칙 | 예 |
|---|---|---|
| 파일: 컴포넌트 | PascalCase.tsx | `SpeechBubble.tsx` |
| 파일: 그 외 | camelCase.ts | `positionBatcher.ts` |
| 디렉토리 | kebab-case | `speech-bubble/` (컴포넌트 폴더는 PascalCase 허용) |
| 컴포넌트 | PascalCase | `ProfileCard` |
| 훅 | `use` 접두 | `useProximity` |
| 스토어 | `~Store` | `worldStore` |
| 타입/인터페이스 | PascalCase, `I` 접두 금지 | `Presence` |
| 상수 | UPPER_SNAKE | `TILE_SIZE` |
| 이벤트 핸들러 | `handle~` (내부) / `on~` (props) | `handleClick`, `onSend` |
| 불리언 | `is/has/can/should` 접두 | `isOnline` |
| API 함수 | 동사 + 리소스 | `sendDm`, `fetchPresences` |

## 3. 디렉토리 규칙 (ARCHITECTURE.md 8장 기준)

- `game/`은 **React를 import하지 않는다**. ESLint `no-restricted-imports`로 강제
- `domain/`은 **같은 폴더의 상대 import(`./*`) 외에 아무것도 import하지 않는다** (외부 패키지·다른 레이어 금지, 순수 함수 + 타입만). ESLint `no-restricted-syntax` 셀렉터로 강제. 테스트 커버리지 100% 목표
- `transport/`는 `store/`에 쓰기만 하고 `features/`를 알지 못한다
- `features/<name>/` 내부 구조: `components/`, `hooks/`, `index.ts` (public API만 export)
- 기능 간 import는 `features/<a>`에서 `features/<b>/index.ts`만 허용. 내부 파일 직접 import 금지
- 절대 경로 alias `@/` = `src/`

## 4. TypeScript

- `any` 금지. 불가피하면 `unknown` + 좁히기
- 타입 정의는 `interface` 우선, 유니온/유틸리티는 `type`
- 서버 응답 타입은 `domain/types.ts`의 것을 그대로 사용. **프론트 전용 필드를 서버 타입에 섞지 않는다** (파생 타입은 `domain/view.ts`)
- 런타임 검증: 외부 입력(API 응답, SSE payload)은 `zod` 스키마로 파싱. 스키마는 `transport/schemas/`
- `enum` 금지 → 문자열 리터럴 유니온
- 함수 반환 타입은 export되는 함수에만 명시
- `exactOptionalPropertyTypes`는 켜지 않는다. zod `.optional()` 추론(`?: T | undefined`)이 `domain/types.ts`의 `?: T`와 호환되지 않는다

## 5. React

- 컴포넌트 1파일 1개. 파일명 = 컴포넌트명
- props는 `interface XxxProps` 로 같은 파일 상단에 정의
- `React.FC` 사용 안 함. `function Comp(props: Props)` 형태
- 상태는 가장 가까운 곳에. 두 컴포넌트 이상이 공유하면 스토어
- `useEffect`는 외부 시스템 동기화에만 사용. 파생 값 계산에 쓰지 않음
- 리스트 key에 index 금지
- 조건부 렌더는 삼항 또는 early return. `&&`로 숫자/문자 렌더 금지 (`0` 노출 버그)
- 스토어 구독은 반드시 **selector** 사용: `useWorldStore(s => s.myPosition)`

## 6. 게임 레이어

- 모든 좌표 변수는 단위를 이름에 포함: `tileX`, `pixelX`, `screenX`. 단위 없는 `x`는 `Position` 타입 내부에서만
- 루프 내부에서 객체/배열 **생성 금지** (GC 압박). 재사용 버퍼 사용
- `Math.random` 직접 호출 금지 → `game/engine/rng.ts` (재현 가능한 테스트용)
- 렌더 함수는 상태를 변경하지 않는다. `update(dt)`와 `render(ctx)` 분리
- 스프라이트·맵 로딩은 `game/assets/loader.ts` 한 곳에서. 컴포넌트에서 `new Image()` 금지
- 매직 넘버 금지: 클라이언트 고유 값(`TILE_SIZE`, `MOVE_DURATION_MS`, `INTERPOLATION_MS`, `AWAY_TIMEOUT_MS`)은 `game/constants.ts`. 서버가 주는 값(`ServerConfig`: `positionBatchMs`, `proximityRadius` 등)은 상수화하지 않고 `authStore`에서 읽는다

## 7. 데이터 · 통신

- REST 호출은 `transport/api/*.ts`에만. 컴포넌트/훅에서 `fetch` 직접 호출 금지
- 서버 상태 조회는 TanStack Query 훅(`features/*/hooks/useXxxQuery.ts`)으로 감싼다. 쿼리 키는 `queryKeys.ts`에 집중 정의
- SSE 핸들러는 `transport/sse/handlers/<type>.ts` — 이벤트 1종 = 파일 1개. 등록은 `transport/sse/registry.ts`
- SSE payload는 zod 파싱 실패 시 **무시 + console.warn** (연결은 유지)
- 낙관적 업데이트는 메시지 전송에만 적용 (`status: 'sending' | 'sent' | 'failed'` UI 상태). 위치는 예측 이동이므로 별도
- 에러는 `ApiError`로 throw, UI는 `code`로 분기. `message`를 그대로 사용자에게 노출하지 않음 (i18n 대비 `errorMessages.ts` 매핑)

## 8. 보안

- 사용자 생성 텍스트는 **항상 `textContent`** 또는 React 텍스트 노드. `dangerouslySetInnerHTML` 금지
- 링크는 서버 `links[]`만 사용, `window.open(url, '_blank', 'noopener,noreferrer')`
- Access 토큰은 메모리(`authStore`)에만. `localStorage`/`sessionStorage`에 토큰 저장 금지
- URL 쿼리에 토큰·개인정보 금지 (SSE 티켓만 예외)
- `.env`에 비밀값 없음. `VITE_` 변수는 모두 공개 값으로 간주

## 9. 테스트

| 층 | 도구 | 필수 범위 |
|---|---|---|
| `domain/` | Vitest | 모든 함수. 근접 판정·경로 탐색·좌표 변환은 경계값 포함 |
| `game/sync/` | Vitest | 배칭 타이밍, 보간, seq 처리 (fake timers) |
| `transport/` | Vitest + MSW | 401 재시도(동시 401은 refresh 1회), 에러 매핑, SSE 재연결·`lastEventId` 쿼리 |
| `features/` | RTL | 사용자 시나리오 단위. 구현 세부(상태 값) 검증 금지 |
| E2E | Playwright | 로그인 → 입장 → 이동 → 근접 대화 → DM → 그룹, 최소 1시나리오 |

- 테스트 파일은 대상 옆에 `*.test.ts(x)`
- 테스트명은 한국어 문장: `it('반경 밖 DM은 말풍선을 만들지 않는다')`
- 스냅샷 테스트 금지 (Canvas 렌더 포함)
- CI에서 `pnpm lint && pnpm typecheck && pnpm test` 통과 필수

## 10. Git

### 브랜치
- `main`: 배포 가능 상태 유지
- `feat/<scope>-<short>`, `fix/<scope>-<short>`, `docs/<short>`, `chore/<short>`

### 커밋 (Conventional Commits, 한국어 본문)
```
<type>(<scope>): <한국어 제목, 50자 이내>

<본문: 왜 바꿨는지. 무엇을 바꿨는지는 diff가 말한다>

Refs: #이슈번호
```
- type: `feat` `fix` `refactor` `test` `docs` `chore` `perf` `style`
- scope: `game` `chat` `dm` `group` `auth` `admin` `transport` `store` `domain` `mock` `docs`
- 예: `feat(game): 클릭 이동 A* 경로 탐색 추가`

### PR
- 1 PR = 1 목적. 300줄 초과 시 분할 검토
- 템플릿: 변경 이유 / 변경 내용 / 테스트 방법 / 스크린샷(UI 변경 시) / 계약 변경 여부
- `API_CONTRACT.md` 변경이 있으면 Mock 핸들러 변경이 **같은 PR**에 포함

## 11. 문서 동기화

| 변경 | 갱신할 문서 |
|---|---|
| 기능 추가/제거 | PRD.md |
| 구조·레이어·통신 방식 | ARCHITECTURE.md |
| 타입·불변 조건 | DOMAIN.md → `domain/types.ts` |
| 엔드포인트·이벤트·에러 | API_CONTRACT.md → `mocks/` |
| 규칙 | CONVENTIONS.md |
| 단계·완료 조건 변경 | ROADMAP.md |
| 자산 규격·팔레트·폰트·말풍선 CSS | GRAPHICS.md (chat 담당, `docs/handoff/to-chat/`로 요청) |
| 계약 자산 (맵 JSON·`catalog.json`·`palette.json`, API_CONTRACT 9장) | `docs/handoff/to-server/`로 백엔드에 알림 (서버가 사본을 씀) |

- 문서는 코드와 같은 PR에서 수정. 문서 버전 상단 표기 갱신
- 결정 사항은 각 문서의 "결정 이력" 표에 날짜와 함께 추가

## 12. 결정 이력

| 날짜 | 결정 |
|---|---|
| 2026-09-29 | 1.2: 스택을 ROADMAP 1단계 표(React 19, Vite 8, TS ~6.0, Vitest 5, Zustand 5, MSW 3, ESLint 10, Node 24)에 맞춤. `domain/`은 같은 폴더 상대 import만 허용. `exactOptionalPropertyTypes` 미사용 |
| 2026-09-29 | 1.3: 11장 문서 동기화 표에 ROADMAP.md 행 추가 |
| 2026-09-30 | 1.4: 11장 문서 동기화 표에 GRAPHICS.md 행 추가 (담당은 chat, 요청은 handoff 인박스) |
| 2026-10-01 | 1.5: 11장 표에 계약 자산 행 추가 — 맵·카탈로그·팔레트를 바꾸면 `to-server`로 백엔드에 알림 (API_CONTRACT 2.1 9장) |
