import { beforeEach, describe, expect, it } from 'vitest';

import type { Position } from '@/domain';
import { useAuthStore } from '@/store/authStore';
import { useChatStore } from '@/store/chatStore';
import type { ConversationsData, ThreadData } from '@/store/dmCache';
import { queryClient } from '@/store/queryClient';
import { queryKeys } from '@/store/queryKeys';
import { useWorldStore } from '@/store/worldStore';

import { SseRegistry } from '../registry';
import { ALL_SSE_HANDLERS } from './index';

const registry = new SseRegistry();
registry.registerAll(ALL_SSE_HANDLERS);

const pos = (x: number, y: number): Position => ({ mapId: 'main', x, y, dir: 'down' });
const sender = (id: string) => ({
  id,
  nickname: `n-${id}`,
  avatarId: 'char_01',
  role: 'member',
  status: 'active',
  createdAt: 1,
});
const dm = (id: string, senderId: string, peerId: string) => ({
  id,
  kind: 'dm',
  conversationId: 'c1',
  senderId,
  content: `내용-${id}`,
  links: [],
  createdAt: 10,
  sender: sender(senderId),
  peerId,
});

function placeWorld(near: Position, far: Position): void {
  const world = useWorldStore.getState();
  world.reset();
  world.setMyUserId('u_me');
  world.applySnapshot({
    mapId: 'main',
    serverTime: 1,
    presences: [
      {
        userId: 'u_me',
        nickname: 'me',
        avatarId: 'char_01',
        position: pos(20, 15),
        state: 'online',
        updatedAt: 1,
      },
      {
        userId: 'near',
        nickname: 'near',
        avatarId: 'char_01',
        position: near,
        state: 'online',
        updatedAt: 1,
      },
      {
        userId: 'far',
        nickname: 'far',
        avatarId: 'char_01',
        position: far,
        state: 'online',
        updatedAt: 1,
      },
    ],
  });
}

beforeEach(() => {
  queryClient.clear();
  useChatStore.getState().reset();
  useAuthStore.getState().setSession({
    accessToken: 't',
    expiresIn: 900,
    me: {
      ...sender('u_me'),
      role: 'member',
      status: 'active',
      email: 'a@b.c',
      phone: '010',
    } as never,
    config: {
      proximityRadius: 5,
      positionBatchMs: 200,
      serverTickMs: 200,
      maxMessageLength: 200,
      defaultMapId: 'main',
      maxGroupMembers: 10,
      avatarIds: ['char_01'],
    },
  });
  placeWorld(pos(22, 15), pos(35, 15));
});

describe('chat.dm', () => {
  it('반경 안 발신자의 DM은 발신자 머리 위 DM 말풍선, 캐시·사용자 캐시에 반영', () => {
    queryClient.setQueryData<ConversationsData>(queryKeys.dmConversations(), {
      pages: [{ items: [], nextCursor: null }],
      pageParams: [undefined],
    });
    expect(
      registry.dispatch({ id: '1', type: 'chat.dm', ts: 1, payload: dm('d1', 'near', 'near') }),
    ).toBe('handled');
    expect(useChatStore.getState().bubbles).toMatchObject([
      { id: 'd1', userId: 'near', variant: 'dm' },
    ]);
    expect(queryClient.getQueryData(queryKeys.user('near'))).toMatchObject({ nickname: 'n-near' });
    expect(
      queryClient.getQueryData<ConversationsData>(queryKeys.dmConversations())?.pages[0]?.items[0],
    ).toMatchObject({ unreadCount: 1 });
  });

  it('반경 밖 발신자의 DM은 말풍선 없이 패널에만', () => {
    registry.dispatch({ id: '1', type: 'chat.dm', ts: 1, payload: dm('d2', 'far', 'far') });
    expect(useChatStore.getState().bubbles).toEqual([]);
  });

  it('내 에코는 같은 본문의 pending을 해소하고, 상대가 반경 안이면 내 머리 위', () => {
    const temp = useChatStore.getState().addPendingDm('near', '내용-d3', 1);
    registry.dispatch({ id: '1', type: 'chat.dm', ts: 1, payload: dm('d3', 'u_me', 'near') });
    expect(useChatStore.getState().pendingDm.find((p) => p.tempId === temp)).toBeUndefined();
    expect(useChatStore.getState().bubbles).toMatchObject([{ userId: 'u_me', variant: 'dm' }]);
  });
});

describe('chat.dm.recalled / chat.dm.read', () => {
  it('회수는 스레드와 말풍선에서 지우고, 읽음은 내 메시지에 readAt을 채운다', () => {
    queryClient.setQueryData<ThreadData>(queryKeys.dmThread('near'), {
      pages: [
        {
          items: [
            {
              id: 'd4',
              kind: 'dm',
              conversationId: 'c1',
              senderId: 'u_me',
              content: 'x',
              links: [],
              createdAt: 5,
            },
          ],
          nextCursor: null,
        },
      ],
      pageParams: [undefined],
    });
    registry.dispatch({
      id: '1',
      type: 'chat.dm.read',
      ts: 1,
      payload: { conversationId: 'c1', readerId: 'near', lastMessageId: 'd4', readAt: 50 },
    });
    expect(
      queryClient.getQueryData<ThreadData>(queryKeys.dmThread('near'))?.pages[0]?.items[0]?.readAt,
    ).toBe(50);

    useChatStore
      .getState()
      .showBubble({ id: 'd4', userId: 'u_me', content: 'x', links: [] }, 'dm', 1);
    registry.dispatch({
      id: '2',
      type: 'chat.dm.recalled',
      ts: 1,
      payload: { conversationId: 'c1', messageId: 'd4' },
    });
    expect(
      queryClient.getQueryData<ThreadData>(queryKeys.dmThread('near'))?.pages[0]?.items,
    ).toEqual([]);
    expect(useChatStore.getState().bubbles).toEqual([]);
  });
});
