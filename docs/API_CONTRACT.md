# API_CONTRACT — REST + SSE 계약

> 문서 버전: 2.3 (2026-10-01, 서버 구현 중 결정 요청 5건 반영)
> 상태: 확정
> 기준: DOMAIN.md 2.3, ARCHITECTURE.md 1.15
> 구현: 백엔드는 기존 API 저장소 `devple-stories`의 Commu 영역 (`net.devple.core.commu`, 문서 `docs/commu/ARCHITECTURE.md`가 구현 방식을 정한다)
> 이 문서는 **백엔드 구현의 유일한 기준**이다. 스키마의 원천은 DOMAIN.md이며, 여기서는 엔드포인트·이벤트·에러만 정의한다. 변경 시 반드시 버전을 올리고 프론트 Mock 핸들러를 함께 갱신한다.

---

## 1. 공통

### 1.1 기본
- Base URL: `/api/v1`
- 요청/응답 본문: `application/json; charset=utf-8`
- 시각: Unix epoch ms. 좌표: 타일 정수. ID: 불투명 문자열
- 모든 성공 응답은 **본문을 직접 반환** (`{ data: ... }` 래핑 없음)
- 목록 응답은 커서 페이지네이션 `{ items: T[], nextCursor: string | null }`

### 1.2 인증
- `Authorization: Bearer <accessToken>` — 아래 표에서 🔒 표시
- 🔒👑 = 운영자(`role: 'admin'`) 전용
- Refresh 토큰은 `refreshToken` httpOnly 쿠키. `Path=/api/v1/auth`, `Secure`, `SameSite=Strict`
- Access 토큰 유효 15분, Refresh 토큰 유효 14일 (백엔드 조정 가능, 프론트는 `expiresIn` 사용)

### 1.3 에러 형식
```json
{ "code": "AUTH_INVALID_KEY", "message": "사람이 읽을 수 있는 설명", "details": { } }
```

| HTTP | code | 상황 |
|---|---|---|
| 400 | `VALIDATION_FAILED` | 필드 검증 실패. `details.fields: { [필드경로]: 사유 }` (사유 어휘는 표 아래) |
| 400 | `MESSAGE_INVALID_CONTENT` | 제어 문자·비UTF-8·길이 초과 |
| 401 | `AUTH_REQUIRED` | 토큰 없음/만료 → 프론트는 refresh 후 1회 재시도 |
| 401 | `AUTH_INVALID_KEY` | 접근 키 불일치 |
| 403 | `USER_SUSPENDED` | 정지 회원 |
| 403 | `FORBIDDEN` | 권한 없음 (그룹 owner 아님 등) |
| 404 | `NOT_FOUND` | 리소스 없음. `details.resource` (예: `'user'`, `'group'`, `'message'`, `'presence'`) |
| 409 | `NICKNAME_TAKEN` | 닉네임 중복 |
| 409 | `EMAIL_TAKEN` | 이미 가입된 이메일, 또는 같은 이메일의 신청이 심사 대기 중 |
| 409 | `SIGNUP_ALREADY_REVIEWED` | 이미 처리된 신청 |
| 409 | `GROUP_FULL` | 인원 초과 |
| 409 | `POSITION_REJECTED` | 이동 검증 실패. 응답에 서버 인정 위치 포함 |
| 409 | `MESSAGE_ALREADY_READ` | 상대가 이미 읽어 DM 회수 불가 |
| 429 | `RATE_LIMITED` | `Retry-After` 헤더 포함 |
| 500 | `INTERNAL` | |

- `details.fields` 사유 어휘 (이 목록 밖의 값은 쓰지 않는다): `'required'` 필수 누락 · `'length'` 길이 위반(코드 포인트) · `'format'` 형식 위반(이메일·전화번호) · `'invalid'` 허용되지 않는 값·문자(제어 문자, 자기 자신에게 DM 등) · `'unknown'` 목록에 없는 ID · `'slot_mismatch'` 외형 슬롯 불일치
- 필드 경로는 요청 본문 기준 점 표기 (`nickname`, `appearance.top.primary`). 경로 파라미터는 이름 그대로 (`userId`)
- **프레임워크 단계 오류**도 위 표의 코드만 쓴다 (새 코드 없음):
  | 상황 | 응답 |
  |---|---|
  | 없는 경로 | `404 NOT_FOUND` (`details` 없음) |
  | 경로는 있고 메서드가 다름 (HTTP 405 상황) | `404 NOT_FOUND` |
  | 필수 쿼리 파라미터 누락 | `400 VALIDATION_FAILED`, `details.fields.<이름>: 'required'` |
  | 경로·쿼리 타입 불일치 | `400 VALIDATION_FAILED`, `details.fields.<이름>: 'invalid'` |
  | 잘못된 JSON 본문, 415, 406, 그 밖의 프레임워크 4xx | `400 VALIDATION_FAILED` (`details` 없음) |
  | 예상 못한 예외 | `500 INTERNAL` |

