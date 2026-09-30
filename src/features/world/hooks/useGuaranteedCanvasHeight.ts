import { useSyncExternalStore } from 'react';

import { guaranteedViewportCssPx, guaranteedViewportTiles } from '@/domain';
import { TILE_SIZE } from '@/game/constants';
import { useAuthStore } from '@/store/authStore';
import { useUiStore } from '@/store/uiStore';

function subscribeResize(onChange: () => void): () => void {
  window.addEventListener('resize', onChange);
  return () => {
    window.removeEventListener('resize', onChange);
  };
}

const viewportWidth = (): number => window.innerWidth;

/**
 * 캔버스가 확보해야 하는 CSS 높이 (ARCHITECTURE 2.5, GRAPHICS 1.2): 폭 640 이상은 15타일, 미만은 (2r+1)타일 × 16 × 줌.
 * 채팅 패널 최대 높이 = 뷰포트 − 이 값. 반경은 서버 값이라 로그인·GET /me마다 바뀔 수 있다
 */
export function useGuaranteedCanvasHeight(): number {
  const width = useSyncExternalStore(subscribeResize, viewportWidth, viewportWidth);
  const radius = useAuthStore((s) => s.config?.proximityRadius ?? 0);
  const zoom = useUiStore((s) => s.zoom);
  return guaranteedViewportCssPx(guaranteedViewportTiles(width, radius), TILE_SIZE, zoom).heightPx;
}
