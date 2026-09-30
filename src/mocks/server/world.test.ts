import { describe, expect, it } from 'vitest';

import { WorldSim } from './world.ts';
import { isBlocked, MAIN_MAP } from '../data/map.ts';
import { mulberry32 } from '../data/rng.ts';
import { ME } from '../data/users.ts';
import { createInitialPresences } from '../data/world.ts';

describe('WorldSim', () => {
  it('초기 배치는 본인이 spawn에 있고 아무도 겹치지 않는다', () => {
    const presences = createInitialPresences(MAIN_MAP);
    const me = presences.find((p) => p.userId === ME.id);
    expect(me?.position).toMatchObject({ x: MAIN_MAP.spawn.x, y: MAIN_MAP.spawn.y });
    expect(presences).toHaveLength(20); // 본인 + 활성 가짜 19명 (1명은 suspended)
    const tiles = new Set(presences.map((p) => `${String(p.position.x)},${String(p.position.y)}`));
    expect(tiles.size).toBe(presences.length);
  });

  it('500틱 동안 점유 규칙과 collision을 지키며 이동한다', () => {
    const presences = createInitialPresences(MAIN_MAP);
    const sim = new WorldSim(MAIN_MAP, presences, mulberry32(7), { frozenUserIds: [ME.id] });
    let moved = 0;
    for (let t = 0; t < 500; t += 1) {
      const deltas = sim.tick(t);
      moved += deltas.length;
      const tiles = new Set(
        presences.map((p) => `${String(p.position.x)},${String(p.position.y)}`),
      );
      expect(tiles.size).toBe(presences.length);
      for (const p of presences) {
        expect(isBlocked(MAIN_MAP, p.position.x, p.position.y)).toBe(false);
      }
      for (const d of deltas) {
        expect(Number.isInteger(d.x) && Number.isInteger(d.y)).toBe(true);
      }
    }
    expect(moved).toBeGreaterThan(100);
    const me = presences.find((p) => p.userId === ME.id);
    expect(me?.position).toMatchObject({ x: MAIN_MAP.spawn.x, y: MAIN_MAP.spawn.y });
  });

  it('place는 빈 타일에만 옮긴다', () => {
    const presences = createInitialPresences(MAIN_MAP);
    const sim = new WorldSim(MAIN_MAP, presences, mulberry32(1));
    expect(sim.place('u_01', MAIN_MAP.spawn.x, MAIN_MAP.spawn.y, 'up')).toBe(false); // 본인 자리
    expect(sim.place('u_01', 0, 0, 'up')).toBe(false); // 벽
  });
});

describe('setFrozen / resetFrozen', () => {
  it('멈춘 사용자는 틱이 지나도 움직이지 않고, resetFrozen 뒤에는 다시 움직인다', () => {
    const presences = createInitialPresences(MAIN_MAP);
    const sim = new WorldSim(MAIN_MAP, presences, mulberry32(3), {
      frozenUserIds: [ME.id],
      moveChance: 1,
    });
    sim.setFrozen('u_01', true);
    const start = { ...sim.find('u_01')?.position };
    for (let t = 0; t < 50; t += 1) sim.tick(t);
    expect(sim.find('u_01')?.position).toMatchObject({ x: start.x, y: start.y });
    sim.resetFrozen([ME.id]);
    let moved = false;
    for (let t = 0; t < 50 && !moved; t += 1) {
      moved = sim.tick(t).some((d) => d.userId === 'u_01');
    }
    expect(moved).toBe(true);
    sim.setFrozen('u_02', false); // 없는 항목 해제는 무시
  });
});
