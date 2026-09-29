// A* 경로 탐색 (ARCHITECTURE 3.1·3.2.1): 4방향, 맨해튼 휴리스틱.
// 차단 = 정적 벽 + 동적 점유(다른 캐릭터). 목적지가 벽이면 가장 가까운 통행 타일로, 점유면 직전 타일까지.
import { isWall, type MapGrid } from './map';
import { DIRECTION_DELTAS, DIRECTIONS, isSameTile } from './movement';
import type { PositionMap } from './occupancy';
import type { TilePoint } from './proximity';

export interface PathGrid {
  width: number;
  height: number;
  isWall: (x: number, y: number) => boolean;
  isOccupied: (x: number, y: number) => boolean;
}

/** 맵 + 접속자 위치(본인 제외)로 탐색 격자를 만든다 */
export function createPathGrid(
  map: MapGrid,
  positions: PositionMap,
  excludeUserId: string | null,
): PathGrid {
  const occupied = new Set<number>();
  for (const [userId, position] of positions) {
    if (userId !== excludeUserId) {
      occupied.add(position.y * map.width + position.x);
    }
  }
  return {
    width: map.width,
    height: map.height,
    isWall: (x, y) => isWall(map, x, y),
    isOccupied: (x, y) => occupied.has(y * map.width + x),
  };
}

export interface RoutePlan {
  /** 출발 타일을 제외한 순서대로의 타일. 비어 있으면 이동 없음 */
  path: TilePoint[];
  /** 실제로 향하는 타일 (대체·점유 처리 반영) */
  goal: TilePoint;
  /** false면 도달 불가라 가장 가까운 타일까지만 */
  reachable: boolean;
  /** 목적지가 점유돼 직전 타일까지만 가는 경우 */
  stoppedBeforeOccupied: boolean;
}

function manhattan(a: TilePoint, b: TilePoint): number {
  return Math.abs(a.x - b.x) + Math.abs(a.y - b.y);
}

/** 목적지 주변에서 벽·점유가 아닌 가장 가까운 타일 (BFS). 없으면 null */
export function nearestWalkable(
  grid: PathGrid,
  target: TilePoint,
  maxRadius = 8,
): TilePoint | null {
  const free = (x: number, y: number): boolean => !grid.isWall(x, y) && !grid.isOccupied(x, y);
  if (free(target.x, target.y)) {
    return { x: target.x, y: target.y };
  }
  for (let r = 1; r <= maxRadius; r += 1) {
    let best: TilePoint | null = null;
    let bestDist = Number.POSITIVE_INFINITY;
    for (let dy = -r; dy <= r; dy += 1) {
      for (let dx = -r; dx <= r; dx += 1) {
        if (Math.max(Math.abs(dx), Math.abs(dy)) !== r) {
          continue;
        }
        const x = target.x + dx;
        const y = target.y + dy;
        const dist = Math.abs(dx) + Math.abs(dy);
        if (free(x, y) && dist < bestDist) {
          best = { x, y };
          bestDist = dist;
        }
      }
    }
    if (best !== null) {
      return best;
    }
  }
  return null;
}

/**
 * A*. from을 제외한 경로를 돌려준다. 도달 불가면 휴리스틱상 가장 가까운 타일까지의 경로와 reachable=false.
 * allowGoalOccupied가 true면 목적지 타일의 점유는 무시하고 탐색한다 (직전 타일 처리는 호출자)
 */
export function findPath(
  grid: PathGrid,
  from: TilePoint,
  to: TilePoint,
  options: { allowGoalOccupied?: boolean; maxExpansions?: number } = {},
): { path: TilePoint[]; reachable: boolean } {
  if (isSameTile(from, to)) {
    return { path: [], reachable: true };
  }
  const { width, height } = grid;
  const maxExpansions = options.maxExpansions ?? width * height;
  const blocked = (x: number, y: number): boolean => {
    if (grid.isWall(x, y)) {
      return true;
    }
    if (options.allowGoalOccupied === true && x === to.x && y === to.y) {
      return false;
    }
    return grid.isOccupied(x, y);
  };

  const nodes = new Map<number, SearchNode>();
  const nodeAt = (x: number, y: number): SearchNode => {
    const key = y * width + x;
    let node = nodes.get(key);
    if (node === undefined) {
      node = {
        x,
        y,
        g: Number.POSITIVE_INFINITY,
        f: Number.POSITIVE_INFINITY,
        parent: null,
        closed: false,
      };
      nodes.set(key, node);
    }
    return node;
  };

  const start = nodeAt(from.x, from.y);
  start.g = 0;
  start.f = manhattan(from, to);
  const open = new Set<SearchNode>([start]);
  let best = start;
  let bestH = start.f;
  let expansions = 0;

  while (expansions < maxExpansions) {
    let current: SearchNode | undefined;
    for (const node of open) {
      if (current === undefined || node.f < current.f) {
        current = node;
      }
    }
    if (current === undefined) {
      break;
    }
    open.delete(current);
    if (current.x === to.x && current.y === to.y) {
      return { path: reconstruct(current), reachable: true };
    }
    current.closed = true;
    expansions += 1;
    for (const dir of DIRECTIONS) {
      const nx = current.x + DIRECTION_DELTAS[dir].dx;
      const ny = current.y + DIRECTION_DELTAS[dir].dy;
      if (nx < 0 || ny < 0 || nx >= width || ny >= height || blocked(nx, ny)) {
        continue;
      }
      const neighbor = nodeAt(nx, ny);
      if (neighbor.closed) {
        continue;
      }
      const tentative = current.g + 1;
      if (tentative < neighbor.g) {
        neighbor.parent = current;
        neighbor.g = tentative;
        const h = manhattan(neighbor, to);
        neighbor.f = tentative + h;
        if (h < bestH) {
          bestH = h;
          best = neighbor;
        }
        open.add(neighbor);
      }
    }
  }
  return { path: reconstruct(best), reachable: false };
}

interface SearchNode {
  x: number;
  y: number;
  g: number;
  f: number;
  parent: SearchNode | null;
  closed: boolean;
}

function reconstruct(node: SearchNode): TilePoint[] {
  const path: TilePoint[] = [];
  let current = node;
  while (current.parent !== null) {
    path.push({ x: current.x, y: current.y });
    current = current.parent;
  }
  path.reverse();
  return path;
}

/**
 * 클릭/탭 이동 계획 (ARCHITECTURE 3.1·3.2.1):
 * - 목적지가 벽(맵 밖 포함)이면 가장 가까운 통행 가능 타일로 대체
 * - 목적지에 다른 캐릭터가 있으면 경로를 목적지까지 계산한 뒤 마지막 타일을 빼 직전 타일까지
 * - 도달 불가면 도달 가능한 가장 가까운 타일까지
 */
export function planRoute(grid: PathGrid, from: TilePoint, target: TilePoint): RoutePlan {
  let goal: TilePoint = { x: target.x, y: target.y };
  let stoppedBeforeOccupied = false;
  if (grid.isWall(goal.x, goal.y)) {
    const replacement = nearestWalkable(grid, goal);
    if (replacement === null) {
      return { path: [], goal, reachable: false, stoppedBeforeOccupied: false };
    }
    goal = replacement;
  }
  const goalOccupied = grid.isOccupied(goal.x, goal.y) && !isSameTile(goal, from);
  const result = findPath(grid, from, goal, { allowGoalOccupied: goalOccupied });
  const path = result.path;
  if (goalOccupied && result.reachable) {
    path.pop();
    stoppedBeforeOccupied = true;
  }
  return { path, goal, reachable: result.reachable, stoppedBeforeOccupied };
}