### 1.4 레이트 리밋 (권장값)
| 대상 | 제한 |
|---|---|
| `PUT /me/position` | 10회/초 |
| 메시지 전송 (공개/DM/그룹) | 5회/초, 60회/분 |
| 가입 신청 | 3회/시간/IP |
| 로그인 | 5회/분/IP |

---

## 2. REST 엔드포인트

### 2.1 가입 · 인증

| 메서드 | 경로 | 인증 | 설명 |
|---|---|---|---|
| POST | `/signup` | — | 가입 신청 |
| GET | `/signup/{requestId}` | — | 신청 상태 조회 |
| POST | `/auth/login` | — | 접근 키 로그인 |
| POST | `/auth/refresh` | 쿠키 | Access 재발급 |
| POST | `/auth/logout` | 🔒 | 로그아웃 (Refresh 무효화) |
| POST | `/sse/ticket` | 🔒 | SSE 접속 티켓 발급 |

**POST /signup**
```jsonc
// req
{ "email": "a@b.com", "nickname": "도트", "phone": "010-0000-0000" }
// 201
{ "requestId": "sr_01", "status": "pending" }
```
- 검증: email 형식, nickname 2~12자 유니크(대기 중 신청 포함), phone 숫자·하이픈 8~20자
- 실패: 형식·길이 → `400 VALIDATION_FAILED` (`fields.email: 'format'`, `fields.nickname: 'length' | 'invalid'`, `fields.phone: 'format'`), 닉네임 중복 → `409 NICKNAME_TAKEN`, 이메일 중복 → `409 EMAIL_TAKEN`
- 닉네임은 앞뒤 공백을 제거하고 저장한다. 중복 비교 규칙은 DOMAIN 8장
- 검사 순서: 필드 오류 `400`(모든 필드를 모아서) → `409 NICKNAME_TAKEN` → `409 EMAIL_TAKEN`. 이메일은 대소문자 무시
- `requestId`는 **추측할 수 없는 난수**다 (8장) — 인증 없는 조회 경로라 순번이면 다른 신청자의 상태와 거절 사유를 볼 수 있다
- 레이트 리밋(3회/시간/IP)은 `400`·`409`를 포함한 **모든 호출**을 센다 (어떤 닉네임·이메일이 있는지 더듬어 보는 것을 막음). `429`로 거부된 호출은 세지 않는다

**GET /signup/{requestId}**에서 없는 신청은 `404 NOT_FOUND`, `details.resource: 'signup'`

**GET /signup/{requestId}** → `200 { "status": "pending" | "approved" | "rejected", "rejectReason"?: string }`

**POST /auth/login**
```jsonc
// req
{ "accessKey": "ABCDE-FGHJK-MNPQR-STVWX" }
// 200  (+ Set-Cookie: refreshToken)
{ "accessToken": "eyJ...", "expiresIn": 900, "me": Me, "config": ServerConfig }
```
- 접근 키 형식: Crockford Base32 20자, 5자 × 4묶음. 서버는 입력을 **정규화**한다 — 공백·하이픈 무시, 대소문자 무시, 혼동 문자(`O`→`0`, `I`·`L`→`1`) 치환. 클라이언트는 형식을 검사하지 않고 앞뒤 공백만 제거해 보낸다
- 불일치·형식 오류 모두 `401 AUTH_INVALID_KEY` (구분하지 않음). 정지 회원은 `403 USER_SUSPENDED`

**POST /auth/refresh** → `200 { "accessToken", "expiresIn" }` (쿠키 회전: 새 refreshToken 발급)
- 폐기된 refresh를 다시 쓰면 `401 AUTH_REQUIRED` + 그 토큰 계열 전체 폐기 (도난 대응). **예외**: 회전된 지 **15초 안**인 토큰은 `401`만 주고 계열은 유지한다 — 같은 쿠키를 쓰는 여러 탭이 동시에 refresh해도 모두 로그아웃되지 않게
- 정지 회원의 refresh는 `401 AUTH_REQUIRED` + 계열 폐기
- `Origin` 헤더가 없거나 Commu 화면의 오리진(DEPLOYMENT 1.1)과 다르면 `403 FORBIDDEN` (`/auth/logout`도 같음)

**POST /auth/logout** → `204` + `Set-Cookie: refreshToken=; Max-Age=0` (같은 `Path`). 서버는 해당 Refresh를 무효화한다. 열린 SSE 연결은 클라이언트가 닫는다

**POST /sse/ticket** → `201 { "ticket": "t_...", "expiresIn": 30 }` — 1회용

### 2.2 본인

