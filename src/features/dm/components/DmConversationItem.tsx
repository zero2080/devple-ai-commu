import type { DmConversation } from '@/domain';
import { peerIdOf } from '@/domain';
import { useUser } from '@/features/profile';
import { useUiStore } from '@/store/uiStore';

import styles from './DmPane.module.css';

interface DmConversationItemProps {
  conversation: DmConversation;
  myUserId: string;
}

/** 대화 목록 한 줄: 상대 닉네임(사용자 캐시), 마지막 메시지, 안 읽음 */
export function DmConversationItem({ conversation, myUserId }: DmConversationItemProps) {
  const peerId = peerIdOf(conversation, myUserId);
  const peer = useUser(peerId);
  const last = conversation.lastMessage;
  const preview =
    last === undefined ? '' : `${last.senderId === myUserId ? '나: ' : ''}${last.content}`;
  return (
    <li>
      <button
        type="button"
        className={styles.row}
        data-testid="dm-conversation"
        onClick={() => {
          useUiStore.getState().openDm(peerId);
        }}
      >
        <span className={styles.rowName}>{peer.data?.nickname ?? '…'}</span>
        <span className={styles.rowPreview}>{preview}</span>
        {conversation.unreadCount > 0 ? (
          <span className={styles.badge} aria-label={`안 읽음 ${String(conversation.unreadCount)}`}>
            {conversation.unreadCount}
          </span>
        ) : null}
      </button>
    </li>
  );
}
