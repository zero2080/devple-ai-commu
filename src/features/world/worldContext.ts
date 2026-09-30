// 월드 화면 공유 컨텍스트: 렌더 프레임 구독(말풍선 오버레이)과 캔버스 포커스(Esc 복귀)를 채팅 쪽에 제공한다.
import { createContext, useContext, useEffect, useRef } from 'react';

import type { WorldFrame } from '@/game/world/worldGame';

export type FrameListener = (frame: WorldFrame) => void;

export interface WorldContextValue {
  subscribeFrame: (listener: FrameListener) => () => void;
  emitFrame: (frame: WorldFrame) => void;
  registerCanvas: (canvas: HTMLCanvasElement | null) => void;
  focusCanvas: () => void;
}

export const WorldContext = createContext<WorldContextValue | null>(null);

export function useWorldContext(): WorldContextValue {
  const value = useContext(WorldContext);
  if (value === null) {
    throw new Error('WorldProvider is missing');
  }
  return value;
}

/** 매 렌더 프레임마다 listener를 부른다. listener가 바뀌어도 다시 구독하지 않는다 */
export function useWorldFrame(listener: FrameListener): void {
  const { subscribeFrame } = useWorldContext();
  const latest = useRef(listener);
  useEffect(() => {
    latest.current = listener;
  });
  useEffect(
    () =>
      subscribeFrame((frame) => {
        latest.current(frame);
      }),
    [subscribeFrame],
  );
}
