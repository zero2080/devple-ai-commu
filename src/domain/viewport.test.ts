import { describe, expect, it } from 'vitest';

import { guaranteedViewportCssPx, guaranteedViewportTiles, isViewportGuaranteed } from './viewport';

describe('guaranteedViewportTiles', () => {
  it('캔버스 폭 640 이상이면 데스크톱 20×15다', () => {
    expect(guaranteedViewportTiles(640, 5)).toEqual({
      kind: 'desktop',
      widthTiles: 20,
      heightTiles: 15,
    });
    expect(guaranteedViewportTiles(1280, 5).kind).toBe('desktop');
  });

  it('640 미만이면 근접 범위 정사각형 (2r+1)²이다', () => {
    expect(guaranteedViewportTiles(639, 5)).toEqual({
      kind: 'mobile',
      widthTiles: 11,
      heightTiles: 11,
    });
    expect(guaranteedViewportTiles(360, 3)).toEqual({
      kind: 'mobile',
      widthTiles: 7,
      heightTiles: 7,
    });
    expect(guaranteedViewportTiles(360, 0)).toEqual({
      kind: 'mobile',
      widthTiles: 1,
      heightTiles: 1,
    });
    expect(guaranteedViewportTiles(360, -2).widthTiles).toBe(1);
  });
});

describe('guaranteedViewportCssPx / isViewportGuaranteed', () => {
  it('반경 5·2x 모바일은 352×352 CSS px가 필요하다', () => {
    const view = guaranteedViewportTiles(390, 5);
    expect(guaranteedViewportCssPx(view, 16, 2)).toEqual({ widthPx: 352, heightPx: 352 });
    expect(isViewportGuaranteed(390, 600, 5, 16, 2)).toBe(true);
    expect(isViewportGuaranteed(390, 300, 5, 16, 2)).toBe(false);
  });

  it('데스크톱은 640×480 CSS px(2x)가 필요하다', () => {
    expect(isViewportGuaranteed(1280, 800, 5, 16, 2)).toBe(true);
    expect(isViewportGuaranteed(640, 479, 5, 16, 2)).toBe(false);
  });

  it('반경이 커져 캔버스를 넘으면 보장하지 않는다', () => {
    expect(isViewportGuaranteed(390, 844, 15, 16, 2)).toBe(false); // 31타일 = 992px
  });
});
