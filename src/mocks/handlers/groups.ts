// API_CONTRACT 2.7 그룹
import { http, HttpResponse } from 'msw';

import type { Group, GroupListItem, GroupMember, GroupMessage } from '@/domain';
import { ENDPOINTS } from '@/transport/api/endpoints';

import { SERVER_CONFIG } from '../data/config.ts';
import { contentError, extractLinks } from '../data/messages.ts';
import { nextId, state } from '../state.ts';
import { apiError, noContent, page, param, readJson, requireAuth, str, url } from './support.ts';

function membersOf(groupId: string): GroupMember[] {
  return state.groupMembers.filter((m) => m.groupId === groupId);
}

function messagesOf(groupId: string): GroupMessage[] {
  return state.groupMessages
    .filter((m) => m.groupId === groupId)
    .sort((a, b) => b.createdAt - a.createdAt);
}

function myMembership(groupId: string): GroupMember | undefined {
  return state.groupMembers.find((m) => m.groupId === groupId && m.userId === state.me.id);
}

function listItem(group: Group): GroupListItem {
  const membership = myMembership(group.id);
  const messages = messagesOf(group.id); // 최신순
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

function userOf(userId: string) {
  return userId === state.me.id ? state.me : state.users.find((u) => u.id === userId);
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
    const length = Array.from(name).length;
    if (length < 2 || length > 20) {
      return apiError(400, 'VALIDATION_FAILED', 'invalid fields', {
        fields: { name: 'length' },
      });
    }
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
    const members = membersOf(group.id).flatMap((m) => {
      const user = userOf(m.userId);
      return user === undefined ? [] : [{ ...m, user }];
    });
    return HttpResponse.json({ group, members });
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
    const length = Array.from(name).length;
    if (length < 2 || length > 20) {
      return apiError(400, 'VALIDATION_FAILED', 'invalid fields', {
        fields: { name: 'length' },
      });
    }
    group.name = name;
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
    if (userOf(userId) === undefined) {
      return apiError(404, 'NOT_FOUND', 'user not found', { resource: 'user' });
    }
    if (membersOf(group.id).some((m) => m.userId === userId)) {
      return apiError(409, 'VALIDATION_FAILED', 'already a member');
    }
    if (group.memberCount >= SERVER_CONFIG.maxGroupMembers) {
      return apiError(409, 'GROUP_FULL', `max ${String(SERVER_CONFIG.maxGroupMembers)} members`);
    }
    const member: GroupMember = { groupId: group.id, userId, role: 'member', joinedAt: Date.now() };
    state.groupMembers.push(member);
    group.memberCount += 1;
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
    const target = membersOf(group.id).find((m) => m.userId === userId);
    if (target === undefined) {
      return apiError(404, 'NOT_FOUND', 'member not found', { resource: 'member' });
    }
    state.groupMembers = state.groupMembers.filter(
      (m) => !(m.groupId === group.id && m.userId === userId),
    );
    group.memberCount -= 1;
    const remaining = membersOf(group.id).sort((a, b) => a.joinedAt - b.joinedAt);
    const oldest = remaining[0];
    if (oldest === undefined) {
      deleteGroup(group.id);
    } else if (target.role === 'owner') {
      oldest.role = 'owner';
      group.ownerId = oldest.userId;
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
    return HttpResponse.json(page(messagesOf(group.id)));
  }),

  http.post(url(ENDPOINTS.sendGroupMessage), async ({ request, params }) => {
    const denied = requireAuth(request);
    if (denied !== null) return denied;
    const group = requireGroup(param(params, 'groupId'));
    if (group instanceof Response) return group;
    if (myMembership(group.id) === undefined) {
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
