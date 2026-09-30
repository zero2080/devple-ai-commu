// Mock 그룹 시뮬레이션 (ARCHITECTURE 9장). 상태는 MSW(state), SSE 방송은 emit 브리지로 Express에 위임한다.
// 가짜 멤버의 발화·초대·강퇴는 실제 서버에서는 다른 클라이언트가 하는 일이라 여기서 흉내 낸다.
import type { Group, GroupMember, GroupMessage, User } from '@/domain';

import { emitViaExpress } from './bridge.ts';
import { extractLinks } from './data/messages.ts';
import { meAsSender } from './dmSim.ts';
import { nextId, state } from './state.ts';

const BOT_REPLIES: readonly string[] = ['오 좋네요', 'ㅋㅋ 동의해요', '저도 갈게요!', '확인했어요'];

export function groupById(groupId: string): Group | undefined {
  return state.groups.find((g) => g.id === groupId);
}

export function groupMembersOf(groupId: string): GroupMember[] {
  return state.groupMembers.filter((m) => m.groupId === groupId);
}

export function myMembership(groupId: string): GroupMember | undefined {
  return groupMembersOf(groupId).find((m) => m.userId === state.me.id);
}

/** 그룹의 메시지, 최신순 */
export function groupMessagesOf(groupId: string): GroupMessage[] {
  return state.groupMessages
    .filter((m) => m.groupId === groupId)
    .sort((a, b) => b.createdAt - a.createdAt || (a.id < b.id ? 1 : -1));
}

/** 이벤트·상세의 user는 User만 (이메일 제외, DOMAIN 3.1) */
export function groupUserOf(userId: string): User | undefined {
  return userId === state.me.id ? meAsSender() : state.users.find((u) => u.id === userId);
}

/** group.updated 페이로드 / GET 상세의 members (GroupMemberWithUser[]) */
export function membersWithUser(groupId: string) {
  return groupMembersOf(groupId).flatMap((member) => {
    const user = groupUserOf(member.userId);
    return user === undefined ? [] : [{ ...member, user }];
  });
}

export function emitGroupUpdated(group: Group): void {
  void emitViaExpress('group.updated', { ...group, members: membersWithUser(group.id) });
}

/** 가짜 멤버(userId)가 그룹에 말한다. 멤버가 아니면 null */
export function receiveGroupMessage(
  groupId: string,
  userId: string,
  content: string,
  now: number = Date.now(),
): GroupMessage | null {
  const sender = groupUserOf(userId);
  if (
    sender === undefined ||
    userId === state.me.id ||
    !groupMembersOf(groupId).some((m) => m.userId === userId)
  ) {
    return null;
  }
  const message: GroupMessage = {
    id: nextId('gm'),
    kind: 'group',
    groupId,
    senderId: userId,
    content: content.normalize('NFC'),
    links: extractLinks(content),
    createdAt: now,
  };
  state.groupMessages.push(message);
  void emitViaExpress('chat.group', { ...message, sender });
  return message;
}

/** 가짜 사용자가 그룹을 만들고 나를 초대한다 → group.joined. 만든 그룹 id */
export function inviteMe(name: string, now: number = Date.now()): string {
  const owner = state.users[5] ?? state.users[0];
  const ownerId = owner?.id ?? state.me.id;
  const group: Group = { id: nextId('g'), name, ownerId, memberCount: 2, createdAt: now };
  state.groups.push(group);
  state.groupMembers.push(
    { groupId: group.id, userId: ownerId, role: 'owner', joinedAt: now },
    { groupId: group.id, userId: state.me.id, role: 'member', joinedAt: now + 1 },
  );
  void emitViaExpress('group.joined', group);
  return group.id;
}

/** owner(가짜)가 나를 강퇴한다 → group.removed { kicked }. 내가 멤버가 아니거나 owner면 false */
export function kickMe(groupId: string): boolean {
  const group = groupById(groupId);
  const membership = myMembership(groupId);
  if (group === undefined || membership === undefined || membership.role === 'owner') {
    return false;
  }
  state.groupMembers = state.groupMembers.filter((m) => m !== membership);
  group.memberCount -= 1;
  void emitViaExpress('group.removed', { groupId, reason: 'kicked' });
  return true;
}

/** 무한 스크롤 확인용: 과거 메시지 count개를 나와 다른 멤버가 번갈아 (방송 없음, 읽은 상태로) */
export function seedGroup(groupId: string, count: number, now: number = Date.now()): number {
  const membership = myMembership(groupId);
  const other = groupMembersOf(groupId).find((m) => m.userId !== state.me.id);
  if (membership === undefined) {
    return 0;
  }
  for (let i = 0; i < count; i += 1) {
    const mine = other === undefined || i % 2 === 1;
    state.groupMessages.push({
      id: nextId('gm'),
      kind: 'group',
      groupId,
      senderId: mine ? state.me.id : other.userId,
      content: `옛 그룹 메시지 ${String(i + 1)}`,
      links: [],
      createdAt: now - (count - i) * 60_000,
    });
  }
  const latest = groupMessagesOf(groupId)[0];
  if (latest !== undefined) {
    membership.lastReadMessageId = latest.id;
  }
  return count;
}

/** 봇: 내 그룹 메시지에 delayMs 뒤 다른 멤버가 짧게 답한다. delayMs ≤ 0이면 끈다 (E2E) */
export function scheduleGroupBot(groupId: string, delayMs: number): void {
  if (delayMs <= 0) {
    return;
  }
  setTimeout(() => {
    const other = groupMembersOf(groupId).find((m) => m.userId !== state.me.id);
    if (other !== undefined) {
      receiveGroupMessage(
        groupId,
        other.userId,
        BOT_REPLIES[state.idCounter % BOT_REPLIES.length] ?? '네!',
      );
    }
  }, delayMs);
}
