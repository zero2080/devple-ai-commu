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
import { nicknameKey } from '@/domain';

import {
  SEED_DM_CONVERSATIONS,
  SEED_DM_MESSAGES,
  SEED_GROUP_MEMBERS,
  SEED_GROUP_MESSAGES,
  SEED_GROUPS,
} from './data/chat.ts';
import { MAIN_MAP } from './data/map.ts';
import { FAKE_USERS, ME, SEED_SIGNUPS } from './data/users.ts';
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
    signups: clone(SEED_SIGNUPS),
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

/** 가입 신청 ID: 128비트 난수 Base64URL 22자 (API_CONTRACT 2.3 8장 — 서버와 같은 모양) */
export function randomRequestId(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(16));
  const base64 = btoa(String.fromCharCode(...bytes));
  return base64.replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

export function nextId(prefix: string): string {
  state.idCounter += 1;
  return `${prefix}_${String(state.idCounter)}`;
}

export function userAsMe(user: User): Me {
  return { ...user, email: `${user.id}@example.com`, phone: '010-0000-0000' };
}

/** 닉네임 중복: 본인·다른 회원·대기 중 가입 신청. 비교는 공백 제거 + NFC + 대소문자 무시 (DOMAIN 8장 2.1) */
export function isNicknameTaken(nickname: string, exceptUserId?: string): boolean {
  const key = nicknameKey(nickname);
  if (state.me.id !== exceptUserId && nicknameKey(state.me.nickname) === key) {
    return true;
  }
  return (
    state.users.some((u) => u.id !== exceptUserId && nicknameKey(u.nickname) === key) ||
    state.signups.some((s) => s.status === 'pending' && nicknameKey(s.nickname) === key)
  );
}

/** 이메일 중복: 가입된 회원 또는 같은 이메일의 대기 중 신청 (API_CONTRACT 2.1 EMAIL_TAKEN). 대소문자 무시 */
export function isEmailTaken(email: string): boolean {
  const key = email.trim().toLowerCase();
  return (
    state.me.email.toLowerCase() === key ||
    state.users.some((u) => userAsMe(u).email.toLowerCase() === key) ||
    state.signups.some((s) => s.status === 'pending' && s.email.toLowerCase() === key)
  );
}
