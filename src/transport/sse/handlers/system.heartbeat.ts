// SSE `system.heartbeat` (API_CONTRACT 3.3, 1.3에서 추가). 수신 자체가 무수신 감시를 리셋하고, serverTime을 갱신한다.
import { useWorldStore } from '@/store/worldStore';
import { systemHeartbeatPayloadSchema } from '@/transport/schemas';

import { defineSseHandler } from '../registry';

export const systemHeartbeatHandler = defineSseHandler({
  type: 'system.heartbeat',
  schema: systemHeartbeatPayloadSchema,
  handle(payload) {
    useWorldStore.getState().setServerTime(payload.serverTime);
  },
});
