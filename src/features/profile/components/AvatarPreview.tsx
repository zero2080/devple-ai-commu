import { useEffect, useRef } from 'react';

import type { Appearance } from '@/domain';
import {
  AVATAR_FRAME_HEIGHT,
  AVATAR_FRAME_WIDTH,
  drawAvatarFrame,
  drawPlaceholderAvatar,
  placeholderColors,
  sharedAvatarCompositor,
} from '@/game';

interface AvatarPreviewProps {
  appearance: Appearance;
}

/**
 * 외형 미리보기 (GRAPHICS 2.9: 합성 시트의 down/0을 3x). 합성이 끝나기 전에는 월드와 같은 플레이스홀더를 그린다.
 * 합성 시트는 월드와 같은 공유 합성기에서 받는다(같은 외형이면 다시 합성하지 않음).
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
    const sheet = sharedAvatarCompositor().request(appearance);
    const draw = (): void => {
      ctx.clearRect(0, 0, AVATAR_FRAME_WIDTH, AVATAR_FRAME_HEIGHT);
      if (sheet.image === null) {
        drawPlaceholderAvatar(ctx, 0, 0, placeholderColors(appearance));
      } else {
        drawAvatarFrame(ctx, sheet.image, 'down', 0, 0, 0);
      }
    };
    draw();
    let cancelled = false;
    if (sheet.image === null) {
      void sheet.ready.then(() => {
        if (!cancelled) {
          draw();
        }
      });
    }
    return () => {
      cancelled = true;
    };
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
