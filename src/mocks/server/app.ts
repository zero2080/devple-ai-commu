// Express mock 앱 (ARCHITECTURE 9장). 티켓·SSE·월드 REST(위치·상태·접속자)를 한곳에서 담당한다.
// sse-server.ts가 이 앱을 띄우고, app.test.ts가 포트 0으로 띄워 검증한다.
import express, { json, type Express, type Request, type Response } from 'express';

import { SseHub, type SseSink } from './sse.ts';
import { TicketStore } from './tickets.ts';
import { WorldSim, type PositionDelta } from './world.ts';
import type { Direction } from '../../domain/types.ts';
import { isBlocked, MAIN_MAP } from '../data/map.ts';
import { mulberry32, type Rng } from '../data/rng.ts';
import { ME } from '../data/users.ts';
import { createInitialPresences, WORLD_SEED } from '../data/world.ts';

const DIRECTIONS: readonly Direction[] = ['up', 'down', 'left', 'right'];
const MIN_ALLOWED_TILES = 3; // API_CONTRACT 2.2: max(3, elapsedMs / 100)

export interface MockServerOptions {
  now?: () => number;
  rng?: Rng;
  log?: (message: string) => void;
}

export interface MockServer {
  app: Express;
  hub: SseHub;
  world: WorldSim;
  tickets: TicketStore;
  /** 200ms 틱: 가짜 접속자 이동 + 실제 사용자 이동을 world.positions로 방송 (본인 포함) */
  tick: () => void;
  heartbeat: () => void;
}

interface PositionRecord {
  seq: number;
  at: number;
}

function apiError(
  res: Response,
  status: number,
  code: string,
  message: string,
  details?: unknown,
): void {
  res.status(status).json(details === undefined ? { code, message } : { code, message, details });
}

/** Authorization: Bearer <token>. mock은 사용자가 1명이라 토큰이 있으면 항상 본인 */
function bearerUserId(req: Request): string | null {
  const header = req.header('authorization') ?? '';
  return header.startsWith('Bearer ') && header.length > 7 ? ME.id : null;
}

function field(body: unknown, key: string): unknown {
  return typeof body === 'object' && body !== null
    ? (body as Record<string, unknown>)[key]
    : undefined;
}

