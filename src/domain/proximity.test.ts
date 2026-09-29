import { describe, expect, it } from 'vitest';

import { chebyshevDistance, isWithinRadius } from './proximity';

describe('chebyshevDistance', () => {
  it('같은 타일은 거리 0이다', () => {
    expect(chebyshevDistance({ x: 3, y: 3 }, { x: 3, y: 3 })).toBe(0);
  });

  it('대각선은 축 거리 중 큰 쪽이다', () => {
    expect(chebyshevDistance({ x: 0, y: 0 }, { x: 2, y: 5 })).toBe(5);
    expect(chebyshevDistance({ x: 0, y: 0 }, { x: -4, y: 1 })).toBe(4);
  });
});

describe('isWithinRadius', () => {
  it('반경 0이면 같은 타일만 범위 안이다', () => {
    expect(isWithinRadius({ x: 1, y: 1 }, { x: 1, y: 1 }, 0)).toBe(true);
    expect(isWithinRadius({ x: 1, y: 1 }, { x: 2, y: 1 }, 0)).toBe(false);
  });

  it('반경 경계의 대각선 타일은 범위 안이다 (정사각 범위)', () => {
    expect(isWithinRadius({ x: 10, y: 10 }, { x: 15, y: 15 }, 5)).toBe(true);
    expect(isWithinRadius({ x: 10, y: 10 }, { x: 5, y: 15 }, 5)).toBe(true);
  });

  it('한 축이라도 반경을 넘으면 범위 밖이다', () => {
    expect(isWithinRadius({ x: 10, y: 10 }, { x: 16, y: 10 }, 5)).toBe(false);
    expect(isWithinRadius({ x: 10, y: 10 }, { x: 10, y: 4 }, 5)).toBe(false);
  });

  it('음수 반경은 항상 범위 밖이다', () => {
    expect(isWithinRadius({ x: 0, y: 0 }, { x: 0, y: 0 }, -1)).toBe(false);
  });
});
