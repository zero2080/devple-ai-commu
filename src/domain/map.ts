// 정적 맵 판정 (DOMAIN 4.3). 맵 밖은 벽으로 취급한다.
import type { MapData } from './types';

export type MapGrid = Pick<MapData, 'width' | 'height' | 'collision'>;

export function isInside(map: Pick<MapData, 'width' | 'height'>, x: number, y: number): boolean {
  return x >= 0 && y >= 0 && x < map.width && y < map.height;
}

/** collision !== 0 이거나 맵 밖이면 벽 */
export function isWall(map: MapGrid, x: number, y: number): boolean {
  if (!isInside(map, x, y)) {
    return true;
  }
  return map.collision[y * map.width + x] !== 0;
}
