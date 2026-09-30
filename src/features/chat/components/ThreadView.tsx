import { useLayoutEffect, useRef, type ReactNode } from 'react';

import type { PendingThreadMessage } from '@/domain';
import { messageForCode } from '@/shared/errorMessages';
import styles from '@/shared/ui/panel.module.css';

import { LinkButton } from './LinkButton';
import { MessageComposer } from './MessageComposer';

/** 위로 이만큼(px) 안에 오면 이전 메시지를 더 받는다 */
const LOAD_OLDER_THRESHOLD_PX = 24;
/** 바닥에서 이만큼 안이면 새 메시지가 올 때 따라 내려간다 */
const STICK_TO_BOTTOM_PX = 24;

export interface ThreadRow {
  id: string;
  mine: boolean;
  nickname: string;
  content: string;
  links: readonly string[];
  /** 줄 끝 부가 요소 (DM "읽음"·"회수" 등) */
  trailing?: ReactNode;
}

export interface ThreadViewProps {
  title: string;
  onBack: () => void;
  /** 헤더 오른쪽 버튼 (그룹 "멤버" 등) */
  headerActions?: ReactNode;
  logLabel: string;
  /** data-testid 접두: `${testId}-message`, `${testId}-pending` */
  testId: string;
  /** 오래된 것 → 최신 */
  rows: readonly ThreadRow[];
  pending: readonly PendingThreadMessage[];
  myNickname: string;
  onRetry: (tempId: string) => void;
  onDismiss: (tempId: string) => void;
  loading: boolean;
  hasOlder: boolean;
  loadingOlder: boolean;
  onLoadOlder: () => void;
  notice: string | null;
  composer: {
    inputId: string;
    label: string;
    placeholder: string;
    onSend: (content: string) => void;
  };
}

/**
 * DM·그룹 공통 스레드 화면 (PRD 5.5·5.6·5.8): 헤더, 메시지 로그(위로 스크롤하면 이전 페이지), 전송 중·실패 항목,
 * 안내, 입력창. 본문은 plain text, 링크는 서버 links[]로만 버튼을 만든다 (ARCHITECTURE 2.4)
 */
export function ThreadView({
  title,
  onBack,
  headerActions,
  logLabel,
  testId,
  rows,
  pending,
  myNickname,
  onRetry,
  onDismiss,
  loading,
  hasOlder,
  loadingOlder,
  onLoadOlder,
  notice,
  composer,
}: ThreadViewProps) {
  const listRef = useRef<HTMLOListElement | null>(null);
  const stick = useRef(true);
  const restore = useRef<{ height: number; top: number } | null>(null);

  // 외부 시스템(DOM 스크롤) 동기화: 이전 페이지를 붙였으면 보던 자리를 지키고, 아니면 바닥을 따라간다
  useLayoutEffect(() => {
    const list = listRef.current;
    if (list === null) {
      return;
    }
    if (restore.current !== null) {
      list.scrollTop = list.scrollHeight - restore.current.height + restore.current.top;
      restore.current = null;
    } else if (stick.current) {
      list.scrollTop = list.scrollHeight;
    }
  }, [rows, pending]);

  const loadOlder = (): void => {
    const list = listRef.current;
    if (!hasOlder || loadingOlder) {
      return;
    }
    if (list !== null) {
      restore.current = { height: list.scrollHeight, top: list.scrollTop };
    }
    onLoadOlder();
  };

  return (
    <div className={styles.thread}>
      <header className={styles.threadHeader}>
        <button type="button" className={styles.back} onClick={onBack}>
          ← 목록
        </button>
        <span className={styles.threadTitle}>{title}</span>
        {headerActions}
      </header>
      <ol
        ref={listRef}
        className={styles.messages}
        role="log"
        aria-live="polite"
        aria-label={logLabel}
        onScroll={(event) => {
          const el = event.currentTarget;
          stick.current = el.scrollHeight - el.scrollTop - el.clientHeight <= STICK_TO_BOTTOM_PX;
          if (el.scrollTop <= LOAD_OLDER_THRESHOLD_PX) {
            loadOlder();
          }
        }}
      >
        {hasOlder ? (
          <li>
            <button
              type="button"
              className={styles.more}
              disabled={loadingOlder}
              onClick={loadOlder}
            >
              {loadingOlder ? '불러오는 중…' : '이전 메시지'}
            </button>
          </li>
        ) : null}
        {loading ? <li className={styles.muted}>불러오는 중…</li> : null}
        {rows.map((row) => (
          <li
            key={row.id}
            className={styles.message}
            data-testid={`${testId}-message`}
            data-mine={row.mine}
          >
            <span className={row.mine ? styles.nickMine : styles.nick}>{row.nickname}</span>
            <span className={styles.text}>{row.content}</span>
            {row.links.length > 0 ? (
              <span className={styles.links}>
                {[...new Set(row.links)].map((url) => (
                  <LinkButton key={url} url={url} />
                ))}
              </span>
            ) : null}
            {row.trailing}
          </li>
        ))}
        {pending.map((item) => (
          <li
            key={item.tempId}
            className={styles.pending}
            data-testid={`${testId}-pending`}
            data-status={item.status}
          >
            <span className={styles.nickMine}>{myNickname}</span>
            <span className={styles.text}>{item.content}</span>
            {item.status === 'sending' ? (
              <span className={styles.muted}>전송 중…</span>
            ) : (
              <span className={styles.failed}>
                <span role="alert">{messageForCode(item.errorCode)}</span>
                <button
                  type="button"
                  className={styles.action}
                  onClick={() => {
                    onRetry(item.tempId);
                  }}
                >
                  다시 보내기
                </button>
                <button
                  type="button"
                  className={styles.action}
                  onClick={() => {
                    onDismiss(item.tempId);
                  }}
                >
                  지우기
                </button>
              </span>
            )}
          </li>
        ))}
      </ol>
      {notice !== null ? (
        <p className={styles.notice} role="alert">
          {notice}
        </p>
      ) : null}
      <MessageComposer
        inputId={composer.inputId}
        label={composer.label}
        placeholder={composer.placeholder}
        onSend={composer.onSend}
        autoFocus
      />
    </div>
  );
}
