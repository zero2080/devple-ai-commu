// SSE `group.updated` (API_CONTRACT 3.3) → 이름·owner·인원·멤버 교체 (9단계)
import { applyGroupUpdated } from '@/store/groupCache';
import { queryClient } from '@/store/queryClient';
import { groupUpdatedPayloadSchema } from '@/transport/schemas';

import { defineSseHandler } from '../registry';

export const groupUpdatedHandler = defineSseHandler({
  type: 'group.updated',
  schema: groupUpdatedPayloadSchema,
  handle(payload) {
    applyGroupUpdated(queryClient, payload);
  },
});
