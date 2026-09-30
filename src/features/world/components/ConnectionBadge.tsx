import { useWorldStore } from '@/store/worldStore';

import styles from './ConnectionBadge.module.css';

const LABELS = {
  idle: '대기',
  connecting: '연결 중',
  open: '실시간 연결됨',
  reconnecting: '재연결 중',
  closed: '연결 종료',
} as const;

export function ConnectionBadge() {
  const sseState = useWorldStore((s) => s.sseState);
  const count = useWorldStore((s) => s.presences.size);
  const away = useWorldStore(
    (s) => s.myUserId !== null && s.presences.get(s.myUserId)?.state === 'away',
  );
  return (
    <div
      className={`${styles.badge ?? ''} ${styles[sseState] ?? ''}`}
      data-testid="sse-state"
      data-state={sseState}
      data-away={away}
    >
      <span className={styles.dot} aria-hidden="true" />
      {LABELS[sseState]} · 접속자 {count}명{away ? ' · 자리비움' : ''}
    </div>
  );
}