export function createMockServer(options: MockServerOptions = {}): MockServer {
  const now = options.now ?? Date.now;
  const log = options.log ?? (() => undefined);
  const app = express();
  app.use(json());

  const tickets = new TicketStore({ now });
  const hub = new SseHub();
  const world = new WorldSim(
    MAIN_MAP,
    createInitialPresences(MAIN_MAP),
    options.rng ?? mulberry32(WORLD_SEED + 1),
    {
      frozenUserIds: [ME.id],
    },
  );
  const ticketOwners = new Map<string, string>();
  const positionRecords = new Map<string, PositionRecord>();
  const pendingDeltas = new Map<string, PositionDelta>();

  /* ---------- 티켓 · SSE ---------- */

  app.post('/api/v1/sse/ticket', (req, res) => {
    const userId = bearerUserId(req);
    if (userId === null) {
      apiError(res, 401, 'AUTH_REQUIRED', 'access token missing');
      return;
    }
    tickets.sweep();
    const ticket = tickets.issue();
    ticketOwners.set(ticket, userId);
    res.status(201).json({ ticket, expiresIn: tickets.ttlSeconds });
  });

  app.get('/api/v1/sse', (req, res) => {
    const ticket = typeof req.query.ticket === 'string' ? req.query.ticket : '';
    const owner = ticketOwners.get(ticket);
    ticketOwners.delete(ticket);
    if (!tickets.consume(ticket) || owner === undefined) {
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

    const sink: SseSink = { write: (chunk) => void res.write(chunk), end: () => res.end() };
    hub.add(sink);
    hub.sendTo(sink, 'world.snapshot', {
      mapId: MAIN_MAP.id,
      presences: world.presences,
      serverTime: now(),
    });
    log(`connected user=${owner} (${String(hub.size)} open)`);

    req.on('close', () => {
      hub.remove(sink);
      log(`closed (${String(hub.size)} open)`);
    });
  });

  /* ---------- 월드 REST (API_CONTRACT 2.2·2.4) ---------- */

  app.put('/api/v1/me/position', (req, res) => {
    const userId = bearerUserId(req);
    if (userId === null) {
      apiError(res, 401, 'AUTH_REQUIRED', 'access token missing');
      return;
    }
    const body: unknown = req.body;
    const mapId = field(body, 'mapId');
    const x = field(body, 'x');
    const y = field(body, 'y');
    const dir = field(body, 'dir');
    const seq = field(body, 'seq');
    if (
      mapId !== MAIN_MAP.id ||
      typeof x !== 'number' ||
      typeof y !== 'number' ||
      !Number.isInteger(x) ||
      !Number.isInteger(y) ||
      typeof dir !== 'string' ||
      !DIRECTIONS.includes(dir as Direction) ||
      typeof seq !== 'number'
    ) {
      apiError(res, 400, 'VALIDATION_FAILED', 'invalid position payload');
      return;
    }
    const me = world.find(userId);
    if (me === undefined) {
      apiError(res, 404, 'NOT_FOUND', 'presence not found', { resource: 'presence' });
      return;
    }
    const record = positionRecords.get(userId);
    if (record !== undefined && seq <= record.seq) {
      res.status(204).end(); // 오래된 seq는 204로 무시 (에러 아님)
      return;
    }
    const reject = (reason: 'collision' | 'too_far' | 'occupied'): void => {
      apiError(res, 409, 'POSITION_REJECTED', reason, {
        position: me.position,
        seq: record?.seq ?? 0,
        reason,
      });
    };
    if (isBlocked(MAIN_MAP, x, y)) {
      reject('collision');
      return;
    }
    const at = now();
    const allowed =
      record === undefined
        ? Number.POSITIVE_INFINITY
        : Math.max(MIN_ALLOWED_TILES, (at - record.at) / 100);
    const distance = Math.max(Math.abs(x - me.position.x), Math.abs(y - me.position.y));
    if (distance > allowed) {
      reject('too_far');
      return;
    }
    const result = world.moveTo(userId, x, y, dir as Direction);
    if (result === 'blocked') {
      reject('occupied');
      return;
    }
    positionRecords.set(userId, { seq, at });
    me.updatedAt = at;
    pendingDeltas.set(userId, { userId, x, y, dir: dir as Direction });
    res.status(204).end();
  });

  app.put('/api/v1/me/presence', (req, res) => {
    const userId = bearerUserId(req);
    if (userId === null) {
      apiError(res, 401, 'AUTH_REQUIRED', 'access token missing');
      return;
    }
    const state = field(req.body, 'state');
    if (state !== 'online' && state !== 'away') {
      apiError(res, 400, 'VALIDATION_FAILED', 'state must be online|away');
      return;
    }
    if (!world.setState(userId, state, now())) {
      apiError(res, 404, 'NOT_FOUND', 'presence not found', { resource: 'presence' });
      return;
    }
    hub.broadcast('presence.updated', { userId, state });
    res.status(204).end();
  });

  app.get('/api/v1/world/:mapId/presences', (req, res) => {
    if (bearerUserId(req) === null) {
      apiError(res, 401, 'AUTH_REQUIRED', 'access token missing');
      return;
    }
    if (req.params.mapId !== MAIN_MAP.id) {
      apiError(res, 404, 'NOT_FOUND', 'map not found', { resource: 'map' });
      return;
    }
    res.json({ mapId: MAIN_MAP.id, presences: world.presences, serverTime: now() });
  });

  /* ---------- 개발용 트리거 ---------- */

  app.post('/__mock/emit', (req, res) => {
    const type = field(req.body, 'type');
    if (typeof type !== 'string') {
      apiError(res, 400, 'VALIDATION_FAILED', 'body must be { type, payload }');
      return;
    }
    const envelope = hub.broadcast(type, field(req.body, 'payload') ?? {});
    log(`emit ${type} id=${envelope.id} → ${String(hub.size)} clients`);
    res.status(202).json({ id: envelope.id, clients: hub.size });
  });

  app.post('/__mock/disconnect', (_req, res) => {
    const count = hub.disconnectAll();
    log(`disconnected ${String(count)} clients by trigger`);
    res.status(202).json({ disconnected: count });
  });

  app.post('/__mock/reset', (_req, res) => {
    // E2E 격리용: 월드를 초기 배치로, 위치 seq 기록·대기 중 방송을 비운다 (연결은 유지)
    world.replaceAll(createInitialPresences(MAIN_MAP));
    positionRecords.clear();
    pendingDeltas.clear();
    hub.broadcast('world.snapshot', {
      mapId: MAIN_MAP.id,
      presences: world.presences,
      serverTime: now(),
    });
    log('world reset by trigger');
    res.status(202).json({ presences: world.presences.length });
  });

  app.get('/__mock/state', (_req, res) => {
    res.json({ clients: hub.size, presences: world.presences });
  });

  const tick = (): void => {
    const deltas = world.tick(now());
    for (const delta of pendingDeltas.values()) {
      deltas.push(delta); // 실제 사용자 이동은 본인 포함으로 방송 (API_CONTRACT 3.3)
    }
    pendingDeltas.clear();
    if (deltas.length > 0 && hub.size > 0) {
      hub.broadcast('world.positions', { mapId: MAIN_MAP.id, positions: deltas });
    }
  };

  return {
    app,
    hub,
    world,
    tickets,
    tick,
    heartbeat: () => {
      hub.heartbeat(now());
    },
  };
}
