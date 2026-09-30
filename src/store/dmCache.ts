// DM Query 캐시 갱신 (ARCHITECTURE 5·7장). SSE 핸들러(transport)와 전송 액션(features)이 함께 쓴다.
// 캐시에는 기본 엔티티만 둔다: 응답의 peer, 이벤트의 sender는 users.byId로 분해 (DOMAIN 9 이중 저장 금지).
import type { InfiniteData, QueryClient } from '@tanstack/react-query';

import type { DmConversation, DmConversationWithPeer, DmMessage, User } from '@/domain';

import { queryKeys } from './queryKeys';

/** API_CONTRACT 1.1 목록 응답 형태 */
export interface CursorPage<T> {
  items: T[];
  nextCursor: string | null;
}

export type ConversationsData = InfiniteData<CursorPage<DmConversation>, string | undefined>;
export type ThreadData = InfiniteData<CursorPage<DmMessage>, string | undefined>;

export function rememberUser(qc: QueryClient, user: User): void {
  qc.setQueryData(queryKeys.user(user.id), user);
}

/** GET /dm 한 페이지: peer는 사용자 캐시로 보내고 대화만 남긴다 */
export function splitConversationPage(
  qc: QueryClient,
  page: CursorPage<DmConversationWithPeer>,
): CursorPage<DmConversation> {
  return {
    nextCursor: page.nextCursor,
    items: page.items.map(({ peer, ...conversation }) => {
      rememberUser(qc, peer);
      return conversation;
    }),
  };
}

function stripEvent(message: DmMessage & { sender?: unknown; peerId?: unknown }): DmMessage {
  const base: DmMessage = {
    id: message.id,
    kind: 'dm',
    conversationId: message.conversationId,
    senderId: message.senderId,
    content: message.content,
    links: message.links,
    createdAt: message.createdAt,
  };
  return message.readAt === undefined ? base : { ...base, readAt: message.readAt };
}

function threadHas(data: ThreadData, id: string): boolean {
  return data.pages.some((page) => page.items.some((m) => m.id === id));
}

/**
 * 새 메시지 반영 (받은 것·보낸 것 공통). 스레드 캐시가 있으면 첫 페이지 앞에 추가(id 중복 제거),
 * 대화 목록은 맨 위로 올리고 상대가 보낸 것이면 안 읽음 +1. 목록에 없는 대화면 새로 만든다 (참여자 = 나·상대)
 */
export function upsertDmMessage(
  qc: QueryClient,
  input: DmMessage,
  peerId: string,
  myUserId: string,
): void {
  const message = stripEvent(input);
  const incoming = message.senderId !== myUserId;

  qc.setQueryData<ThreadData>(queryKeys.dmThread(peerId), (old) => {
    if (old === undefined || threadHas(old, message.id)) {
      return old;
    }
    const [first, ...rest] = old.pages;
    const head: CursorPage<DmMessage> = {
      items: [message, ...(first?.items ?? [])],
      nextCursor: first?.nextCursor ?? null,
    };
    return { ...old, pages: [head, ...rest] };
  });

  qc.setQueryData<ConversationsData>(queryKeys.dmConversations(), (old) => {
    if (old === undefined) {
      return old;
    }
    let existing: DmConversation | undefined;
    const pages = old.pages.map((page) => ({
      ...page,
      items: page.items.filter((c) => {
        if (c.id === message.conversationId) {
          existing = c;
          return false;
        }
        return true;
      }),
    }));
    const alreadyLatest = existing?.lastMessage?.id === message.id;
    const updated: DmConversation = {
      id: message.conversationId,
      participantIds: existing?.participantIds ?? [myUserId, peerId],
      unreadCount: (existing?.unreadCount ?? 0) + (incoming && !alreadyLatest ? 1 : 0),
      updatedAt: Math.max(existing?.updatedAt ?? 0, message.createdAt),
      lastMessage: message,
    };
    const [first, ...rest] = pages;
    return {
      ...old,
      pages: [
        { items: [updated, ...(first?.items ?? [])], nextCursor: first?.nextCursor ?? null },
        ...rest,
      ],
    };
  });
}

