// SSE `system.suspended` (API_CONTRACT 3.3). 세션 종료는 transport가 아니라 features/auth가 한다:
// connectSse({ onSuspended })가 이 이벤트를 받는 즉시 endSession('suspended')를 부른다 (ARCHITECTURE 6장). 여기서는 검증만
import { systemSuspendedPayloadSchema } from '@/transport/schemas';

import { defineSseHandler } from '../registry';

export const systemSuspendedHandler = defineSseHandler({
  type: 'system.suspended',
  schema: systemSuspendedPayloadSchema,
});
