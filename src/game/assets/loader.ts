// 스프라이트·맵 로딩은 여기 한 곳에서 (CONVENTIONS 6장). 컴포넌트에서 new Image()·JSON import 금지 (new Image()는 이 파일만).
import { z } from 'zod';

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

// 아바타 레이어 시트 (GRAPHICS 2.4·6장). URL은 빌드가 수집하고, catalog.json의 상대 경로('hair/hair_long.back.png')로 찾는다
const AVATAR_SHEET_PREFIX = '../../assets/sprites/avatar/';
const AVATAR_SHEET_URLS = import.meta.glob<string>('../../assets/sprites/avatar/**/*.png', {
  eager: true,
  query: '?url',
  import: 'default',
});
const avatarSheetUrls = new Map(
  Object.entries(AVATAR_SHEET_URLS).map(([key, url]) => [
    key.slice(AVATAR_SHEET_PREFIX.length),
    url,
  ]),
);
const avatarSheetCache = new Map<string, Promise<HTMLImageElement>>();

/** catalog.json 기준 경로 → 번들 URL. 없는 시트면 undefined */
export function avatarSheetUrl(path: string): string | undefined {
  return avatarSheetUrls.get(path);
}

/** 레이어 시트 이미지를 읽어 디코드한다. 같은 경로는 한 번만 읽고, 실패하면 캐시에서 빼서 다시 시도할 수 있게 한다 */
export function loadAvatarSheet(path: string): Promise<HTMLImageElement> {
  const cached = avatarSheetCache.get(path);
  if (cached !== undefined) {
    return cached;
  }
  const url = avatarSheetUrls.get(path);
  if (url === undefined) {
    return Promise.reject(new Error(`unknown avatar sheet "${path}"`));
  }
  const image = new Image();
  image.src = url;
  const promise = image.decode().then(
    () => image,
    (error: unknown) => {
      avatarSheetCache.delete(path);
      throw error;
    },
  );
  avatarSheetCache.set(path, promise);
  return promise;
}

// 타일셋 (GRAPHICS 3장): src/assets/tilesets/<id>.png + <id>.tileset.json. art:build가 .tiles 원본에서 만든다
const TILESET_PREFIX = '../../assets/tilesets/';
const TILESET_IMAGES = import.meta.glob<string>('../../assets/tilesets/*.png', {
  eager: true,
  query: '?url',
  import: 'default',
});
const TILESET_JSON = import.meta.glob<unknown>('../../assets/tilesets/*.tileset.json', {
  import: 'default',
});
const tilesetSchema = z.object({
  id: z.string(),
  image: z.string(),
  tileSize: z.literal(16),
  columns: z.literal(16),
  count: z.number().int().min(1).max(256),
  names: z.record(z.string(), z.string()).optional(),
});

export type TilesetData = z.infer<typeof tilesetSchema>;

export interface LoadedTileset {
  data: TilesetData;
  image: HTMLImageElement;
}

const tilesetCache = new Map<string, Promise<LoadedTileset>>();

/** 타일셋 JSON(zod 검증)과 이미지를 함께 읽는다. 같은 id는 한 번만, 실패하면 캐시에서 빼서 다시 시도할 수 있게 */
export function loadTileset(id: string): Promise<LoadedTileset> {
  const cached = tilesetCache.get(id);
  if (cached !== undefined) {
    return cached;
  }
  const json = TILESET_JSON[`${TILESET_PREFIX}${id}.tileset.json`];
  const url = TILESET_IMAGES[`${TILESET_PREFIX}${id}.png`];
  if (json === undefined || url === undefined) {
    return Promise.reject(new Error(`unknown tileset "${id}"`));
  }
  const image = new Image();
  image.src = url;
  const promise = Promise.all([json(), image.decode()]).then(
    ([raw]) => ({ data: tilesetSchema.parse(raw), image }),
    (error: unknown) => {
      tilesetCache.delete(id);
      throw error;
    },
  );
  tilesetCache.set(id, promise);
  return promise;
}
