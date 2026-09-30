import { useEffect, type RefObject } from 'react';

import { loadMap } from '@/game/assets/loader';
import { InputController } from '@/game/engine/input';
import { PositionBatcher } from '@/game/sync/positionBatcher';
import { WorldGame, type WorldFrame } from '@/game/world/worldGame';
import { registerDebugGame } from '@/shared/debug';
import { useAuthStore } from '@/store/authStore';
import { useUiStore } from '@/store/uiStore';
import { useWorldStore } from '@/store/worldStore';
import { updatePosition } from '@/transport/api/me';

/**
 * canvas에 WorldGame을 마운트하고 컨테이너 크기를 따라간다. 스토어는 getState()로 읽어 리렌더를 만들지 않는다.
 * 입력(키·클릭)과 위치 배칭(200ms, 409 보정)도 여기서 연결한다 (ROADMAP 6단계).
 */
export function useWorldGame(
  canvasRef: RefObject<HTMLCanvasElement | null>,
  containerRef: RefObject<HTMLDivElement | null>,
  mapId: string,
  onRendered?: (frame: WorldFrame) => void,
): void {
  useEffect(() => {
    const canvas = canvasRef.current;
    const container = containerRef.current;
    if (canvas === null || container === null) {
      return;
    }
    let game: WorldGame | null = null;
    let observer: ResizeObserver | null = null;
    let input: InputController | null = null;
    let batcher: PositionBatcher | null = null;
    let cancelled = false;

    void loadMap(mapId).then((map) => {
      if (cancelled) {
        return;
      }
      const world = useWorldStore.getState;
      batcher = new PositionBatcher({
        intervalMs: useAuthStore.getState().config?.positionBatchMs ?? 200,
        send: (body, options) => updatePosition(body, options),
        onRejected: (details) => {
          // 서버가 거부하면 인정 위치로 즉시 스냅 (한 칸 튕김 허용) — 경로 재계산은 LocalPlayer가
          game?.snapTo(details.position);
          world().setMyPosition(details.position);
        },
        onError: (error) => {
          console.warn('[position] send failed, will retry on next tick', error);
        },
      });
      const createdGame = new WorldGame({
        canvas,
        map,
        source: {
          presences: () => world().presences,
          positions: () => world().positions,
          myUserId: () => world().myUserId,
          revision: () => world().revision,
          snapshotRevision: () => world().snapshotRevision,
          zoom: () => useUiStore.getState().zoom,
        },
        ...(onRendered === undefined ? {} : { onRendered }),
        onMyMove: (position) => {
          world().setMyPosition(position);
          batcher?.push(position);
        },
      });
      game = createdGame;
      input = new InputController({
        keyTarget: window,
        pointerTarget: canvas,
        onDirectionChange: (direction) => {
          createdGame.setHeldDirection(direction);
        },
        onPointer: (x, y) => {
          createdGame.moveToScreen(x, y);
        },
      });
      const fit = (): void => {
        createdGame.resize(container.clientWidth, container.clientHeight, window.devicePixelRatio);
      };
      fit();
      observer = new ResizeObserver(fit);
      observer.observe(container);
      input.attach();
      batcher.start();
      createdGame.start();
      registerDebugGame(createdGame);
    });

    return () => {
      cancelled = true;
      registerDebugGame(null);
      input?.detach();
      batcher?.stop();
      observer?.disconnect();
      game?.stop();
    };
  }, [canvasRef, containerRef, mapId, onRendered]);
}
