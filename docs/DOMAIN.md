# DOMAIN — 도메인 모델

> 문서 버전: 2.2 (2026-10-01, 닉네임 제어 문자 명시)
> 상태: 확정
> 목적: 프론트 `src/domain/types.ts`와 백엔드 엔티티가 공유하는 단일 기준. 여기 정의된 타입이 API_CONTRACT.md의 스키마 원천이다.

---

## 1. 공통 규칙

- 모든 ID는 문자열. 형식은 백엔드가 정하되 프론트는 **불투명 문자열**로 취급 (파싱하지 않음)
- 시각은 **Unix epoch 밀리초** (`number`). ISO 문자열 사용 안 함
- 좌표는 **타일 단위 정수**. 픽셀 좌표는 프론트 렌더 내부에서만 존재
- 열거형은 소문자 스네이크 문자열 리터럴 (`'pending' | 'approved'`)
- 옵셔널 필드는 `?`. `null`은 "값을 명시적으로 비움"일 때만 사용

## 2. 엔티티 관계

```
SignupRequest ──(승인)──▶ User ──1:1──▶ AccessKey
                            │
            ┌───────────────┼──────────────────┐
            ▼               ▼                  ▼
       Presence      DmConversation       GroupMember ──▶ Group
     (위치·상태)     (user ↔ user)                        │
                            │                              ▼
                            ▼                        GroupMessage
                       DmMessage

       PublicMessage (근접 대화, 대화방 없음)
```

## 3. 사용자 · 인증

### 3.1 User
```ts
interface User {
  id: string;
  nickname: string;          // 2~12자, 유니크 (비교 규칙은 8장)
  appearance: Appearance;    // 외형 (3.7)
  statusMessage?: string;    // 최대 40자
  role: 'member' | 'admin';
  status: 'active' | 'suspended';
  createdAt: number;
}
```
- `email`, `phone`은 **User에 포함하지 않는다**. 본인 정보 조회(`Me`)와 운영자 콘솔에서만 노출

### 3.2 UserProfile (캐릭터 클릭 시 조회)
```ts
interface UserProfile {
  user: User;
  online: boolean;
  position?: Position;       // 접속 중일 때만
}
```

### 3.3 Me (본인 확장 정보)
```ts
interface Me extends User {
  email: string;
  phone: string;
}
```

### 3.4 SignupRequest
```ts
interface SignupRequest {
  id: string;
  email: string;
  nickname: string;
  phone: string;
  status: 'pending' | 'approved' | 'rejected';
  rejectReason?: string;
  createdAt: number;
  reviewedAt?: number;
  reviewedBy?: string;       // admin userId
}
```
- 상태 전이: `pending → approved` 또는 `pending → rejected`. 되돌림 없음
- 승인 시 User 생성 + AccessKey 발급 + 이메일 발송이 **하나의 트랜잭션**

### 3.5 AccessKey (프론트는 값만 입력, 엔티티 조회 없음)
```ts
interface AccessKeyLogin {
  accessKey: string;         // 이메일로 받은 키, 형식은 백엔드 정의
}
interface AuthSession {
  accessToken: string;       // JWT, 메모리 보관
  expiresIn: number;         // 초
  me: Me;
  config: ServerConfig;
}
```

### 3.6 ServerConfig (로그인 응답에 포함)
```ts
interface ServerConfig {
  proximityRadius: number;     // 근접 반경 (타일), 기본 5
  positionBatchMs: number;     // 이동 전송 주기, 기본 200
  serverTickMs: number;        // 위치 브로드캐스트 주기, 기본 200
  maxMessageLength: number;    // 기본 200
  defaultMapId: string;
  maxGroupMembers: number;     // 기본 10
  avatarOptions: {             // 외형 선택지의 원천 (GRAPHICS 2.7·2.8)
    itemIds: string[];         // 선택 가능한 아이템. ID 접두사로 슬롯을 판별 ('hat_beanie' → hat)
    skinRampIds: string[];
    hairRampIds: string[];
    itemRampIds: string[];     // primary·secondary 공통
  };
}
```
- 프론트는 이 값을 하드코딩하지 않고 항상 서버 값을 사용
- `avatarOptions`의 각 목록은 순서가 있다 (선택 UI 표시 순서). 비어 있지 않으며, 필수 슬롯(`top`·`bottom`·`shoes`)은 각각 1개 이상의 아이템을 갖는다
- 모든 목록 안의 값은 **처음부터 누구나 고를 수 있다** (보유·획득 개념 없음, 사용자 결정 2026-09-30)

