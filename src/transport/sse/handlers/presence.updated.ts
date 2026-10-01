// SSE `presence.updated` (API_CONTRACT 3.3) → 월드 접속자(상태·닉네임·외형)와 사용자 캐시. 외형은 바뀔 때 전체가 온다.
// 내 변경(다른 탭의 옷장 저장 등)이면 authStore.me도 맞춘다 — 이 탭의 옷장이 옛 외형에서 시작하지 않게
import { useAuthStore } from '@/store/authStore';
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
    const profile = {
      ...(payload.nickname === undefined ? {} : { nickname: payload.nickname }),
      ...(payload.appearance === undefined ? {} : { appearance: payload.appearance }),
    };
    patchUser(queryClient, payload.userId, profile);
    const auth = useAuthStore.getState();
    if (auth.me?.id === payload.userId && auth.config !== null && Object.keys(profile).length > 0) {
      auth.setMe({ ...auth.me, ...profile }, auth.config);
    }
  },
});
