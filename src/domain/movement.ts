// 타일 이동 규칙 (ARCHITECTURE 3.1). 4방향, 픽셀 좌표 없음.
import type { TilePoint } from './proximity';
import type { Direction } from './types';

export const DIRECTIONS: readonly Direction[] = ['up', 'down', 'left', 'right'];

export const DIRECTION_DELTAS: Readonly<Record<Direction, { dx: number; dy: number }>> = {
  up: { dx: 0, dy: -1 },
  down: { dx: 0, dy: 1 },
  left: { dx: -1, dy: 0 },
  right: { dx: 1, dy: 0 },
};

export function stepTile(tile: TilePoint, dir: Direction): TilePoint {
  const { dx, dy } = DIRECTION_DELTAS[dir];
  return { x: tile.x + dx, y: tile.y + dy };
}

export function isSameTile(a: TilePoint, b: TilePoint): boolean {
  return a.x === b.x && a.y === b.y;
}

/** from에서 to를 바라보는 방향. 같은 타일이면 null. 대각선이면 큰 축 우선, 같으면 세로 */
export function directionTo(from: TilePoint, to: TilePoint): Direction | null {
  const dx = to.x - from.x;
  const dy = to.y - from.y;
  if (dx === 0 && dy === 0) {
    return null;
  }
  if (Math.abs(dx) > Math.abs(dy)) {
    return dx > 0 ? 'right' : 'left';
  }
  return dy > 0 ? 'down' : 'up';
}
