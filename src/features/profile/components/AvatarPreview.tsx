import { useEffect, useRef } from 'react';

import type { Appearance } from '@/domain';
import {
  AVATAR_FRAME_HEIGHT,
  AVATAR_FRAME_WIDTH,
  drawPlaceholderAvatar,
  placeholderColors,
} from '@/game';

interface AvatarPreviewProps {
  appearance: Appearance;
}

/**
 * 외형 미리보기 (GRAPHICS 2.9: down/0을 3x). 12a단계 합성기 전까지는 월드와 같은 플레이스홀더를 그린다.
 * 캔버스는 1x(24×40)로 그리고 CSS로 정수 배율 확대 (image-rendering: pixelated)
 */
export function AvatarPreview({ appearance }: AvatarPreviewProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  // 외부 시스템(Canvas) 동기화: 외형이 바뀔 때만 다시 그린다
  useEffect(() => {
    const ctx = canvasRef.current?.getContext('2d') ?? null;
    if (ctx === null) {
      return;
    }
    ctx.clearRect(0, 0, AVATAR_FRAME_WIDTH, AVATAR_FRAME_HEIGHT);
    drawPlaceholderAvatar(ctx, 0, 0, placeholderColors(appearance));
  }, [appearance]);
  return (
    <canvas
      ref={canvasRef}
      width={AVATAR_FRAME_WIDTH}
      height={AVATAR_FRAME_HEIGHT}
      style={{
        width: `${String(AVATAR_FRAME_WIDTH * 3)}px`,
        height: `${String(AVATAR_FRAME_HEIGHT * 3)}px`,
        imageRendering: 'pixelated',
        flex: 'none',
      }}
      aria-hidden="true"
      data-testid="avatar-preview"
    />
  );
}
