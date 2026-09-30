// SSE `chat.dm.read` (API_CONTRACT 3.3) → 내 메시지의 읽음 표시 (8단계). 발신자인 나에게만 온다
import { applyDmRead } from '@/store/dmCache';
import { queryClient } from '@/store/queryClient';
import { useWorldStore } from '@/store/worldStore';
import { chatDmReadPayloadSchema } from '@/transport/schemas';

import { defineSseHandler } from '../registry';

export const chatDmReadHandler = defineSseHandler({
  type: 'chat.dm.read',
  schema: chatDmReadPayloadSchema,
  handle(payload) {
    const myUserId = useWorldStore.getState().myUserId;
    if (myUserId !== null) {
      applyDmRead(queryClient, payload, myUserId);
    }
  },
});
