import { describe, expect, it } from 'vitest';

import { directionTo, isSameTile, stepTile } from './movement';

describe('stepTile', () => {
  it('4방향으로 한 칸 이동한다', () => {
    expect(stepTile({ x: 5, y: 5 }, 'up')).toEqual({ x: 5, y: 4 });
    expect(stepTile({ x: 5, y: 5 }, 'down')).toEqual({ x: 5, y: 6 });
    expect(stepTile({ x: 5, y: 5 }, 'left')).toEqual({ x: 4, y: 5 });
    expect(stepTile({ x: 5, y: 5 }, 'right')).toEqual({ x: 6, y: 5 });
  });
});

describe('directionTo', () => {
  it('같은 타일이면 null, 큰 축 우선, 같으면 세로', () => {
    expect(directionTo({ x: 1, y: 1 }, { x: 1, y: 1 })).toBeNull();
    expect(directionTo({ x: 1, y: 1 }, { x: 4, y: 2 })).toBe('right');
    expect(directionTo({ x: 1, y: 1 }, { x: 0, y: 3 })).toBe('down');
    expect(directionTo({ x: 1, y: 1 }, { x: 3, y: -1 })).toBe('up');
    expect(directionTo({ x: 5, y: 5 }, { x: 2, y: 5 })).toBe('left');
  });
});

describe('isSameTile', () => {
  it('x·y가 모두 같아야 같다', () => {
    expect(isSameTile({ x: 1, y: 2 }, { x: 1, y: 2 })).toBe(true);
    expect(isSameTile({ x: 1, y: 2 }, { x: 2, y: 1 })).toBe(false);
  });
});
