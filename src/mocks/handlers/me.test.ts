import { http, HttpResponse } from 'msw';
import { setupServer } from 'msw/node';
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';

import type { Appearance } from '@/domain';

import { seedAppearance } from '../data/avatar.ts';
import { resetMockState, state } from '../state.ts';
import { meHandlers } from './me.ts';

const bridge = vi.hoisted(() => ({
  emitViaExpress: vi.fn<(type: string, payload: unknown) => Promise<void>>(() => Promise.resolve()),
}));
vi.mock('../bridge.ts', () => ({ emitViaExpress: bridge.emitViaExpress }));

const server = setupServer(
  ...meHandlers,
  http.post('*/__mock/emit', () => HttpResponse.json({})),
);
const patchMe = (body: unknown) =>
  fetch(new URL('/api/v1/me', location.href).toString(), {
    method: 'PATCH',
    headers: { Authorization: 'Bearer mock-token', 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });

beforeAll(() => {
  server.listen({ onUnhandledFrame: 'error' });
});
afterAll(() => {
  server.close();
});
beforeEach(() => {
  resetMockState();
  state.session.accessToken = 'mock-token';
  bridge.emitViaExpress.mockClear();
});
afterEach(() => {
  server.resetHandlers();
});

describe('PATCH /me appearance (API_CONTRACT 2.2)', () => {
  it('전체 교체: 정규화해 저장하고(hair.primary 버림) presence.updated에 외형 전체를 싣는다', async () => {
    const look: Appearance = {
      ...seedAppearance(4),
      hair: { itemId: 'hair_long', primary: 'item_red', secondary: 'item_pink' },
    };
    const res = await patchMe({ appearance: look });
    expect(res.status).toBe(200);
    const me = (await res.json()) as { appearance: Appearance };
    expect(me.appearance.hair).toEqual({ itemId: 'hair_long', secondary: 'item_pink' });
    expect(state.me.appearance).toEqual(me.appearance);
    expect(bridge.emitViaExpress).toHaveBeenCalledWith('presence.updated', {
      userId: 'u_me',
      appearance: me.appearance,
    });
  });

  it('검증 실패는 필드 경로별로 모두 모아 400, 상태는 그대로', async () => {
    const before = state.me.appearance;
    const res = await patchMe({
      nickname: '가',
      appearance: {
        ...seedAppearance(1),
        top: null,
        hat: { itemId: 'top_hoodie' },
        face: { itemId: 'face_crown' },
        shoes: { itemId: 'shoes_boots', primary: 'hair_red' },
      },
    });
    expect(res.status).toBe(400);
    expect(await res.json()).toMatchObject({
      code: 'VALIDATION_FAILED',
      details: {
        fields: {
          nickname: 'length',
          'appearance.top': 'required',
          'appearance.hat': 'slot_mismatch',
          'appearance.face': 'unknown',
          'appearance.shoes.primary': 'unknown',
        },
      },
    });
    expect(state.me.appearance).toBe(before);
    expect(bridge.emitViaExpress).not.toHaveBeenCalled();
  });

  it('같은 외형이면 방송하지 않는다', async () => {
    expect((await patchMe({ appearance: state.me.appearance })).status).toBe(200);
    expect(bridge.emitViaExpress).not.toHaveBeenCalled();
  });

  it('닉네임: 앞뒤 공백 제거 후 저장, 다른 회원과 대소문자·공백 무시로 겹치면 409, 제어 문자는 invalid', async () => {
    expect((await patchMe({ nickname: ' 픽셀 ' })).status).toBe(409);
    const invalid = await patchMe({ nickname: '데\u0007모' });
    expect(await invalid.json()).toMatchObject({ details: { fields: { nickname: 'invalid' } } });
    const ok = await patchMe({ nickname: '  새 데모  ' });
    expect(ok.status).toBe(200);
    expect(state.me.nickname).toBe('새 데모');
    expect(bridge.emitViaExpress).toHaveBeenCalledWith('presence.updated', {
      userId: 'u_me',
      nickname: '새 데모',
    });
  });
});
