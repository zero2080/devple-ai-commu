import { beforeEach, describe, expect, it } from 'vitest';

import type { AuthSession } from '@/domain';

import { authTokenProvider, useAuthStore } from './authStore';

const session: AuthSession = {
  accessToken: 'tok',
  expiresIn: 900,
  me: {
    id: 'me',
    nickname: '나',
    avatarId: 'char_01',
    role: 'member',
    status: 'active',
    createdAt: 1,
    email: 'a@b.c',
    phone: '010',
  },
  config: {
    proximityRadius: 5,
    positionBatchMs: 200,
    serverTickMs: 200,
    maxMessageLength: 200,
    defaultMapId: 'main',
    maxGroupMembers: 10,
  },
};

beforeEach(() => {
  useAuthStore.getState().clear();
});

describe('authStore', () => {
  it('세션을 저장하면 authenticated가 되고 토큰은 메모리에만 있다', () => {
    useAuthStore.getState().setSession(session);
    const s = useAuthStore.getState();
    expect(s.status).toBe('authenticated');
    expect(s.me?.id).toBe('me');
    expect(authTokenProvider.getAccessToken()).toBe('tok');
    expect(localStorage.getItem('accessToken')).toBeNull();
  });

  it('TokenProvider는 refresh 결과를 반영하고 clear는 anonymous로 만든다', () => {
    useAuthStore.getState().setSession(session);
    authTokenProvider.setAccessToken('fresh', 900);
    expect(useAuthStore.getState().accessToken).toBe('fresh');
    expect(useAuthStore.getState().status).toBe('authenticated');
    authTokenProvider.clear();
    expect(useAuthStore.getState().status).toBe('anonymous');
    expect(useAuthStore.getState().accessToken).toBeNull();
  });
});
