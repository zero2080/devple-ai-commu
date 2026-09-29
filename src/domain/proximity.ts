// 근접 판정 (DOMAIN.md 5.2, ARCHITECTURE 2.5). 항상 타일 좌표 기준, 줌과 무관.
import type { Position } from './types';

export type TilePoint = Pick<Position, 'x' | 'y'>;

/** 체비쇼프 거리: max(|dx|, |dy|). 정사각 범위 판정의 근거 */
export function chebyshevDistance(a: TilePoint, b: TilePoint): number {
  return Math.max(Math.abs(a.x - b.x), Math.abs(a.y - b.y));
}

/**
 * `max(|dx|, |dy|) <= radius`. radius 0이면 같은 타일만, 음수면 항상 false.
 * 호출자는 같은 mapId의 좌표만 넘긴다 (다른 맵은 범위 밖으로 취급해야 함).
 */
export function isWithinRadius(a: TilePoint, b: TilePoint, radius: number): boolean {
  if (radius < 0) {
    return false;
  }
  return chebyshevDistance(a, b) <= radius;
}
