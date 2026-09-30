// 가짜 접속자 랜덤 워크. 점유 규칙(타일당 1명)과 collision을 지킨다 (ROADMAP 4단계).
import type { Direction, MapData, Presence } from '../../domain/types.ts';
import { isBlocked } from '../data/map.ts';
import { pick, type Rng } from '../data/rng.ts';

export interface PositionDelta {
  userId: string;
  x: number;
  y: number;
  dir: Direction;
}

const DIRECTIONS: readonly Direction[] = ['up', 'down', 'left', 'right'];
const STEP: Record<Direction, { dx: number; dy: number }> = {
  up: { dx: 0, dy: -1 },
  down: { dx: 0, dy: 1 },
  left: { dx: -1, dy: 0 },
  right: { dx: 1, dy: 0 },
};

function key(x: number, y: number): string {
  return `${String(x)},${String(y)}`;
}

export interface WorldSimOptions {
  /** 틱마다 이동을 시도할 확률 */
  moveChance?: number;
  /** 이동하지 않는 userId (본인 등) */
  frozenUserIds?: readonly string[];
}

export class WorldSim {
  readonly map: MapData;
  readonly presences: Presence[];
  private readonly rng: Rng;
  private readonly occupied = new Set<string>();
  private readonly moveChance: number;
  private readonly frozen: Set<string>;

  constructor(map: MapData, presences: Presence[], rng: Rng, options: WorldSimOptions = {}) {
    this.map = map;
    this.presences = presences;
    this.rng = rng;
    this.moveChance = options.moveChance ?? 0.35;
    this.frozen = new Set(options.frozenUserIds ?? []);
    for (const presence of presences) {
      const k = key(presence.position.x, presence.position.y);
      if (this.occupied.has(k)) {
        throw new Error(`initial presences overlap at ${k}`);
      }
      this.occupied.add(k);
    }
  }

  isFree(x: number, y: number): boolean {
    return !isBlocked(this.map, x, y) && !this.occupied.has(key(x, y));
  }

  /** 한 틱 진행. 위치·방향이 바뀐 사용자만 돌려준다 (world.positions payload) */
  tick(now: number): PositionDelta[] {
    const deltas: PositionDelta[] = [];
    for (const presence of this.presences) {
      if (this.frozen.has(presence.userId) || presence.state === 'away') {
        continue;
      }
      if (this.rng() >= this.moveChance) {
        continue;
      }
      const dir = pick(this.rng, DIRECTIONS);
      const { x, y } = presence.position;
      const nx = x + STEP[dir].dx;
      const ny = y + STEP[dir].dy;
      if (this.isFree(nx, ny)) {
        this.occupied.delete(key(x, y));
        this.occupied.add(key(nx, ny));
        presence.position = { ...presence.position, x: nx, y: ny, dir };
      } else if (presence.position.dir !== dir) {
        presence.position = { ...presence.position, dir }; // 막히면 방향만 (벽에 부딪힌 것과 동일)
      } else {
        continue;
      }
      presence.updatedAt = now;
      deltas.push({ userId: presence.userId, x: presence.position.x, y: presence.position.y, dir });
    }
    return deltas;
  }

  /** 외부(트리거·검증)에서 위치를 강제로 옮길 때. 빈 타일에만 */
  place(userId: string, x: number, y: number, dir: Direction): boolean {
    return this.moveTo(userId, x, y, dir) !== 'blocked';
  }

  /**
   * 실제 사용자의 이동 요청 (PUT /me/position). 같은 타일이면 방향만 바꾼다.
   * 점유 판정은 이 메서드 안에서 원자적으로 끝난다 (같은 타일 동시 요청은 먼저 온 쪽이 이김)
   */
  moveTo(userId: string, x: number, y: number, dir: Direction): 'moved' | 'turned' | 'blocked' {
    const presence = this.presences.find((p) => p.userId === userId);
    if (presence === undefined) {
      return 'blocked';
    }
    if (presence.position.x === x && presence.position.y === y) {
      presence.position = { ...presence.position, dir };
      return 'turned';
    }
    if (!this.isFree(x, y)) {
      return 'blocked';
    }
    this.occupied.delete(key(presence.position.x, presence.position.y));
    this.occupied.add(key(x, y));
    presence.position = { ...presence.position, x, y, dir };
    return 'moved';
  }

  /** 초기 배치로 되돌린다 (개발용 /__mock/reset). presences 배열 참조는 유지 */
  replaceAll(next: readonly Presence[]): void {
    this.occupied.clear();
    this.presences.length = 0;
    for (const presence of next) {
      const k = key(presence.position.x, presence.position.y);
      if (this.occupied.has(k)) {
        throw new Error(`presences overlap at ${k}`);
      }
      this.occupied.add(k);
      this.presences.push(presence);
    }
  }

  /** (x, y)에서 가까운 빈 타일로 옮긴다 (개발용 /__mock/say). 링 반경 maxRadius까지. 성공하면 위치를 돌려준다 */
  placeNear(userId: string, x: number, y: number, maxRadius = 4): Presence['position'] | null {
    const presence = this.find(userId);
    if (presence === undefined) {
      return null;
    }
    if (presence.position.x === x && presence.position.y === y) {
      return presence.position;
    }
    for (let r = 0; r <= maxRadius; r += 1) {
      for (let dy = -r; dy <= r; dy += 1) {
        for (let dx = -r; dx <= r; dx += 1) {
          if (Math.max(Math.abs(dx), Math.abs(dy)) !== r) {
            continue;
          }
          if (this.moveTo(userId, x + dx, y + dy, presence.position.dir) === 'moved') {
            return presence.position;
          }
        }
      }
    }
    return null;
  }

  /** 랜덤 워크에서 빼거나 넣는다 (E2E가 클릭할 캐릭터를 멈춰 둘 때) */
  setFrozen(userId: string, frozen: boolean): void {
    if (frozen) {
      this.frozen.add(userId);
    } else {
      this.frozen.delete(userId);
    }
  }

  /** 모두 멈춘다 (E2E가 가짜 접속자의 무작위 이동 없이 결정적으로 검증할 때). /__mock/reset이 풀어 준다 */
  freezeAll(): number {
    for (const presence of this.presences) {
      this.frozen.add(presence.userId);
    }
    return this.presences.length;
  }

  /** 기본 고정 목록(생성 시 options.frozenUserIds)만 남긴다 */
  resetFrozen(keep: readonly string[]): void {
    this.frozen.clear();
    for (const id of keep) {
      this.frozen.add(id);
    }
  }

  find(userId: string): Presence | undefined {
    return this.presences.find((p) => p.userId === userId);
  }

  /** 월드에서 뺀다 (정지 등으로 연결이 끊긴 사용자). 없으면 false */
  remove(userId: string): boolean {
    const index = this.presences.findIndex((p) => p.userId === userId);
    const presence = this.presences[index];
    if (presence === undefined) {
      return false;
    }
    this.occupied.delete(key(presence.position.x, presence.position.y));
    this.presences.splice(index, 1);
    this.frozen.delete(userId);
    return true;
  }

  setState(userId: string, state: Presence['state'], now: number): boolean {
    const presence = this.find(userId);
    if (presence === undefined) {
      return false;
    }
    presence.state = state;
    presence.updatedAt = now;
    return true;
  }
}
