// Express mock 앱 (ARCHITECTURE 9장). 티켓·SSE·월드 REST(위치·상태·접속자)·근접 대화(chat.public)를 한곳에서 담당한다.
// sse-server.ts가 이 앱을 띄우고, app.test.ts가 포트 0으로 띄워 검증한다.
import express, { json, type Express, type Request, type Response } from 'express';

import { SseHub, type SseSink } from './sse.ts';
import { TicketStore } from './tickets.ts';
import { WorldSim, type PositionDelta } from './world.ts';
import type { Direction, Presence, PublicMessage } from '../../domain/types.ts';
import { appearanceSchema } from '../../transport/schemas/appearance.ts';
import { CHATTER_LINES } from '../data/chatter.ts';
import { SERVER_CONFIG } from '../data/config.ts';
import { isBlocked, MAIN_MAP } from '../data/map.ts';
import { contentError, extractLinks } from '../data/messages.ts';
import { mulberry32, pick, type Rng } from '../data/rng.ts';
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
  /** 가짜 접속자 1명이 근처에서 말한다 (반경 판정). 전달된 연결 수 */
  chatter: () => number;
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
  let messageSeq = 0;

  /** 체비쇼프 거리 반경 판정 (DOMAIN 5.2, CLAUDE.md 핵심 제약 8) */
  const withinRadius = (a: Presence['position'], b: Presence['position']): boolean =>
    a.mapId === b.mapId &&
    Math.max(Math.abs(a.x - b.x), Math.abs(a.y - b.y)) <= SERVER_CONFIG.proximityRadius;

  /**
   * 발신자 현재 위치 기준으로 반경 내 연결에만 chat.public을 보낸다 (본인 포함, API_CONTRACT 2.5).
   * 수신자 판정은 연결 소유자의 서버 위치로 한다
   */
  const publishPublic = (
    sender: Presence,
    content: string,
  ): { message: PublicMessage; recipients: number } => {
    messageSeq += 1;
    const message: PublicMessage = {
      id: `pm_${String(messageSeq)}`,
      kind: 'public',
      senderId: sender.userId,
      content: content.normalize('NFC'),
      links: extractLinks(content),
      createdAt: now(),
      position: { ...sender.position },
    };
    const { recipients } = hub.broadcastWhere(
      'chat.public',
      { ...message, sender: { nickname: sender.nickname } },
      (userId) => {
        const listener = world.find(userId);
        return listener !== undefined && withinRadius(message.position, listener.position);
      },
    );
    return { message, recipients };
  };

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
    hub.add(sink, owner);
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

  /* ---------- 근접 대화 (API_CONTRACT 2.5) ---------- */

  app.post('/api/v1/chat/public', (req, res) => {
    const userId = bearerUserId(req);
    if (userId === null) {
      apiError(res, 401, 'AUTH_REQUIRED', 'access token missing');
      return;
    }
    const content = field(req.body, 'content');
    const problem =
      typeof content === 'string'
        ? contentError(content, SERVER_CONFIG.maxMessageLength)
        : 'content must be a string';
    if (problem !== null || typeof content !== 'string') {
      apiError(res, 400, 'MESSAGE_INVALID_CONTENT', problem ?? 'invalid content');
      return;
    }
    const sender = world.find(userId);
    if (sender === undefined) {
      apiError(res, 404, 'NOT_FOUND', 'presence not found', { resource: 'presence' });
      return;
    }
    const { message, recipients } = publishPublic(sender, content);
    log(`chat.public ${message.id} from ${userId} → ${String(recipients)} clients`);
    res.status(201).json(message);
  });

  /* ---------- 개발용 트리거 ---------- */

  app.post('/__mock/say', (req, res) => {
    // 가짜 접속자 발화. at이 있으면 그 근처 빈 타일로 옮긴 뒤(즉시 world.positions) 말한다. 반경 밖이면 전달되지 않는다
    const userId = field(req.body, 'userId');
    const content = field(req.body, 'content');
    const at = field(req.body, 'at');
    const speaker = typeof userId === 'string' ? world.find(userId) : undefined;
    if (
      speaker === undefined ||
      typeof content !== 'string' ||
      contentError(content, SERVER_CONFIG.maxMessageLength) !== null
    ) {
      apiError(res, 400, 'VALIDATION_FAILED', 'body must be { userId, content, at? }');
      return;
    }
    const x = field(at, 'x');
    const y = field(at, 'y');
    if (typeof x === 'number' && typeof y === 'number') {
      const placed = world.placeNear(speaker.userId, x, y);
      if (placed === null) {
        apiError(res, 409, 'POSITION_REJECTED', 'no free tile near at');
        return;
      }
      hub.broadcast('world.positions', {
        mapId: MAIN_MAP.id,
        positions: [{ userId: speaker.userId, x: placed.x, y: placed.y, dir: placed.dir }],
      });
    }
    const { message, recipients } = publishPublic(speaker, content);
    log(`say ${message.id} by ${speaker.userId} → ${String(recipients)} clients`);
    res
      .status(202)
      .json({ id: message.id, delivered: recipients > 0, recipients, position: speaker.position });
  });

  app.post('/__mock/emit', (req, res) => {
    const type = field(req.body, 'type');
    if (typeof type !== 'string') {
      apiError(res, 400, 'VALIDATION_FAILED', 'body must be { type, payload }');
      return;
    }
    const payload = field(req.body, 'payload') ?? {};
    // MSW emit 브리지 (ARCHITECTURE 9장): presence.updated는 Express의 Presence 저장소에도 반영해 재연결 스냅샷과 맞춘다
    if (type === 'presence.updated') {
      const userId = field(payload, 'userId');
      const target = typeof userId === 'string' ? world.find(userId) : undefined;
      if (target !== undefined) {
        const nickname = field(payload, 'nickname');
        const appearance = appearanceSchema.safeParse(field(payload, 'appearance'));
        const state = field(payload, 'state');
        if (typeof nickname === 'string') target.nickname = nickname;
        if (appearance.success) target.appearance = appearance.data;
        if (state === 'online' || state === 'away') target.state = state;
        target.updatedAt = now();
      }
    }
    const envelope = hub.broadcast(type, payload);
    log(`emit ${type} id=${envelope.id} → ${String(hub.size)} clients`);
    res.status(202).json({ id: envelope.id, clients: hub.size });
  });

  app.post('/__mock/place', (req, res) => {
    // 개발·E2E용: 사용자를 (x, y) 근처 빈 타일로 옮기고 즉시 world.positions 방송. freeze: true면 랜덤 워크에서 뺀다(/__mock/reset까지)
    const userId = field(req.body, 'userId');
    const x = field(req.body, 'x');
    const y = field(req.body, 'y');
    if (typeof userId !== 'string' || typeof x !== 'number' || typeof y !== 'number') {
      apiError(res, 400, 'VALIDATION_FAILED', 'body must be { userId, x, y }');
      return;
    }
    const placed = world.placeNear(userId, x, y);
    if (placed === null) {
      apiError(res, 409, 'POSITION_REJECTED', 'no free tile near target');
      return;
    }
    if (field(req.body, 'freeze') === true) {
      world.setFrozen(userId, true); // E2E: 클릭할 캐릭터가 걸어가지 않게
    }
    hub.broadcast('world.positions', {
      mapId: MAIN_MAP.id,
      positions: [{ userId, x: placed.x, y: placed.y, dir: placed.dir }],
    });
    res.status(202).json({ position: placed });
  });

  app.post('/__mock/disconnect', (_req, res) => {
    const count = hub.disconnectAll();
    log(`disconnected ${String(count)} clients by trigger`);
    res.status(202).json({ disconnected: count });
  });

  app.post('/__mock/reset', (_req, res) => {
    // E2E 격리용: 월드를 초기 배치로, 위치 seq 기록·대기 중 방송을 비운다 (연결은 유지)
    world.replaceAll(createInitialPresences(MAIN_MAP));
    world.resetFrozen([ME.id]);
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

  const chatterRng = options.rng ?? mulberry32(WORLD_SEED + 2);
  const chatter = (): number => {
    const listeners = hub
      .connectedUserIds()
      .map((id) => world.find(id))
      .filter((p): p is Presence => p !== undefined);
    const nearby = world.presences.filter(
      (p) =>
        p.userId !== ME.id &&
        p.state === 'online' &&
        listeners.some(
          (listener) => listener.userId !== p.userId && withinRadius(p.position, listener.position),
        ),
    );
    if (nearby.length === 0) {
      return 0;
    }
    const { recipients } = publishPublic(pick(chatterRng, nearby), pick(chatterRng, CHATTER_LINES));
    return recipients;
  };

  return {
    app,
    hub,
    world,
    tickets,
    tick,
    chatter,
    heartbeat: () => {
      hub.heartbeat(now());
    },
  };
}
