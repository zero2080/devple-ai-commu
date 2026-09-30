// SSE `sync.required` (API_CONTRACT 3.3·3.5) → 재동기화 (10단계)
import { syncRequiredPayloadSchema } from '@/transport/schemas';

import { defineSseHandler } from '../registry';
import { resyncAll } from '../resync';

export const syncRequiredHandler = defineSseHandler({
  type: 'sync.required',
  schema: syncRequiredPayloadSchema,
  handle(payload) {
    console.info(`[sync] required: ${payload.reason}`);
    void resyncAll();
  },
});
