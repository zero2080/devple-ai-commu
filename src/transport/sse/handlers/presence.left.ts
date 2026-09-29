// SSE `presence.left` (API_CONTRACT 3.3) → worldStore 갱신 (ROADMAP 5단계)
import { useWorldStore } from '@/store/worldStore';
import { presenceLeftPayloadSchema } from '@/transport/schemas';

import { defineSseHandler } from '../registry';

export const presenceLeftHandler = defineSseHandler({
  type: 'presence.left',
  schema: presenceLeftPayloadSchema,
  handle(payload) {
    useWorldStore.getState().removePresence(payload.userId);
  },
});
