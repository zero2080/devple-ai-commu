// API_CONTRACT 2.5 공개 근접 대화
import type { PublicMessage } from '@/domain';

import { request } from '../http';
import { publicMessageSchema } from '../schemas';
import { ENDPOINTS } from './endpoints';

/** POST /chat/public → 201 PublicMessage (links·position은 서버가 채움) */
export function sendPublicMessage(content: string): Promise<PublicMessage> {
  return request({ ...ENDPOINTS.sendPublic, body: { content } }, publicMessageSchema);
}
