// API_CONTRACT 2.6 DM. 경로는 상대 userId, 이벤트는 conversationId (ARCHITECTURE 7장)
import type { DmConversationWithPeer, DmMessage } from '@/domain';

import { request } from '../http';
import { dmConversationWithPeerSchema, dmMessageSchema, paginated } from '../schemas';
import { ENDPOINTS } from './endpoints';

export interface Page<T> {
  items: T[];
  nextCursor: string | null;
}

export interface CursorQuery {
  cursor?: string;
  limit?: number;
}

const dmConversationsPage = paginated(dmConversationWithPeerSchema);
const dmMessagesPage = paginated(dmMessageSchema);

/** GET /dm → 내 대화 목록 (최근순) */
export function fetchDmConversations(cursor?: string): Promise<Page<DmConversationWithPeer>> {
  return request({ ...ENDPOINTS.dmConversations, query: { cursor } }, dmConversationsPage);
}

/** GET /dm/{userId}/messages?cursor=&limit=50 → 최신순 */
export function fetchDmMessages(userId: string, query: CursorQuery = {}): Promise<Page<DmMessage>> {
  return request(
    {
      ...ENDPOINTS.dmMessages,
      params: { userId },
      query: { cursor: query.cursor, limit: query.limit },
    },
    dmMessagesPage,
  );
}

/** POST /dm/{userId}/messages → 201 (대화 없으면 자동 생성) */
export function sendDm(userId: string, content: string): Promise<DmMessage> {
  return request({ ...ENDPOINTS.sendDm, params: { userId }, body: { content } }, dmMessageSchema);
}

/** POST /dm/messages/{messageId}/recall → 204. 이미 읽었으면 409 MESSAGE_ALREADY_READ */
export function recallDm(messageId: string): Promise<void> {
  return request({ ...ENDPOINTS.recallDm, params: { messageId } });
}

/** POST /dm/{userId}/read { lastMessageId } → 204 */
export function markDmRead(userId: string, lastMessageId: string): Promise<void> {
  return request({ ...ENDPOINTS.readDm, params: { userId }, body: { lastMessageId } });
}
