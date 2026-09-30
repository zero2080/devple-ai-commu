import { useRef } from 'react';

import { useWorldFrame } from '@/features/world';
import { useChatStore } from '@/store/chatStore';

import styles from './SpeechBubbleLayer.module.css';
import { SpeechBubbleView } from './SpeechBubbleView';
import { placeBubble, shouldRemoveBubble } from '../bubbleLayout';

interface BubbleElements {
  root: HTMLDivElement;
  tail: HTMLSpanElement;
}

/**
 * 말풍선 DOM 오버레이 (ARCHITECTURE 2.3). 목록은 chatStore 구독으로(드물게) 다시 그리고,
 * 위치는 렌더 프레임마다 DOM transform을 직접 쓴다 (위치 갱신으로 React 리렌더 금지)
 */
export function SpeechBubbleLayer() {
  const bubbles = useChatStore((s) => s.bubbles);
  const elements = useRef(new Map<string, BubbleElements>());
  const hovered = useRef(new Set<string>());
  const removing = useRef(new Set<string>());
  const anchor = useRef({ x: 0, y: 0 });

  useWorldFrame((frame) => {
    const store = useChatStore.getState();
    const now = Date.now();
    const zoom = frame.camera.zoom;
    const reads: { el: BubbleElements; ok: boolean; x: number; y: number; w: number; h: number }[] =
      [];
    for (const bubble of store.bubbles) {
      if (shouldRemoveBubble(bubble.expiresAt, now, hovered.current.has(bubble.id))) {
        if (!removing.current.has(bubble.id)) {
          removing.current.add(bubble.id);
          store.removeBubble(bubble.id);
        }
        continue;
      }
      const el = elements.current.get(bubble.id);
      if (el === undefined) {
        continue;
      }
      const ok = frame.anchorOf(bubble.userId, anchor.current);
      // 읽기를 먼저 모두 끝낸다 (쓰기와 섞으면 레이아웃을 여러 번 계산)
      reads.push({
        el,
        ok,
        x: anchor.current.x,
        y: anchor.current.y,
        w: el.root.offsetWidth,
        h: el.root.offsetHeight,
      });
    }
    for (const read of reads) {
      const placement = read.ok
        ? placeBubble(read, read.w, read.h, zoom, frame.viewportWidthPx, frame.viewportHeightPx)
        : null;
      if (!placement?.visible) {
        read.el.root.style.visibility = 'hidden';
        continue;
      }
      read.el.root.style.transform = `translate(${String(placement.x)}px, ${String(placement.y)}px)`;
      read.el.tail.style.left = `${String(placement.tailLeft)}px`;
      read.el.root.style.visibility = 'visible';
    }
  });

  const handleElement = (
    id: string,
    root: HTMLDivElement | null,
    tail: HTMLSpanElement | null,
  ): void => {
    if (root === null || tail === null) {
      elements.current.delete(id);
      hovered.current.delete(id);
      removing.current.delete(id);
      return;
    }
    elements.current.set(id, { root, tail });
  };

  const handleHoverChange = (id: string, isHovered: boolean): void => {
    if (isHovered) {
      hovered.current.add(id);
    } else {
      hovered.current.delete(id);
    }
  };

  return (
    // 같은 내용이 로그(role=log)에 있으므로 보조기기에는 숨긴다. 말풍선 속 링크 버튼은 tabIndex=-1
    <div className={styles.layer} aria-hidden="true" data-testid="bubble-layer">
      {bubbles.map((bubble) => (
        <SpeechBubbleView
          key={bubble.id}
          bubble={bubble}
          onElement={handleElement}
          onHoverChange={handleHoverChange}
        />
      ))}
    </div>
  );
}
