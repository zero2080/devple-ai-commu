// MSW 핸들러가 공유하는 in-memory 상태. 새로고침하면 초기화된다 (세션은 refresh 쿠키로 복구).
import type {
  DmConversation,
  DmMessage,
  Group,
  GroupMember,
  GroupMessage,
  Me,
  Notice,
  Position,
  Presence,
  PresenceState,
  SignupRequest,
  User,
} from '@/domain';

import {
  SEED_DM_CONVERSATIONS,
  SEED_DM_MESSAGES,
  SEED_GROUP_MEMBERS,
  SEED_GROUP_MESSAGES,
  SEED_GROUPS,
} from './data/chat.ts';
import { MAIN_MAP } from './data/map.ts';
import { FAKE_USERS, ME } from './data/users.ts';
import { createInitialPresences } from './data/world.ts';

export interface MockSession {
  accessToken: string | null;
  serial: number;
}

export interface MockState {
  session: MockSession;
  me: Me;
  users: User[];
  signups: SignupRequest[];
  presences: Presence[];
  myPosition: Position;
  myPositionSeq: number;
  myPositionAt: number;
  myPresence: PresenceState;
  dmConversations: DmConversation[];
  dmMessages: DmMessage[];
  groups: Group[];
  groupMembers: GroupMember[];
  groupMessages: GroupMessage[];
  notices: Notice[];
  idCounter: number;
}

function clone<T>(value: T): T {
  return structuredClone(value);
}

export function createInitialState(): MockState {
  return {
    session: { accessToken: null, serial: 0 },
    me: clone(ME),
    users: clone(FAKE_USERS),
    signups: [
      {
        id: 'sr_01',
        email: 'newbie@example.com',
        nickname: '신입',
        phone: '010-1111-2222',
        status: 'pending',
        createdAt: Date.now() - 3_600_000,
      },
    ],
    presences: createInitialPresences(MAIN_MAP),
    myPosition: { mapId: MAIN_MAP.id, x: MAIN_MAP.spawn.x, y: MAIN_MAP.spawn.y, dir: 'down' },
    myPositionSeq: 0,
    myPositionAt: 0,
    myPresence: 'online',
    dmConversations: clone(SEED_DM_CONVERSATIONS),
    dmMessages: clone(SEED_DM_MESSAGES),
    groups: clone(SEED_GROUPS),
    groupMembers: clone(SEED_GROUP_MEMBERS),
    groupMessages: clone(SEED_GROUP_MESSAGES),
    notices: [],
    idCounter: 1000,
  };
}

export const state: MockState = createInitialState();

export function resetMockState(): void {
  Object.assign(state, createInitialState());
}

export function nextId(prefix: string): string {
  state.idCounter += 1;
  return `${prefix}_${String(state.idCounter)}`;
}

/** 서버 규칙(DOMAIN 5.1): http/https만, 최대 5개 */
export function extractLinks(content: string): string[] {
  const matches = content.match(/https?:\/\/[^\s<>"']+/g) ?? [];
  return matches.slice(0, 5);
}

/** DOMAIN 5.1 content 규칙: 공백만 불가, 제어 문자 불가, 코드 포인트 길이 제한 */
export function contentError(content: string, maxLength: number): string | null {
  if (content.trim() === '') {
    return 'content must not be blank';
  }
  // eslint-disable-next-line no-control-regex -- 제어 문자 검출이 목적
  if (/[\x00-\x08\x0B-\x1F\x7F\u200B-\u200F]/.test(content)) {
    return 'content contains control characters';
  }
  if (Array.from(content).length > maxLength) {
    return `content exceeds ${String(maxLength)} code points`;
  }
  return null;
}

export function userAsMe(user: User): Me {
  return { ...user, email: `${user.id}@example.com`, phone: '010-0000-0000' };
}
