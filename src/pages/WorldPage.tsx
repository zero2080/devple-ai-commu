import type { CSSProperties } from 'react';

import { ChatPanel, SpeechBubbleLayer } from '@/features/chat';
import {
  ConnectionBadge,
  useGuaranteedCanvasHeight,
  WorldCanvas,
  WorldProvider,
} from '@/features/world';
import { useAuthStore } from '@/store/authStore';
import { useUiStore } from '@/store/uiStore';

import styles from './WorldPage.module.css';

type CssVars = CSSProperties & Record<`--${string}`, string>;

/**
 * 월드 화면: 캔버스(+말풍선 오버레이)와 아래 근접 대화 패널 (ARCHITECTURE 2.5 분할 배치).
 * SSE 연결은 세션 수명(features/auth/session.ts)이 관리한다
 */
export function WorldPage() {
  const mapId = useAuthStore((s) => s.config?.defaultMapId ?? 'main');
  const zoom = useUiStore((s) => s.zoom);
  const guaranteedHeight = useGuaranteedCanvasHeight();
  const style: CssVars = {
    '--zoom': String(zoom),
    '--guaranteed-canvas-h': `${String(guaranteedHeight)}px`,
  };
  return (
    <WorldProvider>
      <main className={styles.page} style={style}>
        <div className={styles.stage}>
          <WorldCanvas mapId={mapId}>
            <SpeechBubbleLayer />
          </WorldCanvas>
          <ConnectionBadge />
        </div>
        <ChatPanel />
      </main>
    </WorldProvider>
  );
}
