// 정적 맵 레이어 (ARCHITECTURE 2.2): 오프스크린 캔버스에 1회 그려 캐싱. 5단계 플레이스홀더: 벽=회색, 바닥=녹색.
import type { MapData } from '@/domain';

import { TILE_SIZE } from '../constants';
import type { Camera } from '../engine/camera';

export const FLOOR_COLOR = '#3f7d3a';
export const FLOOR_ALT_COLOR = '#43853d';
export const WALL_COLOR = '#6b6b6b';
export const WALL_TOP_COLOR = '#8a8a8a';

export interface TilemapCache {
  canvas: HTMLCanvasElement;
  widthPx: number;
  heightPx: number;
}

/** 맵 전체를 픽셀 단위로 한 번 그린다 (40×30 타일 = 640×480px) */
export function createTilemapCache(map: MapData, doc: Document = document): TilemapCache {
  const widthPx = map.width * TILE_SIZE;
  const heightPx = map.height * TILE_SIZE;
  const canvas = doc.createElement('canvas');
  canvas.width = widthPx;
  canvas.height = heightPx;
  const ctx = canvas.getContext('2d');
  if (ctx === null) {
    throw new Error('2d context unavailable');
  }
  ctx.imageSmoothingEnabled = false;
  for (let y = 0; y < map.height; y += 1) {
    for (let x = 0; x < map.width; x += 1) {
      const blocked = map.collision[y * map.width + x] !== 0;
      const px = x * TILE_SIZE;
      const py = y * TILE_SIZE;
      if (blocked) {
        ctx.fillStyle = WALL_COLOR;
        ctx.fillRect(px, py, TILE_SIZE, TILE_SIZE);
        ctx.fillStyle = WALL_TOP_COLOR;
        ctx.fillRect(px, py, TILE_SIZE, 4);
      } else {
        ctx.fillStyle = (x + y) % 2 === 0 ? FLOOR_COLOR : FLOOR_ALT_COLOR;
        ctx.fillRect(px, py, TILE_SIZE, TILE_SIZE);
      }
    }
  }
  return { canvas, widthPx, heightPx };
}

/** ctx는 이미 zoom 스케일과 카메라 이동이 적용된 상태로 받는다 */
export function renderTilemap(
  ctx: CanvasRenderingContext2D,
  cache: TilemapCache,
  camera: Camera,
): void {
  ctx.drawImage(cache.canvas, -camera.originX, -camera.originY);
}
