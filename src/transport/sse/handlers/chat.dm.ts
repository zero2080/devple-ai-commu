// SSE `chat.dm` (API_CONTRACT 3.3) → DM 캐시·말풍선 (8단계). 받은 것과 내 에코(다중 탭) 모두 온다
import { dmBubbleSpeaker } from '@/domain';
import { useAuthStore } from '@/store/authStore';
import { useChatStore } from '@/store/chatStore';
import { rememberUser, upsertDmMessage } from '@/store/dmCache';
import { queryClient } from '@/store/queryClient';
import { useWorldStore } from '@/store/worldStore';
import { chatDmPayloadSchema } from '@/transport/schemas';

import { defineSseHandler } from '../registry';

export const chatDmHandler = defineSseHandler({
  type: 'chat.dm',
  schema: chatDmPayloadSchema,
  handle(payload) {
    const world = useWorldStore.getState();
    const myUserId = world.myUserId;
    if (myUserId === null) {
      return;
    }
    rememberUser(queryClient, payload.sender);
    upsertDmMessage(queryClient, payload, payload.peerId, myUserId);
    const chat = useChatStore.getState();
    if (payload.senderId === myUserId) {
      chat.resolvePendingDmByEcho(payload.peerId, payload.content);
    }
    const radius = useAuthStore.getState().config?.proximityRadius ?? 0;
    const speaker = dmBubbleSpeaker(
      payload.senderId,
      payload.peerId,
      myUserId,
      world.myPosition,
      world.positions,
      radius,
    );
    if (speaker !== null) {
      chat.showBubble(
        { id: payload.id, userId: speaker, content: payload.content, links: payload.links },
        'dm',
        Date.now(),
      );
    }
  },
});
