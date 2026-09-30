// SSE `chat.dm.recalled` (API_CONTRACT 3.3) → 스레드에서 제거·목록 갱신·말풍선 제거 (8단계)
import { useChatStore } from '@/store/chatStore';
import { removeDmMessage } from '@/store/dmCache';
import { queryClient } from '@/store/queryClient';
import { chatDmRecalledPayloadSchema } from '@/transport/schemas';

import { defineSseHandler } from '../registry';

export const chatDmRecalledHandler = defineSseHandler({
  type: 'chat.dm.recalled',
  schema: chatDmRecalledPayloadSchema,
  handle(payload) {
    removeDmMessage(queryClient, payload.messageId);
    useChatStore.getState().removeBubble(payload.messageId);
  },
});
