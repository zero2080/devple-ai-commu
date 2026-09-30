// 캔버스 백킹 스토어 = CSS px × devicePixelRatio (ARCHITECTURE 2.1, 2026-09-30 결정 5).
// 줌 배율(2x·3x·4x)은 월드 px → CSS px 변환에만 쓰고, DPR은 CSS px → 장치 px에만 곱한다.
export interface BackingStoreSize {
  width: number;
  height: number;
  dpr: number;
}

/** 비정상 DPR(0·NaN·음수)은 1로 */
export function normalizeDpr(dpr: number): number {
  return Number.isFinite(dpr) && dpr > 0 ? dpr : 1;
}

export function backingStoreSize(
  cssWidth: number,
  cssHeight: number,
  dpr: number,
): BackingStoreSize {
  const ratio = normalizeDpr(dpr);
  return {
    width: Math.max(1, Math.round(cssWidth * ratio)),
    height: Math.max(1, Math.round(cssHeight * ratio)),
    dpr: ratio,
  };
}
