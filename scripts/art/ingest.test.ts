import { join } from 'node:path';

import { describe, expect, it } from 'vitest';

import { allowedKeys } from './brief.ts';
import { AVATAR_SOURCE_DIR, loadPix, renderSheet, sourceOf } from './build.ts';
import { readCatalog, readPalette } from './catalog.ts';
import {
  detectBackground,
  detectGeometry,
  downscale,
  ingestRaster,
  mergeFrames,
  nearestGlyph,
  type Raster,
} from './ingest.ts';
import { glyphColors, KEY_GLYPHS, parsePix, type PixFrame } from './pix.ts';

const colors = glyphColors(['#181425', '#ffffff', '#262b44', '#3e8948']);
const ROW = (s: string) => s.padEnd(24, '.');

/** 1x 픽셀 배열 → s배 확대 래스터 (배경색 bg, -1 = 투명) */
function raster(
  width: number,
  height: number,
  pixel: (x: number, y: number) => number,
  scale: number,
): Raster {
  const data = new Uint8Array(width * scale * height * scale * 4);
  for (let y = 0; y < height * scale; y += 1) {
    for (let x = 0; x < width * scale; x += 1) {
      const rgb = pixel(Math.floor(x / scale), Math.floor(y / scale));
      const i = (y * width * scale + x) * 4;
      if (rgb >= 0) data.set([(rgb >> 16) & 0xff, (rgb >> 8) & 0xff, rgb & 0xff, 255], i);
    }
  }
  return { width: width * scale, height: height * scale, data };
}

describe('detectGeometry', () => {
  it('4방향 띠·시트·한 프레임의 정수배를 찾는다', () => {
    expect(detectGeometry(96 * 8, 40 * 8)).toEqual({ layout: 'strip', scale: 8 });
    expect(detectGeometry(96, 160)).toEqual({ layout: 'sheet', scale: 1 });
    expect(detectGeometry(24 * 3, 40 * 3)).toEqual({ layout: 'frame', scale: 3 });
    expect(() => detectGeometry(1000, 400)).toThrow('정수배가 아님');
    expect(() => detectGeometry(96 * 4, 40 * 4, 3)).toThrow('(배율 3)');
  });
});

describe('detectBackground · downscale · nearestGlyph', () => {
  it('네 모서리가 같은 불투명 색이면 배경색, 투명이면 null', () => {
    const solid = raster(4, 4, (x, y) => (x === 1 && y === 1 ? 0xff0000 : 0xff00ff), 1);
    expect(detectBackground(solid)).toBe(0xff00ff);
    expect(detectBackground(raster(4, 4, () => -1, 1))).toBeNull();
  });

  it('블록 최빈색, 불투명이 절반 미만이면 투명, 배경색은 투명 취급', () => {
    // 4×4 블록 하나: 10칸 빨강 · 4칸 파랑 · 2칸 투명
    const img: Raster = { width: 4, height: 4, data: new Uint8Array(64) };
    for (let i = 0; i < 16; i += 1) {
      const rgb = i < 10 ? [255, 0, 0, 255] : i < 14 ? [0, 0, 255, 255] : [0, 0, 0, 0];
      img.data.set(rgb, i * 4);
    }
    expect([...downscale(img, 4, null)]).toEqual([0xff0000]);
    expect([...downscale(img, 4, 0xff0000)]).toEqual([-1]); // 빨강이 배경이면 불투명 4칸 < 절반
  });

  it('가장 가까운 허용 색 — 키 색에 가까운 빨강은 Q, 어두운 초록은 팔레트 코드', () => {
    expect(nearestGlyph(0xf40a08, colors)).toBe('Q');
    expect(nearestGlyph(0x3d8a47, colors)).toBe('3'); // '3' = #3e8948 (팔레트 순서 4번째, 외곽선은 o)
    expect(nearestGlyph(0x1a1626, colors)).toBe('o');
  });
});

