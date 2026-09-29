// 원격 캐릭터 선형 보간 (ARCHITECTURE 3.4): 서버 위치(타일)를 목표로 INTERPOLATION_MS 동안 픽셀 좌표를 이동.
import type { Presence, RemoteCharacter } from '@/domain';

import { INTERPOLATION_MS, TILE_SIZE } from '../constants';

interface Tracked {
  character: RemoteCharacter;
  fromX: number;
  fromY: number;
  startedAt: number;
}

export function tileToPixel(tileX: number, tileY: number): { x: number; y: number } {
  return { x: tileX * TILE_SIZE, y: tileY * TILE_SIZE };
}

export class RemoteInterpolator {
  private readonly tracked = new Map<string, Tracked>();
  private readonly durationMs: number;

  constructor(durationMs: number = INTERPOLATION_MS) {
    this.durationMs = durationMs;
  }

  get size(): number {
    return this.tracked.size;
  }

  /** 스토어의 Presence와 동기화: 새로 온 캐릭터는 즉시 배치, 사라진 캐릭터는 제거, 위치가 바뀌면 보간 시작 */
  sync(
    presences: ReadonlyMap<string, Presence>,
    nowMs: number,
    excludeUserId: string | null,
  ): void {
    for (const userId of this.tracked.keys()) {
      if (!presences.has(userId)) {
        this.tracked.delete(userId);
      }
    }
    for (const [userId, presence] of presences) {
      if (userId === excludeUserId) {
        continue;
      }
      const target = tileToPixel(presence.position.x, presence.position.y);
      const entry = this.tracked.get(userId);
      if (entry === undefined) {
        this.tracked.set(userId, {
          character: {
            presence,
            renderPixel: { ...target },
            targetPixel: { ...target },
            animFrame: 0,
          },
          fromX: target.x,
          fromY: target.y,
          startedAt: nowMs,
        });
        continue;
      }
      entry.character.presence = presence;
      const current = entry.character.targetPixel;
      if (current.x !== target.x || current.y !== target.y) {
        entry.fromX = entry.character.renderPixel.x;
        entry.fromY = entry.character.renderPixel.y;
        entry.startedAt = nowMs;
        entry.character.targetPixel = { ...target };
      }
    }
  }

  /** 보간 진행. 루프 내부에서 객체를 새로 만들지 않는다 (CONVENTIONS 6장) */
  update(nowMs: number): void {
    for (const entry of this.tracked.values()) {
      const t = Math.min(1, (nowMs - entry.startedAt) / this.durationMs);
      const { renderPixel, targetPixel } = entry.character;
      renderPixel.x = entry.fromX + (targetPixel.x - entry.fromX) * t;
      renderPixel.y = entry.fromY + (targetPixel.y - entry.fromY) * t;
    }
  }

  characters(): IterableIterator<RemoteCharacter> {
    return mapValues(this.tracked);
  }

  get(userId: string): RemoteCharacter | undefined {
    return this.tracked.get(userId)?.character;
  }
}

function* mapValues(map: Map<string, Tracked>): IterableIterator<RemoteCharacter> {
  for (const entry of map.values()) {
    yield entry.character;
  }
}
