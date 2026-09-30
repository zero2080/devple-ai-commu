import type { CSSProperties } from 'react';
import { Link } from 'react-router';

import { ChatPanel, SpeechBubbleLayer } from '@/features/chat';
import { DmPane, useDmUnreadTotal } from '@/features/dm';
import { GroupPane, useGroupUnreadTotal } from '@/features/group';
import { NoticeBanner } from '@/features/notice';
import { ProfileCard } from '@/features/profile';
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
 * 월드 화면: 캔버스(+말풍선·프로필 카드 오버레이)와 아래 채팅 패널(근접·DM·그룹 탭) (ARCHITECTURE 2.5 분할 배치).
 * SSE 연결은 세션 수명(features/auth/session.ts)이 관리한다
 */
export function WorldPage() {
  const mapId = useAuthStore((s) => s.config?.defaultMapId ?? 'main');
  const zoom = useUiStore((s) => s.zoom);
  const isAdmin = useAuthStore((s) => s.me?.role === 'admin');
  const guaranteedHeight = useGuaranteedCanvasHeight();
  const dmUnread = useDmUnreadTotal();
  const groupUnread = useGroupUnreadTotal();
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
          <NoticeBanner placement="overlay" />
          <ProfileCard />
          {isAdmin ? (
            <Link to="/admin" className={styles.adminLink}>
              운영자 콘솔
            </Link>
          ) : null}
        </div>
        <ChatPanel
          dmPane={<DmPane />}
          dmUnread={dmUnread}
          groupPane={<GroupPane />}
          groupUnread={groupUnread}
        />
      </main>
    </WorldProvider>
  );
}
