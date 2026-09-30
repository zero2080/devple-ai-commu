// Mock DM 시뮬레이션 (ARCHITECTURE 9장). 상태는 MSW(state), SSE 방송은 emit 브리지로 Express에 위임한다.
// 가짜 상대가 나에게 DM을 보내거나 내 DM을 읽는 일은 실제 서버에서는 상대 클라이언트가 하는 일이라 여기서 흉내 낸다.
import type { DmConversation, DmMessage, User } from '@/domain';

import { emitViaExpress } from './bridge.ts';
import { extractLinks } from './data/messages.ts';
import { nextId, state } from './state.ts';

const BOT_REPLIES: readonly string[] = [
  '앗 확인했어요!',
  '좋아요 ㅋㅋ',
  '잠시 후에 광장에서 봬요',
  '오 그거 재밌네요',
];

/** 이벤트의 sender는 User만 (이메일·전화 제외, DOMAIN 3.1) */
export function meAsSender(): User {
  const me = state.me;
  return {
    id: me.id,
    nickname: me.nickname,
    avatarId: me.avatarId,
    ...(me.statusMessage === undefined ? {} : { statusMessage: me.statusMessage }),
    role: me.role,
    status: me.status,
    createdAt: me.createdAt,
  };
}

export function conversationWith(userId: string): DmConversation | undefined {
  return state.dmConversations.find(
    (c) => c.participantIds.includes(state.me.id) && c.participantIds.includes(userId),
  );
}

export function ensureConversation(userId: string, now: number): DmConversation {
  const existing = conversationWith(userId);
  if (existing !== undefined) {
    return existing;
  }
  const conversation: DmConversation = {
    id: nextId('c'),
    participantIds: [state.me.id, userId],
    unreadCount: 0,
    updatedAt: now,
  };
  state.dmConversations.push(conversation);
  return conversation;
}

/** 대화의 메시지, 최신순 */
export function messagesOf(conversationId: string): DmMessage[] {
  return state.dmMessages
    .filter((m) => m.conversationId === conversationId)
    .sort((a, b) => b.createdAt - a.createdAt || (a.id < b.id ? 1 : -1));
}

/** 안 읽음 수 (DOMAIN 5.3): 상대가 보낸 메시지 중 readAt이 없는 것. 내 메시지는 세지 않는다 — 저장하지 않고 매번 계산 */
export function dmUnreadOf(conversationId: string): number {
  return messagesOf(conversationId).filter(
    (m) => m.senderId !== state.me.id && m.readAt === undefined,
  ).length;
}

/** chat.dm 페이로드 (API_CONTRACT 3.3): peerId는 수신자(나) 관점의 상대 */
export function dmEvent(message: DmMessage, sender: User, peerId: string) {
  return { ...message, sender, peerId };
}

/** 가짜 상대(userId)가 나에게 DM을 보낸다 (readAt 없음 = 안 읽음) 후 chat.dm 방송 */
export function receiveDmFrom(
  userId: string,
  content: string,
  now: number = Date.now(),
): DmMessage | null {
  const sender = state.users.find((u) => u.id === userId);
  if (sender === undefined) {
    return null;
  }
  const conversation = ensureConversation(userId, now);
  const message: DmMessage = {
    id: nextId('dm'),
    kind: 'dm',
    conversationId: conversation.id,
    senderId: userId,
    content: content.normalize('NFC'),
    links: extractLinks(content),
    createdAt: now,
  };
  state.dmMessages.push(message);
  conversation.lastMessage = message;
  conversation.updatedAt = now;
  void emitViaExpress('chat.dm', dmEvent(message, sender, userId));
  return message;
}

/** 가짜 상대(userId)가 내 DM을 모두 읽는다. 읽을 게 있으면 chat.dm.read 방송 */
export function readMyMessagesBy(userId: string, now: number = Date.now()): number {
  const conversation = conversationWith(userId);
  if (conversation === undefined) {
    return 0;
  }
  const mine = messagesOf(conversation.id).filter(
    (m) => m.senderId === state.me.id && m.readAt === undefined,
  );
  for (const message of mine) {
    message.readAt = now;
  }
  const latest = mine[0];
  if (latest !== undefined) {
    void emitViaExpress('chat.dm.read', {
      conversationId: conversation.id,
      readerId: userId,
      lastMessageId: latest.id,
      readAt: now,
    });
  }
  return mine.length;
}

/** 무한 스크롤 확인용: 과거 메시지 count개를 서로 번갈아 만든다 (방송 없음, 양쪽 모두 읽은 상태로) */
export function seedDm(userId: string, count: number, now: number = Date.now()): number {
  if (state.users.every((u) => u.id !== userId)) {
    return 0;
  }
  const conversation = ensureConversation(userId, now);
  for (let i = 0; i < count; i += 1) {
    const mine = i % 2 === 1;
    state.dmMessages.push({
      id: nextId('dm'),
      kind: 'dm',
      conversationId: conversation.id,
      senderId: mine ? state.me.id : userId,
      content: `옛 메시지 ${String(i + 1)}`,
      links: [],
      createdAt: now - (count - i) * 60_000,
      readAt: now - (count - i) * 60_000 + 1,
    });
  }
  const latest = messagesOf(conversation.id)[0];
  if (latest !== undefined) {
    conversation.lastMessage = latest;
    conversation.updatedAt = latest.createdAt;
  }
  return count;
}

/** 가짜 상대 봇: 내 DM을 delayMs 뒤 읽고, 조금 뒤 짧게 답한다. delayMs ≤ 0이면 끈다 (E2E) */
export function scheduleBot(userId: string, delayMs: number): void {
  if (delayMs <= 0) {
    return;
  }
  setTimeout(() => {
    readMyMessagesBy(userId);
  }, delayMs);
  setTimeout(() => {
    receiveDmFrom(userId, BOT_REPLIES[state.idCounter % BOT_REPLIES.length] ?? '네!');
  }, delayMs + 1500);
}