### 3.7 Appearance (캐릭터 외형)
```ts
type SlotId = 'hair' | 'hat' | 'face' | 'top' | 'bottom' | 'shoes' | 'hand';

interface EquippedItem {
  itemId: string;            // '<slot>_<name>' (GRAPHICS 2.8). 접두사 = 들어간 슬롯 키
  primary?: string;          // itemRampId. 생략 시 아이템 기본색
  secondary?: string;        // itemRampId. 생략 시 아이템 기본색
}

interface Appearance {
  skin: string;              // skinRampId
  hairColor: string;         // hairRampId
  hair: EquippedItem | null; // null = 민머리
  hat: EquippedItem | null;
  face: EquippedItem | null;
  top: EquippedItem;         // 필수
  bottom: EquippedItem;      // 필수
  shoes: EquippedItem;       // 필수
  hand: EquippedItem | null;
}
```
- **모든 키가 항상 존재**한다. 선택 슬롯이 비어 있으면 `null`로 명시 (부분 객체 없음)
- 각 슬롯의 `itemId` 접두사는 슬롯 키와 같아야 한다 (`hat` 슬롯에 `top_hoodie` 불가)
- `hair` 슬롯의 `primary`는 쓰지 않는다 (머리카락 색은 `hairColor`). 보내면 서버는 저장하지 않고 버린다
- 외형 편집은 `PATCH /me { appearance }`로 **전체 교체**한다. 부분 갱신 없음
- 가입 승인 시 서버가 유효한 기본 외형을 배정한다 (방식은 백엔드 재량)
- 렌더링(레이어 순서·색 치환·캐시)은 GRAPHICS 2.6~2.9

## 4. 공간 · 위치

### 4.1 Position
```ts
type Direction = 'up' | 'down' | 'left' | 'right';

interface Position {
  mapId: string;
  x: number;                 // 타일 X (0-based)
  y: number;                 // 타일 Y
  dir: Direction;
}
```

### 4.2 Presence (접속 중인 사용자 1명의 월드 상태)
```ts
interface Presence {
  userId: string;
  nickname: string;          // 스냅샷에 포함해 User 조회 없이 렌더
  appearance: Appearance;    // 3.7
  position: Position;
  state: 'online' | 'away';
  updatedAt: number;
}
```
- `Presence`는 서버 메모리 상태이며 영속 저장 대상이 아님
- 접속 끊김 후 서버 유예 시간(권장 10초) 내 재접속하면 위치 유지

### 4.3 MapData (정적 자산, 프론트 `assets/maps/*.json`)
```ts
interface MapData {
  id: string;
  width: number;             // 타일 수
  height: number;
  tileSize: 16;
  tileset: string;           // 타일셋 ID (GRAPHICS 3장). 맵당 1개
  spawn: { x: number; y: number };
  layers: TileLayer[];       // 그리기 순서대로. 표준 구성은 GRAPHICS 4장 (floor / objects / overhead)
  collision: number[];       // width*height, 0=통행 1=차단
}
interface TileLayer {
  name: string;
  order: 'below' | 'above';  // 캐릭터 아래/위
  tiles: number[];           // width*height, 타일셋 인덱스 (-1=빈칸)
}
```
- 서버는 collision 배열을 동일하게 보유해 이동 검증
- **점유 규칙**: 정적 `collision`과 별도로, 접속자 위치(`Presence.position`)도 동적 차단으로 취급. 한 타일에는 Presence 1개만 존재할 수 있다
- `spawn`이 점유되어 있으면 서버가 가장 가까운 빈 타일(BFS)에 배치
- 이미지·타일셋·스프라이트 규격은 **GRAPHICS.md**가 기준. `tileset`은 `src/assets/tilesets/<id>.tileset.json`을 가리킨다

