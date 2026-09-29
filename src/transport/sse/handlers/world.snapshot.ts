// SSE `world.snapshot` (API_CONTRACT 3.3) → worldStore 갱신 (ROADMAP 5단계)
import { useWorldStore } from '@/store/worldStore';
import { worldSnapshotPayloadSchema } from '@/transport/schemas';

import { defineSseHandler } from '../registry';

export const worldSnapshotHandler = defineSseHandler({
  type: 'world.snapshot',
  schema: worldSnapshotPayloadSchema,
  handle(payload) {
    useWorldStore.getState().applySnapshot(payload);
  },
});
