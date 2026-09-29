import { describe, expect, it } from 'vitest';

import { createPathGrid, findPath, nearestWalkable, planRoute } from './pathfinding';
import type { Position } from './types';

/**
 * 7×5 맵. #=벽
 *  .......
 *  .###...
 *  .#.#...
 *  .#.#...
 *  .......
 */
const rows = ['.......', '.###...', '.#.#...', '.#.#...', '.......'];
const map = {
  width: 7,
  height: 5,
  collision: rows.flatMap((row) => Array.from(row, (c) => (c === '#' ? 1 : 0))),
};

function positions(entries: [string, number, number][]): Map<string, Position> {
  return new Map(entries.map(([id, x, y]) => [id, { mapId: 'm', x, y, dir: 'down' as const }]));
}

describe('findPath', () => {
  it('직선 경로는 출발을 제외한 타일 순서다', () => {
    const grid = createPathGrid(map, new Map(), null);
    expect(findPath(grid, { x: 0, y: 0 }, { x: 3, y: 0 })).toEqual({
      path: [
        { x: 1, y: 0 },
        { x: 2, y: 0 },
        { x: 3, y: 0 },
      ],
      reachable: true,
    });
  });

  it('벽을 우회한다 (움푹 팬 곳 안으로)', () => {
    const grid = createPathGrid(map, new Map(), null);
    const { path, reachable } = findPath(grid, { x: 0, y: 0 }, { x: 2, y: 2 });
    expect(reachable).toBe(true);
    expect(path.at(-1)).toEqual({ x: 2, y: 2 });
    expect(path.length).toBe(8); // 0,0 → 아래로 내려가 4행에서 2열로 → 위로: 4 + 2 + 2
    for (const tile of path) {
      expect(map.collision[tile.y * map.width + tile.x]).toBe(0);
    }
  });

  it('시작 = 목적지면 빈 경로다', () => {
    const grid = createPathGrid(map, new Map(), null);
    expect(findPath(grid, { x: 1, y: 0 }, { x: 1, y: 0 })).toEqual({ path: [], reachable: true });
  });

  it('다른 캐릭터가 막으면 우회하고, 본인은 차단으로 보지 않는다', () => {
    const grid = createPathGrid(
      map,
      positions([
        ['me', 0, 0],
        ['a', 1, 0],
      ]),
      'me',
    );
    const { path } = findPath(grid, { x: 0, y: 0 }, { x: 2, y: 0 });
    expect(path).not.toContainEqual({ x: 1, y: 0 });
    expect(path.at(-1)).toEqual({ x: 2, y: 0 });
  });

  it('도달 불가면 가장 가까운 타일까지 가고 reachable=false다', () => {
    // 2,2를 사방으로 막는다: (2,1)·(1,2)·(3,2)는 벽, (2,3)에 캐릭터
    const grid = createPathGrid(map, positions([['a', 2, 3]]), null);
    const { path, reachable } = findPath(grid, { x: 0, y: 0 }, { x: 2, y: 2 });
    expect(reachable).toBe(false);
    const last = path.at(-1);
    expect(last).toBeDefined();
    // 맨해튼 거리 2인 도달 가능 타일 (2,0) 또는 (2,4) 중 하나
    expect(Math.abs((last?.x ?? 0) - 2) + Math.abs((last?.y ?? 0) - 2)).toBe(2);
    expect(path).not.toContainEqual({ x: 2, y: 2 });
  });
});

describe('nearestWalkable', () => {
  it('벽이면 가장 가까운 통행 타일을 고른다 (통행 가능하면 그대로)', () => {
    const grid = createPathGrid(map, new Map(), null);
    expect(nearestWalkable(grid, { x: 0, y: 0 })).toEqual({ x: 0, y: 0 });
    expect(nearestWalkable(grid, { x: 1, y: 1 })).toEqual({ x: 1, y: 0 });
    expect(nearestWalkable(grid, { x: -1, y: 0 })).toEqual({ x: 0, y: 0 });
  });
});

describe('planRoute', () => {
  it('목적지가 벽이면 가까운 통행 타일로 대체한다', () => {
    const grid = createPathGrid(map, new Map(), null);
    const plan = planRoute(grid, { x: 0, y: 0 }, { x: 1, y: 1 });
    expect(plan.goal).toEqual({ x: 1, y: 0 });
    expect(plan.path).toEqual([{ x: 1, y: 0 }]);
  });

  it('목적지가 점유면 직전 타일까지만 간다', () => {
    const grid = createPathGrid(map, positions([['a', 3, 0]]), 'me');
    const plan = planRoute(grid, { x: 0, y: 0 }, { x: 3, y: 0 });
    expect(plan.stoppedBeforeOccupied).toBe(true);
    expect(plan.path).toEqual([
      { x: 1, y: 0 },
      { x: 2, y: 0 },
    ]);
    expect(plan.goal).toEqual({ x: 3, y: 0 });
  });

  it('바로 옆 타일이 점유면 이동 없이 끝난다', () => {
    const grid = createPathGrid(map, positions([['a', 1, 0]]), 'me');
    const plan = planRoute(grid, { x: 0, y: 0 }, { x: 1, y: 0 });
    expect(plan.path).toEqual([]);
    expect(plan.stoppedBeforeOccupied).toBe(true);
  });

  it('맵 밖 클릭은 맵 안 가장 가까운 타일로', () => {
    const grid = createPathGrid(map, new Map(), null);
    const plan = planRoute(grid, { x: 0, y: 0 }, { x: 9, y: 0 });
    expect(plan.goal).toEqual({ x: 6, y: 0 });
    expect(plan.reachable).toBe(true);
  });
});

describe('전부 벽인 맵', () => {
  const walled = { width: 2, height: 2, collision: [1, 1, 1, 1] };

  it('nearestWalkable은 null, planRoute는 빈 경로·reachable=false', () => {
    const grid = createPathGrid(walled, new Map(), null);
    expect(nearestWalkable(grid, { x: 0, y: 0 })).toBeNull();
    expect(planRoute(grid, { x: 0, y: 0 }, { x: 1, y: 1 })).toEqual({
      path: [],
      goal: { x: 1, y: 1 },
      reachable: false,
      stoppedBeforeOccupied: false,
    });
  });

  it('findPath는 탐색 상한(maxExpansions)에 걸리면 지금까지의 최선으로 끝낸다', () => {
    const grid = createPathGrid(map, new Map(), null);
    const { reachable } = findPath(grid, { x: 0, y: 0 }, { x: 6, y: 4 }, { maxExpansions: 1 });
    expect(reachable).toBe(false);
  });
});
