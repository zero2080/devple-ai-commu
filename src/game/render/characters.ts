// 캐릭터 그리기 (GRAPHICS 2장, ARCHITECTURE 2.1): 합성 시트에서 (방향, 걷기 프레임)을 잘라 그리고, 합성 전이면 외형 색 도형.
// 닉네임은 DOM 오버레이(features/world NicknameLayer, GRAPHICS 5.3)가 그린다 — Canvas에는 글자를 그리지 않는다
import type { Appearance, Direction } from '@/domain';

import { AVATAR_BODY_BOX, AVATAR_FRAME_HEIGHT, AVATAR_FRAME_WIDTH, TILE_SIZE } from '../constants';
import type { AvatarSheet } from './avatarCompositor';
import { drawPlaceholderAvatar, type PlaceholderColors } from './avatarPlaceholder';
import { advanceWalk, drawAvatarFrame, type WalkState } from './sprite';
import type { Camera } from '../engine/camera';

export interface DrawableCharacter {
  userId: string;
  nickname: string;
  appearance: Appearance;
  /** appearance가 바뀔 때만 다시 계산한 색 (합성 전 대체 그림, GRAPHICS 2.9) */
  colors: PlaceholderColors;
  /** appearance가 바뀔 때만 다시 요청한 합성 시트 (같은 외형은 사용자끼리 같은 객체) */
  sheet: AvatarSheet;
  state: 'online' | 'away';
  dir: Direction;
  /** 내 캐릭터는 예측 이동 중, 원격은 보간 중 */
  moving: boolean;
  walk: WalkState;
  /** 발 위치 기준 타일의 왼쪽 위 월드 px */
  pixelX: number;
  pixelY: number;
  isMe: boolean;
}

export const ME_OUTLINE_COLOR = '#ffffff';
export const AWAY_ALPHA = 0.5;

/** 타일 왼쪽 위(pixelX, pixelY) → 프레임 왼쪽 위. 앵커(타일 바닥 중앙) = 프레임 (12, 40) */
export function frameOrigin(pixelX: number, pixelY: number): { x: number; y: number } {
  return {
    x: pixelX + TILE_SIZE / 2 - AVATAR_FRAME_WIDTH / 2,
    y: pixelY + TILE_SIZE - AVATAR_FRAME_HEIGHT,
  };
}

/** 화면 크기 (월드 px). 이 밖의 캐릭터는 그리지 않는다 */
export interface WorldViewport {
  width: number;
  height: number;
}

/**
 * y 정렬 후 그린다. ctx는 zoom·카메라 변환이 적용된 상태.
 * visibleOut에는 프레임이 조금이라도 화면에 걸친 캐릭터를 그린 순서(y 오름차순)로 채운다 (닉네임 레이어용)
 */
export function renderCharacters(
  ctx: CanvasRenderingContext2D,
  characters: Iterable<DrawableCharacter>,
  camera: Camera,
  viewport: WorldViewport,
  nowMs: number,
  visibleOut: DrawableCharacter[],
): void {
  visibleOut.length = 0;
  for (const c of characters) {
    visibleOut.push(c);
  }
  visibleOut.sort((a, b) => a.pixelY - b.pixelY);

  let kept = 0;
  for (const c of visibleOut) {
    // 걷기 상태는 화면 밖에서도 진행한다 (들어오는 순간 주기가 처음부터 시작하지 않게)
    const walkFrame = advanceWalk(c.walk, c.moving, nowMs);
    // 보간 중 소수 좌표를 정수 월드 px로 스냅한다 (GRAPHICS 1.2 — 서브픽셀 금지)
    const frame = frameOrigin(Math.round(c.pixelX), Math.round(c.pixelY));
    const left = frame.x - camera.originX;
    const top = frame.y - camera.originY;
    if (
      left + AVATAR_FRAME_WIDTH <= 0 ||
      top + AVATAR_FRAME_HEIGHT <= 0 ||
      left >= viewport.width ||
      top >= viewport.height
    ) {
      continue;
    }
    visibleOut[kept] = c;
    kept += 1;
    const away = c.state === 'away';
    ctx.globalAlpha = away ? AWAY_ALPHA : 1;
    const image = c.sheet.image;
    if (image === null) {
      drawPlaceholderAvatar(ctx, left, top, c.colors);
    } else {
      // 자리비움은 별도 프레임 없이 idle(0) + 알파 0.5 (GRAPHICS 2.3)
      drawAvatarFrame(ctx, image, c.dir, away ? 0 : walkFrame, left, top);
    }
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
  }
  visibleOut.length = kept;
}
