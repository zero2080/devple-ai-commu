// 뷰포트 보장 영역 (GRAPHICS 1.2, PRD 6, ARCHITECTURE 2.5). 줌을 낮추지 않고 레이아웃이 캔버스 크기를 확보한다.

/** 이 폭(캔버스 CSS px) 이상이면 데스크톱 보장 영역을 쓴다 */
export const DESKTOP_MIN_CANVAS_CSS_PX = 640;
export const DESKTOP_GUARANTEED_TILES = { widthTiles: 20, heightTiles: 15 } as const;

export interface GuaranteedViewport {
  kind: 'desktop' | 'mobile';
  widthTiles: number;
  heightTiles: number;
}

/**
 * 데스크톱(캔버스 폭 ≥ 640 CSS px): 20×15 타일.
 * 모바일: 근접 범위 정사각형 (2 × proximityRadius + 1)² — 내 말이 닿는 상대는 항상 화면에 보인다.
 */
export function guaranteedViewportTiles(
  canvasCssWidth: number,
  proximityRadius: number,
): GuaranteedViewport {
  if (canvasCssWidth >= DESKTOP_MIN_CANVAS_CSS_PX) {
    return { kind: 'desktop', ...DESKTOP_GUARANTEED_TILES };
  }
  const side = 2 * Math.max(0, Math.floor(proximityRadius)) + 1;
  return { kind: 'mobile', widthTiles: side, heightTiles: side };
}

/** 보장 영역을 CSS px로 (tileSize × zoom) */
export function guaranteedViewportCssPx(
  viewport: GuaranteedViewport,
  tileSize: number,
  zoom: number,
): { widthPx: number; heightPx: number } {
  return {
    widthPx: viewport.widthTiles * tileSize * zoom,
    heightPx: viewport.heightTiles * tileSize * zoom,
  };
}

/** 캔버스가 보장 영역을 담을 만큼 큰가. 반경이 커져 넘치면 false (보장 포기, 카메라 중심만 유지) */
export function isViewportGuaranteed(
  canvasCssWidth: number,
  canvasCssHeight: number,
  proximityRadius: number,
  tileSize: number,
  zoom: number,
): boolean {
  const need = guaranteedViewportCssPx(
    guaranteedViewportTiles(canvasCssWidth, proximityRadius),
    tileSize,
    zoom,
  );
  return canvasCssWidth >= need.widthPx && canvasCssHeight >= need.heightPx;
}
