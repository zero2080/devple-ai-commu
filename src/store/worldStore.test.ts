import { beforeEach, describe, expect, it } from 'vitest';

import type { Presence } from '@/domain';

import { useWorldStore } from './worldStore';

function presence(userId: string, x: number, y: number): Presence {
  return {
    userId,
    nickname: userId,
    avatarId: 'char_01',
    position: { mapId: 'main', x, y, dir: 'down' },
    state: 'online',
    updatedAt: 1,
  };
}

beforeEach(() => {
  useWorldStore.getState().reset();
  useWorldStore.getState().setMyUserId('me');
});

describe('worldStore', () => {
  it('스냅샷은 presences·positions를 통째로 교체한다', () => {
    useWorldStore.getState().applySnapshot({
      mapId: 'main',
      presences: [presence('me', 1, 1), presence('a', 2, 2)],
      serverTime: 10,
    });
    const s = useWorldStore.getState();
    expect(s.mapId).toBe('main');
    expect(s.presences.size).toBe(2);
    expect(s.positions.get('a')).toEqual({ mapId: 'main', x: 2, y: 2, dir: 'down' });
    expect(s.revision).toBe(1);
    expect(s.snapshotRevision).toBe(1);
    expect(s.myPosition).toEqual({ mapId: 'main', x: 1, y: 1, dir: 'down' });
  });

  it('world.positions는 본인 항목을 무시한다', () => {
    useWorldStore.getState().applySnapshot({
      mapId: 'main',
      presences: [presence('me', 1, 1), presence('a', 2, 2)],
      serverTime: 10,
    });
    useWorldStore.getState().applyPositions('main', [
      { userId: 'me', x: 9, y: 9, dir: 'up' },
      { userId: 'a', x: 3, y: 2, dir: 'right' },
    ]);
    const s = useWorldStore.getState();
    expect(s.presences.get('me')?.position).toMatchObject({ x: 1, y: 1 });
    expect(s.presences.get('a')?.position).toMatchObject({ x: 3, y: 2, dir: 'right' });
    expect(s.revision).toBe(2);
  });

  it('모르는 userId·다른 맵·변경 없음은 revision을 올리지 않는다', () => {
    useWorldStore
      .getState()
      .applySnapshot({ mapId: 'main', presences: [presence('a', 2, 2)], serverTime: 10 });
    useWorldStore.getState().applyPositions('main', [{ userId: 'ghost', x: 1, y: 1, dir: 'up' }]);
    useWorldStore.getState().applyPositions('other', [{ userId: 'a', x: 5, y: 5, dir: 'up' }]);
    useWorldStore.getState().applyPositions('main', [{ userId: 'a', x: 2, y: 2, dir: 'down' }]);
    expect(useWorldStore.getState().revision).toBe(1);
    expect(useWorldStore.getState().presences.get('a')?.position).toMatchObject({ x: 2, y: 2 });
  });

  it('joined/left/updated는 presences와 positions를 함께 갱신한다', () => {
    useWorldStore.getState().addPresence(presence('b', 4, 4));
    expect(useWorldStore.getState().positions.get('b')).toMatchObject({ x: 4, y: 4 });
    useWorldStore.getState().updatePresence({ userId: 'b', state: 'away', nickname: '비' });
    expect(useWorldStore.getState().presences.get('b')).toMatchObject({
      state: 'away',
      nickname: '비',
    });
    useWorldStore.getState().removePresence('b');
    expect(useWorldStore.getState().presences.has('b')).toBe(false);
    expect(useWorldStore.getState().positions.has('b')).toBe(false);
  });
});
