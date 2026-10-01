// 클라이언트 고유 상수 (CONVENTIONS 6장). 서버가 정하는 값(ServerConfig)은 여기 두지 않는다.
export const TILE_SIZE = 16; // px, ARCHITECTURE 2.1
/** 캐릭터 프레임 (GRAPHICS 2.1): 24×40, 앵커 = 하단 중앙 (12, 40) = 서 있는 타일의 바닥 중앙 */
export const AVATAR_FRAME_WIDTH = 24;
export const AVATAR_FRAME_HEIGHT = 40;
/** 몸 박스 (프레임 좌표, GRAPHICS 2.1). 위 8px은 모자, 좌우 4px은 소품·머리숱 여백. 클릭 판정은 몸 박스로 */
export const AVATAR_BODY_BOX = { x: 4, y: 8, width: 16, height: 32 } as const;
export const MOVE_DURATION_MS = 150; // 타일당 이동 시간, ARCHITECTURE 3.1
export const INTERPOLATION_MS = 200; // 원격 캐릭터 선형 보간, ARCHITECTURE 3.4
export const AWAY_TIMEOUT_MS = 5 * 60 * 1000; // 자리비움 판정, ARCHITECTURE 3.5
export const ZOOM_LEVELS = [2, 3, 4] as const; // 정수 배율만, ARCHITECTURE 2.1
export type ZoomLevel = (typeof ZOOM_LEVELS)[number];
export const DEFAULT_ZOOM: ZoomLevel = 2;
/** 닉네임 블록 하단과 캐릭터 프레임 상단(앵커 − 40) 사이 (월드 px, GRAPHICS 5.2 수직 배치) */
export const NICKNAME_GAP_PX = 2;
/** 닉네임 한 줄 높이 (월드 px) = PixelKo em 12 × line-height 1 (12a단계 DOM 닉네임, GRAPHICS 5.1·5.3) */
export const NICKNAME_LINE_HEIGHT_PX = 12;
/** 말풍선 꼬리 끝과 닉네임 블록 상단 사이 (월드 px) */
export const BUBBLE_TAIL_GAP_PX = 1;
/** 꼬리 끝 = 프레임 상단 − (닉네임 간격 + 닉네임 line-height + 꼬리 간격) = 15 (GRAPHICS 5.2) */
export const BUBBLE_NICKNAME_CLEARANCE_PX =
  NICKNAME_GAP_PX + NICKNAME_LINE_HEIGHT_PX + BUBBLE_TAIL_GAP_PX;
/** 말풍선 픽셀 꼬리 높이 (월드 px). 몸통 아래로 3줄 */
export const BUBBLE_TAIL_PX = 3;
