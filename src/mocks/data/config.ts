// ServerConfig mock 값 (DOMAIN 3.6 기본값)
import type { ServerConfig } from '../../domain/types.ts';

export const SERVER_CONFIG: ServerConfig = {
  proximityRadius: 5,
  positionBatchMs: 200,
  serverTickMs: 200,
  maxMessageLength: 200,
  defaultMapId: 'main',
  maxGroupMembers: 10,
  avatarIds: [
    'char_01',
    'char_02',
    'char_03',
    'char_04',
    'char_05',
    'char_06',
    'char_07',
    'char_08',
  ],
};

export const DEMO_ACCESS_KEY = 'DEMO-0000-0000';
export const ACCESS_TOKEN_TTL_SEC = 900;
export const DEFAULT_SSE_MOCK_PORT = 5174;

/**
 * Express mock이 담당하는 엔드포인트 (ARCHITECTURE 9장, 2026-09-30 결정).
 * 실시간 위치·점유·티켓은 SSE를 보내는 곳에 있어야 한다. 나머지 REST는 MSW.
 */
export const EXPRESS_MOCK_ENDPOINT_NAMES = [
  'sseTicket',
  'updatePosition',
  'updatePresence',
  'worldPresences',
  'sendPublic', // 7단계: 서버 위치 기준 반경 판정 후 chat.public 방송
] as const;

/** Vite proxy와 MSW 통과 판정이 공유하는 경로 접두 */
export const EXPRESS_MOCK_PATH_PREFIXES = [
  '/api/v1/sse',
  '/api/v1/me/position',
  '/api/v1/me/presence',
  '/api/v1/world',
  '/api/v1/chat/public',
  '/__mock', // MSW 핸들러가 SSE 방송을 위임하는 emit 브리지 (ARCHITECTURE 9장)
] as const;

/** 가짜 접속자가 근처에서 말하는 주기 기본값 (ms). MOCK_CHATTER_MS=0이면 끈다 (E2E) */
export const DEFAULT_CHATTER_MS = 7000;
