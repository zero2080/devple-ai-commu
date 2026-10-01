// 합성 전 대체 그림 (ARCHITECTURE 2.1): 합성 시트가 준비되기 전·실패 시 외형 색으로 칠한 도형. 24×40 프레임 규격·몸 박스는 실제 시트와 같다.
// 색은 외형이 바뀔 때만 계산한다 (매 프레임 계산 금지, GRAPHICS 2.9)
import type { Appearance } from '@/domain';

import { catalogItem, itemRamp, rampOf } from '../assets/avatarAssets';

export interface PlaceholderColors {
  skin: string;
  /** null = 민머리 */
  hair: string | null;
  hat: string | null;
  top: string;
  /** null = 상의가 하의를 덮음 (coversBottom) */
  bottom: string | null;
  shoes: string;
  hand: string | null;
}

export function placeholderColors(appearance: Appearance): PlaceholderColors {
  const covers = catalogItem(appearance.top.itemId)?.coversBottom === true;
  return {
    skin: rampOf(appearance.skin, 'skin').base,
    hair: appearance.hair === null ? null : rampOf(appearance.hairColor, 'hair').base,
    hat: appearance.hat === null ? null : itemRamp(appearance.hat, 'primary').base,
    top: itemRamp(appearance.top, 'primary').base,
    bottom: covers ? null : itemRamp(appearance.bottom, 'primary').base,
    shoes: itemRamp(appearance.shoes, 'primary').base,
    hand: appearance.hand === null ? null : itemRamp(appearance.hand, 'primary').base,
  };
}

/** 프레임 좌상단(left, top, 정수 px)에 1x 크기로 그린다. 영역은 GRAPHICS 2.2 체형 가이드 (down 기준) */
export function drawPlaceholderAvatar(
  ctx: CanvasRenderingContext2D,
  left: number,
  top: number,
  colors: PlaceholderColors,
): void {
  const rect = (color: string, x: number, y: number, w: number, h: number): void => {
    ctx.fillStyle = color;
    ctx.fillRect(left + x, top + y, w, h);
  };
  // 머리 y 8–23: 머리카락(없으면 피부) 위에 얼굴
  rect(colors.hair ?? colors.skin, 5, 8, 14, 16);
  rect(colors.skin, 7, colors.hair === null ? 10 : 13, 10, colors.hair === null ? 13 : 10);
  if (colors.hat !== null) {
    rect(colors.hat, 4, 4, 16, 6); // 모자 여백 y 0–7에 걸침
  }
  rect(colors.top, 6, 24, 12, 8); // 몸통 y 24–31
  rect(colors.bottom ?? colors.top, 7, 32, 10, 5); // 다리 y 32–36
  rect(colors.shoes, 6, 37, 12, 3); // 발 y 37–39
  if (colors.hand !== null) {
    rect(colors.hand, 18, 25, 4, 6); // 오른손 소품 (좌우 여백)
  }
}
