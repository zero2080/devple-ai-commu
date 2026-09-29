// API_CONTRACT 2.4 월드
import type { Presence } from '@/domain';

import { request } from '../http';
import { worldPresencesResponseSchema } from '../schemas';
import { ENDPOINTS } from './endpoints';

export interface WorldPresencesResponse {
  mapId: string;
  presences: Presence[];
  serverTime: number;
}

/** GET /world/{mapId}/presences — SSE 단절 후 재동기화용 */
export function fetchPresences(mapId: string): Promise<WorldPresencesResponse> {
  return request({ ...ENDPOINTS.worldPresences, params: { mapId } }, worldPresencesResponseSchema);
}
