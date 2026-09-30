// DM 전송·회수·읽음 (PRD 5.5·5.8). 확정된 메시지는 Query 캐시에만, 전송 중 상태는 chatStore (ARCHITECTURE 7)
import { dmBubbleSpeaker } from '@/domain';
import { useAuthStore } from '@/store/authStore';
import { dmThreadKey, useChatStore } from '@/store/chatStore';
import {
  markConversationRead,
  markIncomingRead,
  removeDmMessage,
  upsertDmMessage,
} from '@/store/dmCache';
import { queryClient } from '@/store/queryClient';
import { queryKeys } from '@/store/queryKeys';
import { useWorldStore } from '@/store/worldStore';
import { markDmRead, recallDm, sendDm } from '@/transport/api/dm';
import { ApiError } from '@/transport/http';

async function deliver(tempId: string, peerId: string, content: string): Promise<void> {
  try {
    const message = await sendDm(peerId, content);
    const world = useWorldStore.getState();
    const myUserId = world.myUserId ?? message.senderId;
    upsertDmMessage(queryClient, message, peerId, myUserId);
    const chat = useChatStore.getState();
    chat.removePendingThread(tempId);
    const radius = useAuthStore.getState().config?.proximityRadius ?? 0;
    const speaker = dmBubbleSpeaker(
      myUserId,
      peerId,
      myUserId,
      world.myPosition,
      world.positions,
      radius,
    );
    if (speaker !== null) {
      chat.showBubble(
        { id: message.id, userId: speaker, content: message.content, links: message.links },
        'dm',
        Date.now(),
      );
    }
  } catch (error) {
    useChatStore
      .getState()
      .failPendingThread(tempId, error instanceof ApiError ? error.code : 'NETWORK');
  }
}

/** pending 추가 → POST /dm/{userId}/messages → 캐시 반영(에코와 중복 없음) 또는 failed */
export async function sendDmMessage(peerId: string, content: string): Promise<void> {
  const tempId = useChatStore.getState().addPendingThread(dmThreadKey(peerId), content, Date.now());
  await deliver(tempId, peerId, content);
}

export async function retryDm(tempId: string, peerId: string): Promise<void> {
  const pending = useChatStore.getState().pendingThread.find((p) => p.tempId === tempId);
  if (pending?.status !== 'failed' || pending.threadKey !== dmThreadKey(peerId)) {
    return;
  }
  useChatStore.getState().markSendingThread(tempId);
  await deliver(tempId, peerId, pending.content);
}

export function dismissDm(tempId: string): void {
  useChatStore.getState().dismissPendingThread(tempId);
}

export type RecallResult = 'recalled' | 'already_read' | 'failed';

/** 미열람 회수 (DOMAIN 5.3). 이미 읽혔으면 409 → 스레드를 다시 받아 읽음 표시를 맞춘다 */
export async function recallDmMessage(messageId: string, peerId: string): Promise<RecallResult> {
  try {
    await recallDm(messageId);
    removeDmMessage(queryClient, messageId);
    useChatStore.getState().removeBubble(messageId);
    return 'recalled';
  } catch (error) {
    if (error instanceof ApiError && error.code === 'MESSAGE_ALREADY_READ') {
      void queryClient.invalidateQueries({ queryKey: queryKeys.dmThread(peerId) });
      return 'already_read';
    }
    return 'failed';
  }
}

/** 스레드가 보이는 동안 받은 메시지 읽음 처리: 목록 안 읽음 0, 받은 메시지 readAt, 서버에 POST /dm/{userId}/read */
export async function markThreadRead(peerId: string, lastMessageId: string): Promise<void> {
  const myUserId = useWorldStore.getState().myUserId;
  markConversationRead(queryClient, peerId);
  if (myUserId !== null) {
    markIncomingRead(queryClient, peerId, myUserId, Date.now());
  }
  try {
    await markDmRead(peerId, lastMessageId);
  } catch {
    // 실패해도 다음 수신 때 다시 시도한다 (안 읽음 표시는 서버 목록을 다시 받을 때 맞춰진다)
  }
}
