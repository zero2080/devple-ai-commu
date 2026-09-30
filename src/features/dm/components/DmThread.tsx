import { useEffect, useLayoutEffect, useRef, useState } from 'react';

import { LinkButton, MessageComposer } from '@/features/chat';
import { useUser } from '@/features/profile';
import { messageForCode } from '@/shared/errorMessages';
import { useAuthStore } from '@/store/authStore';
import { useChatStore } from '@/store/chatStore';
import { useUiStore } from '@/store/uiStore';

import styles from './DmPane.module.css';
import { dismissDm, markThreadRead, recallDmMessage, retryDm, sendDmMessage } from '../actions';
import { LOAD_OLDER_THRESHOLD_PX, STICK_TO_BOTTOM_PX } from '../constants';
import { useDmThread } from '../hooks/useDmThread';

interface DmThreadProps {
  peerId: string;
}

/**
 * 1:1 대화 (PRD 5.5·5.8): 오래된 것 → 최신, 위로 스크롤하면 이전 50개. 내 메시지는 "읽음" 또는 미열람이면 "회수".
 * 보이는 동안 받은 메시지는 읽음 처리한다
 */
export function DmThread({ peerId }: DmThreadProps) {
  const peer = useUser(peerId);
  const myUserId = useAuthStore((s) => s.me?.id ?? '');
  const myNickname = useAuthStore((s) => s.me?.nickname ?? '');
  const pending = useChatStore((s) => s.pendingDm);
  const thread = useDmThread(peerId);
  const [notice, setNotice] = useState<string | null>(null);
  const listRef = useRef<HTMLOListElement | null>(null);
  const stick = useRef(true);
  const restore = useRef<{ height: number; top: number } | null>(null);

  const newestFirst = thread.data?.pages.flatMap((page) => page.items) ?? [];
  const messages = [...newestFirst].reverse();
  const mine = pending.filter((p) => p.peerId === peerId);
  const newestIncoming = newestFirst.find((m) => m.senderId !== myUserId);
  const peerName = peer.data?.nickname ?? '…';

  // 받은 최신 메시지가 바뀌면(열었을 때 포함) 읽음 처리. 이미 읽은 것(readAt)은 건너뛴다
  const toMark =
    newestIncoming !== undefined && newestIncoming.readAt === undefined ? newestIncoming.id : null;
  useEffect(() => {
    if (toMark !== null) {
      void markThreadRead(peerId, toMark);
    }
  }, [peerId, toMark]);

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
  }, [thread.data, pending]);

  const loadOlder = (): void => {
    const list = listRef.current;
    if (!thread.hasNextPage || thread.isFetchingNextPage) {
      return;
    }
    if (list !== null) {
      restore.current = { height: list.scrollHeight, top: list.scrollTop };
    }
    void thread.fetchNextPage();
  };

  const recall = async (messageId: string): Promise<void> => {
    const result = await recallDmMessage(messageId, peerId);
    setNotice(
      result === 'recalled'
        ? null
        : messageForCode(result === 'already_read' ? 'MESSAGE_ALREADY_READ' : 'INTERNAL'),
    );
  };

  return (
    <div className={styles.thread}>
      <header className={styles.threadHeader}>
        <button
          type="button"
          className={styles.back}
          onClick={() => {
            useUiStore.getState().closeDmThread();
          }}
        >
          ← 목록
        </button>
        <span className={styles.threadTitle}>{peerName}</span>
      </header>
      <ol
        ref={listRef}
        className={styles.messages}
        role="log"
        aria-live="polite"
        aria-label={`${peerName}와의 DM`}
        onScroll={(event) => {
          const el = event.currentTarget;
          stick.current = el.scrollHeight - el.scrollTop - el.clientHeight <= STICK_TO_BOTTOM_PX;
          if (el.scrollTop <= LOAD_OLDER_THRESHOLD_PX) {
            loadOlder();
          }
        }}
      >
        {thread.hasNextPage ? (
          <li>
            <button
              type="button"
              className={styles.more}
              disabled={thread.isFetchingNextPage}
              onClick={loadOlder}
            >
              {thread.isFetchingNextPage ? '불러오는 중…' : '이전 메시지'}
            </button>
          </li>
        ) : null}
        {thread.isPending ? <li className={styles.muted}>불러오는 중…</li> : null}
        {messages.map((m) => {
          const isMine = m.senderId === myUserId;
          return (
            <li key={m.id} className={styles.message} data-testid="dm-message" data-mine={isMine}>
              <span className={isMine ? styles.nickMine : styles.nick}>
                {isMine ? myNickname : peerName}
              </span>
              <span className={styles.text}>{m.content}</span>
              {m.links.length > 0 ? (
                <span className={styles.links}>
                  {[...new Set(m.links)].map((url) => (
                    <LinkButton key={url} url={url} />
                  ))}
                </span>
              ) : null}
              {isMine ? (
                m.readAt !== undefined ? (
                  <span className={styles.read}>읽음</span>
                ) : (
                  <button
                    type="button"
                    className={styles.action}
                    onClick={() => {
                      void recall(m.id);
                    }}
                  >
                    회수
                  </button>
                )
              ) : null}
            </li>
          );
        })}
        {mine.map((item) => (
          <li
            key={item.tempId}
            className={styles.pending}
            data-testid="dm-pending"
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
                    void retryDm(item.tempId);
                  }}
                >
                  다시 보내기
                </button>
                <button
                  type="button"
                  className={styles.action}
                  onClick={() => {
                    dismissDm(item.tempId);
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
        inputId="dm-input"
        label={`${peerName}에게 DM`}
        placeholder={`${peerName}에게 DM · 위치와 상관없이 전달`}
        onSend={(content) => {
          void sendDmMessage(peerId, content);
        }}
        autoFocus
      />
    </div>
  );
}
