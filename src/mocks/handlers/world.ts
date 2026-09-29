// API_CONTRACT 2.4 월드. Mock에서는 Express SSE 서버가 실시간 위치를 갖고, 여기는 초기 배치를 돌려준다
import { http, HttpResponse } from 'msw';

import { ENDPOINTS } from '@/transport/api/endpoints';

import { state } from '../state.ts';
import { apiError, param, requireAuth, url } from './support.ts';

export const worldHandlers = [
  http.get(url(ENDPOINTS.worldPresences), ({ request, params }) => {
    const denied = requireAuth(request);
    if (denied !== null) return denied;
    const mapId = param(params, 'mapId');
    if (mapId !== state.myPosition.mapId) {
      return apiError(404, 'NOT_FOUND', 'map not found', { resource: 'map' });
    }
    return HttpResponse.json({ mapId, presences: state.presences, serverTime: Date.now() });
  }),
];
