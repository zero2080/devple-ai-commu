// SSE `chat.public` (API_CONTRACT 3.3) → chatStore (7단계). 서버가 반경 판정을 끝낸 뒤 보낸 것이므로 받으면 그대로 표시한다.
import { useChatStore } from '@/store/chatStore';
import { useWorldStore } from '@/store/worldStore';
import { chatPublicPayloadSchema } from '@/transport/schemas';

import { defineSseHandler } from '../registry';

export const chatPublicHandler = defineSseHandler({
  type: 'chat.public',
  schema: chatPublicPayloadSchema,
  handle(payload) {
    useChatStore.getState().receivePublic(payload, useWorldStore.getState().myUserId, Date.now());
  },
});
