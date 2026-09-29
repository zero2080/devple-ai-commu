import { describe, expect, it } from 'vitest';

import { isInside, isWall } from './map';

const map = { width: 3, height: 2, collision: [0, 1, 0, 0, 0, 1] };

describe('isWall', () => {
  it('collision이 0이 아니면 벽이다', () => {
    expect(isWall(map, 1, 0)).toBe(true);
    expect(isWall(map, 2, 1)).toBe(true);
    expect(isWall(map, 0, 0)).toBe(false);
  });

  it('맵 밖은 벽으로 취급한다', () => {
    expect(isWall(map, -1, 0)).toBe(true);
    expect(isWall(map, 3, 0)).toBe(true);
    expect(isWall(map, 0, 2)).toBe(true);
    expect(isInside(map, 2, 1)).toBe(true);
  });
});
