// SSE `system.notice` (API_CONTRACT 3.3) → 상단 공지 배너 (11단계, DOMAIN 6.1). 최신 1건이 이전 공지를 대체한다
import { useUiStore } from '@/store/uiStore';
import { systemNoticePayloadSchema } from '@/transport/schemas';

import { defineSseHandler } from '../registry';

export const systemNoticeHandler = defineSseHandler({
  type: 'system.notice',
  schema: systemNoticePayloadSchema,
  handle(payload) {
    useUiStore.getState().showNotice(payload);
  },
});
