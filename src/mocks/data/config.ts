// ServerConfig mock 값 (DOMAIN 3.6 기본값)
import type { ServerConfig } from '../../domain/types.ts';

export const SERVER_CONFIG: ServerConfig = {
  proximityRadius: 5,
  positionBatchMs: 200,
  serverTickMs: 200,
  maxMessageLength: 200,
  defaultMapId: 'main',
  maxGroupMembers: 10,
};

export const DEMO_ACCESS_KEY = 'DEMO-0000-0000';
export const ACCESS_TOKEN_TTL_SEC = 900;
export const DEFAULT_SSE_MOCK_PORT = 5174;