/** 회수·삭제: 모든 스레드에서 제거하고, 목록은 마지막 메시지·안 읽음이 바뀔 수 있어 다시 받는다 */
export function removeDmMessage(qc: QueryClient, messageId: string): void {
  qc.setQueriesData<ThreadData>({ queryKey: queryKeys.dmThreads() }, (old) => {
    if (old === undefined || !threadHas(old, messageId)) {
      return old;
    }
    return {
      ...old,
      pages: old.pages.map((page) => ({
        ...page,
        items: page.items.filter((m) => m.id !== messageId),
      })),
    };
  });
  void qc.invalidateQueries({ queryKey: queryKeys.dmConversations() });
}

/**
 * 상대가 읽음 (chat.dm.read): 그 대화의 내 메시지 중 lastMessageId까지 readAt을 채운다.
 * lastMessageId가 캐시에 없으면 readAt 시각 이전에 만든 내 메시지를 읽은 것으로 본다
 */
export function applyDmRead(
  qc: QueryClient,
  read: { conversationId: string; lastMessageId: string; readAt: number },
  myUserId: string,
): void {
  const mark = (m: DmMessage, until: number): DmMessage =>
    m.conversationId === read.conversationId &&
    m.senderId === myUserId &&
    m.readAt === undefined &&
    m.createdAt <= until
      ? { ...m, readAt: read.readAt }
      : m;
  qc.setQueriesData<ThreadData>({ queryKey: queryKeys.dmThreads() }, (old) => {
    if (old === undefined) {
      return old;
    }
    const anchor = old.pages.flatMap((p) => p.items).find((m) => m.id === read.lastMessageId);
    const until = anchor?.createdAt ?? read.readAt;
    return {
      ...old,
      pages: old.pages.map((page) => ({ ...page, items: page.items.map((m) => mark(m, until)) })),
    };
  });
  qc.setQueryData<ConversationsData>(queryKeys.dmConversations(), (old) =>
    old === undefined
      ? old
      : {
          ...old,
          pages: old.pages.map((page) => ({
            ...page,
            items: page.items.map((c) =>
              c.lastMessage === undefined
                ? c
                : { ...c, lastMessage: mark(c.lastMessage, c.lastMessage.createdAt) },
            ),
          })),
        },
  );
}

/** 내가 스레드를 읽음 처리: 목록의 안 읽음을 0으로 (서버에는 POST /dm/{userId}/read) */
export function markConversationRead(qc: QueryClient, peerId: string): void {
  qc.setQueryData<ConversationsData>(queryKeys.dmConversations(), (old) =>
    old === undefined
      ? old
      : {
          ...old,
          pages: old.pages.map((page) => ({
            ...page,
            items: page.items.map((c) =>
              c.participantIds.includes(peerId) ? { ...c, unreadCount: 0 } : c,
            ),
          })),
        },
  );
}

/** 내가 스레드를 읽음: 상대가 보낸 메시지에 readAt을 채워 같은 메시지로 다시 읽음 요청하지 않게 한다 */
export function markIncomingRead(
  qc: QueryClient,
  peerId: string,
  myUserId: string,
  now: number,
): void {
  qc.setQueryData<ThreadData>(queryKeys.dmThread(peerId), (old) =>
    old === undefined
      ? old
      : {
          ...old,
          pages: old.pages.map((page) => ({
            ...page,
            items: page.items.map((m) =>
              m.senderId !== myUserId && m.readAt === undefined ? { ...m, readAt: now } : m,
            ),
          })),
        },
  );
}

/** 탭 배지용: 목록 캐시에서 안 읽음 합계를 파생 (별도 저장 없음, ARCHITECTURE 7) */
export function totalUnread(data: ConversationsData | undefined): number {
  return (
    data?.pages.reduce((sum, page) => sum + page.items.reduce((s, c) => s + c.unreadCount, 0), 0) ??
    0
  );
}
