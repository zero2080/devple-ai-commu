// SSE `system.notice` (API_CONTRACT 3.3). 3단계: 파싱만. 스토어 갱신은 이후 단계에서 handle을 채운다.
import { systemNoticePayloadSchema } from '@/transport/schemas';

import { defineSseHandler } from '../registry';

export const systemNoticeHandler = defineSseHandler({
  type: 'system.notice',
  schema: systemNoticePayloadSchema,
});
