// SSE `presence.updated` (API_CONTRACT 3.3) → 월드 접속자(상태·닉네임·외형)와 사용자 캐시. 외형은 바뀔 때 전체가 온다
import { queryClient } from '@/store/queryClient';
import { patchUser } from '@/store/userCache';
import { useWorldStore } from '@/store/worldStore';
import { presenceUpdatedPayloadSchema } from '@/transport/schemas';

import { defineSseHandler } from '../registry';

export const presenceUpdatedHandler = defineSseHandler({
  type: 'presence.updated',
  schema: presenceUpdatedPayloadSchema,
  handle(payload) {
    useWorldStore.getState().updatePresence({
      userId: payload.userId,
      ...(payload.state === undefined ? {} : { state: payload.state }),
      ...(payload.nickname === undefined ? {} : { nickname: payload.nickname }),
      ...(payload.appearance === undefined ? {} : { appearance: payload.appearance }),
    });
    patchUser(queryClient, payload.userId, {
      ...(payload.nickname === undefined ? {} : { nickname: payload.nickname }),
      ...(payload.appearance === undefined ? {} : { appearance: payload.appearance }),
    });
  },
});
