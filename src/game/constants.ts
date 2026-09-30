// 클라이언트 고유 상수 (CONVENTIONS 6장). 서버가 정하는 값(ServerConfig)은 여기 두지 않는다.
export const TILE_SIZE = 16; // px, ARCHITECTURE 2.1
export const CHARACTER_HEIGHT_TILES = 2; // 스프라이트 16×32
export const MOVE_DURATION_MS = 150; // 타일당 이동 시간, ARCHITECTURE 3.1
export const INTERPOLATION_MS = 200; // 원격 캐릭터 선형 보간, ARCHITECTURE 3.4
export const AWAY_TIMEOUT_MS = 5 * 60 * 1000; // 자리비움 판정, ARCHITECTURE 3.5
export const ZOOM_LEVELS = [2, 3, 4] as const; // 정수 배율만, ARCHITECTURE 2.1
export type ZoomLevel = (typeof ZOOM_LEVELS)[number];
export const DEFAULT_ZOOM: ZoomLevel = 2;
/** 닉네임 블록 하단과 캐릭터 프레임 상단 사이 (월드 px, GRAPHICS 5.2 수직 배치) */
export const NICKNAME_GAP_PX = 2;
/** 닉네임 한 줄 높이 (월드 px). 12단계 전 Canvas 플레이스홀더 8px, PixelKo(em 12, line-height 1) 전환 후 12 */
export const NICKNAME_LINE_HEIGHT_PX = 8;
/** 말풍선 꼬리 끝과 닉네임 블록 상단 사이 (월드 px) */
export const BUBBLE_TAIL_GAP_PX = 1;
/** 꼬리 끝 = 프레임 상단 − (닉네임 간격 + 닉네임 line-height + 꼬리 간격). 플레이스홀더 11, PixelKo 15 (GRAPHICS 5.2) */
export const BUBBLE_NICKNAME_CLEARANCE_PX =
  NICKNAME_GAP_PX + NICKNAME_LINE_HEIGHT_PX + BUBBLE_TAIL_GAP_PX;
/** 말풍선 픽셀 꼬리 높이 (월드 px). 몸통 아래로 3줄 */
export const BUBBLE_TAIL_PX = 3;