## 5. 메시지

### 5.1 공통
```ts
interface MessageBase {
  id: string;
  senderId: string;
  content: string;           // 1~maxMessageLength자, 공백만은 불가
  links: string[];           // 서버가 content에서 추출한 URL 목록 (없으면 [])
  createdAt: number;
}
```

**불변성**: 모든 메시지는 전송 후 수정·삭제 불가. 유일한 예외는 DM의 미열람 회수(5.3).

**content 규칙 (서버 검증 필수)**
- 유효한 **UTF-8 유니코드 문자열**만 허용. 바이너리·Base64 데이터·첨부 개념 없음
- 허용 문자: 출력 가능 문자 + 이모지 + 줄바꿈(`\n`). 그 외 제어 문자(U+0000~U+001F, U+007F, U+200B~U+200F 등 보이지 않는 문자)는 거부 또는 제거
- 길이는 **코드 포인트 기준** `maxMessageLength` 이하 (이모지 1개 = 1자로 계산되도록)
- 저장 전 NFC 정규화

**links 규칙**
- 서버가 `content`에서 `http://` / `https://` URL만 추출해 `links`에 넣는다. 다른 스킴(`javascript:`, `data:`, `file:`)은 링크로 인정하지 않음
- `content`는 원문 그대로 유지 (URL을 치환하거나 마크업하지 않음)
- 최대 5개, 초과분은 무시. 각 URL 최대 2,000자
- 클라이언트는 `links`만 신뢰하고 자체 URL 파싱을 하지 않는다 (서버·클라이언트 판정 불일치 방지)

### 5.2 PublicMessage (근접 공개 대화)
```ts
interface PublicMessage extends MessageBase {
  kind: 'public';
  position: Position;        // 발화 시점 위치 (수신 대상 판정 근거)
}
```
- 대화방 없음. 서버는 `position` 기준 `proximityRadius` 내 접속자에게만 전달
- 거리 계산: **정사각 범위** `max(|dx|, |dy|) <= radius` (체비쇼프 거리, 확정)
- 수정/삭제 불가 (휘발성). 서버 저장 여부는 백엔드 재량이나 프론트는 히스토리를 요청하지 않음

### 5.3 DmMessage / DmConversation
```ts
interface DmConversation {
  id: string;
  participantIds: [string, string];
  lastMessage?: DmMessage;
  unreadCount: number;       // 조회자 기준
  updatedAt: number;
}
interface DmMessage extends MessageBase {
  kind: 'dm';
  conversationId: string;
  readAt?: number;           // 상대가 읽은 시각
}
```
- DM은 **상대 userId만 알면 누구에게나** 가능 (친구 관계 없음). 프론트는 캐릭터 클릭 또는 닉네임 검색으로 userId를 얻음
- 첫 메시지 전송 시 서버가 DmConversation을 자동 생성 (`POST /dm/{userId}/messages`)
- 안 읽음 수(`unreadCount`) = **상대가 보낸** 메시지 중 `readAt == null`인 것의 수. 내가 보낸 메시지는 세지 않는다 (`readAt`은 수신자가 읽은 시각이므로 내 메시지의 `readAt`은 상대의 읽음 여부다)
- 수신 시 프론트 판정: 발신자가 내 근접 범위 안이면 말풍선(DM 스타일) + 패널, 밖이면 패널만
- **삭제 불가.** 단, 본인 메시지이고 상대가 아직 읽지 않았으면(`readAt == null`) **회수** 가능 → 서버에서 실제 제거, 상대 화면에서도 제거

