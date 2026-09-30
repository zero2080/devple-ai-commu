// API_CONTRACT 2.6 DM
import { http, HttpResponse } from 'msw';

import type { DmConversation, DmMessage } from '@/domain';
import { ENDPOINTS } from '@/transport/api/endpoints';

import { emitViaExpress } from '../bridge.ts';
import { SERVER_CONFIG } from '../data/config.ts';
import { contentError, extractLinks } from '../data/messages.ts';
import {
  conversationWith,
  dmEvent,
  ensureConversation,
  meAsSender,
  messagesOf,
  scheduleBot,
} from '../dmSim.ts';
import { nextId, state } from '../state.ts';
import { apiError, noContent, page, param, readJson, requireAuth, str, url } from './support.ts';

function peerOf(conversation: DmConversation) {
  const peerId = conversation.participantIds.find((id) => id !== state.me.id) ?? state.me.id;
  return state.users.find((u) => u.id === peerId) ?? meAsSender();
}

const DEFAULT_PAGE_LIMIT = 50;
/** 가짜 상대 봇 기본 지연 (ms). VITE_MOCK_DM_BOT_MS=0이면 끔 (E2E) */
const DEFAULT_BOT_MS = 5000;
const MAX_PAGE_LIMIT = 100;

/** 커서 페이지네이션 (API_CONTRACT 2.6): 최신순, cursor = 이전 페이지의 가장 오래된 messageId */
function pageOf(messages: DmMessage[], cursor: string | null, limitParam: string | null) {
  const limit = Math.min(
    Math.max(Number(limitParam ?? DEFAULT_PAGE_LIMIT) || DEFAULT_PAGE_LIMIT, 1),
    MAX_PAGE_LIMIT,
  );
  const start = cursor === null ? 0 : messages.findIndex((m) => m.id === cursor) + 1;
  if (cursor !== null && start === 0) {
    return { items: [], nextCursor: null }; // 모르는 커서
  }
  const items = messages.slice(start, start + limit);
  const last = items.at(-1);
  return {
    items,
    nextCursor: start + limit < messages.length && last !== undefined ? last.id : null,
  };
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
    const query = new URL(request.url).searchParams;
    const messages = conversation === undefined ? [] : messagesOf(conversation.id);
    return HttpResponse.json(pageOf(messages, query.get('cursor'), query.get('limit')));
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
    const conversation = ensureConversation(userId, now);
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
    // 양쪽에 chat.dm (API_CONTRACT 2.6). Mock에서 상대는 가짜라 연결이 없고, 내 에코(다중 탭)만 실제로 받는다
    void emitViaExpress('chat.dm', dmEvent(message, meAsSender(), userId));
    scheduleBot(userId, Number(import.meta.env.VITE_MOCK_DM_BOT_MS ?? DEFAULT_BOT_MS));
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
    void emitViaExpress('chat.dm.recalled', { conversationId: message.conversationId, messageId });
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
