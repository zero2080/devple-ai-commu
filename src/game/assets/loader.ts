// 스프라이트·맵 로딩은 여기 한 곳에서 (CONVENTIONS 6장). 컴포넌트에서 new Image()·JSON import 금지.
import type { MapData } from '@/domain';
import { mapDataSchema } from '@/transport/schemas';

const MAP_MODULES: Record<string, () => Promise<{ default: unknown }>> = {
  main: () => import('@/assets/maps/main.json'),
};

const mapCache = new Map<string, Promise<MapData>>();

/** mapId로 정적 맵 JSON을 읽고 스키마로 검증한다. 같은 맵은 한 번만 읽는다 */
export function loadMap(mapId: string): Promise<MapData> {
  const cached = mapCache.get(mapId);
  if (cached !== undefined) {
    return cached;
  }
  const loader = MAP_MODULES[mapId];
  if (loader === undefined) {
    return Promise.reject(new Error(`unknown map "${mapId}"`));
  }
  const promise = loader().then((mod) => mapDataSchema.parse(mod.default));
  mapCache.set(mapId, promise);
  return promise;
}