### 5.4 Group / GroupMember / GroupMessage
```ts
interface Group {
  id: string;
  name: string;              // 2~20자
  ownerId: string;
  memberCount: number;
  createdAt: number;
}
interface GroupMember {
  groupId: string;
  userId: string;
  role: 'owner' | 'member';
  joinedAt: number;
  lastReadMessageId?: string;
}
interface GroupMessage extends MessageBase {
  kind: 'group';
  groupId: string;
}
```
- 그룹 최대 인원 **10명** (ServerConfig `maxGroupMembers`)
- `owner`만 초대·강퇴·해산. owner가 나가면 가장 오래된 멤버가 승계
- 그룹 메시지는 **누구도 수정·삭제 불가** (owner 포함)
- 위치 무관 전달. 그룹 메시지는 말풍선을 띄우지 않음
- 안 읽음 수 = `lastReadMessageId` 이후 메시지 수. 서버는 그룹 메시지를 받으면 **발신자의 `lastReadMessageId`를 그 메시지로 옮긴다** — 따라서 내 메시지는 안 읽음에 세지 않는다 (DM과 같은 결과)

### 5.5 Message 유니온
```ts
type Message = PublicMessage | DmMessage | GroupMessage;
```

## 6. 운영

### 6.1 Notice (운영자 공지)
```ts
interface Notice {
  id: string;
  content: string;
  createdBy: string;
  createdAt: number;
}
```
- SSE `system.notice`로 전체 접속자에게 전달. 프론트는 상단 배너로 표시

### 6.2 운영자 액션 (엔티티 아님, 계약에서 정의)
- 가입 승인/거절, 회원 정지/해제. 정지된 사용자는 즉시 SSE 끊김 + 재로그인 불가

## 7. 프론트 전용 파생 상태 (서버와 무관)

```ts
interface SpeechBubble {
  id: string;                // messageId
  userId: string;
  content: string;
  links: string[];           // 있으면 말풍선에 "링크 열기" 버튼 표시
  variant: 'public' | 'dm';
  expiresAt: number;
}
interface RemoteCharacter {
  presence: Presence;
  renderPixel: { x: number; y: number };   // 보간 중인 픽셀 좌표 (월드 기준)
  targetPixel: { x: number; y: number };
  animFrame: number;                       // GRAPHICS 2.3 프레임 인덱스 (0~3)
}
```

## 8. 불변 조건 요약 (백엔드 검증 목록)

| 규칙 | 검증 위치 |
|---|---|
| 닉네임 2~12자(코드 포인트), 앞뒤 공백 제거 후 저장, **한 줄** — C0 제어 문자 U+0000–U+001F 전부 금지(메시지와 달리 줄바꿈 U+000A·탭 U+0009도 금지), 그 밖의 금지 문자는 5.1과 같은 집합. **유니크 비교는 NFC 정규화 + 대소문자 무시** (`Dot`과 `dot`은 같은 닉네임). 회원과 심사 대기 중 신청을 함께 비교 | 가입 신청 · `PATCH /me` 시 |
| `appearance`: 모든 키 존재, 필수 슬롯 non-null, 슬롯과 `itemId` 접두사 일치, 아이템·램프 ID는 `ServerConfig.avatarOptions` 안의 값. 가입 승인 시 유효한 기본 외형 배정 | 가입 승인 시 배정 · `PATCH /me` 시 검증 |
| 두 사용자 간 DmConversation 1개 | 첫 전송 시 자동 생성 |
| DM 대상은 active 상태 회원 | 전송 시 |
| 이동 목적지는 collision=0 이며 이전 위치에서 도달 가능 | 위치 갱신 시 |
| 이동 목적지에 다른 Presence가 없음 (타일당 1명, 서버 선착순) | 위치 갱신 시 |
| 메시지 길이 1~maxMessageLength (코드 포인트) | 전송 시 |
| content는 유효 UTF-8, 제어/비가시 문자 없음 | 전송 시 |
| links는 http/https만, 최대 5개 | 전송 시 서버 추출 |
| 그룹 인원 ≤ maxGroupMembers(10) | 초대 시 |
| 정지 회원은 모든 쓰기 API 거부 | 인증 미들웨어 |
| 메시지 수정·삭제 불가. DM 회수는 본인 && readAt==null 일 때만 | 회수 요청 시 |

