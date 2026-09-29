import { describe, expect, it } from 'vitest';

import { isOccupied, occupantAt } from './occupancy';
import type { Position } from './types';

function pos(x: number, y: number): Position {
  return { mapId: 'main', x, y, dir: 'down' };
}

const positions = new Map<string, Position>([
  ['u1', pos(2, 3)],
  ['u2', pos(5, 5)],
]);

describe('occupantAt', () => {
  it('타일을 점유한 userId를 돌려준다', () => {
    expect(occupantAt({ x: 5, y: 5 }, positions)).toBe('u2');
  });

  it('아무도 없으면 undefined다', () => {
    expect(occupantAt({ x: 0, y: 0 }, positions)).toBeUndefined();
    expect(occupantAt({ x: 0, y: 0 }, new Map())).toBeUndefined();
  });

  it('excludeUserId(본인)의 위치는 점유로 보지 않는다', () => {
    expect(occupantAt({ x: 2, y: 3 }, positions, 'u1')).toBeUndefined();
  });
});

describe('isOccupied', () => {
  it('다른 캐릭터가 있는 타일은 점유다', () => {
    expect(isOccupied({ x: 2, y: 3 }, positions, 'u2')).toBe(true);
  });

  it('x만 같거나 y만 같은 타일은 점유가 아니다', () => {
    expect(isOccupied({ x: 2, y: 5 }, positions)).toBe(false);
    expect(isOccupied({ x: 5, y: 3 }, positions)).toBe(false);
  });

  it('본인만 있는 타일은 점유가 아니다', () => {
    expect(isOccupied({ x: 2, y: 3 }, positions, 'u1')).toBe(false);
  });
});
