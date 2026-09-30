import { beforeEach, describe, expect, it } from 'vitest';

import { useChatStore } from '@/store/chatStore';
import { useWorldStore } from '@/store/worldStore';

import { SseRegistry } from '../registry';
import { ALL_SSE_HANDLERS } from './index';

const registry = new SseRegistry();
registry.registerAll(ALL_SSE_HANDLERS);

const payload = {
  id: 'pm_1',
  kind: 'public',
  senderId: 'u_01',
  content: '안녕하세요 https://example.com',
  links: ['https://example.com'],
  createdAt: 1,
  position: { mapId: 'main', x: 20, y: 15, dir: 'down' },
  sender: { nickname: '도트', avatarId: 'char_01' },
};

beforeEach(() => {
  useChatStore.getState().reset();
  useWorldStore.getState().setMyUserId('u_me');
});

describe('chat.public 핸들러', () => {
  it('로그와 말풍선에 반영한다', () => {
    expect(registry.dispatch({ id: '9', type: 'chat.public', ts: 1, payload })).toBe('handled');
    expect(useChatStore.getState().publicLog[0]).toMatchObject({
      senderNickname: '도트',
      links: ['https://example.com'],
    });
    expect(useChatStore.getState().bubbles[0]).toMatchObject({ userId: 'u_01', variant: 'public' });
  });

  it('kind가 public이 아니면 무시한다 (zod)', () => {
    expect(
      registry.dispatch({
        id: '9',
        type: 'chat.public',
        ts: 1,
        payload: { ...payload, kind: 'dm' },
      }),
    ).toBe('invalid');
    expect(useChatStore.getState().publicLog).toEqual([]);
  });
});
