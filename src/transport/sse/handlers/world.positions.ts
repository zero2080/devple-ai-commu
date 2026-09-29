// SSE `world.positions` (API_CONTRACT 3.3) → worldStore 갱신 (ROADMAP 5단계)
import { useWorldStore } from '@/store/worldStore';
import { worldPositionsPayloadSchema } from '@/transport/schemas';

import { defineSseHandler } from '../registry';

export const worldPositionsHandler = defineSseHandler({
  type: 'world.positions',
  schema: worldPositionsPayloadSchema,
  handle(payload) {
    // 본인 항목은 스토어가 무시한다 (보정은 PUT /me/position 응답으로만)
    useWorldStore.getState().applyPositions(payload.mapId, payload.positions);
  },
});