| 메서드 | 경로 | 인증 | 설명 |
|---|---|---|---|
| GET | `/me` | 🔒 | 내 정보 + config (새로고침 후 세션 복구용) |
| PATCH | `/me` | 🔒 | 닉네임·상태 메시지·아바타 수정 |
| PUT | `/me/position` | 🔒 | 위치 갱신 (배칭) |
| PUT | `/me/presence` | 🔒 | `online` / `away` 전환 |

**GET /me** → `200 { "me": Me, "config": ServerConfig }`

**PATCH /me** — body: `{ nickname?, statusMessage?, appearance? }` → `200 Me`
- `appearance`는 **전체 교체** (DOMAIN 3.7). 일부 키만 보내는 부분 갱신은 없다
- 검증 실패 응답 (여러 필드가 동시에 틀리면 `details.fields`에 모두 담는다):

| 조건 | 응답 |
|---|---|
| `nickname` 2~12자 위반 | `400 VALIDATION_FAILED`, `details.fields.nickname: 'length'` |
| `statusMessage` 40자 초과 | `400 VALIDATION_FAILED`, `details.fields.statusMessage: 'length'` |
| `appearance`의 키 누락, 또는 필수 슬롯(`top`·`bottom`·`shoes`)이 `null` | `400 VALIDATION_FAILED`, `details.fields['appearance.<키>']: 'required'` |
| 아이템이 `avatarOptions.itemIds`에 없음 | `400 VALIDATION_FAILED`, `details.fields['appearance.<슬롯>']: 'unknown'` |
| `itemId` 접두사가 슬롯 키와 다름 | `400 VALIDATION_FAILED`, `details.fields['appearance.<슬롯>']: 'slot_mismatch'` |
| 램프 ID가 해당 목록(`skin`→`skinRampIds`, `hairColor`→`hairRampIds`, `primary`·`secondary`→`itemRampIds`)에 없음 | `400 VALIDATION_FAILED`, `details.fields['appearance.<경로>']: 'unknown'` (예: `appearance.top.primary`, `appearance.skin`) |
| `nickname`이 다른 회원·대기 중 가입 신청과 중복 | `409 NICKNAME_TAKEN` |

- 길이는 코드 포인트 기준 (DOMAIN 5.1과 동일). 성공 시 같은 맵 접속자에게 `presence.updated`(변경된 `nickname`·`appearance`만) 전송

**PUT /me/position**
```jsonc
// req
{ "mapId": "main", "x": 12, "y": 7, "dir": "down", "seq": 1042 }
// 204  (정상)
// 409 POSITION_REJECTED
{ "code": "POSITION_REJECTED", "message": "...", "details": { "position": Position, "seq": 1041, "reason": "occupied" } }
```
- `seq`는 클라이언트가 **`Date.now()` 밀리초 정수**로 생성. 서버는 사용자 단위로 마지막 인정 seq를 보관하고, 작거나 같으면 **204로 무시** (에러 아님). 다중 탭은 같은 시계를 쓰므로 나중 요청이 자연히 이김
- 검증 (순서대로):
  1. collision=0
  2. 이전 인정 위치에서 도달 가능 거리: `max(3, elapsedMs / 100)` 타일 이내 (체비쇼프 거리). 하한 3타일은 200ms 배칭 중 이동량 + 네트워크 지연 여유
  3. **해당 타일에 다른 Presence 없음** — 같은 타일로의 동시 요청은 서버 수신 순서로 선착순 판정
- 검증 실패 시 `409 POSITION_REJECTED`, `details.position` = 서버가 인정하는 현재 위치(마지막 성공 위치), `details.reason` = `'collision' | 'too_far' | 'occupied'`
- 409 수신 시 프론트는 `details.position`으로 즉시 보정. `occupied`면 경로 재계산 (ARCHITECTURE 3.2.1)
- 점유 판정은 서버의 **원자적 연산**이어야 함 (같은 타일에 2명이 기록되는 일이 없도록)
- SSE가 연결되지 않아 Presence가 없으면 `404 NOT_FOUND`, `details.resource: 'presence'` (프론트는 `world.snapshot`을 받은 뒤에만 이동을 보낸다). `mapId`가 현재 맵과 다르면 `400 VALIDATION_FAILED fields.mapId: 'invalid'`

**PUT /me/presence** — body: `{ "state": "online" | "away" }` → `204`

### 2.3 사용자 조회

| 메서드 | 경로 | 인증 | 설명 |
|---|---|---|---|
| GET | `/users/{userId}` | 🔒 | 프로필 카드 |
| GET | `/users?nickname={q}` | 🔒 | 닉네임 검색 (부분 일치, `q` 1자 이상, 최대 20건, 본인 제외) |

**GET /users/{userId}** → `200 UserProfile`
**GET /users?nickname=도** → `200 { "items": UserProfile[] }` (페이지네이션 없음)

### 2.4 월드

| 메서드 | 경로 | 인증 | 설명 |
|---|---|---|---|
| GET | `/world/{mapId}/presences` | 🔒 | 현재 접속자 전체 (SSE 단절 후 재동기화용) |

