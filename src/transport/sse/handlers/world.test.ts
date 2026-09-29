import { beforeEach, describe, expect, it } from 'vitest';

import { useWorldStore } from '@/store/worldStore';

import { SseRegistry } from '../registry';
import { ALL_SSE_HANDLERS } from './index';

const registry = new SseRegistry();
registry.registerAll(ALL_SSE_HANDLERS);

const presence = (userId: string, x: number, y: number) => ({
  userId,
  nickname: userId,
  avatarId: 'char_01',
  position: { mapId: 'main', x, y, dir: 'down' },
  state: 'online',
  updatedAt: 1,
});

beforeEach(() => {
  useWorldStore.getState().reset();
  useWorldStore.getState().setMyUserId('me');
});

describe('world.* / presence.* 핸들러', () => {
  it('world.snapshot → 스토어 교체, world.positions → 본인 제외 갱신', () => {
    expect(
      registry.dispatch({
        id: '1',
        type: 'world.snapshot',
        ts: 1,
        payload: {
          mapId: 'main',
          presences: [presence('me', 1, 1), presence('a', 2, 2)],
          serverTime: 5,
        },
      }),
    ).toBe('handled');
    expect(
      registry.dispatch({
        id: '2',
        type: 'world.positions',
        ts: 2,
        payload: {
          mapId: 'main',
          positions: [
            { userId: 'a', x: 3, y: 3, dir: 'left' },
            { userId: 'me', x: 7, y: 7, dir: 'up' },
          ],
        },
      }),
    ).toBe('handled');
    const s = useWorldStore.getState();
    expect(s.presences.get('a')?.position).toMatchObject({ x: 3, y: 3, dir: 'left' });
    expect(s.presences.get('me')?.position).toMatchObject({ x: 1, y: 1 });
  });

  it('presence.joined / presence.left', () => {
    expect(
      registry.dispatch({ id: '3', type: 'presence.joined', ts: 3, payload: presence('b', 4, 4) }),
    ).toBe('handled');
    expect(useWorldStore.getState().presences.has('b')).toBe(true);
    expect(
      registry.dispatch({ id: '4', type: 'presence.left', ts: 4, payload: { userId: 'b' } }),
    ).toBe('handled');
    expect(useWorldStore.getState().presences.has('b')).toBe(false);
  });

  it('좌표가 정수가 아니면 무시한다 (zod)', () => {
    expect(
      registry.dispatch({
        id: '5',
        type: 'world.positions',
        ts: 5,
        payload: { mapId: 'main', positions: [{ userId: 'a', x: 1.5, y: 1, dir: 'up' }] },
      }),
    ).toBe('invalid');
  });
});
