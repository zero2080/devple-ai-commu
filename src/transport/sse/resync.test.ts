import { beforeEach, describe, expect, it, vi } from 'vitest';

import type { Presence } from '@/domain';
import { queryClient } from '@/store/queryClient';
import { queryKeys } from '@/store/queryKeys';
import { useWorldStore } from '@/store/worldStore';
import { TEST_APPEARANCE } from '@/test/fixtures';

import { ALL_SSE_HANDLERS } from './handlers';
import { SseRegistry } from './registry';
import { resyncAll } from './resync';

const worldApi = vi.hoisted(() => ({
  fetchPresences:
    vi.fn<
      (mapId: string) => Promise<{ mapId: string; presences: Presence[]; serverTime: number }>
    >(),
}));
vi.mock('../api/world', () => worldApi);

const registry = new SseRegistry();
registry.registerAll(ALL_SSE_HANDLERS);

const presence = (userId: string, x: number): Presence => ({
  userId,
  nickname: userId,
  appearance: TEST_APPEARANCE,
  position: { mapId: 'main', x, y: 5, dir: 'down' },
  state: 'online',
  updatedAt: 1,
});
const page = { pages: [{ items: [], nextCursor: null }], pageParams: [undefined] };

beforeEach(() => {
  queryClient.clear();
  vi.clearAllMocks();
  vi.spyOn(console, 'info').mockImplementation(() => undefined);
  const world = useWorldStore.getState();
  world.reset();
  world.setMyUserId('me');
  world.applySnapshot({
    mapId: 'main',
    presences: [presence('me', 1), presence('old', 2)],
    serverTime: 1,
  });
  worldApi.fetchPresences.mockResolvedValue({
    mapId: 'main',
    presences: [presence('me', 3), presence('new', 4)],
    serverTime: 99,
  });
  queryClient.setQueryData(queryKeys.dmConversations(), page);
  queryClient.setQueryData(queryKeys.groups(), { items: [] });
  queryClient.setQueryData(queryKeys.groupDetail('g1'), { group: {}, members: [] });
  queryClient.setQueryData(queryKeys.dmThread('u_01'), page);
  queryClient.setQueryData(queryKeys.groupThread('g1'), page);
});

describe('재동기화 (API_CONTRACT 3.5)', () => {
  it('월드를 스냅샷 경로로 교체하고, 목록·상세는 무효화, 열린 스레드는 비운다(최신 페이지부터)', async () => {
    const before = useWorldStore.getState().snapshotRevision;
    await resyncAll();
    expect(worldApi.fetchPresences).toHaveBeenCalledWith('main');
    const world = useWorldStore.getState();
    expect([...world.presences.keys()]).toEqual(['me', 'new']);
    expect(world.myPosition).toMatchObject({ x: 3 });
    expect(world.serverTime).toBe(99);
    expect(world.snapshotRevision).toBe(before + 1);
    for (const key of [
      queryKeys.dmConversations(),
      queryKeys.groups(),
      queryKeys.groupDetail('g1'),
    ]) {
      expect(queryClient.getQueryState(key)?.isInvalidated).toBe(true);
    }
    expect(queryClient.getQueryData(queryKeys.dmThread('u_01'))).toBeUndefined();
    expect(queryClient.getQueryData(queryKeys.groupThread('g1'))).toBeUndefined();
  });

  it('동시에 여러 번 불려도 한 번만 받는다 (sync.required 이벤트 경로 포함)', async () => {
    registry.dispatch({
      id: '1',
      type: 'sync.required',
      ts: 1,
      payload: { reason: 'server_restart' },
    });
    await Promise.all([resyncAll(), resyncAll()]);
    expect(worldApi.fetchPresences).toHaveBeenCalledTimes(1);
    await resyncAll();
    expect(worldApi.fetchPresences).toHaveBeenCalledTimes(2);
  });

  it('접속자 조회가 실패해도 캐시는 맞추고 월드는 그대로 둔다', async () => {
    vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    worldApi.fetchPresences.mockRejectedValue(new Error('offline'));
    await resyncAll();
    expect([...useWorldStore.getState().presences.keys()]).toEqual(['me', 'old']);
    expect(queryClient.getQueryState(queryKeys.groups())?.isInvalidated).toBe(true);
  });
});
