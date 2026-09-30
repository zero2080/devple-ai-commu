// 재동기화 (API_CONTRACT 3.5, ARCHITECTURE 4.1): sync.required 수신 또는 60초 초과 단절 뒤 다시 연결됐을 때.
// 월드는 스냅샷과 같은 경로로 교체, DM·그룹 목록·상세는 무효화, 열린 스레드는 최신 페이지만 다시 받는다
import { useAuthStore } from '@/store/authStore';
import { queryClient } from '@/store/queryClient';
import { queryKeys } from '@/store/queryKeys';
import { useWorldStore } from '@/store/worldStore';

import { fetchPresences } from '../api/world';

let inFlight: Promise<void> | null = null;

async function run(): Promise<void> {
  const mapId = useWorldStore.getState().mapId ?? useAuthStore.getState().config?.defaultMapId;
  const caches = Promise.allSettled([
    queryClient.invalidateQueries({ queryKey: queryKeys.dmConversations() }),
    queryClient.invalidateQueries({ queryKey: queryKeys.groups() }),
    queryClient.invalidateQueries({ queryKey: queryKeys.groupDetails() }),
    // 스레드는 쌓아 둔 이전 페이지까지 다시 받지 않고 첫 페이지부터 (API_CONTRACT 3.5 "최신 페이지 재조회")
    queryClient.resetQueries({ queryKey: queryKeys.dmThreads() }),
    queryClient.resetQueries({ queryKey: queryKeys.groupThreads() }),
  ]);
  if (mapId !== undefined) {
    try {
      useWorldStore.getState().applySnapshot(await fetchPresences(mapId));
    } catch (error) {
      console.warn('[sync] presences refetch failed', error);
    }
  }
  await caches;
}

/** 동시에 여러 번 불려도(sync.required + 긴 단절) 진행 중인 한 번을 공유한다 */
export function resyncAll(): Promise<void> {
  inFlight ??= run().finally(() => {
    inFlight = null;
  });
  return inFlight;
}
