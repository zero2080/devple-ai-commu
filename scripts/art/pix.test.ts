import { describe, expect, it } from 'vitest';

import { glyphColors, parsePix, PixError, serializePix } from './pix.ts';

const PALETTE = ['#be4a2f', '#181425', '#ffffff', '#262b44'];
const colors = glyphColors(PALETTE);
const glyphs = new Set(colors.keys());
const ROW = (s: string) => s.padEnd(24, '.');

describe('glyphColors (전역 글자표)', () => {
  it('키 색 12 + 외곽선 o + 팔레트 순서대로 코드(외곽선 색은 건너뜀)', () => {
    expect(colors.get('S')).toBe('#ffff00');
    expect(colors.get('b')).toBe('#0000ff');
    expect(colors.get('Q')).toBe('#ff0000');
    expect(colors.get('z')).toBe('#008000');
    expect(colors.get('o')).toBe('#181425');
    expect(colors.get('1')).toBe('#be4a2f');
    expect(colors.get('2')).toBe('#ffffff'); // #181425는 'o'라 코드를 쓰지 않는다
    expect(colors.get('3')).toBe('#262b44');
    expect(colors.size).toBe(12 + 1 + 3);
  });

  it('실제 palette.json 32색이면 코드 31개가 모두 다르다', async () => {
    const { default: palette } = await import('../../src/assets/palette.json', {
      with: { type: 'json' },
    });
    const table = glyphColors(palette.colors);
    expect(table.size).toBe(12 + 32);
    expect(new Set(table.values()).size).toBe(12 + 32);
  });
});

describe('parsePix', () => {
  const text = [
    '# hat_test — 시험',
    '@sheet front',
    '@dir down',
    ` 8 ${ROW('oQQo')}`,
    `39 ${ROW('PP')}`,
    '@dir left 1',
    ` 0 ${ROW('2')}`,
    '@sheet back',
    '@dir up',
    `10 ${ROW('...y')}`,
  ].join('\n');

  it('블록·행을 읽고 적지 않은 행은 투명, 주석 머리는 보존', () => {
    const doc = parsePix(text, 'hat_test.pix', glyphs);
    expect(doc.header).toEqual(['# hat_test — 시험']);
    expect(doc.frames.map((f) => [f.sheet, f.dir, f.frame])).toEqual([
      ['front', 'down', 0],
      ['front', 'left', 1],
      ['back', 'up', 0],
    ]);
    const down = doc.frames[0];
    expect(down?.rows).toHaveLength(40);
    expect(down?.rows[8]).toBe(ROW('oQQo'));
    expect(down?.rows[9]).toBe('.'.repeat(24));
    expect(doc.frames[2]?.rows[10]).toBe(ROW('...y'));
  });

  it('@sheet 없이 시작하면 front', () => {
    const doc = parsePix(`@dir right\n 5 ${ROW('o')}`, 'x.pix', glyphs);
    expect(doc.frames[0]?.sheet).toBe('front');
  });

  it.each([
    [`@dir down\n 8 ${'o'.repeat(23)}`, 'x.pix:2: 행 길이 23 (24이어야 함)'],
    [`@dir down\n 8 ${ROW('oq')}`, "x.pix:2: 알 수 없는 글자 'q'"],
    [`@dir down\n40 ${ROW('o')}`, 'x.pix:2: y는 0–39 (받은 값: 40)'],
    [`@dir down\n 8 ${ROW('o')}\n 8 ${ROW('o')}`, 'x.pix:3: y 8 행이 두 번 있음'],
    [`@dir down\n@dir down`, 'x.pix:2: front down 0 블록이 두 번 있음'],
    [` 8 ${ROW('o')}`, 'x.pix:1: 행보다 @dir가 먼저 와야 함'],
    ['@sheet side', 'x.pix:1: @sheet는 front 또는 back (받은 값: side)'],
    ['@dir north', 'x.pix:1: @dir는 down·left·right·up (받은 값: north)'],
    ['@dir down 4', 'x.pix:1: 프레임은 0–3 (받은 값: 4)'],
    ['@frame 1', 'x.pix:1: 알 수 없는 지시어 @frame'],
    [
      `@dir down\n 8 ${'ㅇ'.repeat(24)}`,
      'x.pix:2: 행에는 전역 글자표의 ASCII 글자만 (art/README.md)',
    ],
    ['@dir down\nhello', 'x.pix:2: 행은 "<y> <24글자>" 형식'],
  ])('오류는 파일:줄과 함께 (%#)', (source, message) => {
    expect(() => parsePix(source, 'x.pix', glyphs)).toThrow(
      new PixError('x.pix', 0, '').constructor,
    );
    expect(() => parsePix(source, 'x.pix', glyphs)).toThrow(message);
  });

  it('serializePix → parsePix 왕복이 같다 (빈 행은 적지 않음)', () => {
    const doc = parsePix(text, 'hat_test.pix', glyphs);
    const out = serializePix(doc);
    expect(out).toContain('@sheet back\n@dir up\n10 ...y');
    expect(out).not.toContain(` 9 ${'.'.repeat(24)}`);
    expect(parsePix(out, 'again.pix', glyphs)).toEqual(doc);
  });
});
