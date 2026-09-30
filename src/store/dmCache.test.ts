import { beforeEach, describe, expect, it } from 'vitest';

import type { DmConversation, DmMessage, User } from '@/domain';
import { TEST_APPEARANCE } from '@/test/fixtures';

import {
  applyDmRead,
  markConversationRead,
  markIncomingRead,
  removeDmMessage,
  splitConversationPage,
  totalUnread,
  upsertDmMessage,
  type ConversationsData,
  type ThreadData,
} from './dmCache';
import { createQueryClient } from './queryClient';
import { queryKeys } from './queryKeys';

const ME = 'me';
const user = (id: string): User => ({
  id,
  nickname: `n-${id}`,
  appearance: TEST_APPEARANCE,
  role: 'member',
  status: 'active',
  createdAt: 1,
});
const msg = (
  id: string,
  senderId: string,
  createdAt: number,
  conversationId = 'c1',
): DmMessage => ({
  id,
  kind: 'dm',
  conversationId,
  senderId,
  content: id,
  links: [],
  createdAt,
});
const conv = (
  id: string,
  peer: string,
  unreadCount = 0,
  lastMessage?: DmMessage,
): DmConversation => ({
  id,
  participantIds: [ME, peer],
  unreadCount,
  updatedAt: lastMessage?.createdAt ?? 0,
  ...(lastMessage === undefined ? {} : { lastMessage }),
});
const list = (...items: DmConversation[]): ConversationsData => ({
  pages: [{ items, nextCursor: null }],
  pageParams: [undefined],
});
const thread = (...items: DmMessage[]): ThreadData => ({
  pages: [{ items, nextCursor: null }],
  pageParams: [undefined],
});

let qc = createQueryClient();

beforeEach(() => {
  qc = createQueryClient();
});

describe('splitConversationPage', () => {
  it('peer는 사용자 캐시로 보내고 대화만 남긴다 (DOMAIN 9)', () => {
    const page = splitConversationPage(qc, {
      items: [{ ...conv('c1', 'a'), peer: user('a') }],
      nextCursor: 'x',
    });
    expect(page).toEqual({ items: [conv('c1', 'a')], nextCursor: 'x' });
    expect(qc.getQueryData(queryKeys.user('a'))).toEqual(user('a'));
  });
});

describe('upsertDmMessage', () => {
  it('받은 메시지는 스레드 맨 앞(최신)에 넣고 목록 맨 위로 올리며 안 읽음 +1', () => {
    qc.setQueryData(queryKeys.dmThread('a'), thread(msg('m1', 'a', 1)));
    qc.setQueryData(queryKeys.dmConversations(), list(conv('c2', 'b', 0), conv('c1', 'a', 0)));
    upsertDmMessage(
      qc,
      { ...msg('m2', 'a', 5), sender: user('a'), peerId: 'a' } as DmMessage,
      'a',
      ME,
    );
    expect(
      qc.getQueryData<ThreadData>(queryKeys.dmThread('a'))?.pages[0]?.items.map((m) => m.id),
    ).toEqual(['m2', 'm1']);
    const items = qc.getQueryData<ConversationsData>(queryKeys.dmConversations())?.pages[0]?.items;
    expect(items?.map((c) => [c.id, c.unreadCount, c.lastMessage?.id])).toEqual([
      ['c1', 1, 'm2'],
      ['c2', 0, undefined],
    ]);
    // 이벤트 전용 필드는 캐시에 남지 않는다
    expect(qc.getQueryData<ThreadData>(queryKeys.dmThread('a'))?.pages[0]?.items[0]).toEqual(
      msg('m2', 'a', 5),
    );
  });

  it('같은 id는 한 번만 넣고 안 읽음도 한 번만 센다', () => {
    qc.setQueryData(queryKeys.dmThread('a'), thread());
    qc.setQueryData(queryKeys.dmConversations(), list(conv('c1', 'a')));
    upsertDmMessage(qc, msg('m1', 'a', 1), 'a', ME);
    upsertDmMessage(qc, msg('m1', 'a', 1), 'a', ME);
    expect(qc.getQueryData<ThreadData>(queryKeys.dmThread('a'))?.pages[0]?.items).toHaveLength(1);
    expect(totalUnread(qc.getQueryData(queryKeys.dmConversations()))).toBe(1);
  });

  it('내가 보낸 메시지는 안 읽음을 올리지 않고, 목록에 없던 대화는 새로 만든다', () => {
    qc.setQueryData(queryKeys.dmConversations(), list(conv('c9', 'z')));
    upsertDmMessage(qc, msg('m1', ME, 7, 'c1'), 'a', ME);
    expect(
      qc.getQueryData<ConversationsData>(queryKeys.dmConversations())?.pages[0]?.items[0],
    ).toEqual({
      id: 'c1',
      participantIds: [ME, 'a'],
      unreadCount: 0,
      updatedAt: 7,
      lastMessage: msg('m1', ME, 7, 'c1'),
    });
  });

  it('스레드·목록 캐시가 없으면 건드리지 않는다 (열 때 받아온다)', () => {
    upsertDmMessage(qc, msg('m1', 'a', 1), 'a', ME);
    expect(qc.getQueryData(queryKeys.dmThread('a'))).toBeUndefined();
    expect(qc.getQueryData(queryKeys.dmConversations())).toBeUndefined();
  });
});

