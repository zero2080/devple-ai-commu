// SSE `chat.group` (API_CONTRACT 3.3) → 그룹 캐시 (9단계). 받은 것과 내 에코(다중 탭) 모두 온다.
// 그룹 메시지는 위치와 무관하게 전달되며 말풍선을 띄우지 않는다 (DOMAIN 5.4)
import { groupThreadKey, useChatStore } from '@/store/chatStore';
import { upsertGroupMessage } from '@/store/groupCache';
import { queryClient } from '@/store/queryClient';
import { rememberUser } from '@/store/userCache';
import { useWorldStore } from '@/store/worldStore';
import { chatGroupPayloadSchema } from '@/transport/schemas';

import { defineSseHandler } from '../registry';

export const chatGroupHandler = defineSseHandler({
  type: 'chat.group',
  schema: chatGroupPayloadSchema,
  handle(payload) {
    const myUserId = useWorldStore.getState().myUserId;
    if (myUserId === null) {
      return;
    }
    rememberUser(queryClient, payload.sender);
    upsertGroupMessage(queryClient, payload, myUserId);
    if (payload.senderId === myUserId) {
      useChatStore
        .getState()
        .resolvePendingThreadByEcho(groupThreadKey(payload.groupId), payload.content);
    }
  },
});
