// 초기 Presence 배치: 본인은 spawn, 가짜 접속자 20명은 빈 바닥 타일에 (타일당 1명)

import { isBlocked } from './map.ts';
import { mulberry32, type Rng } from './rng.ts';
import { FAKE_USERS, ME, SEED_TIME } from './users.ts';
import type { MapData, Presence, User } from '../../domain/types.ts';

export const WORLD_SEED = 20_260_929;

function randomFreeTile(map: MapData, taken: Set<string>, rng: Rng): { x: number; y: number } {
  for (let guard = 0; guard < 10_000; guard += 1) {
    const x = Math.floor(rng() * map.width);
    const y = Math.floor(rng() * map.height);
    if (!isBlocked(map, x, y) && !taken.has(`${String(x)},${String(y)}`)) {
      return { x, y };
    }
  }
  throw new Error('no free tile for initial presences');
}

export function createInitialPresences(
  map: MapData,
  users: readonly User[] = FAKE_USERS,
  rng: Rng = mulberry32(WORLD_SEED),
): Presence[] {
  const taken = new Set<string>([`${String(map.spawn.x)},${String(map.spawn.y)}`]);
  const presences: Presence[] = [
    {
      userId: ME.id,
      nickname: ME.nickname,
      appearance: ME.appearance,
      position: { mapId: map.id, x: map.spawn.x, y: map.spawn.y, dir: 'down' },
      state: 'online',
      updatedAt: SEED_TIME,
    },
  ];
  for (const user of users) {
    if (user.status !== 'active') {
      continue;
    }
    const { x, y } = randomFreeTile(map, taken, rng);
    taken.add(`${String(x)},${String(y)}`);
    presences.push({
      userId: user.id,
      nickname: user.nickname,
      appearance: user.appearance,
      position: { mapId: map.id, x, y, dir: 'down' },
      state: rng() < 0.15 ? 'away' : 'online',
      updatedAt: SEED_TIME,
    });
  }
  return presences;
}
