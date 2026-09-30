import type { SpeechBubble } from '@/domain';

import { LinkButton } from './LinkButton';
import styles from './SpeechBubbleLayer.module.css';

interface SpeechBubbleViewProps {
  bubble: SpeechBubble;
  onElement: (id: string, root: HTMLDivElement | null, tail: HTMLSpanElement | null) => void;
  onHoverChange: (id: string, hovered: boolean) => void;
}

/** 말풍선 1개. 위치는 레이어가 프레임마다 transform으로 쓴다. 본문은 텍스트 노드 (HTML 해석 없음) */
export function SpeechBubbleView({ bubble, onElement, onHoverChange }: SpeechBubbleViewProps) {
  const links = [...new Set(bubble.links)];
  const hasLinks = links.length > 0;
  return (
    <div
      ref={(element) => {
        // 루트가 붙을 때는 자식(꼬리)도 이미 DOM에 있다. cleanup을 돌려주므로 null로는 불리지 않지만 타입상 가드
        onElement(
          bubble.id,
          element,
          element?.querySelector<HTMLSpanElement>('[data-bubble-tail]') ?? null,
        );
        return () => {
          onElement(bubble.id, null, null);
        };
      }}
      className={`${styles.bubble ?? ''} ${hasLinks ? (styles.interactive ?? '') : ''}`}
      data-testid="speech-bubble"
      data-user-id={bubble.userId}
      data-variant={bubble.variant}
      onPointerEnter={() => {
        onHoverChange(bubble.id, true);
      }}
      onPointerLeave={() => {
        onHoverChange(bubble.id, false);
      }}
    >
      <span className={styles.text}>{bubble.content}</span>
      {hasLinks ? (
        <span className={styles.links}>
          {links.map((url) => (
            <LinkButton key={url} url={url} inBubble />
          ))}
        </span>
      ) : null}
      <span className={styles.tail} data-bubble-tail="" />
    </div>
  );
}
