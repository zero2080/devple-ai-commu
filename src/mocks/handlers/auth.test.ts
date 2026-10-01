import { setupServer } from 'msw/node';
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from 'vitest';

import { resetMockState, state } from '../state.ts';
import { authHandlers, normalizeAccessKey } from './auth.ts';

const server = setupServer(...authHandlers);
const post = (path: string, body: unknown) =>
  fetch(new URL(`/api/v1${path}`, location.href).toString(), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
const signup = (email: string, nickname: string, phone = '010-1234-5678') =>
  post('/signup', { email, nickname, phone });

beforeAll(() => {
  server.listen({ onUnhandledFrame: 'error' });
});
afterAll(() => {
  server.close();
});
beforeEach(() => {
  resetMockState();
});
afterEach(() => {
  server.resetHandlers();
});

describe('POST /signup (API_CONTRACT 2.1)', () => {
  it('형식·길이 실패는 사유 어휘로 모두 모은다', async () => {
    const res = await signup('nope', '가', '12');
    expect(res.status).toBe(400);
    expect(await res.json()).toMatchObject({
      code: 'VALIDATION_FAILED',
      details: { fields: { email: 'format', nickname: 'length', phone: 'format' } },
    });
    const invalid = await signup('a@b.com', '도\u200B트');
    expect(await invalid.json()).toMatchObject({ details: { fields: { nickname: 'invalid' } } });
  });

  it('닉네임은 공백 제거 후 저장하고, 중복은 대소문자·NFC 무시로 409 NICKNAME_TAKEN', async () => {
    const created = await signup('new@example.com', '  Pixelart  ');
    expect(created.status).toBe(201);
    const { requestId } = (await created.json()) as { requestId: string };
    expect(state.signups.find((s) => s.id === requestId)?.nickname).toBe('Pixelart');
    const dup = await signup('other@example.com', 'pixelART');
    expect(dup.status).toBe(409);
    expect(await dup.json()).toMatchObject({ code: 'NICKNAME_TAKEN' });
    expect((await signup('x@example.com', '도트')).status).toBe(409); // 기존 회원
  });

  it('이미 가입한 이메일·대기 중 신청 이메일은 409 EMAIL_TAKEN (대소문자 무시)', async () => {
    const member = await signup('U_01@Example.com', '새사람');
    expect(member.status).toBe(409);
    expect(await member.json()).toMatchObject({ code: 'EMAIL_TAKEN' });
    expect((await signup('newbie@example.com', '새사람2')).status).toBe(409); // sr_01 대기 중
    expect((await signup('spam@example.com', '새사람3')).status).toBe(201); // 거절된 신청 이메일은 다시 가능
  });
});

describe('POST /auth/login 접근 키 정규화 (API_CONTRACT 2.1)', () => {
  it('공백·하이픈·대소문자 무시, O→0, I·L→1', () => {
    expect(normalizeAccessKey(' demo0 00000-00000 00000 ')).toBe(
      normalizeAccessKey('DEMO0-00000-00000-00000'),
    );
    expect(normalizeAccessKey('ABCIL-O')).toBe('ABC110');
  });

  it('형식이 달라도 정규화해서 맞으면 로그인, 아니면 401 AUTH_INVALID_KEY', async () => {
    const ok = await post('/auth/login', { accessKey: 'dem0000000000000000O' });
    expect(ok.status).toBe(200);
    const bad = await post('/auth/login', { accessKey: 'DEMO-0000-0000' });
    expect(bad.status).toBe(401);
    expect(await bad.json()).toMatchObject({ code: 'AUTH_INVALID_KEY' });
  });
});
