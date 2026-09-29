// API_CONTRACT 2.5 공개 근접 대화 (히스토리 없음)
import { http, HttpResponse } from 'msw';

import type { PublicMessage } from '@/domain';
import { ENDPOINTS } from '@/transport/api/endpoints';

import { SERVER_CONFIG } from '../data/config.ts';
import { contentError, extractLinks, nextId, state } from '../state.ts';
import { apiError, readJson, requireAuth, str, url } from './support.ts';

export const chatHandlers = [
  http.post(url(ENDPOINTS.sendPublic), async ({ request }) => {
    const denied = requireAuth(request);
    if (denied !== null) return denied;
    const content = str(await readJson(request), 'content') ?? '';
    const problem = contentError(content, SERVER_CONFIG.maxMessageLength);
    if (problem !== null) {
      return apiError(400, 'MESSAGE_INVALID_CONTENT', problem);
    }
    const message: PublicMessage = {
      id: nextId('pm'),
      kind: 'public',
      senderId: state.me.id,
      content: content.normalize('NFC'),
      links: extractLinks(content),
      createdAt: Date.now(),
      position: state.myPosition,
    };
    return HttpResponse.json(message, { status: 201 });
  }),
];
