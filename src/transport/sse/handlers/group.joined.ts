// SSE `group.joined` (API_CONTRACT 3.3) → 초대됨: 목록에 넣고 서버 목록을 다시 받는다 (9단계)
import { applyGroupJoined } from '@/store/groupCache';
import { queryClient } from '@/store/queryClient';
import { groupJoinedPayloadSchema } from '@/transport/schemas';

import { defineSseHandler } from '../registry';

export const groupJoinedHandler = defineSseHandler({
  type: 'group.joined',
  schema: groupJoinedPayloadSchema,
  handle(payload) {
    applyGroupJoined(queryClient, payload);
  },
});