→ `200 { "mapId": "main", "presences": Presence[], "serverTime": number }`

### 2.5 공개 근접 대화

| 메서드 | 경로 | 인증 | 설명 |
|---|---|---|---|
| POST | `/chat/public` | 🔒 | 근접 메시지 전송 |

```jsonc
// req
{ "content": "안녕하세요 https://example.com" }
// 201
PublicMessage   // links: ["https://example.com"], position: 서버가 인정한 발신자 현재 위치
```
- 서버가 `position` 기준 `proximityRadius` 내 접속자(본인 포함)에게 `chat.public` 이벤트 전송
- 발신자 Presence가 없으면(SSE 미연결) `404 NOT_FOUND`, `details.resource: 'presence'`
- 히스토리 API 없음

### 2.6 DM

| 메서드 | 경로 | 인증 | 설명 |
|---|---|---|---|
| GET | `/dm` | 🔒 | 내 대화 목록 (최근순) |
| GET | `/dm/{userId}/messages` | 🔒 | 상대와의 메시지 히스토리 |
| POST | `/dm/{userId}/messages` | 🔒 | 전송 (대화 없으면 자동 생성) |
| POST | `/dm/messages/{messageId}/recall` | 🔒 | 내 메시지 회수 (상대 미열람 시에만) |
| POST | `/dm/{userId}/read` | 🔒 | 읽음 처리 |

**GET /dm** → `200 { "items": DmConversationWithPeer[], "nextCursor" }` (DOMAIN 9장). 정렬: `updatedAt` 내림차순 (최근 활동 먼저)

**GET /dm/{userId}/messages?cursor=&limit=50** → `200 { "items": DmMessage[], "nextCursor" }` — 최신순, `cursor`는 이전 페이지의 가장 오래된 messageId

**POST /dm/{userId}/messages** — body `{ "content" }` → `201 DmMessage`
- 대상이 `suspended`이면 `403 FORBIDDEN`, 없으면 `404`, 자기 자신이면 `400 VALIDATION_FAILED fields.userId: 'invalid'`
- 서버는 양쪽에 `chat.dm` 이벤트 전송 (발신자에게도 보내 다중 탭 동기화)

**POST /dm/messages/{id}/recall** → `204` (양쪽에 `chat.dm.recalled`)
- 조건: 본인 메시지 && `readAt == null`. 이미 읽었으면 `409 MESSAGE_ALREADY_READ`
- 회수된 메시지는 서버에서 **실제 제거**. 히스토리에도 남지 않음
- 그 외 수정·삭제 API는 없다 — 한번 전송된 메시지는 **불변**

**POST /dm/{userId}/read** — body `{ "lastMessageId" }` → `204` (상대에게 `chat.dm.read`)

### 2.7 그룹

| 메서드 | 경로 | 인증 | 설명 |
|---|---|---|---|
| GET | `/groups` | 🔒 | 내가 속한 그룹 목록 |
| POST | `/groups` | 🔒 | 생성 (생성자 = owner) |
| GET | `/groups/{groupId}` | 🔒 | 그룹 상세 + 멤버 |
| PATCH | `/groups/{groupId}` | 🔒 owner | 이름 변경 |
| DELETE | `/groups/{groupId}` | 🔒 owner | 해산 |
| POST | `/groups/{groupId}/members` | 🔒 owner | 초대 `{ userId }` |
| DELETE | `/groups/{groupId}/members/{userId}` | 🔒 | owner: 강퇴 / 본인: 나가기 |
| GET | `/groups/{groupId}/messages` | 🔒 멤버 | 히스토리 |
| POST | `/groups/{groupId}/messages` | 🔒 멤버 | 전송 |
| POST | `/groups/{groupId}/read` | 🔒 멤버 | 읽음 처리 `{ lastMessageId }` |

