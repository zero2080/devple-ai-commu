// 카메라: 내 캐릭터 중심, 맵 경계 클램프, 정수 줌 (ARCHITECTURE 2.5). 순수 함수.
import type { PixelPoint } from '@/domain';

export interface Viewport {
  /** CSS px */
  widthPx: number;
  heightPx: number;
  zoom: number;
}

export interface Camera {
  /** 뷰포트 왼쪽 위가 가리키는 월드 픽셀 좌표 */
  originX: number;
  originY: number;
  zoom: number;
}

/**
 * center(월드 px)를 화면 중앙에 두되 맵 밖이 보이지 않게 클램프한다.
 * 맵이 뷰포트보다 작으면 맵을 가운데 정렬한다. 결과는 정수 px (픽셀 아트 떨림 방지).
 */
export function computeCamera(
  center: PixelPoint,
  viewport: Viewport,
  mapWidthPx: number,
  mapHeightPx: number,
): Camera {
  const viewWorldW = viewport.widthPx / viewport.zoom;
  const viewWorldH = viewport.heightPx / viewport.zoom;
  return {
    originX: clampAxis(center.x - viewWorldW / 2, viewWorldW, mapWidthPx),
    originY: clampAxis(center.y - viewWorldH / 2, viewWorldH, mapHeightPx),
    zoom: viewport.zoom,
  };
}

function clampAxis(origin: number, viewWorld: number, mapPx: number): number {
  if (mapPx <= viewWorld) {
    return Math.round(-(viewWorld - mapPx) / 2);
  }
  return Math.round(Math.min(Math.max(origin, 0), mapPx - viewWorld));
}

/** 월드 px → 화면 CSS px (말풍선 DOM 오버레이 위치 계산에도 쓴다) */
export function worldToScreen(camera: Camera, world: PixelPoint): PixelPoint {
  return {
    x: (world.x - camera.originX) * camera.zoom,
    y: (world.y - camera.originY) * camera.zoom,
  };
}

/** 화면 CSS px → 월드 px (클릭·탭 이동에 쓴다) */
export function screenToWorld(camera: Camera, screen: PixelPoint): PixelPoint {
  return {
    x: screen.x / camera.zoom + camera.originX,
    y: screen.y / camera.zoom + camera.originY,
  };
}
