// API_CONTRACT 2.7 그룹. 상태는 MSW, SSE(chat.group·group.*)는 emit 브리지로 방송 (ARCHITECTURE 9장)
import { http, HttpResponse } from 'msw';

import type { Group, GroupListItem, GroupMember, GroupMessage } from '@/domain';
import { ENDPOINTS } from '@/transport/api/endpoints';

import { emitViaExpress } from '../bridge.ts';
import { SERVER_CONFIG } from '../data/config.ts';
import { contentError, extractLinks } from '../data/messages.ts';
import { meAsSender } from '../dmSim.ts';
import {
  emitGroupUpdated,
  groupMembersOf,
  groupMessagesOf,
  groupUserOf,
  membersWithUser,
  myMembership,
  scheduleGroupBot,
} from '../groupSim.ts';
import { nextId, state } from '../state.ts';
import {
  apiError,
  botDelayMs,
  cursorPage,
  noContent,
  param,
  readJson,
  requireAuth,
  str,
  url,
} from './support.ts';

function listItem(group: Group): GroupListItem {
  const membership = myMembership(group.id);
  const messages = groupMessagesOf(group.id); // 최신순
  const lastReadIndex =
    membership?.lastReadMessageId === undefined
      ? messages.length
      : messages.findIndex((m) => m.id === membership.lastReadMessageId);
  const unreadCount = lastReadIndex === -1 ? messages.length : lastReadIndex;
  const last = messages[0];
  return last === undefined
    ? { ...group, unreadCount }
    : { ...group, unreadCount, lastMessage: last };
}

function requireGroup(groupId: string): Group | Response {
  const group = state.groups.find((g) => g.id === groupId);
  return group ?? apiError(404, 'NOT_FOUND', 'group not found', { resource: 'group' });
}

function deleteGroup(groupId: string): void {
  state.groups = state.groups.filter((g) => g.id !== groupId);
  state.groupMembers = state.groupMembers.filter((m) => m.groupId !== groupId);
  state.groupMessages = state.groupMessages.filter((m) => m.groupId !== groupId);
}

/** 이름 2~20 코드 포인트 (API_CONTRACT 2.7). 위반이면 400 응답 */
function nameError(name: string): Response | null {
  const length = Array.from(name).length;
  return length < 2 || length > 20
    ? apiError(400, 'VALIDATION_FAILED', 'invalid fields', { fields: { name: 'length' } })
    : null;
}