**GET /groups** → `200 { "items": GroupListItem[] }` (DOMAIN 9장). 정렬: 최근 활동 먼저 — `lastMessage.createdAt`, 메시지가 없으면 `createdAt` 기준 내림차순
**POST /groups** — body `{ "name" }` → `201 Group`
- `name` 2~20자(코드 포인트) 위반 → `400 VALIDATION_FAILED`, `details.fields.name: 'length'` (PATCH도 동일)
**GET /groups/{id}** → `200 GroupDetail` = `{ group: Group, members: GroupMemberWithUser[] }`
**PATCH /groups/{id}** — body `{ "name" }` → `200 Group` (전 멤버에게 `group.updated`). owner가 아니면 `403 FORBIDDEN`
**DELETE /groups/{id}** → `204`. 멤버 전원(owner 포함)에게 `group.removed { reason: 'dissolved' }`. owner가 아니면 `403 FORBIDDEN`
**POST /groups/{id}/members** — body `{ "userId" }` → `201 GroupMember` / `409 GROUP_FULL`
- 초대는 즉시 가입 (수락 절차 없음). 초대된 사용자에게 `group.joined`, 기존 멤버에게 `group.updated`
- 초대된 멤버의 `lastReadMessageId`는 그 시점 마지막 메시지 → 안 읽음 0에서 시작. 가입 전 메시지도 히스토리로 읽을 수 있다 (DOMAIN 5.4). `POST /groups`의 owner도 같은 규칙
**DELETE /groups/{id}/members/{userId}** → `204`
- owner가 타인을 지정: **강퇴**. 대상에게 `group.removed { reason: 'kicked' }`, 남은 멤버에게 `group.updated`
- 본인을 지정: **나가기**. 본인(모든 탭)에게 `group.removed { reason: 'left' }`, 남은 멤버에게 `group.updated`. owner가 나가면 가장 오래된 `joinedAt` 멤버가 owner를 승계하고 같은 `group.updated`에 반영. 마지막 멤버가 나가면 그룹 삭제 (남은 멤버 없으므로 `group.updated` 없음)
- owner가 아닌 사람이 타인을 지정 → `403 FORBIDDEN`. 대상이 멤버가 아니면 `404 NOT_FOUND`
**GET /groups/{id}/messages?cursor=&limit=50** → DM과 동일 구조
**POST /groups/{id}/read** — body `{ "lastMessageId" }` → `204` (`GroupMember.lastReadMessageId` 갱신, 이벤트 없음)
**POST /groups/{id}/messages** — body `{ "content" }` → `201 GroupMessage` (전 멤버에게 `chat.group`)
- 서버는 발신자의 `lastReadMessageId`를 새 메시지로 갱신한다 (내 메시지는 안 읽음에 세지 않음, DOMAIN 5.4)

### 2.8 운영자

| 메서드 | 경로 | 인증 | 설명 |
|---|---|---|---|
| GET | `/admin/signups?status=pending` | 🔒👑 | 신청 목록 |
| POST | `/admin/signups/{id}/approve` | 🔒👑 | 승인 → User 생성 + 키 발급 + 메일 |
| POST | `/admin/signups/{id}/reject` | 🔒👑 | 거절 `{ reason }` |
| GET | `/admin/users?status=&cursor=` | 🔒👑 | 회원 목록 |
| POST | `/admin/users/{id}/suspend` | 🔒👑 | 정지 → SSE 강제 종료 |
| POST | `/admin/users/{id}/unsuspend` | 🔒👑 | 해제 |
| POST | `/admin/users/{id}/reissue-key` | 🔒👑 | 접근 키 재발급 → 기존 키·Refresh 무효 + 새 키 이메일 |
| POST | `/admin/notices` | 🔒👑 | 공지 `{ content }` → 전체 `system.notice` |

**GET /admin/signups** → `200 { "items": SignupRequest[], "nextCursor" }`
- 정렬: `status=pending`이면 **오래된 순**(먼저 온 신청부터 심사), 그 밖(`approved`·`rejected`·미지정)은 **최신순**. 한 페이지 50건, `cursor` = 이전 응답의 `nextCursor`
- 심사(`approve`·`reject`) 검사 순서: 없는 신청 `404 NOT_FOUND details.resource: 'signup'` → 이미 처리됨 `409 SIGNUP_ALREADY_REVIEWED` → 필드 검사
**POST /admin/signups/{id}/approve** → `200 { "userId": string }` / `409 SIGNUP_ALREADY_REVIEWED`
**POST /admin/signups/{id}/reject** — body `{ "reason" }` (1~200자, 필수) → `204` / `409 SIGNUP_ALREADY_REVIEWED`. 신청자는 `GET /signup/{requestId}`의 `rejectReason`으로 확인
- `reason` 없음 → `fields.reason: 'required'`, 공백뿐이거나 앞뒤 공백 제거 후 200자 초과 → `'length'`. 공백을 제거한 값을 저장
**GET /admin/users** → `200 { "items": Me[], "nextCursor" }` (email/phone 포함)
**POST /admin/users/{id}/suspend** → `204`. 대상의 Refresh 전부 무효, 접속 중이면 `system.suspended` 전송 후 SSE 종료. 이미 정지 상태여도 `204` (멱등). 자기 자신은 `403 FORBIDDEN`
**POST /admin/users/{id}/unsuspend** → `204` (멱등). 대상은 기존 접근 키로 다시 로그인한다
**POST /admin/notices** — body `{ "content" }` → `201 Notice`, 접속자 전원에게 `system.notice`. `content`는 메시지와 같은 규칙(DOMAIN 5.1) — 위반 시 `400 MESSAGE_INVALID_CONTENT`
**POST /admin/users/{id}/reissue-key** → `204`. 기존 접근 키 즉시 무효, 해당 사용자의 Refresh 토큰 전부 무효(접속 중이면 다음 refresh에서 재로그인 유도), 새 키 이메일 발송. 사용자 셀프 재발급 API는 없다 (폐쇄형 원칙)

