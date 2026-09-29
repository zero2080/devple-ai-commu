// API_CONTRACT 2.2 본인
import type { Me, Position, PresenceState, ServerConfig } from '@/domain';

import { request } from '../http';
import { meResponseSchema, meSchema } from '../schemas';
import { ENDPOINTS } from './endpoints';

export interface MeResponse {
  me: Me;
  config: ServerConfig;
}

export interface UpdateMeBody {
  nickname?: string;
  statusMessage?: string;
  avatarId?: string;
}

/** PUT /me/position 요청. seq는 Date.now() 밀리초 정수 (API_CONTRACT 2.2) */
export interface UpdatePositionBody extends Position {
  seq: number;
}

/** GET /me — 새로고침 후 세션 복구용 */
export function getMe(): Promise<MeResponse> {
  return request({ ...ENDPOINTS.me }, meResponseSchema);
}

/** PATCH /me → Me */
export function updateMe(body: UpdateMeBody): Promise<Me> {
  return request({ ...ENDPOINTS.updateMe, body }, meSchema);
}

/** PUT /me/position → 204. 409 POSITION_REJECTED는 ApiError로 throw */
export function updatePosition(
  body: UpdatePositionBody,
  options: { keepalive?: boolean } = {},
): Promise<void> {
  return request({ ...ENDPOINTS.updatePosition, body, keepalive: options.keepalive ?? false });
}

/** PUT /me/presence → 204 */
export function updatePresence(state: PresenceState): Promise<void> {
  return request({ ...ENDPOINTS.updatePresence, body: { state } });
}
