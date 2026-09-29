import { useRef } from 'react';

import styles from './WorldCanvas.module.css';
import { useWorldGame } from '../hooks/useWorldGame';

interface WorldCanvasProps {
  mapId: string;
}

export function WorldCanvas({ mapId }: WorldCanvasProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  useWorldGame(canvasRef, containerRef, mapId);

  return (
    <div ref={containerRef} className={styles.container} data-testid="world-container">
      <canvas ref={canvasRef} className={styles.canvas} role="img" aria-label="가상공간 맵" />
    </div>
  );
}
