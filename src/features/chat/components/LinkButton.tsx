import { linkLabel } from '@/domain';
import { openExternalLink } from '@/shared/externalLink';

import styles from './LinkButton.module.css';

interface LinkButtonProps {
  url: string;
  /** 말풍선 안 버튼은 키보드 순서에서 뺀다 (같은 링크가 로그에 있고 말풍선은 사라지므로) */
  inBubble?: boolean;
}

/** `↗ hostname` 버튼. 서버 links[]의 값만 받는다. 전체 URL은 title (ARCHITECTURE 2.4) */
export function LinkButton({ url, inBubble = false }: LinkButtonProps) {
  const label = linkLabel(url);
  if (label === null) {
    return null;
  }
  return (
    <button
      type="button"
      className={styles.link}
      title={url}
      tabIndex={inBubble ? -1 : undefined}
      onClick={() => {
        openExternalLink(url);
      }}
    >
      ↗ {label}
    </button>
  );
}
