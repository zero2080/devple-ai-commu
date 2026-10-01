import { describe, expect, it, vi } from 'vitest';

import type { MapData } from '@/domain';

import {
  createTilemapCache,
  renderOverhead,
  renderTilemap,
  splitLayers,
  tileSourceRect,
} from './tilemap';
import type { LoadedTileset } from '../assets/loader';

const map: MapData = {
  id: 'm',
  width: 3,
  height: 2,
  tileSize: 16,
  tileset: 'main',
  spawn: { x: 0, y: 0 },
  layers: [
    { name: 'floor', order: 'below', tiles: [0, 1, 0, 0, 0, 17] },
    { name: 'objects', order: 'below', tiles: [-1, -1, 33, -1, -1, -1] },
    { name: 'overhead', order: 'above', tiles: [-1, 84, -1, -1, -1, -1] },
  ],
  collision: [0, 0, 1, 0, 0, 0],
};

/** 캔버스마다 drawImage·fillRect 호출을 기록하는 가짜 문서 */
function fakeDoc() {
  const canvases: { canvas: HTMLCanvasElement; draws: unknown[][]; fills: unknown[][] }[] = [];
  const doc = {
    createElement: () => {
      const draws: unknown[][] = [];
      const fills: unknown[][] = [];
      const ctx = {
        imageSmoothingEnabled: true,
        fillStyle: '',
        drawImage: (...args: unknown[]) => draws.push(args),
        fillRect: (...args: unknown[]) => fills.push(args),
      };
      const canvas = { width: 0, height: 0, getContext: () => ctx } as unknown as HTMLCanvasElement;
      canvases.push({ canvas, draws, fills });
      return canvas;
    },
  } as unknown as Document;
  return { doc, canvases };
}

const tileset = { data: { columns: 16 }, image: { tag: 'sheet' } } as unknown as LoadedTileset;

describe('tilemap (GRAPHICS 3·4장)', () => {
  it('tileSourceRect: index = row × 16 + col', () => {
    expect(tileSourceRect(0, 16)).toEqual({ x: 0, y: 0 });
    expect(tileSourceRect(17, 16)).toEqual({ x: 16, y: 16 });
    expect(tileSourceRect(84, 16)).toEqual({ x: 64, y: 80 });
  });

  it('splitLayers: below(floor·objects)와 above(overhead)를 그리기 순서대로', () => {
    const { below, above } = splitLayers(map);
    expect(below.map((l) => l.name)).toEqual(['floor', 'objects']);
    expect(above.map((l) => l.name)).toEqual(['overhead']);
  });

  it('아래 캐시는 floor 다음 objects, 위 캐시는 overhead만 그리고 -1은 건너뛴다', () => {
    const { doc, canvases } = fakeDoc();
    const cache = createTilemapCache(map, tileset, doc);
    expect([cache.widthPx, cache.heightPx]).toEqual([48, 32]);
    expect(canvases).toHaveLength(2);
    const [below, above] = canvases;
    // floor 6칸 + objects 1칸 (sx, sy, …, dx, dy)
    expect(below?.draws.map((d) => [d[1], d[2], d[5], d[6]])).toEqual([
      [0, 0, 0, 0],
      [16, 0, 16, 0],
      [0, 0, 32, 0],
      [0, 0, 0, 16],
      [0, 0, 16, 16],
      [16, 16, 32, 16],
      [16, 32, 32, 0],
    ]);
    expect(above?.draws.map((d) => [d[1], d[2], d[5], d[6]])).toEqual([[64, 80, 16, 0]]);
    expect(cache.above).toBe(above?.canvas);
  });

  it('overhead 레이어가 없으면 위 캐시 없음, 타일셋이 없으면 충돌 칸 기반 대체 그림', () => {
    const { doc, canvases } = fakeDoc();
    const flat = createTilemapCache({ ...map, layers: map.layers.slice(0, 2) }, tileset, doc);
    expect(flat.above).toBeNull();
    const fallback = createTilemapCache(map, null, doc);
    expect(fallback.above).toBeNull();
    expect(canvases.at(-1)?.draws).toEqual([]);
    expect(canvases.at(-1)?.fills.length).toBeGreaterThan(0);
  });

  it('renderTilemap은 아래 캐시, renderOverhead는 위 캐시를 카메라만큼 옮겨 그린다', () => {
    const drawImage = vi.fn();
    const ctx = { drawImage } as unknown as CanvasRenderingContext2D;
    const cache = {
      below: 'below',
      above: 'above',
      widthPx: 1,
      heightPx: 1,
    } as unknown as Parameters<typeof renderTilemap>[1];
    const camera = { originX: 10, originY: 20, zoom: 2 };
    renderTilemap(ctx, cache, camera);
    renderOverhead(ctx, cache, camera);
    renderOverhead(ctx, { ...cache, above: null }, camera);
    expect(drawImage.mock.calls).toEqual([
      ['below', -10, -20],
      ['above', -10, -20],
    ]);
  });
});
