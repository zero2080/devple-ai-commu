// Express 기반 Mock SSE 서버 (ROADMAP 4단계, ARCHITECTURE 9장). `pnpm dev:sse` → 포트 5174.
// - POST /api/v1/sse/ticket: 30초 1회용 티켓 (MSW와 상태를 공유할 수 없어 여기서 발급·검증)
// - GET  /api/v1/sse?ticket&lastEventId: 검증 → world.snapshot → 200ms마다 world.positions, 15초 하트비트
// - POST /__mock/emit { type, payload }: 임의 이벤트 주입. POST /__mock/disconnect: 강제 끊김
import express, { json } from 'express';

import { DEFAULT_SSE_MOCK_PORT, SERVER_CONFIG } from './data/config.ts';
import { MAIN_MAP } from './data/map.ts';
import { mulberry32 } from './data/rng.ts';
import { ME } from './data/users.ts';
import { createInitialPresences, WORLD_SEED } from './data/world.ts';
import { SseHub } from './server/sse.ts';
import { TicketStore } from './server/tickets.ts';
import { WorldSim } from './server/world.ts';

const HEARTBEAT_MS = 15_000;
// 5174가 다른 개발 서버에 점유돼 있으면 MOCK_SSE_PORT로 바꾼다 (vite.config.ts proxy도 같은 변수를 읽음)
const PORT = Number(process.env.MOCK_SSE_PORT ?? DEFAULT_SSE_MOCK_PORT);

const app = express();
app.use(json());

const tickets = new TicketStore();
const hub = new SseHub();
const rng = mulberry32(WORLD_SEED + 1);
const world = new WorldSim(MAIN_MAP, createInitialPresences(MAIN_MAP), rng, {
  frozenUserIds: [ME.id],
});

function log(message: string): void {
  console.log(`[sse-mock ${new Date().toISOString()}] ${message}`);
}

app.post('/api/v1/sse/ticket', (_req, res) => {
  tickets.sweep();
  const ticket = tickets.issue();
  res.status(201).json({ ticket, expiresIn: tickets.ttlSeconds });
});

app.get('/api/v1/sse', (req, res) => {
  const ticket = typeof req.query.ticket === 'string' ? req.query.ticket : '';
  if (!tickets.consume(ticket)) {
    log(`rejected ticket "${ticket}" (missing/expired/reused)`);
    res.status(401).end();
    return;
  }
  const lastEventId = typeof req.query.lastEventId === 'string' ? req.query.lastEventId : null;
  if (lastEventId !== null) {
    log(`reconnect with lastEventId=${lastEventId} (mock: 재전송 버퍼 없음)`);
  }

  res.status(200);
  res.setHeader('Content-Type', 'text/event-stream; charset=utf-8');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.setHeader('X-Accel-Buffering', 'no');
  res.flushHeaders();

  const sink = { write: (chunk: string) => void res.write(chunk), end: () => res.end() };
  hub.add(sink);
  hub.sendTo(sink, 'world.snapshot', {
    mapId: MAIN_MAP.id,
    presences: world.presences,
    serverTime: Date.now(),
  });
  log(`connected (${String(hub.size)} open)`);

  req.on('close', () => {
    hub.remove(sink);
    log(`closed (${String(hub.size)} open)`);
  });
});

app.post('/__mock/emit', (req, res) => {
  const body: unknown = req.body;
  if (
    typeof body !== 'object' ||
    body === null ||
    typeof (body as { type?: unknown }).type !== 'string'
  ) {
    res.status(400).json({ code: 'VALIDATION_FAILED', message: 'body must be { type, payload }' });
    return;
  }
  const { type, payload } = body as { type: string; payload?: unknown };
  const envelope = hub.broadcast(type, payload ?? {});
  log(`emit ${type} id=${envelope.id} → ${String(hub.size)} clients`);
  res.status(202).json({ id: envelope.id, clients: hub.size });
});

app.post('/__mock/disconnect', (_req, res) => {
  const count = hub.disconnectAll();
  log(`disconnected ${String(count)} clients by trigger`);
  res.status(202).json({ disconnected: count });
});

app.get('/__mock/state', (_req, res) => {
  res.json({ clients: hub.size, presences: world.presences });
});

setInterval(() => {
  const deltas = world.tick(Date.now());
  if (deltas.length > 0 && hub.size > 0) {
    hub.broadcast('world.positions', { mapId: MAIN_MAP.id, positions: deltas });
  }
}, SERVER_CONFIG.serverTickMs);

setInterval(() => {
  hub.heartbeat();
}, HEARTBEAT_MS);

app.listen(PORT, () => {
  log(
    `listening on http://localhost:${String(PORT)} (${String(world.presences.length)} presences)`,
  );
});
