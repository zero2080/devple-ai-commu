// @vitest-environment node
import type { Server } from 'node:http';

import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';

import { createMockServer, type MockServer } from './app.ts';
import { MAIN_MAP } from '../data/map.ts';
import { ME } from '../data/users.ts';

let clock = 1_700_000_000_000;
let server: MockServer;
let http: Server;
let base = '';

const AUTH = { Authorization: 'Bearer mock', 'Content-Type': 'application/json' };

function put(path: string, body: unknown, headers: Record<string, string> = AUTH) {
  return fetch(`${base}${path}`, { method: 'PUT', headers, body: JSON.stringify(body) });
}

beforeAll(async () => {
  server = createMockServer({ now: () => clock });
  http = await new Promise<Server>((resolve) => {
    const s = server.app.listen(0, () => {
      resolve(s);
    });
  });
  const address = http.address();
  if (address === null || typeof address === 'string') {
    throw new Error('no port');
  }
  base = `http://127.0.0.1:${String(address.port)}`;
});

afterAll(async () => {
  await new Promise<void>((resolve) => {
    http.close(() => {
      resolve();
    });
  });
});

beforeEach(() => {
  clock += 10_000;
});

describe('티켓', () => {
  it('Bearer 없이 티켓을 요청하면 401이다', async () => {
    const res = await fetch(`${base}/api/v1/sse/ticket`, { method: 'POST' });
    expect(res.status).toBe(401);
    expect(await res.json()).toMatchObject({ code: 'AUTH_REQUIRED' });
  });

  it('Bearer가 있으면 30초 1회용 티켓을 준다', async () => {
    const res = await fetch(`${base}/api/v1/sse/ticket`, { method: 'POST', headers: AUTH });
    expect(res.status).toBe(201);
    const body = (await res.json()) as { ticket: string; expiresIn: number };
    expect(body.expiresIn).toBe(30);
    expect(server.tickets.consume(body.ticket)).toBe(true);
  });
});

describe('PUT /me/position', () => {
  it('벽이면 409 collision', async () => {
    const res = await put('/api/v1/me/position', {
      mapId: 'main',
      x: 0,
      y: 0,
      dir: 'up',
      seq: clock,
    });
    expect(res.status).toBe(409);
    expect(await res.json()).toMatchObject({
      code: 'POSITION_REJECTED',
      details: { reason: 'collision' },
    });
  });

  it('첫 이동은 거리 제한 없이 수락하고 다음 틱에 본인 포함으로 방송한다', async () => {
    const res = await put('/api/v1/me/position', {
      mapId: 'main',
      x: 21,
      y: 15,
      dir: 'right',
      seq: clock,
    });
    expect(res.status).toBe(204);
    expect(server.world.find(ME.id)?.position).toMatchObject({ x: 21, y: 15, dir: 'right' });
    const chunks: string[] = [];
    server.hub.add({ write: (c) => chunks.push(c), end: () => undefined });
    server.tick();
    const positions = chunks.find((c) => c.includes('world.positions'));
    expect(positions).toContain(`"userId":"${ME.id}","x":21,"y":15`);
  });

  it('오래된 seq는 204로 무시한다', async () => {
    const res = await put('/api/v1/me/position', {
      mapId: 'main',
      x: 22,
      y: 15,
      dir: 'right',
      seq: 1,
    });
    expect(res.status).toBe(204);
    expect(server.world.find(ME.id)?.position).toMatchObject({ x: 21, y: 15 });
  });

  it('경과 시간 대비 너무 멀면 409 too_far (하한 3타일)', async () => {
    // 직전 인정 시각을 지금으로 맞춘 뒤 100ms 만에 5타일 → 허용 max(3, 1) = 3
    const settle = await put('/api/v1/me/position', {
      mapId: 'main',
      x: 21,
      y: 15,
      dir: 'right',
      seq: clock,
    });
    expect(settle.status).toBe(204);
    clock += 100;
    const res = await put('/api/v1/me/position', {
      mapId: 'main',
      x: 21 + 5,
      y: 15,
      dir: 'right',
      seq: clock,
    });
    expect(res.status).toBe(409);
    expect(await res.json()).toMatchObject({
      details: { reason: 'too_far', position: { x: 21, y: 15 } },
    });
  });

  it('다른 접속자가 있는 타일이면 409 occupied (선착순)', async () => {
    expect(server.world.place('u_01', 22, 15, 'left')).toBe(true);
    const res = await put('/api/v1/me/position', {
      mapId: 'main',
      x: 22,
      y: 15,
      dir: 'right',
      seq: clock,
    });
    expect(res.status).toBe(409);
    expect(await res.json()).toMatchObject({ details: { reason: 'occupied' } });
  });

  it('같은 타일이면 방향만 바꾼다', async () => {
    const res = await put('/api/v1/me/position', {
      mapId: 'main',
      x: 21,
      y: 15,
      dir: 'up',
      seq: clock,
    });
    expect(res.status).toBe(204);
    expect(server.world.find(ME.id)?.position.dir).toBe('up');
  });

  it('잘못된 본문은 400', async () => {
    const res = await put('/api/v1/me/position', {
      mapId: 'main',
      x: 1.5,
      y: 15,
      dir: 'up',
      seq: clock,
    });
    expect(res.status).toBe(400);
  });
});

describe('PUT /me/presence · GET /world/:mapId/presences', () => {
  it('away로 바꾸면 presence.updated를 방송한다', async () => {
    const chunks: string[] = [];
    server.hub.add({ write: (c) => chunks.push(c), end: () => undefined });
    const res = await put('/api/v1/me/presence', { state: 'away' });
    expect(res.status).toBe(204);
    expect(chunks.some((c) => c.includes('presence.updated') && c.includes('"state":"away"'))).toBe(
      true,
    );
  });

  it('접속자 전체를 돌려주고 다른 맵은 404', async () => {
    const ok = await fetch(`${base}/api/v1/world/${MAIN_MAP.id}/presences`, { headers: AUTH });
    expect(ok.status).toBe(200);
    const body = (await ok.json()) as { presences: unknown[] };
    expect(body.presences).toHaveLength(20);
    const missing = await fetch(`${base}/api/v1/world/nope/presences`, { headers: AUTH });
    expect(missing.status).toBe(404);
  });
});

describe('/__mock/reset', () => {
  it('월드를 초기 배치로 되돌리고 seq 기록을 비운다', async () => {
    const res = await fetch(`${base}/__mock/reset`, { method: 'POST' });
    expect(res.status).toBe(202);
    expect(server.world.find(ME.id)?.position).toMatchObject({
      x: MAIN_MAP.spawn.x,
      y: MAIN_MAP.spawn.y,
    });
    const again = await put('/api/v1/me/position', {
      mapId: 'main',
      x: 21,
      y: 15,
      dir: 'right',
      seq: 1,
    });
    expect(again.status).toBe(204); // seq 기록이 비었으므로 작은 seq도 수락
  });
});
