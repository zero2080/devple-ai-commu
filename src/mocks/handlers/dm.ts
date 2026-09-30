// API_CONTRACT 2.6 DM
import { http, HttpResponse } from 'msw';

import type { DmConversation, DmMessage } from '@/domain';
import { ENDPOINTS } from '@/transport/api/endpoints';

import { SERVER_CONFIG } from '../data/config.ts';
import { contentError, extractLinks } from '../data/messages.ts';
import { nextId, state } from '../state.ts';
import { apiError, noContent, page, param, readJson, requireAuth, str, url } from './support.ts';

function conversationWith(userId: string): DmConversation | undefined {
  return state.dmConversations.find(
    (c) => c.participantIds.includes(state.me.id) && c.participantIds.includes(userId),
  );
}

function peerOf(conversation: DmConversation) {
  const peerId = conversation.participantIds.find((id) => id !== state.me.id) ?? state.me.id;
  return state.users.find((u) => u.id === peerId) ?? state.me;
}

function messagesOf(conversationId: string): DmMessage[] {
  return state.dmMessages
    .filter((m) => m.conversationId === conversationId)
    .sort((a, b) => b.createdAt - a.createdAt);
}

export const dmHandlers = [
  http.get(url(ENDPOINTS.dmConversations), ({ request }) => {
    const denied = requireAuth(request);
    if (denied !== null) return denied;
    const items = [...state.dmConversations]
      .sort((a, b) => b.updatedAt - a.updatedAt)
      .map((c) => ({ ...c, peer: peerOf(c) }));
    return HttpResponse.json(page(items));
  }),

  http.get(url(ENDPOINTS.dmMessages), ({ request, params }) => {
    const denied = requireAuth(request);
    if (denied !== null) return denied;
    const conversation = conversationWith(param(params, 'userId'));
    return HttpResponse.json(page(conversation === undefined ? [] : messagesOf(conversation.id)));
  }),

  http.post(url(ENDPOINTS.sendDm), async ({ request, params }) => {
    const denied = requireAuth(request);
    if (denied !== null) return denied;
    const userId = param(params, 'userId');
    const target = state.users.find((u) => u.id === userId);
    if (target === undefined) {
      return apiError(404, 'NOT_FOUND', 'user not found', { resource: 'user' });
    }
    if (target.status === 'suspended') {
      return apiError(403, 'FORBIDDEN', 'target user is suspended');
    }
    const content = str(await readJson(request), 'content') ?? '';
    const problem = contentError(content, SERVER_CONFIG.maxMessageLength);
    if (problem !== null) {
      return apiError(400, 'MESSAGE_INVALID_CONTENT', problem);
    }
    const now = Date.now();
    let conversation = conversationWith(userId);
    if (conversation === undefined) {
      conversation = {
        id: nextId('c'),
        participantIds: [state.me.id, userId],
        unreadCount: 0,
        updatedAt: now,
      };
      state.dmConversations.push(conversation);
    }
    const message: DmMessage = {
      id: nextId('dm'),
      kind: 'dm',
      conversationId: conversation.id,
      senderId: state.me.id,
      content: content.normalize('NFC'),
      links: extractLinks(content),
      createdAt: now,
    };
    state.dmMessages.push(message);
    conversation.lastMessage = message;
    conversation.updatedAt = now;
    return HttpResponse.json(message, { status: 201 });
  }),

  http.post(url(ENDPOINTS.recallDm), ({ request, params }) => {
    const denied = requireAuth(request);
    if (denied !== null) return denied;
    const messageId = param(params, 'messageId');
    const index = state.dmMessages.findIndex((m) => m.id === messageId);
    const message = state.dmMessages[index];
    if (message === undefined) {
      return apiError(404, 'NOT_FOUND', 'message not found', { resource: 'message' });
    }
    if (message.senderId !== state.me.id) {
      return apiError(403, 'FORBIDDEN', 'not your message');
    }
    if (message.readAt !== undefined) {
      return apiError(409, 'MESSAGE_ALREADY_READ', 'peer already read this message');
    }
    state.dmMessages.splice(index, 1);
    const conversation = state.dmConversations.find((c) => c.id === message.conversationId);
    if (conversation !== undefined) {
      const remaining = messagesOf(conversation.id);
      if (remaining[0] === undefined) {
        delete conversation.lastMessage;
      } else {
        conversation.lastMessage = remaining[0];
      }
    }
    return noContent();
  }),

  http.post(url(ENDPOINTS.readDm), async ({ request, params }) => {
    const denied = requireAuth(request);
    if (denied !== null) return denied;
    const conversation = conversationWith(param(params, 'userId'));
    if (conversation === undefined) {
      return apiError(404, 'NOT_FOUND', 'conversation not found', { resource: 'conversation' });
    }
    const lastMessageId = str(await readJson(request), 'lastMessageId');
    const now = Date.now();
    for (const message of state.dmMessages) {
      if (message.conversationId === conversation.id && message.senderId !== state.me.id) {
        message.readAt ??= now;
      }
      if (message.id === lastMessageId) break;
    }
    conversation.unreadCount = 0;
    return noContent();
  }),
];
