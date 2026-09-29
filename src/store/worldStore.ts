// 월드 상태: 접속자 Presence·위치 (ARCHITECTURE 7장). 60Hz로 읽히므로 React 구독 대상이 아니다 — Game Engine이 getState()로 읽는다.
import { create } from 'zustand';

import type { Position, Presence, PresenceState } from '@/domain';
import type { SseConnectionState } from '@/transport/sse/client';

export interface WorldSnapshotInput {
  mapId: string;
  presences: Presence[];
  serverTime: number;
}

export interface PositionDeltaInput {
  userId: string;
  x: number;
  y: number;
  dir: Position['dir'];
}

export interface WorldState {
  mapId: string | null;
  myUserId: string | null;
  /** 본인 포함 접속자 전원 */
  presences: ReadonlyMap<string, Presence>;
  /** userId → 위치. 점유 판정(domain/occupancy)에 그대로 넘긴다 */
  positions: ReadonlyMap<string, Position>;
  serverTime: number | null;
  /** 스냅샷 이후 갱신 횟수. 렌더 쪽이 변경 감지에 쓴다 */
  revision: number;
  sseState: SseConnectionState;
  setMyUserId: (userId: string | null) => void;
  applySnapshot: (snapshot: WorldSnapshotInput) => void;
  /** world.positions. 본인 항목은 무시한다 (API_CONTRACT 3.3) */
  applyPositions: (mapId: string, deltas: readonly PositionDeltaInput[]) => void;
  addPresence: (presence: Presence) => void;
  removePresence: (userId: string) => void;
  updatePresence: (patch: {
    userId: string;
    state?: PresenceState;
    nickname?: string;
    avatarId?: string;
  }) => void;
  setSseState: (state: SseConnectionState) => void;
  setServerTime: (serverTime: number) => void;
  reset: () => void;
}

function positionsOf(presences: ReadonlyMap<string, Presence>): Map<string, Position> {
  const positions = new Map<string, Position>();
  for (const [userId, presence] of presences) {
    positions.set(userId, presence.position);
  }
  return positions;
}

const initial = {
  mapId: null,
  myUserId: null,
  presences: new Map<string, Presence>(),
  positions: new Map<string, Position>(),
  serverTime: null,
  revision: 0,
  sseState: 'idle' as SseConnectionState,
};

export const useWorldStore = create<WorldState>()((set, get) => ({
  ...initial,
  setMyUserId: (userId) => {
    set({ myUserId: userId });
  },
  applySnapshot: (snapshot) => {
    const presences = new Map<string, Presence>();
    for (const presence of snapshot.presences) {
      presences.set(presence.userId, presence);
    }
    set((s) => ({
      mapId: snapshot.mapId,
      presences,
      positions: positionsOf(presences),
      serverTime: snapshot.serverTime,
      revision: s.revision + 1,
    }));
  },
  applyPositions: (mapId, deltas) => {
    const { presences, myUserId, mapId: currentMapId } = get();
    if (currentMapId !== null && mapId !== currentMapId) {
      return;
    }
    let changed = false;
    const next = new Map(presences);
    for (const delta of deltas) {
      if (delta.userId === myUserId) {
        continue; // 내 위치 보정은 PUT /me/position 응답으로만
      }
      const presence = next.get(delta.userId);
      if (presence === undefined) {
        continue; // presence.joined 전에 온 위치는 무시 (스냅샷·joined가 원천)
      }
      const p = presence.position;
      if (p.x === delta.x && p.y === delta.y && p.dir === delta.dir) {
        continue;
      }
      next.set(delta.userId, {
        ...presence,
        position: { mapId, x: delta.x, y: delta.y, dir: delta.dir },
      });
      changed = true;
    }
    if (changed) {
      set((s) => ({ presences: next, positions: positionsOf(next), revision: s.revision + 1 }));
    }
  },
  addPresence: (presence) => {
    const next = new Map(get().presences);
    next.set(presence.userId, presence);
    set((s) => ({ presences: next, positions: positionsOf(next), revision: s.revision + 1 }));
  },
  removePresence: (userId) => {
    if (!get().presences.has(userId)) {
      return;
    }
    const next = new Map(get().presences);
    next.delete(userId);
    set((s) => ({ presences: next, positions: positionsOf(next), revision: s.revision + 1 }));
  },
  updatePresence: (patch) => {
    const presence = get().presences.get(patch.userId);
    if (presence === undefined) {
      return;
    }
    const next = new Map(get().presences);
    next.set(patch.userId, {
      ...presence,
      ...(patch.state === undefined ? {} : { state: patch.state }),
      ...(patch.nickname === undefined ? {} : { nickname: patch.nickname }),
      ...(patch.avatarId === undefined ? {} : { avatarId: patch.avatarId }),
    });
    set((s) => ({ presences: next, revision: s.revision + 1 }));
  },
  setSseState: (sseState) => {
    set({ sseState });
  },
  setServerTime: (serverTime) => {
    set({ serverTime });
  },
  reset: () => {
    set({ ...initial, presences: new Map(), positions: new Map() });
  },
}));
