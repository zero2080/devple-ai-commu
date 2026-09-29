// 타일 점유 판정 (DOMAIN.md 4.3 점유 규칙, ARCHITECTURE 3.2.1). 한 타일에는 캐릭터 1명.
import type { TilePoint } from './proximity';
import type { Position } from './types';

/** worldStore가 갖는 형태: userId → 위치. 같은 맵의 접속자만 담긴다고 가정한다 */
export type PositionMap = ReadonlyMap<string, Position>;

/** tile을 점유한 userId. excludeUserId(보통 본인)는 무시. 없으면 undefined */
export function occupantAt(
  tile: TilePoint,
  positions: PositionMap,
  excludeUserId?: string,
): string | undefined {
  for (const [userId, position] of positions) {
    if (userId === excludeUserId) {
      continue;
    }
    if (position.x === tile.x && position.y === tile.y) {
      return userId;
    }
  }
  return undefined;
}

/** 다른 캐릭터가 tile에 있으면 true. 벽과 동일한 차단 타일로 취급한다 */
export function isOccupied(
  tile: TilePoint,
  positions: PositionMap,
  excludeUserId?: string,
): boolean {
  return occupantAt(tile, positions, excludeUserId) !== undefined;
}
