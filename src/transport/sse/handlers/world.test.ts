import { beforeEach, describe, expect, it } from 'vitest';

import { useAuthStore } from '@/store/authStore';
import { queryClient } from '@/store/queryClient';
import { queryKeys } from '@/store/queryKeys';
import { useWorldStore } from '@/store/worldStore';
import { TEST_APPEARANCE } from '@/test/fixtures';

import { SseRegistry } from '../registry';
import { ALL_SSE_HANDLERS } from './index';

const registry = new SseRegistry();
registry.registerAll(ALL_SSE_HANDLERS);

const presence = (userId: string, x: number, y: number) => ({
  userId,
  nickname: userId,
  appearance: TEST_APPEARANCE,
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

  it('presence.updated → 상태·닉네임·외형 전체를 월드와 사용자 캐시에 반영 (API_CONTRACT 3.3)', () => {
    const world = useWorldStore.getState();
    world.addPresence(presence('u_1', 3, 3) as Parameters<typeof world.addPresence>[0]);
    queryClient.setQueryData(queryKeys.user('u_1'), {
      id: 'u_1',
      nickname: 'u_1',
      appearance: TEST_APPEARANCE,
      role: 'member',
      status: 'active',
      createdAt: 1,
    });
    const look = { ...TEST_APPEARANCE, hat: { itemId: 'hat_cap' }, hair: null };
    registry.dispatch({
      id: '9',
      type: 'presence.updated',
      ts: 1,
      payload: { userId: 'u_1', state: 'away', nickname: '새닉', appearance: look },
    });
    expect(useWorldStore.getState().presences.get('u_1')).toMatchObject({
      state: 'away',
      nickname: '새닉',
      appearance: look,
    });
    expect(queryClient.getQueryData(queryKeys.user('u_1'))).toMatchObject({
      nickname: '새닉',
      appearance: look,
    });
    // 외형이 부분 객체면 스키마에서 거른다 (모든 키 필수, DOMAIN 3.7)
    registry.dispatch({
      id: '10',
      type: 'presence.updated',
      ts: 1,
      payload: { userId: 'u_1', appearance: { skin: 'skin_1' } },
    });
    expect(useWorldStore.getState().presences.get('u_1')?.appearance).toEqual(look);
  });

  it('presence.updated가 내 것이면(다른 탭의 옷장 저장) authStore.me 외형·닉네임도 맞춘다', () => {
    const config = {
      proximityRadius: 5,
      positionBatchMs: 200,
      serverTickMs: 200,
      maxMessageLength: 200,
      defaultMapId: 'main',
      maxGroupMembers: 10,
      avatarOptions: { itemIds: [], skinRampIds: [], hairRampIds: [], itemRampIds: [] },
    };
    const me = {
      id: 'me',
      nickname: '나',
      appearance: TEST_APPEARANCE,
      role: 'member' as const,
      status: 'active' as const,
      createdAt: 1,
      email: 'me@example.com',
      phone: '010',
    };
    useAuthStore.getState().setMe(me, config);
    const look = { ...TEST_APPEARANCE, skin: 'skin_4' };
    registry.dispatch({
      id: '11',
      type: 'presence.updated',
      ts: 1,
      payload: { userId: 'me', appearance: look },
    });
    expect(useAuthStore.getState().me).toEqual({ ...me, appearance: look });
    // 남의 변경·상태만 바뀐 경우는 건드리지 않는다
    registry.dispatch({
      id: '12',
      type: 'presence.updated',
      ts: 1,
      payload: { userId: 'a', nickname: '남' },
    });
    registry.dispatch({
      id: '13',
      type: 'presence.updated',
      ts: 1,
      payload: { userId: 'me', state: 'away' },
    });
    expect(useAuthStore.getState().me).toEqual({ ...me, appearance: look });
    useAuthStore.getState().clear();
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