export const groupsHandlers = [
  http.get(url(ENDPOINTS.groups), ({ request }) => {
    const denied = requireAuth(request);
    if (denied !== null) return denied;
    const mine = state.groups.filter((g) => myMembership(g.id) !== undefined);
    return HttpResponse.json({ items: mine.map(listItem) });
  }),

  http.post(url(ENDPOINTS.createGroup), async ({ request }) => {
    const denied = requireAuth(request);
    if (denied !== null) return denied;
    const name = str(await readJson(request), 'name') ?? '';
    const invalid = nameError(name);
    if (invalid !== null) return invalid;
    const now = Date.now();
    const group: Group = {
      id: nextId('g'),
      name,
      ownerId: state.me.id,
      memberCount: 1,
      createdAt: now,
    };
    state.groups.push(group);
    state.groupMembers.push({
      groupId: group.id,
      userId: state.me.id,
      role: 'owner',
      joinedAt: now,
    });
    return HttpResponse.json(group, { status: 201 });
  }),

  http.get(url(ENDPOINTS.groupDetail), ({ request, params }) => {
    const denied = requireAuth(request);
    if (denied !== null) return denied;
    const group = requireGroup(param(params, 'groupId'));
    if (group instanceof Response) return group;
    return HttpResponse.json({ group, members: membersWithUser(group.id) });
  }),

  http.patch(url(ENDPOINTS.renameGroup), async ({ request, params }) => {
    const denied = requireAuth(request);
    if (denied !== null) return denied;
    const group = requireGroup(param(params, 'groupId'));
    if (group instanceof Response) return group;
    if (group.ownerId !== state.me.id) {
      return apiError(403, 'FORBIDDEN', 'owner only');
    }
    const name = str(await readJson(request), 'name') ?? '';
    const invalid = nameError(name);
    if (invalid !== null) return invalid;
    group.name = name;
    emitGroupUpdated(group); // 전 멤버 (API_CONTRACT 2.7)
    return HttpResponse.json(group);
  }),

  http.delete(url(ENDPOINTS.dissolveGroup), ({ request, params }) => {
    const denied = requireAuth(request);
    if (denied !== null) return denied;
    const group = requireGroup(param(params, 'groupId'));
    if (group instanceof Response) return group;
    if (group.ownerId !== state.me.id) {
      return apiError(403, 'FORBIDDEN', 'owner only');
    }
    deleteGroup(group.id);
    // 멤버 전원(owner 포함)에게. Mock에서 연결된 건 나뿐이다
    void emitViaExpress('group.removed', { groupId: group.id, reason: 'dissolved' });
    return noContent();
  }),

  http.post(url(ENDPOINTS.inviteGroupMember), async ({ request, params }) => {
    const denied = requireAuth(request);
    if (denied !== null) return denied;
    const group = requireGroup(param(params, 'groupId'));
    if (group instanceof Response) return group;
    if (group.ownerId !== state.me.id) {
      return apiError(403, 'FORBIDDEN', 'owner only');
    }
    const userId = str(await readJson(request), 'userId') ?? '';
    if (groupUserOf(userId) === undefined) {
      return apiError(404, 'NOT_FOUND', 'user not found', { resource: 'user' });
    }
    if (groupMembersOf(group.id).some((m) => m.userId === userId)) {
      return apiError(409, 'VALIDATION_FAILED', 'already a member');
    }
    if (group.memberCount >= SERVER_CONFIG.maxGroupMembers) {
      return apiError(409, 'GROUP_FULL', `max ${String(SERVER_CONFIG.maxGroupMembers)} members`);
    }
    const member: GroupMember = { groupId: group.id, userId, role: 'member', joinedAt: Date.now() };
    state.groupMembers.push(member);
    group.memberCount += 1;
    // 초대된 사용자에게 group.joined(가짜라 연결 없음), 기존 멤버(나 포함)에게 group.updated
    emitGroupUpdated(group);
    return HttpResponse.json(member, { status: 201 });
  }),

  http.delete(url(ENDPOINTS.removeGroupMember), ({ request, params }) => {
    const denied = requireAuth(request);
    if (denied !== null) return denied;
    const group = requireGroup(param(params, 'groupId'));
    if (group instanceof Response) return group;
    const userId = param(params, 'userId');
    const isSelf = userId === state.me.id;
    if (!isSelf && group.ownerId !== state.me.id) {
      return apiError(403, 'FORBIDDEN', 'owner can kick, members can only leave');
    }
    const target = groupMembersOf(group.id).find((m) => m.userId === userId);
    if (target === undefined) {
      return apiError(404, 'NOT_FOUND', 'member not found', { resource: 'member' });
    }
    state.groupMembers = state.groupMembers.filter((m) => m !== target);
    group.memberCount -= 1;
    const remaining = groupMembersOf(group.id).sort((a, b) => a.joinedAt - b.joinedAt);
    const oldest = remaining[0];
    if (oldest === undefined) {
      deleteGroup(group.id);
    } else if (target.role === 'owner') {
      oldest.role = 'owner';
      group.ownerId = oldest.userId;
    }
    if (isSelf) {
      // 나간 본인(모든 탭)에게 left. 남은 멤버의 group.updated는 가짜라 보내지 않는다
      void emitViaExpress('group.removed', { groupId: group.id, reason: 'left' });
    } else {
      // 강퇴 대상(가짜)에게 kicked, 남은 멤버(나 포함)에게 group.updated
      emitGroupUpdated(group);
    }
    return noContent();
  }),

  http.get(url(ENDPOINTS.groupMessages), ({ request, params }) => {
    const denied = requireAuth(request);
    if (denied !== null) return denied;
    const group = requireGroup(param(params, 'groupId'));
    if (group instanceof Response) return group;
    if (myMembership(group.id) === undefined) {
      return apiError(403, 'FORBIDDEN', 'not a member');
    }
    const query = new URL(request.url).searchParams;
    return HttpResponse.json(
      cursorPage(groupMessagesOf(group.id), query.get('cursor'), query.get('limit')),
    );
  }),

  http.post(url(ENDPOINTS.sendGroupMessage), async ({ request, params }) => {
    const denied = requireAuth(request);
    if (denied !== null) return denied;
    const group = requireGroup(param(params, 'groupId'));
    if (group instanceof Response) return group;
    const membership = myMembership(group.id);
    if (membership === undefined) {
      return apiError(403, 'FORBIDDEN', 'not a member');
    }
    const content = str(await readJson(request), 'content') ?? '';
    const problem = contentError(content, SERVER_CONFIG.maxMessageLength);
    if (problem !== null) {
      return apiError(400, 'MESSAGE_INVALID_CONTENT', problem);
    }
    const message: GroupMessage = {
      id: nextId('gm'),
      kind: 'group',
      groupId: group.id,
      senderId: state.me.id,
      content: content.normalize('NFC'),
      links: extractLinks(content),
      createdAt: Date.now(),
    };
    state.groupMessages.push(message);
    // 내 메시지는 안 읽음에 세지 않는다 (to-chat 2026-09-30-group-unread-order 추천안)
    membership.lastReadMessageId = message.id;
    void emitViaExpress('chat.group', { ...message, sender: meAsSender() }); // 전 멤버 (나는 에코)
    scheduleGroupBot(group.id, botDelayMs());
    return HttpResponse.json(message, { status: 201 });
  }),

  http.post(url(ENDPOINTS.readGroup), async ({ request, params }) => {
    const denied = requireAuth(request);
    if (denied !== null) return denied;
    const membership = myMembership(param(params, 'groupId'));
    if (membership === undefined) {
      return apiError(403, 'FORBIDDEN', 'not a member');
    }
    const lastMessageId = str(await readJson(request), 'lastMessageId');
    if (lastMessageId !== undefined) {
      membership.lastReadMessageId = lastMessageId;
    }
    return noContent();
  }),
];
