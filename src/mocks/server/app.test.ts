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

describe('/__mock/emit 브리지', () => {
  it('presence.updated는 Express Presence에도 반영하고 방송한다', async () => {
    const chunks: string[] = [];
    server.hub.add({ write: (c) => chunks.push(c), end: () => undefined });
    const res = await fetch(`${base}/__mock/emit`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        type: 'presence.updated',
        payload: { userId: ME.id, nickname: '새이름', avatarId: 'char_03' },
      }),
    });
    expect(res.status).toBe(202);
    expect(server.world.find(ME.id)).toMatchObject({ nickname: '새이름', avatarId: 'char_03' });
    expect(chunks.some((c) => c.includes('presence.updated') && c.includes('새이름'))).toBe(true);
  });
});

describe('POST /api/v1/chat/public', () => {
  const post = (content: unknown, headers: Record<string, string> = AUTH) =>
    fetch(`${base}/api/v1/chat/public`, {
      method: 'POST',
      headers,
      body: JSON.stringify({ content }),
    });

  it('Bearer가 없으면 401', async () => {
    const res = await post('hi', { 'Content-Type': 'application/json' });
    expect(res.status).toBe(401);
  });

  it('공백만·제어 문자·코드 포인트 초과는 400 MESSAGE_INVALID_CONTENT', async () => {
    for (const bad of ['   ', 'a\u0007b', '가'.repeat(201), 42]) {
      const res = await post(bad);
      expect(res.status).toBe(400);
      expect(await res.json()).toMatchObject({ code: 'MESSAGE_INVALID_CONTENT' });
    }
  });

  it('NFC 정규화·링크 추출·서버 위치로 201을 주고 반경 안 연결에 chat.public을 보낸다', async () => {
    await fetch(`${base}/__mock/reset`, { method: 'POST' });
    const mine: string[] = [];
    const farAway: string[] = [];
    server.hub.add({ write: (c) => mine.push(c), end: () => undefined }, ME.id);
    server.hub.add({ write: (c) => farAway.push(c), end: () => undefined }, 'u_01');
    expect(server.world.place('u_01', 3, 3, 'down')).toBe(true); // 스폰(20,15)에서 17칸

    const res = await post('가 https://example.com/a');
    expect(res.status).toBe(201);
    const body = (await res.json()) as {
      content: string;
      links: string[];
      position: { x: number; y: number };
      senderId: string;
    };
    expect(body).toMatchObject({
      content: '가 https://example.com/a',
      links: ['https://example.com/a'],
      senderId: ME.id,
    });
    expect(body.position).toMatchObject({ x: MAIN_MAP.spawn.x, y: MAIN_MAP.spawn.y });
    expect(
      mine.some((c) => c.includes('event: chat.public') && c.includes('"nickname":"데모"')),
    ).toBe(true);
    expect(farAway.some((c) => c.includes('chat.public'))).toBe(false);
  });
});

describe('/__mock/say · chatter', () => {
  it('at 근처로 옮겨 말하면 반경 안의 나에게 전달되고, 멀면 전달되지 않는다', async () => {
    await fetch(`${base}/__mock/reset`, { method: 'POST' });
    const chunks: string[] = [];
    server.hub.add({ write: (c) => chunks.push(c), end: () => undefined }, ME.id);
    const say = (body: unknown) =>
      fetch(`${base}/__mock/say`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      }).then(async (r) => ({
        status: r.status,
        body: (await r.json()) as { delivered: boolean; position: { x: number; y: number } },
      }));

    const near = await say({ userId: 'u_02', content: '근처', at: { x: 22, y: 15 } });
    expect(near.status).toBe(202);
    expect(near.body.delivered).toBe(true);
    expect(
      Math.max(Math.abs(near.body.position.x - 20), Math.abs(near.body.position.y - 15)),
    ).toBeLessThanOrEqual(5);
    expect(chunks.some((c) => c.includes('world.positions') && c.includes('"userId":"u_02"'))).toBe(
      true,
    );

    const far = await say({ userId: 'u_03', content: '멀리', at: { x: 3, y: 3 } });
    expect(far.body.delivered).toBe(false);
    expect(chunks.some((c) => c.includes('멀리'))).toBe(false);

    const bad = await say({ userId: 'nobody', content: 'x' });
    expect(bad.status).toBe(400);
  });

  it('chatter는 연결된 사용자 반경 안의 가짜 접속자만 말하게 한다', async () => {
    await fetch(`${base}/__mock/reset`, { method: 'POST' });
    const lonely = createMockServer({ now: () => clock });
    expect(lonely.chatter()).toBe(0); // 연결 없음
    const chunks: string[] = [];
    lonely.hub.add({ write: (c) => chunks.push(c), end: () => undefined }, ME.id);
    expect(lonely.world.placeNear('u_04', 21, 15)).not.toBeNull();
    let delivered = 0;
    for (let i = 0; i < 20 && delivered === 0; i += 1) {
      delivered = lonely.chatter();
    }
    expect(delivered).toBe(1);
    expect(chunks.some((c) => c.includes('event: chat.public'))).toBe(true);
  });
});
