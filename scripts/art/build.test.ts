import { describe, expect, it } from 'vitest';

import { hasSide, renderSheet, samePixels, sourceOf } from './build.ts';
import { glyphColors, parsePix } from './pix.ts';
import { Sheet } from './sheet.ts';

const colors = glyphColors(['#181425', '#ffffff']);
const ROW = (s: string) => s.padEnd(24, '.');
const parse = (text: string) => parsePix(text, 't.pix', new Set(colors.keys()));

describe('sourceOf', () => {
  it('front·back 시트는 같은 원본', () => {
    expect(sourceOf('hair/hair_long.png')).toBe('hair/hair_long.pix');
    expect(sourceOf('hair/hair_long.back.png')).toBe('hair/hair_long.pix');
    expect(sourceOf('body/body_base.png')).toBe('body/body_base.pix');
  });
});

describe('renderSheet', () => {
  const doc = parse(
    [
      '@dir right',
      ` 0 ${ROW('Q')}`,
      `39 ${ROW('............o')}`,
      '@dir right 2',
      ` 1 ${ROW('1')}`,
      '@sheet back',
      '@dir up',
      ` 3 ${ROW('...y')}`,
    ].join('\n'),
  );

  it('서기에서 걷기를 파생해 (frame×24, row×40)에 그리고, 명시한 프레임은 그것을 쓴다', () => {
    const sheet = renderSheet(doc, 'front', colors);
    const at = (x: number, y: number) => sheet.get(x, y).join();
    const right = 2 * 40;
    expect(at(0, right)).toBe('255,0,0,255'); // frame 0
    expect(at(24, right + 1)).toBe('255,0,0,255'); // frame 1: 1px 아래
    expect(at(24 + 12, right + 39)).toBe('24,20,37,255'); // frame 1: x≥12 다리는 들지 않음 → 그대로 y39
    expect(at(72 + 12, right + 38)).toBe('24,20,37,255'); // frame 3: 오른쪽 다리 들림 → y38
    expect(at(48, right + 1)).toBe('255,255,255,255'); // frame 2는 명시 블록
    expect(at(48, right)).toBe('0,0,0,0');
    expect(at(0, 0)).toBe('0,0,0,0'); // down 없음
  });

  it('back 시트는 back 블록만', () => {
    expect(hasSide(doc, 'back')).toBe(true);
    const back = renderSheet(doc, 'back', colors);
    expect(back.get(3, 3 * 40 + 3).join()).toBe('0,255,0,255');
    expect(back.get(0, 2 * 40).join()).toBe('0,0,0,0');
  });

  it('samePixels', () => {
    const a = renderSheet(doc, 'front', colors);
    expect(samePixels(a, renderSheet(doc, 'front', colors))).toBe(true);
    expect(samePixels(a, new Sheet())).toBe(false);
    expect(samePixels(a, new Sheet(24, 40))).toBe(false);
  });
});
