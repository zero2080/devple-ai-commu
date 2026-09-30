import { useUiStore } from '@/store/uiStore';

import styles from './NoticeBanner.module.css';

interface NoticeBannerProps {
  /** overlay: 월드 캔버스 위, inline: 콘솔 페이지 상단 */
  placement: 'overlay' | 'inline';
}

/**
 * 운영자 공지 배너 (system.notice, DOMAIN 6.1). 최신 1건, 닫을 수 있다.
 * 본문은 plain text — Notice에는 서버 links[]가 없으므로 링크 버튼을 만들지 않는다 (CLAUDE.md 제약 4)
 */
export function NoticeBanner({ placement }: NoticeBannerProps) {
  const notice = useUiStore((s) => s.notice);
  if (notice === null) {
    return null;
  }
  return (
    <div
      className={[styles.banner, placement === 'overlay' ? styles.overlay : ''].join(' ')}
      role="status"
      aria-label="공지"
      data-testid="notice-banner"
    >
      <span className={styles.label}>공지</span>
      <span className={styles.content}>{notice.content}</span>
      <button
        type="button"
        className={styles.close}
        aria-label="공지 닫기"
        onClick={() => {
          useUiStore.getState().dismissNotice();
        }}
      >
        닫기
      </button>
    </div>
  );
}
