// SSE `group.joined` (API_CONTRACT 3.3). 3단계: 파싱만. 스토어 갱신은 이후 단계에서 handle을 채운다.
import { groupJoinedPayloadSchema } from '@/transport/schemas';

import { defineSseHandler } from '../registry';

export const groupJoinedHandler = defineSseHandler({
  type: 'group.joined',
  schema: groupJoinedPayloadSchema,
});
