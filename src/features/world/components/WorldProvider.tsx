import { useMemo, useRef, type ReactNode } from 'react';

import { WorldContext, type FrameListener, type WorldContextValue } from '../worldContext';

interface WorldProviderProps {
  children: ReactNode;
}

/** 월드 화면(캔버스·말풍선·채팅 패널)을 감싼다. 값은 한 번 만들어 고정한다 */
export function WorldProvider({ children }: WorldProviderProps) {
  const listeners = useRef(new Set<FrameListener>());
  const canvas = useRef<HTMLCanvasElement | null>(null);
  const value = useMemo<WorldContextValue>(
    () => ({
      subscribeFrame: (listener) => {
        listeners.current.add(listener);
        return () => {
          listeners.current.delete(listener);
        };
      },
      emitFrame: (frame) => {
        for (const listener of listeners.current) {
          listener(frame);
        }
      },
      registerCanvas: (element) => {
        canvas.current = element;
      },
      focusCanvas: () => {
        canvas.current?.focus();
      },
    }),
    [],
  );
  return <WorldContext value={value}>{children}</WorldContext>;
}
