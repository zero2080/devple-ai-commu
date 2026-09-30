// 캐릭터 플레이스홀더 (ROADMAP 5단계 → 아바타 v2): 외형 색 도형 + 머리 위 닉네임. 프레임 24×40 (GRAPHICS 2.1).
// 닉네임은 말풍선이 아니므로 Canvas fillText 허용. 12a단계에서 DOM 오버레이로 전환한다 (ARCHITECTURE 2.3, GRAPHICS 5.3).
import type { Appearance } from '@/domain';

import {
  AVATAR_BODY_BOX,
  AVATAR_FRAME_HEIGHT,
  AVATAR_FRAME_WIDTH,
  NICKNAME_GAP_PX,
  NICKNAME_LINE_HEIGHT_PX,
  TILE_SIZE,
} from '../constants';
import { drawPlaceholderAvatar, type PlaceholderColors } from './avatarPlaceholder';
import type { Camera } from '../engine/camera';

export interface DrawableCharacter {
  userId: string;
  nickname: string;
  appearance: Appearance;
  /** appearance가 바뀔 때만 다시 계산한 색 (GRAPHICS 2.9) */
  colors: PlaceholderColors;
  state: 'online' | 'away';
  /** 발 위치 기준 타일의 왼쪽 위 월드 px */
  pixelX: number;
  pixelY: number;
  isMe: boolean;
}

export const ME_OUTLINE_COLOR = '#ffffff';
export const AWAY_ALPHA = 0.5;
export const NICKNAME_FONT = `${String(NICKNAME_LINE_HEIGHT_PX)}px monospace`;

/** 타일 왼쪽 위(pixelX, pixelY) → 프레임 왼쪽 위. 앵커(타일 바닥 중앙) = 프레임 (12, 40) */
export function frameOrigin(pixelX: number, pixelY: number): { x: number; y: number } {
  return {
    x: pixelX + TILE_SIZE / 2 - AVATAR_FRAME_WIDTH / 2,
    y: pixelY + TILE_SIZE - AVATAR_FRAME_HEIGHT,
  };
}

const sortBuffer: DrawableCharacter[] = [];

/** y 정렬 후 그린다. ctx는 zoom·카메라 변환이 적용된 상태 */
export function renderCharacters(
  ctx: CanvasRenderingContext2D,
  characters: Iterable<DrawableCharacter>,
  camera: Camera,
): void {
  sortBuffer.length = 0;
  for (const c of characters) {
    sortBuffer.push(c);
  }
  sortBuffer.sort((a, b) => a.pixelY - b.pixelY);

  ctx.font = NICKNAME_FONT;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'bottom';
  for (const c of sortBuffer) {
    // 보간 중 소수 좌표를 정수 월드 px로 스냅한다 (GRAPHICS 1.2 — 서브픽셀 금지)
    const frame = frameOrigin(Math.round(c.pixelX), Math.round(c.pixelY));
    if (
      frame.x + AVATAR_FRAME_WIDTH < camera.originX ||
      frame.y + AVATAR_FRAME_HEIGHT < camera.originY
    ) {
      continue;
    }
    const left = frame.x - camera.originX;
    const top = frame.y - camera.originY;
    ctx.globalAlpha = c.state === 'away' ? AWAY_ALPHA : 1;
    drawPlaceholderAvatar(ctx, left, top, c.colors);
    if (c.isMe) {
      ctx.strokeStyle = ME_OUTLINE_COLOR;
      ctx.lineWidth = 1;
      ctx.strokeRect(
        left + AVATAR_BODY_BOX.x + 0.5,
        top + AVATAR_BODY_BOX.y + 0.5,
        AVATAR_BODY_BOX.width - 1,
        AVATAR_BODY_BOX.height - 1,
      );
    }
    ctx.globalAlpha = 1;
    ctx.fillStyle = '#000000';
    // 닉네임 블록 하단 = 프레임 상단 − 2 (GRAPHICS 5.2). 그림자는 1px 아래·오른쪽
    const centerX = left + AVATAR_FRAME_WIDTH / 2;
    ctx.fillText(c.nickname, centerX + 1, top - NICKNAME_GAP_PX + 1);
    ctx.fillStyle = '#ffffff';
    ctx.fillText(c.nickname, centerX, top - NICKNAME_GAP_PX);
  }
}