describe('ingestRaster', () => {
  const glyphs = new Set(colors.keys());
  const source = parsePix(
    [
      '@dir down',
      ` 8 ${ROW('.....oooo')}`,
      ` 9 ${ROW('....oQQQQo')}`,
      '@dir left',
      ` 8 ${ROW('..oPPRo')}`,
      '@dir right',
      ` 8 ${ROW('....oRPPo')}`,
      '@dir up',
      `30 ${ROW('......o2o')}`,
    ].join('\n'),
    'src.pix',
    glyphs,
  );

  it('왕복: .pix → 서기 4방향 띠를 6배로 확대·단색 배경 → ingest → 원본 서기 블록과 같다', () => {
    const sheet = renderSheet(source, 'front', colors);
    const strip = raster(
      96,
      40,
      (x, y) => {
        const dirRow = Math.floor(x / 24);
        const [r, g, b, a] = sheet.get(x % 24, dirRow * 40 + y);
        return a === 0 ? 0xff00ff : (r << 16) | (g << 8) | b;
      },
      6,
    );
    const frames = ingestRaster(strip, colors, { sheet: 'front' });
    expect(frames.map((f) => [f.dir, f.frame])).toEqual([
      ['down', 0],
      ['left', 0],
      ['right', 0],
      ['up', 0],
    ]);
    expect(frames.map((f) => f.rows)).toEqual(source.frames.map((f) => f.rows));
  });

  it('시트(96×160)는 기본으로 서기 열만, --keep-frames면 걷기 프레임도 블록으로', () => {
    const sheet = renderSheet(source, 'front', colors);
    const img: Raster = { width: 96, height: 160, data: sheet.data };
    expect(ingestRaster(img, colors, { sheet: 'back' })).toHaveLength(4);
    const all = ingestRaster(img, colors, { sheet: 'front', keepFrames: true });
    expect(all).toHaveLength(16);
    expect(all.find((f) => f.dir === 'down' && f.frame === 1)?.rows[9]).toBe(ROW('.....oooo')); // 파생된 1px 흔들림 그대로
  });

  it('한 프레임 이미지는 방향이 필요하다', () => {
    const one = raster(24, 40, () => -1, 2);
    expect(() => ingestRaster(one, colors, { sheet: 'front' })).toThrow('--dir');
    expect(ingestRaster(one, colors, { sheet: 'front', dir: 'up' })[0]?.dir).toBe('up');
  });
});

describe('mergeFrames', () => {
  const block = (sheet: 'front' | 'back', dir: PixFrame['dir'], tag: string): PixFrame => ({
    sheet,
    dir,
    frame: 0,
    rows: [tag],
  });
  const existing = [
    block('front', 'down', 'old'),
    block('front', 'up', 'old'),
    block('back', 'down', 'keep'),
  ];

  it('여러 블록이 오면 같은 시트 전체를 바꾸고 다른 시트는 둔다', () => {
    const merged = mergeFrames(existing, [
      block('front', 'left', 'new'),
      block('front', 'right', 'new'),
    ]);
    expect(merged.map((f) => `${f.sheet}:${f.dir}:${f.rows[0] ?? ''}`)).toEqual([
      'back:down:keep',
      'front:left:new',
      'front:right:new',
    ]);
  });

  it('한 블록(한 프레임 이미지)이면 그 방향만 바꾼다', () => {
    const merged = mergeFrames(existing, [block('front', 'up', 'new')]);
    expect(merged.map((f) => `${f.sheet}:${f.dir}:${f.rows[0] ?? ''}`)).toEqual([
      'front:down:old',
      'back:down:keep',
      'front:up:new',
    ]);
  });
});

describe('개발용 원본 왕복 (ROADMAP 12b 완료 조건)', () => {
  it('art/source/avatar의 모든 .pix: 서기 4방향을 4배 띠 + 단색 배경으로 → ingest → 원본 서기 블록과 같다', () => {
    const all = glyphColors(readPalette().colors);
    const catalog = readCatalog();
    const entries = [
      { slot: 'body' as const, front: catalog.body.front, back: false },
      ...catalog.items.map((item) => ({
        slot: item.slot,
        front: item.sheets.front,
        back: item.sheets.back !== undefined,
      })),
    ];
    for (const entry of entries) {
      const keys = new Set(allowedKeys(entry.slot));
      const allowed = new Map(
        [...all].filter(([glyph]) => {
          const key = KEY_GLYPHS[glyph];
          return key === undefined || keys.has(key[0]);
        }),
      );
      const source = join(AVATAR_SOURCE_DIR, sourceOf(entry.front));
      const doc = loadPix(source, source, all);
      for (const side of entry.back ? (['front', 'back'] as const) : (['front'] as const)) {
        const sheet = renderSheet(doc, side, all);
        const strip = raster(
          96,
          40,
          (x, y) => {
            const [r, g, b, a] = sheet.get(x % 24, Math.floor(x / 24) * 40 + y);
            return a === 0 ? 0x00ff01 : (r << 16) | (g << 8) | b;
          },
          4,
        );
        const back = ingestRaster(strip, allowed, { sheet: side });
        const original = ['down', 'left', 'right', 'up'].map(
          (dir) =>
            doc.frames.find((f) => f.sheet === side && f.dir === dir && f.frame === 0)?.rows ??
            Array<string>(40).fill('.'.repeat(24)),
        );
        expect(
          back.map((f) => f.rows),
          `${source} ${side}`,
        ).toEqual(original);
      }
    }
  });
});
