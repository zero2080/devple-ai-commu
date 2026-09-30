// Express 기반 Mock 서버 CLI (ROADMAP 4단계, ARCHITECTURE 9장). `pnpm dev:sse` → 포트 5174.
// 담당: SSE 티켓·스트림, 월드 REST(PUT /me/position, PUT /me/presence, GET /world/:mapId/presences), POST /chat/public, 개발용 트리거.
// 앱 본체는 server/app.ts (테스트에서 포트 0으로 띄운다).
import {
  DEFAULT_CHATTER_MS,
  DEFAULT_SSE_MOCK_PORT,
  SERVER_CONFIG,
  SSE_MOCK_HOST,
} from './data/config.ts';
import { createMockServer } from './server/app.ts';

const HEARTBEAT_MS = 15_000;
// 포트가 점유돼 있으면 MOCK_SSE_PORT로 바꾼다 (vite.config.ts proxy도 같은 변수를 읽음). 호스트는 SSE_MOCK_HOST 주석 참고
const PORT = Number(process.env.MOCK_SSE_PORT ?? DEFAULT_SSE_MOCK_PORT);

function log(message: string): void {
  console.log(`[sse-mock ${new Date().toISOString()}] ${message}`);
}

const server = createMockServer({ log });

setInterval(server.tick, SERVER_CONFIG.serverTickMs);
setInterval(server.heartbeat, HEARTBEAT_MS);

// 가짜 접속자 근처 발화. E2E는 MOCK_CHATTER_MS=0으로 끈다 (결정적 검증)
const CHATTER_MS = Number(process.env.MOCK_CHATTER_MS ?? DEFAULT_CHATTER_MS);
if (CHATTER_MS > 0) {
  setInterval(server.chatter, CHATTER_MS);
}

// Express 5는 listen 실패('error')도 이 콜백으로 넘긴다. 무시하면 듣지 않는 채 타이머만 돌며 "listening"을 찍는다
server.app.listen(PORT, SSE_MOCK_HOST, (error?: Error) => {
  if (error !== undefined) {
    log(`cannot listen on ${SSE_MOCK_HOST}:${String(PORT)}: ${error.message}`);
    log('another process holds this port — retry with MOCK_SSE_PORT=5199 pnpm dev');
    process.exit(1);
  }
  log(
    `listening on http://${SSE_MOCK_HOST}:${String(PORT)} (${String(server.world.presences.length)} presences)`,
  );
});
