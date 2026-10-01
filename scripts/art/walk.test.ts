import { describe, expect, it } from 'vitest';

import { deriveWalkFrame } from './walk.ts';

/** 몸통 한 줄(y31)과 양쪽 다리(y32–39)만 있는 서기 프레임 */
function idle(): string[] {
  const rows = Array<string>(40).fill('.'.repeat(24));
  rows[5] = '.....HHHH...............';
  rows[31] = '......SSSSSSSSSSSS......';
  for (let y = 32; y < 40; y += 1) rows[y] = '.......LLLL.RRRR........';
  return rows;
}

describe('deriveWalkFrame (GRAPHICS 2.3)', () => {
  it('0·2 프레임은 서기 그대로', () => {
    expect(deriveWalkFrame(idle(), 0)).toEqual(idle());
    expect(deriveWalkFrame(idle(), 2)).toEqual(idle());
  });

  it('1 프레임: 머리·몸통 1px 아래, 화면 왼쪽 다리만 1px 들어 발바닥 y38', () => {
    const f = deriveWalkFrame(idle(), 1);
    expect(f[5]).toBe('.'.repeat(24));
    expect(f[6]).toBe('.....HHHH...............');
    expect(f[32]).toBe('......SSSSSSSSSSSS......'); // 내려온 몸통이 다리 맨 윗줄을 덮음
    expect(f[38]).toBe('.......LLLL.RRRR........');
    expect(f[39]).toBe('............RRRR........'); // 왼쪽 다리는 y38에서 끝남
  });

  it('3 프레임: 오른쪽 다리를 든다', () => {
    const f = deriveWalkFrame(idle(), 3);
    expect(f[39]).toBe('.......LLLL.............');
    expect(f[38]).toBe('.......LLLL.RRRR........');
  });

  it('모든 프레임에 40줄 × 24글자', () => {
    for (const frame of [0, 1, 2, 3]) {
      const f = deriveWalkFrame(idle(), frame);
      expect(f).toHaveLength(40);
      expect(f.every((row) => row.length === 24)).toBe(true);
    }
  });
});
