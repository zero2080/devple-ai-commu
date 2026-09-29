// SSE `presence.joined` (API_CONTRACT 3.3) → worldStore 갱신 (ROADMAP 5단계)
import { useWorldStore } from '@/store/worldStore';
import { presenceJoinedPayloadSchema } from '@/transport/schemas';

import { defineSseHandler } from '../registry';

export const presenceJoinedHandler = defineSseHandler({
  type: 'presence.joined',
  schema: presenceJoinedPayloadSchema,
  handle(payload) {
    useWorldStore.getState().addPresence(payload);
  },
});
