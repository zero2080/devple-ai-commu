import { useCallback, useRef, type ReactNode } from 'react';

import { NicknameLayer } from './NicknameLayer';
import styles from './WorldCanvas.module.css';
import { useWorldGame } from '../hooks/useWorldGame';
import { useWorldContext } from '../worldContext';

interface WorldCanvasProps {
  mapId: string;
  /** 캔버스 위 DOM 오버레이 (말풍선). 닉네임 레이어보다 위에 놓인다 */
  children?: ReactNode;
}

export function WorldCanvas({ mapId, children }: WorldCanvasProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const { emitFrame, registerCanvas } = useWorldContext();
  useWorldGame(canvasRef, containerRef, mapId, emitFrame);

  const setCanvas = useCallback(
    (element: HTMLCanvasElement | null) => {
      canvasRef.current = element;
      registerCanvas(element);
    },
    [registerCanvas],
  );

  return (
    <div ref={containerRef} className={styles.container} data-testid="world-container">
      {/* tabIndex: Esc로 입력창에서 돌아올 포커스 대상 (ARCHITECTURE 3.1) */}
      <canvas
        ref={setCanvas}
        className={styles.canvas}
        role="img"
        aria-label="가상공간 맵"
        tabIndex={0}
      />
      <NicknameLayer />
      {children}
    </div>
  );
}
