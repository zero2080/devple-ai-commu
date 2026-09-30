// DM 대화 3개, 그룹 2개 시드. MSW 핸들러가 런타임에 변경한다 (state.ts 참조)
import { ME, SEED_TIME } from './users.ts';
import type {
  DmConversation,
  DmMessage,
  Group,
  GroupMember,
  GroupMessage,
} from '../../domain/types.ts';

const minute = 60_000;

function dm(
  id: string,
  conversationId: string,
  senderId: string,
  content: string,
  offsetMin: number,
  readAt?: number,
): DmMessage {
  return {
    id,
    kind: 'dm',
    conversationId,
    senderId,
    content,
    links: [],
    createdAt: SEED_TIME - offsetMin * minute,
    ...(readAt === undefined ? {} : { readAt }),
  };
}

export const SEED_DM_MESSAGES: DmMessage[] = [
  dm('dm_001', 'c_01', 'u_01', '안녕하세요! 광장에서 봤어요', 120, SEED_TIME - 110 * minute),
  dm('dm_002', 'c_01', ME.id, '반가워요, 도트님', 110, SEED_TIME - 100 * minute),
  dm('dm_003', 'c_01', 'u_01', '오늘 저녁에 그룹 채팅 하실래요?', 30),
  dm('dm_004', 'c_02', 'u_02', '픽셀입니다. 프로필 멋지네요', 90, SEED_TIME - 80 * minute),
  dm('dm_005', 'c_02', ME.id, '고마워요 :)', 80, SEED_TIME - 70 * minute),
  dm('dm_006', 'c_03', ME.id, '레트로님 계신가요?', 15),
];

function lastOf(conversationId: string): DmMessage | undefined {
  return [...SEED_DM_MESSAGES]
    .filter((m) => m.conversationId === conversationId)
    .sort((a, b) => b.createdAt - a.createdAt)[0];
}

function conversation(
  id: string,
  peerId: string,
  unreadCount: number,
  updatedAt: number,
): DmConversation {
  const last = lastOf(id);
  const base: DmConversation = { id, participantIds: [ME.id, peerId], unreadCount, updatedAt };
  return last === undefined ? base : { ...base, lastMessage: last };
}

export const SEED_DM_CONVERSATIONS: DmConversation[] = [
  conversation('c_01', 'u_01', 1, SEED_TIME - 30 * minute),
  conversation('c_02', 'u_02', 0, SEED_TIME - 70 * minute),
  conversation('c_03', 'u_03', 0, SEED_TIME - 15 * minute),
];

export const SEED_GROUPS: Group[] = [
  {
    id: 'g_01',
    name: '광장 단골',
    ownerId: ME.id,
    memberCount: 4,
    createdAt: SEED_TIME - 5 * 86_400_000,
  },
  {
    id: 'g_02',
    name: '레트로 게임 모임',
    ownerId: 'u_03',
    memberCount: 3,
    createdAt: SEED_TIME - 2 * 86_400_000,
  },
];

export const SEED_GROUP_MEMBERS: GroupMember[] = [
  {
    groupId: 'g_01',
    userId: ME.id,
    role: 'owner',
    joinedAt: SEED_TIME - 5 * 86_400_000,
    lastReadMessageId: 'gm_001', // 내가 보낸 메시지까지 읽음 (내 메시지는 안 읽음에 세지 않음)
  },
  { groupId: 'g_01', userId: 'u_01', role: 'member', joinedAt: SEED_TIME - 4 * 86_400_000 },
  { groupId: 'g_01', userId: 'u_02', role: 'member', joinedAt: SEED_TIME - 3 * 86_400_000 },
  { groupId: 'g_01', userId: 'u_04', role: 'member', joinedAt: SEED_TIME - 1 * 86_400_000 },
  { groupId: 'g_02', userId: 'u_03', role: 'owner', joinedAt: SEED_TIME - 2 * 86_400_000 },
  {
    groupId: 'g_02',
    userId: ME.id,
    role: 'member',
    joinedAt: SEED_TIME - 1 * 86_400_000,
    lastReadMessageId: 'gm_003',
  },
  { groupId: 'g_02', userId: 'u_05', role: 'member', joinedAt: SEED_TIME - 1 * 86_400_000 },
];

function gm(
  id: string,
  groupId: string,
  senderId: string,
  content: string,
  offsetMin: number,
): GroupMessage {
  return {
    id,
    kind: 'group',
    groupId,
    senderId,
    content,
    links: [],
    createdAt: SEED_TIME - offsetMin * minute,
  };
}

export const SEED_GROUP_MESSAGES: GroupMessage[] = [
  gm('gm_001', 'g_01', ME.id, '단골 모임 만들었어요', 200),
  gm('gm_002', 'g_01', 'u_01', '와 좋아요', 190),
  gm('gm_003', 'g_02', 'u_03', '이번 주 레트로 게임 뭐 할까요', 60),
  {
    ...gm('gm_004', 'g_02', 'u_05', '저는 슈팅 게임이요 https://example.com/shmup', 50),
    links: ['https://example.com/shmup'],
  },
];
