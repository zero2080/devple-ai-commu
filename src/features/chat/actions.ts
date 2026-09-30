// 근접 대화 전송 (CONVENTIONS 7: 낙관적 업데이트는 메시지 전송에만). 컴포넌트는 fetch를 직접 부르지 않는다
import { useAuthStore } from '@/store/authStore';
import { useChatStore } from '@/store/chatStore';
import { sendPublicMessage } from '@/transport/api/chat';
import { ApiError } from '@/transport/http';

async function deliver(tempId: string, content: string): Promise<void> {
  try {
    const message = await sendPublicMessage(content);
    const nickname = useAuthStore.getState().me?.nickname ?? '';
    useChatStore.getState().confirmPending(tempId, message, nickname, Date.now());
  } catch (error) {
    useChatStore.getState().failPending(tempId, error instanceof ApiError ? error.code : 'NETWORK');
  }
}

/** pending 추가 → POST /chat/public → 201이면 확정(SSE가 먼저 왔으면 중복 없이 정리), 실패면 failed */
export async function sendPublic(content: string): Promise<void> {
  const tempId = useChatStore.getState().addPending(content, Date.now());
  await deliver(tempId, content);
}

/** 실패한 항목만 다시 보낸다 (보내지지 않은 메시지라 불변 원칙과 무관) */
export async function retryPublic(tempId: string): Promise<void> {
  const pending = useChatStore.getState().pendingPublic.find((p) => p.tempId === tempId);
  if (pending?.status !== 'failed') {
    return;
  }
  useChatStore.getState().markSending(tempId);
  await deliver(tempId, pending.content);
}

export function dismissPublic(tempId: string): void {
  useChatStore.getState().dismissPending(tempId);
}