---

## 3. SSE

### 3.1 연결
```
GET /api/v1/sse?ticket=t_xxx&lastEventId=1234
Accept: text/event-stream
```
- `ticket`: `POST /sse/ticket`으로 받은 1회용 티켓 (필수)
- `lastEventId`: 마지막으로 수신한 이벤트 `id` (재연결 시, 선택). 서버는 `Last-Event-ID` 헤더와 이 쿼리 중 **있는 것을 사용**하고 둘 다 있으면 쿼리 우선
- 티켓 무효/만료/재사용 → `401` (본문 없이 종료). 프론트는 티켓 재발급 후 새 연결
- 응답 헤더: `Cache-Control: no-cache`, `X-Accel-Buffering: no` (프록시 버퍼링 방지)
- 서버는 연결 즉시 `world.snapshot` 전송, 이후 15초마다 `system.heartbeat` 이벤트 전송. SSE 주석(`: ping`)은 브라우저 `EventSource` API가 JS에 전달하지 않아 클라이언트 무수신 감시에 쓸 수 없으므로 이벤트로 보낸다
- `lastEventId`가 있으면 서버는 60초 버퍼에서 그 이후 이벤트를 `world.snapshot` **뒤에** 재전송. 버퍼 밖이면 `sync.required` 전송
- 사용자당 동시 SSE 연결 최대 3개 (다중 탭). 초과 시 가장 오래된 연결 종료

### 3.2 이벤트 형식
```
id: 1234
event: chat.public
data: {"id":"1234","type":"chat.public","ts":1727600000000,"payload":{...}}

```
- `id`와 `data.id` 동일. `event`와 `data.type` 동일 (EventSource `addEventListener(type)` 과 `onmessage` 양쪽 대응)
- `payload` 스키마는 아래 표

### 3.3 이벤트 목록

| type | 대상 | payload |
|---|---|---|
| `world.snapshot` | 접속자 본인 | `{ mapId, presences: Presence[], serverTime }` — 본인 Presence 포함, 서버가 배치한 초기 위치 |
| `world.positions` | 같은 맵 전원 | `{ mapId, positions: { userId, x, y, dir }[] }` — 200ms 틱, 변경분만. **본인 포함**. 클라이언트는 본인 항목을 무시하고 내 위치 보정은 `PUT /me/position` 응답으로만 한다 |
| `presence.joined` | 같은 맵 전원 | `Presence` |
| `presence.left` | 같은 맵 전원 | `{ userId }` |
| `presence.updated` | 같은 맵 전원 | `{ userId, state?: 'online'\|'away', nickname?, appearance? }` — 렌더에 필요한 필드만. `appearance`는 바뀔 때 전체를 보낸다. statusMessage는 프로필 카드 REST로 조회 |
| `chat.public` | 반경 내 접속자 | `ChatPublicEvent` (DOMAIN 9장) |
| `chat.dm` | 대화 양측 | `ChatDmEvent` = `DmMessage & { sender: User, peerId }`. `peerId`는 **수신자 관점의 상대** (발신자 자기 사본에는 수신자 ID). 첫 DM은 수신자에게 대화 캐시가 없으므로 필수 |
| `chat.dm.recalled` | 대화 양측 | `{ conversationId, messageId }` |
| `chat.dm.read` | 발신자 | `{ conversationId, readerId, lastMessageId, readAt }` |
| `chat.group` | 그룹 전원 | `ChatGroupEvent` = `GroupMessage & { sender: User }` |
| `group.joined` | 초대된 사용자 | `Group` |
| `group.updated` | 그룹 전원 | `GroupUpdatedEvent` = `Group & { members: GroupMemberWithUser[] }` — 이름 변경, owner 승계, 멤버 변동 |
| `group.removed` | 강퇴·해산 대상, 나간 본인 | `{ groupId, reason: 'kicked'\|'dissolved'\|'left' }` — `left`는 나간 사용자의 다른 탭 동기화용 |
| `system.notice` | 전원 | `Notice` |
| `system.suspended` | 본인 | `{}` — 직후 서버가 연결 종료 |
| `system.heartbeat` | 본인 | `{ serverTime }` — 15초 간격. 클라이언트는 30초 무수신 시 재연결 (ARCHITECTURE 4.1) |
| `sync.required` | 본인 | `{ reason: 'buffer_overflow' \| 'server_restart' }` |

### 3.4 순서 보장
- 단일 SSE 연결 내 이벤트 순서는 `id` 오름차순으로 보장
- `world.positions`, `presence.*`, `system.heartbeat`는 재전송 버퍼에 **넣지 않는다** — positions는 다음 틱이 덮어쓰고, presence는 재연결 시 `world.snapshot`이 먼저 와서 복구되며, heartbeat는 생존 신호일 뿐이다
- `chat.*`, `group.*`, `system.*`는 버퍼에 넣는다

