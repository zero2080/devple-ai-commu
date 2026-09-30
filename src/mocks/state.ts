// MSW 핸들러가 공유하는 in-memory 상태. 새로고침하면 초기화된다 (세션은 refresh 쿠키로 복구).
import type {
  DmConversation,
  DmMessage,
  Group,
  GroupMember,
  GroupMessage,
  Me,
  Notice,
  Presence,
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

export function userAsMe(user: User): Me {
  return { ...user, email: `${user.id}@example.com`, phone: '010-0000-0000' };
}

/** 닉네임 중복: 본인·다른 회원·대기 중 가입 신청 (API_CONTRACT 2.1·2.2) */
export function isNicknameTaken(nickname: string, exceptUserId?: string): boolean {
  if (state.me.id !== exceptUserId && state.me.nickname === nickname) {
    return true;
  }
  return (
    state.users.some((u) => u.id !== exceptUserId && u.nickname === nickname) ||
    state.signups.some((s) => s.status === 'pending' && s.nickname === nickname)
  );
}
