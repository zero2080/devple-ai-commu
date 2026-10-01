// 정적 맵 레이어 (ARCHITECTURE 2.2, GRAPHICS 3·4장): 오프스크린 캔버스에 1회 그려 캐싱한다.
// 아래 캐시 = order 'below' 레이어(floor → objects), 위 캐시 = 'above'(overhead) — 위 캐시는 캐릭터 다음에 그린다.
// 타일셋이 없으면(로드 실패) 5단계 대체 그림: 충돌 칸 = 회색 벽, 나머지 = 녹색 바닥
import type { MapData, TileLayer } from '@/domain';

import type { LoadedTileset } from '../assets/loader';
import { TILE_SIZE } from '../constants';
import type { Camera } from '../engine/camera';

export const FLOOR_COLOR = '#3f7d3a';
export const FLOOR_ALT_COLOR = '#43853d';
export const WALL_COLOR = '#6b6b6b';
export const WALL_TOP_COLOR = '#8a8a8a';

export interface TilemapCache {
  below: HTMLCanvasElement;
  /** overhead 레이어가 없으면 null */
  above: HTMLCanvasElement | null;
  widthPx: number;
  heightPx: number;
}

/** 시트 안 타일 위치 (GRAPHICS 3.1: index = row × columns + col) */
export function tileSourceRect(index: number, columns: number): { x: number; y: number } {
  return { x: (index % columns) * TILE_SIZE, y: Math.floor(index / columns) * TILE_SIZE };
}

/** 그리기 순서대로 아래·위 레이어를 나눈다 (MapData.layers는 이미 그리기 순서) */
export function splitLayers(map: MapData): { below: TileLayer[]; above: TileLayer[] } {
  return {
    below: map.layers.filter((layer) => layer.order === 'below'),
    above: map.layers.filter((layer) => layer.order === 'above'),
  };
}

function context(canvas: HTMLCanvasElement): CanvasRenderingContext2D {
  const ctx = canvas.getContext('2d');
  if (ctx === null) {
    throw new Error('2d context unavailable');
  }
  ctx.imageSmoothingEnabled = false;
  return ctx;
}

/** 레이어들을 한 캔버스에 겹친다. -1은 빈칸 */
export function drawLayers(
  ctx: CanvasRenderingContext2D,
  map: MapData,
  layers: readonly TileLayer[],
  tileset: LoadedTileset,
): void {
  const columns = tileset.data.columns;
  for (const layer of layers) {
    layer.tiles.forEach((index, i) => {
      if (index < 0) {
        return;
      }
      const source = tileSourceRect(index, columns);
      const x = (i % map.width) * TILE_SIZE;
      const y = Math.floor(i / map.width) * TILE_SIZE;
      ctx.drawImage(
        tileset.image,
        source.x,
        source.y,
        TILE_SIZE,
        TILE_SIZE,
        x,
        y,
        TILE_SIZE,
        TILE_SIZE,
      );
    });
  }
}

function drawPlaceholder(ctx: CanvasRenderingContext2D, map: MapData): void {
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
}

/** 맵 전체를 픽셀 단위로 한 번 그린다 (40×30 타일 = 640×480px). tileset이 null이면 대체 그림 */
export function createTilemapCache(
  map: MapData,
  tileset: LoadedTileset | null,
  doc: Document = document,
): TilemapCache {
  const widthPx = map.width * TILE_SIZE;
  const heightPx = map.height * TILE_SIZE;
  const makeCanvas = (): HTMLCanvasElement => {
    const canvas = doc.createElement('canvas');
    canvas.width = widthPx;
    canvas.height = heightPx;
    return canvas;
  };
  const below = makeCanvas();
  const { below: belowLayers, above: aboveLayers } = splitLayers(map);
  if (tileset === null) {
    drawPlaceholder(context(below), map);
    return { below, above: null, widthPx, heightPx };
  }
  drawLayers(context(below), map, belowLayers, tileset);
  let above: HTMLCanvasElement | null = null;
  if (aboveLayers.length > 0) {
    above = makeCanvas();
    drawLayers(context(above), map, aboveLayers, tileset);
  }
  return { below, above, widthPx, heightPx };
}

/** ctx는 이미 zoom 스케일과 카메라 이동이 적용된 상태로 받는다 */
export function renderTilemap(
  ctx: CanvasRenderingContext2D,
  cache: TilemapCache,
  camera: Camera,
): void {
  ctx.drawImage(cache.below, -camera.originX, -camera.originY);
}

/** 캐릭터 다음에 그린다: 나무 꼭대기·지붕 (GRAPHICS 4장 overhead) */
export function renderOverhead(
  ctx: CanvasRenderingContext2D,
  cache: TilemapCache,
  camera: Camera,
): void {
  if (cache.above !== null) {
    ctx.drawImage(cache.above, -camera.originX, -camera.originY);
  }
}
