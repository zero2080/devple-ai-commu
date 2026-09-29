import { describe, expect, it, vi } from 'vitest';

import type { Position } from '@/domain';

import { LocalPlayer } from './localPlayer';

/**
 * 8×5 맵. #=벽
 *  ........
 *  ..#.....
 *  ........
 *  ........
 *  ........
 */
const rows = ['........', '..#.....', '........', '........', '........'];
const map = {
  width: 8,
  height: 5,
  collision: rows.flatMap((row) => Array.from(row, (c) => (c === '#' ? 1 : 0))),
};

function pos(x: number, y: number, dir: Position['dir'] = 'down'): Position {
  return { mapId: 'main', x, y, dir };
}

function setup(others = new Map<string, Position>()) {
  const onArrive = vi.fn<(p: Position) => void>();
  const player = new LocalPlayer({
    map,
    mapId: 'main',
    positions: () => others,
    myUserId: () => 'me',
    onArrive,
    moveDurationMs: 150,
    replanThrottleMs: 100,
  });
  player.spawn(pos(0, 0));
  return { player, onArrive, others };
}

describe('LocalPlayer 키 이동', () => {
  it('누르는 동안 150ms마다 한 칸씩 간다', () => {
    const { player, onArrive } = setup();
    player.setHeldDirection('right');
    player.update(0);
    expect(player.isMoving).toBe(true);
    expect(player.renderPixel(75)).toEqual({ x: 8, y: 0 });
    player.update(150);
    expect(player.position).toMatchObject({ x: 1, y: 0, dir: 'right' });
    expect(onArrive).toHaveBeenCalledWith(pos(1, 0, 'right'));
    player.update(300);
    expect(player.position).toMatchObject({ x: 2, y: 0 });
    player.setHeldDirection(null);
    player.update(450);
    player.update(600);
    expect(player.position).toMatchObject({ x: 3, y: 0 }); // 진행 중이던 한 칸은 끝낸다
    expect(onArrive).toHaveBeenCalledTimes(3);
  });

  it('벽이면 이동하지 않고 방향만 바꿔 알린다', () => {
    const { player, onArrive } = setup();
    player.spawn(pos(2, 0, 'right'));
    player.setHeldDirection('down'); // (2,1)은 벽
    player.update(0);
    expect(player.isMoving).toBe(false);
    expect(player.position).toMatchObject({ x: 2, y: 0, dir: 'down' });
    expect(onArrive).toHaveBeenCalledTimes(1);
    player.update(16);
    expect(onArrive).toHaveBeenCalledTimes(1); // 같은 방향으로는 다시 알리지 않는다
  });

  it('다른 캐릭터가 있는 타일은 벽과 같다', () => {
    const others = new Map([['a', pos(1, 0)]]);
    const { player, onArrive } = setup(others);
    player.setHeldDirection('right');
    player.update(0);
    expect(player.isMoving).toBe(false);
    expect(onArrive).toHaveBeenCalledWith(pos(0, 0, 'right'));
    others.delete('a');
    player.update(16);
    expect(player.isMoving).toBe(true);
  });

  it('맵 밖으로는 나가지 않는다', () => {
    const { player } = setup();
    player.setHeldDirection('left');
    player.update(0);
    expect(player.isMoving).toBe(false);
  });
});

describe('LocalPlayer 경로 이동', () => {
  it('클릭 목적지까지 경로를 따라가고 도착하면 멈춘다', () => {
    const { player, onArrive } = setup();
    player.moveTo({ x: 3, y: 0 }, 0);
    expect(player.hasRoute).toBe(true);
    let t = 0;
    for (let i = 0; i < 8; i += 1) {
      player.update(t);
      t += 150;
    }
    expect(player.position).toMatchObject({ x: 3, y: 0 });
    expect(player.hasRoute).toBe(false);
    expect(player.isMoving).toBe(false);
    expect(onArrive).toHaveBeenCalledTimes(3);
  });

  it('키 입력이 들어오면 자동 이동을 취소한다', () => {
    const { player } = setup();
    player.moveTo({ x: 5, y: 0 }, 0);
    player.update(0);
    player.setHeldDirection('down');
    expect(player.hasRoute).toBe(false);
    player.update(150); // 첫 칸 도착 후 아래로
    player.update(300);
    expect(player.position).toMatchObject({ x: 1, y: 1 });
  });

  it('목적지가 점유면 직전 타일에서 멈추고 목적지를 바라본다', () => {
    const others = new Map([['a', pos(3, 0)]]);
    const { player, onArrive } = setup(others);
    player.moveTo({ x: 3, y: 0 }, 0);
    let t = 0;
    for (let i = 0; i < 6; i += 1) {
      player.update(t);
      t += 150;
    }
    expect(player.position).toMatchObject({ x: 2, y: 0, dir: 'right' });
    expect(player.hasRoute).toBe(false);
    expect(onArrive).toHaveBeenLastCalledWith(pos(2, 0, 'right'));
  });

  it('이동 중 경로가 막히면 100ms 스로틀로 재계산해 우회한다', () => {
    const others = new Map<string, Position>();
    const { player } = setup(others);
    player.moveTo({ x: 4, y: 0 }, 0);
    player.update(0); // (0,0)→(1,0)
    others.set('a', pos(2, 0)); // 다음 타일을 막는다
    player.update(150); // 도착. (2,0) 막힘 → 재계산 (t=150)
    expect(player.position).toMatchObject({ x: 1, y: 0 });
    expect(player.hasRoute).toBe(true);
    // 재계산 결과 우회 경로로 이동 시작 (막힌 타일이 아닌 곳으로)
    expect(player.isMoving).toBe(true);
    let t = 300;
    for (let i = 0; i < 10; i += 1) {
      player.update(t);
      t += 150;
    }
    expect(player.position).toMatchObject({ x: 4, y: 0 });
  });

  it('재계산해도 도달 불가면 가장 가까운 타일까지만 간다', () => {
    // (3,0)을 사방으로 막는다: (2,0) (4,0) (3,1)에 캐릭터
    const others = new Map([
      ['a', pos(2, 0)],
      ['b', pos(4, 0)],
      ['c', pos(3, 1)],
    ]);
    const { player } = setup(others);
    player.moveTo({ x: 3, y: 0 }, 0);
    let t = 0;
    for (let i = 0; i < 12; i += 1) {
      player.update(t);
      t += 150;
    }
    expect(player.hasRoute).toBe(false);
    expect(player.position).not.toMatchObject({ x: 3, y: 0 });
  });

  it('snapTo(409 보정)는 즉시 되돌리고 경로를 다시 계산한다', () => {
    const { player, onArrive } = setup();
    player.moveTo({ x: 4, y: 0 }, 0);
    player.update(0);
    player.update(150);
    player.update(300);
    expect(player.position).toMatchObject({ x: 2, y: 0 });
    player.snapTo(pos(1, 0, 'right'), 320);
    expect(player.position).toMatchObject({ x: 1, y: 0 });
    expect(player.isMoving).toBe(false);
    expect(player.hasRoute).toBe(true);
    player.update(320);
    expect(player.isMoving).toBe(true);
    onArrive.mockClear();
    let t = 470;
    for (let i = 0; i < 6; i += 1) {
      player.update(t);
      t += 150;
    }
    expect(player.position).toMatchObject({ x: 4, y: 0 });
  });
});
