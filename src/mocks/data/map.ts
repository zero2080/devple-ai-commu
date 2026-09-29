// 맵 `main` 40×30 (테두리 벽 + 장애물, spawn 20,15). 원본은 ../maps/main.json
import type { MapData } from '../../domain/types.ts';
import mainMapJson from '../maps/main.json';

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