describe('removeDmMessage', () => {
  it('모든 스레드에서 그 id를 지운다', () => {
    qc.setQueryData(queryKeys.dmThread('a'), thread(msg('m2', ME, 2), msg('m1', 'a', 1)));
    qc.setQueryData(queryKeys.dmThread('b'), thread(msg('x', 'b', 1, 'c2')));
    removeDmMessage(qc, 'm2');
    expect(
      qc.getQueryData<ThreadData>(queryKeys.dmThread('a'))?.pages[0]?.items.map((m) => m.id),
    ).toEqual(['m1']);
    expect(qc.getQueryData<ThreadData>(queryKeys.dmThread('b'))?.pages[0]?.items).toHaveLength(1);
  });
});

describe('applyDmRead', () => {
  it('그 대화의 내 메시지 중 lastMessageId까지 readAt을 채운다', () => {
    qc.setQueryData(
      queryKeys.dmThread('a'),
      thread(msg('m3', ME, 30), msg('m2', ME, 20), msg('m1', 'a', 10)),
    );
    qc.setQueryData(queryKeys.dmConversations(), list(conv('c1', 'a', 0, msg('m3', ME, 30))));
    applyDmRead(qc, { conversationId: 'c1', lastMessageId: 'm2', readAt: 99 }, ME);
    const items = qc.getQueryData<ThreadData>(queryKeys.dmThread('a'))?.pages[0]?.items;
    expect(items?.map((m) => [m.id, m.readAt])).toEqual([
      ['m3', undefined],
      ['m2', 99],
      ['m1', undefined], // 상대 메시지는 그대로
    ]);
  });

  it('lastMessageId가 캐시에 없으면 readAt 시각 이전 내 메시지를 읽은 것으로 본다', () => {
    qc.setQueryData(queryKeys.dmThread('a'), thread(msg('m2', ME, 200), msg('m1', ME, 50)));
    qc.setQueryData(queryKeys.dmConversations(), list(conv('c1', 'a', 0, msg('m2', ME, 200))));
    applyDmRead(qc, { conversationId: 'c1', lastMessageId: 'unknown', readAt: 100 }, ME);
    expect(
      qc.getQueryData<ThreadData>(queryKeys.dmThread('a'))?.pages[0]?.items.map((m) => m.readAt),
    ).toEqual([undefined, 100]);
    expect(
      qc.getQueryData<ConversationsData>(queryKeys.dmConversations())?.pages[0]?.items[0]
        ?.lastMessage?.readAt,
    ).toBe(100);
  });
});

describe('markConversationRead / totalUnread', () => {
  it('그 상대와의 대화 안 읽음을 0으로, 합계는 목록에서 파생', () => {
    qc.setQueryData(queryKeys.dmConversations(), list(conv('c1', 'a', 3), conv('c2', 'b', 2)));
    expect(totalUnread(qc.getQueryData(queryKeys.dmConversations()))).toBe(5);
    markConversationRead(qc, 'a');
    expect(totalUnread(qc.getQueryData(queryKeys.dmConversations()))).toBe(2);
    expect(totalUnread(undefined)).toBe(0);
  });
});

describe('markIncomingRead', () => {
  it('상대가 보낸 메시지에만 readAt을 채운다', () => {
    qc.setQueryData(queryKeys.dmThread('a'), thread(msg('m2', ME, 2), msg('m1', 'a', 1)));
    markIncomingRead(qc, 'a', ME, 77);
    expect(
      qc.getQueryData<ThreadData>(queryKeys.dmThread('a'))?.pages[0]?.items.map((m) => m.readAt),
    ).toEqual([undefined, 77]);
    markIncomingRead(qc, 'zz', ME, 1); // 캐시 없음
  });
});
