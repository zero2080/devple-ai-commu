// 클라이언트 고유 상수 (CONVENTIONS 6장). 서버가 정하는 값(ServerConfig)은 여기 두지 않는다.
export const TILE_SIZE = 16; // px, ARCHITECTURE 2.1
export const CHARACTER_HEIGHT_TILES = 2; // 스프라이트 16×32
export const MOVE_DURATION_MS = 150; // 타일당 이동 시간, ARCHITECTURE 3.1
export const INTERPOLATION_MS = 200; // 원격 캐릭터 선형 보간, ARCHITECTURE 3.4
export const AWAY_TIMEOUT_MS = 5 * 60 * 1000; // 자리비움 판정, ARCHITECTURE 3.5
export const ZOOM_LEVELS = [2, 3, 4] as const; // 정수 배율만, ARCHITECTURE 2.1
export type ZoomLevel = (typeof ZOOM_LEVELS)[number];
export const DEFAULT_ZOOM: ZoomLevel = 2;
