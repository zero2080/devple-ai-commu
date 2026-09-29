import { useEffect, type RefObject } from 'react';

import { loadMap } from '@/game/assets/loader';
import { WorldGame } from '@/game/world/worldGame';
import { useUiStore } from '@/store/uiStore';
import { useWorldStore } from '@/store/worldStore';

/** canvas에 WorldGame을 마운트하고 컨테이너 크기를 따라간다. 스토어는 getState()로 읽어 리렌더를 만들지 않는다 */
export function useWorldGame(
  canvasRef: RefObject<HTMLCanvasElement | null>,
  containerRef: RefObject<HTMLDivElement | null>,
  mapId: string,
): void {
  useEffect(() => {
    const canvas = canvasRef.current;
    const container = containerRef.current;
    if (canvas === null || container === null) {
      return;
    }
    let game: WorldGame | null = null;
    let observer: ResizeObserver | null = null;
    let cancelled = false;

    void loadMap(mapId).then((map) => {
      if (cancelled) {
        return;
      }
      game = new WorldGame({
        canvas,
        map,
        source: {
          presences: () => useWorldStore.getState().presences,
          myUserId: () => useWorldStore.getState().myUserId,
          revision: () => useWorldStore.getState().revision,
          zoom: () => useUiStore.getState().zoom,
        },
      });
      game.resize(container.clientWidth, container.clientHeight);
      observer = new ResizeObserver(() => {
        game?.resize(container.clientWidth, container.clientHeight);
      });
      observer.observe(container);
      game.start();
    });

    return () => {
      cancelled = true;
      observer?.disconnect();
      game?.stop();
    };
  }, [canvasRef, containerRef, mapId]);
}
