// 개발·E2E 검증용 훅. DEV 빌드에서만 window.__devple로 스토어·게임 인스턴스를 노출한다 (프로덕션 번들에서는 제거됨).
import type { WorldGame } from '@/game/world/worldGame';
import { useAuthStore } from '@/store/authStore';
import { useWorldStore } from '@/store/worldStore';

export interface DevpleDebug {
  worldStore: typeof useWorldStore;
  authStore: typeof useAuthStore;
  game?: WorldGame;
}

declare global {
  interface Window {
    __devple?: DevpleDebug;
  }
}

export function exposeDebugHooks(): void {
  if (import.meta.env.DEV) {
    window.__devple = { worldStore: useWorldStore, authStore: useAuthStore };
  }
}

/** WorldGame이 마운트될 때 등록 (E2E가 카메라·내 위치를 읽는다) */
export function registerDebugGame(game: WorldGame | null): void {
  if (import.meta.env.DEV && window.__devple !== undefined) {
    if (game === null) {
      delete window.__devple.game;
    } else {
      window.__devple.game = game;
    }
  }
}