### 3.5 프론트 재동기화 절차 (`sync.required` 또는 60초 초과 단절)
1. `GET /world/{mapId}/presences` → worldStore 교체
2. `GET /dm`, `GET /groups` → TanStack Query 무효화
3. 열려 있는 DM/그룹 패널의 히스토리 최신 페이지 재조회

---

## 4. 시퀀스 예시

### 4.1 접속
```
POST /auth/login ──▶ accessToken + me + config
POST /sse/ticket ──▶ ticket
GET  /sse?ticket ──▶ world.snapshot → 렌더 시작
                     (이후 world.positions 200ms 틱)
```

### 4.2 근접 대화
```
A: POST /chat/public {content}
서버: A 위치 기준 반경 내 B, C 판정
서버 ──chat.public──▶ A, B, C   (D는 범위 밖, 수신 없음)
```

### 4.3 범위 밖 DM
```
A: POST /dm/{B}/messages {content}
서버 ──chat.dm──▶ A, B
B 클라이언트: A가 내 근접 범위 안? → 예: DM 말풍선 + 패널 / 아니오: 패널만
```

---

## 5. Mock 계약
- `src/mocks/handlers/*.ts`는 이 문서의 예시 응답을 그대로 사용
- `src/mocks/sse-server.ts`는 3.3 이벤트를 모두 발생시킬 수 있어야 함 (개발용 트리거 UI 제공)
- 계약 변경 시 Mock과 문서를 같은 PR에서 수정

## 6. 결정 이력
| 날짜 | 결정 |
|---|---|
| 2026-09-29 | 그룹 초대 즉시 가입, DM 이벤트 발신자에게도 전송, positions 버퍼 제외, SSE 3연결, Access 15분/Refresh 14일 |
| 2026-09-29 | 전송된 메시지는 삭제 불가. DM만 상대 미열람 시 회수 가능. 그룹 메시지 삭제 API 없음 |
| 2026-09-29 | 메시지 수정 금지. 전송 후 불변 (DM 미열람 회수만 예외) |
| 2026-09-29 | 위치 검증에 점유 조건 추가, `details.reason` 필드 추가 |
| 2026-09-29 | 교차 검토: `GET /me` 응답 정의, SSE `lastEventId` 쿼리 추가, `presence.updated`에서 statusMessage 제거 |
| 2026-09-29 | 1.2 (ROADMAP 선행 결정): seq=`Date.now()`, 이동 검증 `max(3, elapsedMs/100)`, positions 본인 포함·클라이언트 무시, `chat.dm.peerId`, 그룹 read body, 합성 타입명 DOMAIN 9장 참조, `presence.*` 버퍼 제외, `POST /admin/users/{id}/reissue-key` 추가 (엔드포인트 37개) |
| 2026-09-30 | 1.3: 하트비트를 SSE 주석에서 `system.heartbeat` 이벤트(15초, `{ serverTime }`, 버퍼 제외)로 변경 — EventSource가 주석을 관찰할 수 없어 30초 무수신 감시가 동작하지 않았음. 이벤트 17종 |
| 2026-09-30 | 1.4: `PATCH /me` 검증 실패 응답 명시(`details.fields.avatarId: 'unknown'` 등), 성공 시 `presence.updated` 발송 명시. `ServerConfig.avatarIds`는 DOMAIN 1.4 (로그인·`GET /me` 응답의 `config`에 포함) |
| 2026-09-30 | 1.5 (결정 리포트 7번): 응답 미정의 엔드포인트 명시 — `POST /auth/logout` 204, `PATCH /groups/{id}` 200 Group, `DELETE /groups/{id}` 204, `DELETE /groups/{id}/members/{userId}` 204, `reject` 204(reason 필수), `suspend`·`unsuspend` 204(멱등), `POST /admin/notices` 201 Notice. 그룹 이름 검증 응답, 초대 시 기존 멤버 `group.updated`, `group.removed`에 `'left'` 추가(다중 탭) |
| 2026-09-30 | 1.6 (Claude Code 결정 요청): 그룹 메시지 전송 시 발신자 `lastReadMessageId` 갱신, `GET /groups` 정렬(최근 활동 먼저, 안 A), `GET /dm` 정렬 기준 `updatedAt` 명시 |
| 2026-09-30 | **2.0 (호환 깨짐, DOMAIN 2.0)**: `avatarId` → `appearance`. `PATCH /me`는 `appearance` 전체 교체 + 검증 실패 4종(`required`·`unknown`·`slot_mismatch`, 필드 경로 `appearance.<경로>`), `presence.updated`는 `appearance` 전체. `User`·`Presence`를 싣는 모든 응답·이벤트(`world.snapshot`, `presence.joined`, `GET /users/*`, DM·그룹의 `User`)가 함께 바뀐다. `chat.public`의 sender는 nickname만 |
| 2026-09-30 | 2.1 (서버 설계 중 발견): `409 EMAIL_TAKEN` 추가, `details.fields` 사유 어휘 고정(`required`·`length`·`format`·`invalid`·`unknown`·`slot_mismatch`), 가입 검증 실패 매핑, 접근 키 형식(Crockford 20자)과 서버 정규화, Presence 없을 때 위치·공개 대화 `404 resource: 'presence'`, 자기 자신에게 DM `400 invalid`. 8장 백엔드 결정 기록, 9장 계약 자산 신설 |
| 2026-10-01 | 2.2: 백엔드 구현 저장소를 기존 `devple-stories`로 확정(사용자). 8장: 전용 Deployment(Pod 1), Stories와 회원·인증 분리, ID는 IDENTITY 문자열(기존 저장소 관례). 엔드포인트·필드 변경 없음 |
| 2026-10-01 | 2.3 (서버 결정 요청 5건): 1.3 프레임워크 오류 매핑(새 코드 없음), 2.1 가입 검사 순서·`404 resource: 'signup'`·레이트 리밋은 모든 호출 집계, refresh 15초 다중 탭 유예·정지 회원 401·`Origin` 불일치 `403 FORBIDDEN`, 2.7 초대 멤버 안 읽음 0 시작·이전 대화 열람, 2.8 심사 목록 정렬(대기는 오래된 순, 그 밖 최신순, 50건)·거절 사유 규칙, 8장 가입 신청 ID는 128비트 난수 예외. 요청·응답 모양 변경 없음 |

