import { useEffect, useRef } from 'react';

import { messageForCode } from '@/shared/errorMessages';
import { useAuthStore } from '@/store/authStore';
import { useChatStore } from '@/store/chatStore';

import { LinkButton } from './LinkButton';
import styles from './PublicLog.module.css';
import { dismissPublic, retryPublic } from '../actions';

/** 바닥에서 이 정도(px) 안이면 새 메시지가 올 때 따라 내려간다 */
const STICK_TO_BOTTOM_PX = 24;

/** 근접 대화 로그 (PRD 5.4, 세션 한정). 본문은 텍스트 노드, 링크는 서버 links[]만 버튼으로 */
export function PublicLog() {
  const entries = useChatStore((s) => s.publicLog);
  const pending = useChatStore((s) => s.pendingPublic);
  const myUserId = useAuthStore((s) => s.me?.id ?? null);
  const myNickname = useAuthStore((s) => s.me?.nickname ?? '');
  const listRef = useRef<HTMLOListElement | null>(null);
  const stick = useRef(true);

  // 외부 시스템(DOM 스크롤) 동기화: 새 항목이 오면 바닥을 따라간다
  useEffect(() => {
    const list = listRef.current;
    if (list !== null && stick.current) {
      list.scrollTop = list.scrollHeight;
    }
  }, [entries, pending]);

  return (
    <ol
      ref={listRef}
      className={styles.log}
      role="log"
      aria-live="polite"
      aria-label="근접 대화 기록"
      onScroll={(event) => {
        const el = event.currentTarget;
        stick.current = el.scrollHeight - el.scrollTop - el.clientHeight <= STICK_TO_BOTTOM_PX;
      }}
    >
      {entries.map((entry) => (
        <li key={entry.id} className={styles.entry} data-testid="public-log-entry">
          <span className={entry.senderId === myUserId ? styles.nickMine : styles.nick}>
            {entry.senderNickname}
          </span>
          <span className={styles.text}>{entry.content}</span>
          {entry.links.length > 0 ? (
            <span className={styles.links}>
              {[...new Set(entry.links)].map((url) => (
                <LinkButton key={url} url={url} />
              ))}
            </span>
          ) : null}
        </li>
      ))}
      {pending.map((item) => (
        <li
          key={item.tempId}
          className={styles.pending}
          data-testid="public-log-pending"
          data-status={item.status}
        >
          <span className={styles.nickMine}>{myNickname}</span>
          <span className={styles.text}>{item.content}</span>
          {item.status === 'sending' ? (
            <span className={styles.status}>전송 중…</span>
          ) : (
            <span className={styles.failed}>
              <span role="alert">{messageForCode(item.errorCode)}</span>
              <button
                type="button"
                className={styles.action}
                onClick={() => {
                  void retryPublic(item.tempId);
                }}
              >
                다시 보내기
              </button>
              <button
                type="button"
                className={styles.action}
                onClick={() => {
                  dismissPublic(item.tempId);
                }}
              >
                지우기
              </button>
            </span>
          )}
        </li>
      ))}
    </ol>
  );
}
