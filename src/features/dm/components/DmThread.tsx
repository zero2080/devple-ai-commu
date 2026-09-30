import { useEffect, useState } from 'react';

import { ThreadView, type ThreadRow } from '@/features/chat';
import { useUser } from '@/features/profile';
import { messageForCode } from '@/shared/errorMessages';
import styles from '@/shared/ui/panel.module.css';
import { useAuthStore } from '@/store/authStore';
import { dmThreadKey, useChatStore } from '@/store/chatStore';
import { useUiStore } from '@/store/uiStore';

import { dismissDm, markThreadRead, recallDmMessage, retryDm, sendDmMessage } from '../actions';
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
  const pendingAll = useChatStore((s) => s.pendingThread);
  const thread = useDmThread(peerId);
  const [notice, setNotice] = useState<string | null>(null);

  const newestFirst = thread.data?.pages.flatMap((page) => page.items) ?? [];
  const threadKey = dmThreadKey(peerId);
  const pending = pendingAll.filter((p) => p.threadKey === threadKey);
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

  const recall = async (messageId: string): Promise<void> => {
    const result = await recallDmMessage(messageId, peerId);
    setNotice(
      result === 'recalled'
        ? null
        : messageForCode(result === 'already_read' ? 'MESSAGE_ALREADY_READ' : 'INTERNAL'),
    );
  };

  const rows: ThreadRow[] = [...newestFirst].reverse().map((m) => {
    const mine = m.senderId === myUserId;
    return {
      id: m.id,
      mine,
      nickname: mine ? myNickname : peerName,
      content: m.content,
      links: m.links,
      trailing: !mine ? undefined : m.readAt !== undefined ? (
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
      ),
    };
  });

  return (
    <ThreadView
      title={peerName}
      onBack={() => {
        useUiStore.getState().closeDmThread();
      }}
      logLabel={`${peerName}와의 DM`}
      testId="dm"
      rows={rows}
      pending={pending}
      myNickname={myNickname}
      onRetry={(tempId) => {
        void retryDm(tempId, peerId);
      }}
      onDismiss={dismissDm}
      loading={thread.isPending}
      hasOlder={thread.hasNextPage}
      loadingOlder={thread.isFetchingNextPage}
      onLoadOlder={() => {
        void thread.fetchNextPage();
      }}
      notice={notice}
      composer={{
        inputId: 'dm-input',
        label: `${peerName}에게 DM`,
        placeholder: `${peerName}에게 DM · 위치와 상관없이 전달`,
        onSend: (content) => {
          void sendDmMessage(peerId, content);
        },
      }}
    />
  );
}