## 7. 운영 중 조정 가능한 값 (계약 변경 없이 백엔드가 조정)
- `PUT /me/position` 이동 검증 관대함 (`max(3, elapsedMs/100)`)
- 사용자당 SSE 동시 연결 수 (3)
- 재전송 버퍼 보관 시간 (60초), 하트비트 간격 (15초)
- 레이트 리밋 수치

## 8. 백엔드 결정 사항 (프론트 무관, 2026-09-30 확정)
상세는 `devple-stories/docs/commu/ARCHITECTURE.md`
- 배치: 기존 Stories API와 같은 이미지의 **전용 Deployment(Pod 1개)**. Stories의 다중 Pod와 무관하게 Commu 실시간 상태는 항상 한 곳에 있다
- 회원·인증: Stories 회원(`users`)·토큰과 완전히 분리. Stories 토큰으로는 이 계약의 API를 쓸 수 없다
- 이메일 발송: outbox + 재시도. 발송 실패는 승인을 **되돌리지 않는다** (관리자가 키 재발급으로 다시 보냄)
- 근접 공개 대화: DB에 저장하지 않는다 (재전송 버퍼 60초에만)
- ID: DB IDENTITY 정수를 문자열로 (예: `"1234"`). 값이 커지는 순서가 생성 순서와 같다. 프론트는 계속 불투명 문자열로 취급한다 (파싱·비교 금지)
  - **예외**: 가입 신청 ID(`requestId`, `SignupRequest.id`)는 128비트 난수 Base64URL 22자 (예: `Xq3f0Y2kR8m1Zp7vT4aW9A`). 인증 없는 조회 경로(`GET /signup/{requestId}`)라 순번을 쓰지 않는다
- 접근 키: 2.1 형식, HMAC 해시로만 저장
- 첫 관리자: 서버 기동 시 설정값으로 1명 생성 (API 없음)
- SSE 이벤트 `id`: 기동 시각 기반 단조 증가 — 재시작 후에도 이전 값보다 크다. 프론트는 문자열 그대로 돌려보낸다

## 9. 계약 자산 (프론트·서버가 같은 내용을 가져야 하는 파일)
| 자산 | 원본 (프론트 저장소) | 서버가 쓰는 부분 |
|---|---|---|
| 맵 | `src/assets/maps/<mapId>.json` | `width`·`height`·`spawn`·`collision` (위치 검증) |
| 아바타 카탈로그 | `src/assets/sprites/avatar/catalog.json` | `items[].id` → `ServerConfig.avatarOptions.itemIds` 기본값 |
| 팔레트 | `src/assets/palette.json` | `rampGroups` → `skin/hair/itemRampIds` 기본값 |

- **원본은 프론트 저장소**다. 서버는 동기화 스크립트로 사본을 만들고 원본 커밋·sha256을 기록한다
- 위 파일을 바꾸는 프론트 변경은 `docs/handoff/to-server/`로 서버에 알린다. 맵의 `collision`·스폰이나 아이템·램프 ID가 어긋나면 위치 거부·외형 거부가 생긴다
- 새 아이템은 GRAPHICS 2.8 순서(그림 먼저 → 서버 목록)를 따른다
