// 말풍선 배치 계산 (ARCHITECTURE 2.3). 순수 함수 — 레이어가 프레임마다 부른다
import {
  BUBBLE_NICKNAME_CLEARANCE_PX,
  BUBBLE_TAIL_PX,
  CHARACTER_HEIGHT_TILES,
  TILE_SIZE,
} from '@/game/constants';

/** 꼬리 끝(anchor)에서 발화자 프레임 하단까지 (월드 px): 닉네임 블록 + 스프라이트 높이 */
const ANCHOR_TO_FRAME_BOTTOM_PX = BUBBLE_NICKNAME_CLEARANCE_PX + TILE_SIZE * CHARACTER_HEIGHT_TILES;

export interface BubblePlacement {
  /** 말풍선 몸통 왼쪽 위 (캔버스 기준 CSS px, 정수) */
  x: number;
  y: number;
  /** 꼬리 열의 몸통 기준 left (CSS px, 줌의 배수) */
  tailLeft: number;
  /** 발화자 프레임이 캔버스에 조금이라도 보이면 true */
  visible: boolean;
}

/**
 * anchor는 꼬리 끝(닉네임 위)이다. 몸통은 꼬리 높이만큼 위에 둔다.
 * 몸통은 캔버스 좌우 안으로 밀어 넣고(잘림 방지) 꼬리만 발화자를 가리킨다. 위로 넘치면 몸통을 캔버스
 * 상단(y = 0)까지 내린다 — 이때는 발화자의 닉네임·머리를 덮는다 (GRAPHICS 5.2 가장자리 규칙, 사용자 결정 B).
 * 좌표는 줌의 배수로 내림해 꼬리와 몸통이 같은 픽셀 격자에 놓이게 한다 (GRAPHICS 1.2).
 * 발화자 프레임이 화면 밖이면 숨긴다
 */
export function placeBubble(
  anchor: { x: number; y: number },
  width: number,
  height: number,
  zoom: number,
  viewportWidth: number,
  viewportHeight: number,
): BubblePlacement {
  const snap = (value: number): number => Math.floor(value / zoom) * zoom;
  const half = snap(width / 2);
  const maxX = Math.max(0, snap(viewportWidth - width));
  const x = Math.min(Math.max(snap(anchor.x - half), 0), maxX);
  // 꼬리는 몸통 모서리 2칸 안쪽까지만 (꼬리 폭 ±2 월드 px)
  const tailLeft = snap(
    Math.min(Math.max(anchor.x - x, 2 * zoom), Math.max(2 * zoom, width - 3 * zoom)),
  );
  const above = Math.round(anchor.y - height - BUBBLE_TAIL_PX * zoom);
  const y = Math.max(above, 0);
  const frameBottom = anchor.y + ANCHOR_TO_FRAME_BOTTOM_PX * zoom;
  const visible =
    anchor.x >= 0 && anchor.x <= viewportWidth && frameBottom > 0 && above < viewportHeight;
  return { x, y, tailLeft, visible };
}

/** 만료 시각이 지났고 포인터가 올라가 있지 않으면 지운다 (링크 버튼이 있는 말풍선은 호버·터치 중 유지) */
export function shouldRemoveBubble(expiresAt: number, now: number, hovered: boolean): boolean {
  return !hovered && now >= expiresAt;
}
