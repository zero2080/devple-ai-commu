// 맵 `main` 40×30 (테두리 벽 + 장애물, spawn 20,15). 원본은 src/assets/maps/main.json (앱과 Mock이 같은 파일을 쓴다)
import mainMapJson from '../../assets/maps/main.json';
import type { MapData } from '../../domain/types.ts';

/** JSON의 tileSize는 number로 추론되므로 MapData(리터럴 16)로 좁힌다 */
export const MAIN_MAP: MapData = {
  ...mainMapJson,
  tileSize: 16,
  layers: mainMapJson.layers.map((layer) => ({
    ...layer,
    order: layer.order === 'above' ? 'above' : 'below',
  })),
};

export function isBlocked(map: MapData, x: number, y: number): boolean {
  if (x < 0 || y < 0 || x >= map.width || y >= map.height) {
    return true;
  }
  return map.collision[y * map.width + x] !== 0;
}