## 9. API 응답·이벤트 합성 타입 (zod 스키마 원천)

API_CONTRACT가 기본 엔티티에 필드를 덧붙여 내려주는 경우의 **이름**을 여기서 정한다. `transport/schemas/`는 이 이름 그대로 스키마를 만들고, `domain/types.ts`에도 동일하게 export한다.

```ts
// 2.6 GET /dm
interface DmConversationWithPeer extends DmConversation {
  peer: User;                          // 조회자 관점의 상대
}

// 2.7 GET /groups
interface GroupListItem extends Group {
  unreadCount: number;                 // 조회자 기준
  lastMessage?: GroupMessage;
}

// 2.7 GET /groups/{id}, SSE group.updated
interface GroupMemberWithUser extends GroupMember {
  user: User;
}
interface GroupDetail {
  group: Group;
  members: GroupMemberWithUser[];
}

// SSE chat.public
interface ChatPublicEvent extends PublicMessage {
  sender: Pick<User, 'nickname'>;      // 발화자는 같은 맵 접속자이므로 외형은 Presence에 이미 있다
}

// SSE chat.dm
interface ChatDmEvent extends DmMessage {
  sender: User;
  peerId: string;                      // 수신자 관점의 상대. 발신자 자기 사본에는 수신자 ID
}

// SSE chat.group
interface ChatGroupEvent extends GroupMessage {
  sender: User;
}

// SSE group.updated
interface GroupUpdatedEvent extends Group {
  members: GroupMemberWithUser[];
}
```

- 합성 타입은 **읽기 전용 응답 형태**다. 스토어·캐시에 저장할 때는 기본 엔티티로 분해해 저장하고, `sender`/`peer`는 별도 사용자 캐시로 보낸다 (이중 저장 금지 원칙)
- 새 합성이 필요하면 여기 추가한 뒤 API_CONTRACT에서 이름으로 참조한다. 인라인 `& { ... }` 표기는 계약에 쓰지 않는다

## 10. 결정 이력

| 날짜 | 결정 |
|---|---|
| 2026-09-29 | 1.0 확정 |
| 2026-09-29 | 1.1: 교차 검토 (RemoteCharacter 픽셀 좌표 명명) |
| 2026-09-29 | 1.2: 9장 합성 타입 신설 (ROADMAP 3단계 선행 결정) |
| 2026-09-30 | 1.3: `MapData.tileset` 추가, `avatarId` 형식 `char_NN`·서버 검증 명시, 자산 규격은 GRAPHICS.md 참조 |
| 2026-09-30 | 1.4: `ServerConfig.avatarIds` 추가 — 아바타 목록 원천은 서버 (Claude Code 결정 요청 B). 승인 시 목록 중 배정 |
| 2026-09-30 | 1.5: 안 읽음 수 정의 — 그룹은 전송 시 발신자 `lastReadMessageId` 자동 갱신(Claude Code 제안), DM은 상대 메시지 중 `readAt == null`. 두 경우 모두 내 메시지 제외 |
| 2026-09-30 | **2.0 (호환 깨짐)**: `User.avatarId`·`Presence.avatarId` → `appearance: Appearance`(3.7 신설, 7슬롯 + 피부색·머리색 + 아이템별 primary/secondary). `ServerConfig.avatarIds` → `avatarOptions`(itemIds + 램프 목록 3종). `ChatPublicEvent.sender`에서 avatarId 제거. 사용자 결정: 7슬롯, 프리셋 램프만, 모든 아이템 자유 선택 |
| 2026-09-30 | 2.1 (서버 설계 중 발견): 닉네임 유일성 비교 = NFC + 대소문자 무시, 앞뒤 공백 제거, 제어·비가시 문자 금지, `PATCH /me`에도 적용 |
| 2026-10-01 | 2.2 (Claude Code 결정 요청): 닉네임은 한 줄 — 줄바꿈·탭 포함 C0 제어 문자 전부 금지 (메시지 5.1은 줄바꿈 허용 유지) |
