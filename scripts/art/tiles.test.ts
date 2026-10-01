import { describe, expect, it } from 'vitest';

import { PixError } from './pix.ts';
import { Sheet } from './sheet.ts';
import {
  parseTiles,
  renderTileset,
  tileOrigin,
  tilesetJson,
  tilesetProblems,
  type MapLike,
  type TilesDoc,
} from './tiles.ts';

const colors = new Map([
  ['o', '#181425'],
  ['F', '#3e8948'],
  ['U', '#8b9bb4'],
]);
const glyphs = new Set(colors.keys());
const solid = (ch: string) => Array<string>(16).fill(ch.repeat(16)).join('\n');
const ring = () =>
  ['o'.repeat(16), ...Array<string>(14).fill(`o${'.'.repeat(14)}o`), 'o'.repeat(16)].join('\n');

const text = `# 시험 타일셋\n@tile 0 grass\n${solid('F')}\n@tile 17 rock\n${ring()}\n`;

describe('parseTiles', () => {
  it('번호·이름·16줄을 읽고 번호순으로', () => {
    const doc = parseTiles(text, 't.tiles', glyphs);
    expect(doc.header).toEqual(['# 시험 타일셋']);
    expect(doc.tiles.map((t) => [t.index, t.name, t.rows.length])).toEqual([
      [0, 'grass', 16],
      [17, 'rock', 16],
    ]);
  });

  it.each([
    [
      `@tile 0 a\n${solid('F').split('\n').slice(0, 15).join('\n')}`,
      't.tiles:16: 타일 0 a: 15줄 (16줄이어야 함)',
    ],
    [`@tile 0 a\n${solid('F')}\nFFFF`, 't.tiles:18: 타일 0: 16줄을 넘음'],
    [`@tile 0 a\nFFF`, 't.tiles:2: 행은 ASCII 16글자 (받은 길이 3)'],
    [`@tile 0 a\n${'Q'.repeat(16)}`, "t.tiles:2: 타일에 쓸 수 없는 글자 'Q' (팔레트 코드·o·.만)"],
    [`@tile 256 a`, 't.tiles:1: 타일 번호는 0–255 (받은 값: 256)'],
    [`@tile 0 a\n${solid('F')}\n@tile 0 b`, 't.tiles:18: 타일 번호·이름 중복: 0 b'],
    [`@tile 0 Big`, 't.tiles:1: 지시어는 "@tile <번호> <소문자_이름>"'],
    [`FFFF`, 't.tiles:1: 행보다 @tile이 먼저 와야 함'],
  ])('오류는 파일:줄과 함께 (%#)', (source, message) => {
    expect(() => parseTiles(source, 't.tiles', glyphs)).toThrow(PixError);
    expect(() => parseTiles(source, 't.tiles', glyphs)).toThrow(message);
  });
});

describe('renderTileset · tilesetJson', () => {
  const doc = parseTiles(text, 't.tiles', glyphs);

  it('번호 = 행 × 16 + 열 자리에 그린다 (투명은 비움)', () => {
    expect(tileOrigin(17)).toEqual({ x: 16, y: 16 });
    const sheet = renderTileset(doc, colors);
    expect([sheet.width, sheet.height]).toEqual([256, 256]);
    expect(sheet.get(0, 0).join()).toBe('62,137,72,255');
    expect(sheet.get(16, 16).join()).toBe('24,20,37,255');
    expect(sheet.get(20, 20).join()).toBe('0,0,0,0');
  });

  it('count = 가장 큰 번호 + 1, names는 번호 → 이름 (GRAPHICS 3.3)', () => {
    expect(tilesetJson(doc, 'main')).toEqual({
      id: 'main',
      image: 'main.png',
      tileSize: 16,
      columns: 16,
      count: 18,
      names: { '0': 'grass', '17': 'rock' },
    });
  });
});

describe('tilesetProblems (GRAPHICS 3·4·8장)', () => {
  const doc: TilesDoc = parseTiles(text, 't.tiles', glyphs);
  const json = tilesetJson(doc, 'main');
  const palette = [...colors.values()];
  const mapWith = (layers: MapLike['layers']): MapLike => ({
    id: 'm',
    width: 2,
    height: 1,
    tileset: 'main',
    layers,
  });

  it('규격에 맞으면 문제없음 (빈칸 -1은 floor 밖에서만)', () => {
    const sheet = renderTileset(doc, colors);
    const map = mapWith([
      { name: 'floor', order: 'below', tiles: [0, 0] },
      { name: 'objects', order: 'below', tiles: [-1, 17] },
    ]);
    expect(tilesetProblems(sheet, json, palette, [map])).toEqual([]);
  });

  it('크기·반투명·팔레트 밖(키 색)·레이어 길이·없는 번호·floor 빈칸·투명한 바닥 타일', () => {
    expect(tilesetProblems(new Sheet(128, 128), json, palette, [])).toEqual([
      '타일셋 크기 128×128 (256×256이어야 함)',
    ]);
    const sheet = renderTileset(doc, colors);
    sheet.set(100, 100, [255, 0, 0, 255]); // 주색 키
    sheet.set(101, 100, [62, 137, 72, 128]);
    const problems = tilesetProblems(sheet, json, palette, [
      mapWith([
        { name: 'floor', order: 'below', tiles: [0, -1] },
        { name: 'objects', order: 'below', tiles: [5, -1] },
        { name: 'overhead', order: 'above', tiles: [-1] },
      ]),
      mapWith([{ name: 'floor', order: 'below', tiles: [17, 0] }]),
    ]);
    expect(problems).toEqual([
      '반투명 픽셀 1개 (알파는 0 또는 255)',
      '팔레트 밖 색(키 색 포함): #ff0000',
      'm.floor: 빈칸(-1)이 있음 (바닥은 모두 채운다)',
      'm.objects: 타일셋에 없는 번호 5',
      'm.overhead: 타일 1개 (2이어야 함)',
      'm.floor: 바닥 타일 17 rock에 투명 픽셀',
    ]);
  });
});
