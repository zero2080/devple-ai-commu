// DOMAIN.md의 타입을 그대로 옮긴 파일. 각 블록의 주석은 DOMAIN.md 섹션 번호다.
// 서버 응답 타입에 프론트 전용 필드를 섞지 않는다 (CONVENTIONS 4장). 파생 타입은 ./view.ts.

/* ---------- 3. 사용자 · 인증 ---------- */

// 3.1 User
export type UserRole = 'member' | 'admin';
export type UserStatus = 'active' | 'suspended';

export interface User {
  id: string;
  nickname: string; // 2~12자, 유니크
  avatarId: string; // 기본 제공 아바타 ID, 형식 'char_NN' (GRAPHICS 2.3)
  statusMessage?: string; // 최대 40자
  role: UserRole;
  status: UserStatus;
  createdAt: number;
}

// 3.2 UserProfile (캐릭터 클릭 시 조회)
export interface UserProfile {
  user: User;
  online: boolean;
  position?: Position; // 접속 중일 때만
}

// 3.3 Me (본인 확장 정보)
export interface Me extends User {
  email: string;
  phone: string;
}

// 3.4 SignupRequest
export type SignupStatus = 'pending' | 'approved' | 'rejected';

export interface SignupRequest {
  id: string;
  email: string;
  nickname: string;
  phone: string;
  status: SignupStatus;
  rejectReason?: string;
  createdAt: number;
  reviewedAt?: number;
  reviewedBy?: string; // admin userId
}

// 3.5 AccessKey (프론트는 값만 입력, 엔티티 조회 없음)
export interface AccessKeyLogin {
  accessKey: string; // 이메일로 받은 키, 형식은 백엔드 정의
}

export interface AuthSession {
  accessToken: string; // JWT, 메모리 보관
  expiresIn: number; // 초
  me: Me;
  config: ServerConfig;
}

// 3.6 ServerConfig (로그인 응답에 포함)
export interface ServerConfig {
  proximityRadius: number; // 근접 반경 (타일), 기본 5
  positionBatchMs: number; // 이동 전송 주기, 기본 200
  serverTickMs: number; // 위치 브로드캐스트 주기, 기본 200
  maxMessageLength: number; // 기본 200
  defaultMapId: string;
  maxGroupMembers: number; // 기본 10
}

/* ---------- 4. 공간 · 위치 ---------- */

// 4.1 Position
export type Direction = 'up' | 'down' | 'left' | 'right';

export interface Position {
  mapId: string;
  x: number; // 타일 X (0-based)
  y: number; // 타일 Y
  dir: Direction;
}

// 4.2 Presence (접속 중인 사용자 1명의 월드 상태)
export type PresenceState = 'online' | 'away';

export interface Presence {
  userId: string;
  nickname: string; // 스냅샷에 포함해 User 조회 없이 렌더
  avatarId: string;
  position: Position;
  state: PresenceState;
  updatedAt: number;
}

// 4.3 MapData (정적 자산)
export interface MapData {
  id: string;
  width: number; // 타일 수
  height: number;
  tileSize: 16;
  tileset: string; // 타일셋 ID (GRAPHICS 3장). 맵당 1개
  spawn: { x: number; y: number };
  layers: TileLayer[]; // 그리기 순서대로. 표준 구성은 GRAPHICS 4장 (floor / objects / overhead)
  collision: number[]; // width*height, 0=통행 1=차단
}

export interface TileLayer {
  name: string;
  order: 'below' | 'above'; // 캐릭터 아래/위
  tiles: number[]; // width*height, 타일셋 인덱스 (-1=빈칸)
}

/* ---------- 5. 메시지 ---------- */

// 5.1 공통
export interface MessageBase {
  id: string;
  senderId: string;
  content: string; // 1~maxMessageLength자, 공백만은 불가
  links: string[]; // 서버가 content에서 추출한 URL 목록 (없으면 [])
  createdAt: number;
}

// 5.2 PublicMessage (근접 공개 대화)
export interface PublicMessage extends MessageBase {
  kind: 'public';
  position: Position; // 발화 시점 위치 (수신 대상 판정 근거)
}

// 5.3 DmMessage / DmConversation
export interface DmConversation {
  id: string;
  participantIds: [string, string];
  lastMessage?: DmMessage;
  unreadCount: number; // 조회자 기준
  updatedAt: number;
}

export interface DmMessage extends MessageBase {
  kind: 'dm';
  conversationId: string;
  readAt?: number; // 상대가 읽은 시각
}

// 5.4 Group / GroupMember / GroupMessage
export interface Group {
  id: string;
  name: string; // 2~20자
  ownerId: string;
  memberCount: number;
  createdAt: number;
}

export type GroupRole = 'owner' | 'member';

export interface GroupMember {
  groupId: string;
  userId: string;
  role: GroupRole;
  joinedAt: number;
  lastReadMessageId?: string;
}

export interface GroupMessage extends MessageBase {
  kind: 'group';
  groupId: string;
}

// 5.5 Message 유니온
export type Message = PublicMessage | DmMessage | GroupMessage;

/* ---------- 6. 운영 ---------- */

// 6.1 Notice (운영자 공지)
export interface Notice {
  id: string;
  content: string;
  createdBy: string;
  createdAt: number;
}

/* ---------- 9. API 응답·이벤트 합성 타입 (zod 스키마 원천) ---------- */
// 읽기 전용 응답 형태. 스토어·캐시에는 기본 엔티티로 분해해 저장한다 (이중 저장 금지).

// 2.6 GET /dm
export interface DmConversationWithPeer extends DmConversation {
  peer: User; // 조회자 관점의 상대
}

// 2.7 GET /groups
export interface GroupListItem extends Group {
  unreadCount: number; // 조회자 기준
  lastMessage?: GroupMessage;
}

// 2.7 GET /groups/{id}, SSE group.updated
export interface GroupMemberWithUser extends GroupMember {
  user: User;
}

export interface GroupDetail {
  group: Group;
  members: GroupMemberWithUser[];
}

// SSE chat.public
export interface ChatPublicEvent extends PublicMessage {
  sender: Pick<User, 'nickname' | 'avatarId'>;
}

// SSE chat.dm
export interface ChatDmEvent extends DmMessage {
  sender: User;
  peerId: string; // 수신자 관점의 상대. 발신자 자기 사본에는 수신자 ID
}

// SSE chat.group
export interface ChatGroupEvent extends GroupMessage {
  sender: User;
}

// SSE group.updated
export interface GroupUpdatedEvent extends Group {
  members: GroupMemberWithUser[];
}
