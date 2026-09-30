import { beforeEach, describe, expect, it, vi } from 'vitest';

import type { AuthSession } from '@/domain';
import { useAuthStore } from '@/store/authStore';
import { useWorldStore } from '@/store/worldStore';

import { loginWithAccessKey, logoutSession, restoreSession } from './session';

const mocks = vi.hoisted(() => ({
  login: vi.fn<(body: { accessKey: string }) => Promise<AuthSession>>(),
  logout: vi.fn<() => Promise<void>>(),
  getMe: vi.fn<() => Promise<{ me: AuthSession['me']; config: AuthSession['config'] }>>(),
  refreshAccessToken: vi.fn<() => Promise<string>>(),
  connectSse: vi.fn(),
  disconnectSse: vi.fn(),
}));

vi.mock('@/transport/api/auth', () => ({ login: mocks.login, logout: mocks.logout }));
vi.mock('@/transport/api/me', () => ({ getMe: mocks.getMe }));
vi.mock('@/transport/http', () => ({ refreshAccessToken: mocks.refreshAccessToken }));
vi.mock('@/features/realtime', () => ({
  connectSse: mocks.connectSse,
  disconnectSse: mocks.disconnectSse,
}));

const { login, logout, getMe, refreshAccessToken, connectSse, disconnectSse } = mocks;

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
    avatarIds: ['char_01'],
  },
};

beforeEach(() => {
  vi.clearAllMocks();
  useAuthStore.getState().clear();
  useWorldStore.getState().reset();
});

describe('세션 수명과 SSE', () => {
  it('로그인하면 세션·내 userId를 저장하고 SSE를 연결한다', async () => {
    login.mockResolvedValue(session);
    await loginWithAccessKey('DEMO-0000-0000');
    expect(useAuthStore.getState().status).toBe('authenticated');
    expect(useWorldStore.getState().myUserId).toBe('me');
    expect(connectSse).toHaveBeenCalledOnce();
  });

  it('세션 복구에 성공하면 SSE를 연결하고, 실패하면 anonymous로 두고 연결하지 않는다', async () => {
    refreshAccessToken.mockResolvedValue('fresh');
    getMe.mockResolvedValue({ me: session.me, config: session.config });
    await restoreSession();
    expect(useAuthStore.getState().status).toBe('authenticated');
    expect(connectSse).toHaveBeenCalledOnce();

    connectSse.mockClear();
    refreshAccessToken.mockRejectedValue(new Error('no cookie'));
    await restoreSession();
    expect(useAuthStore.getState().status).toBe('anonymous');
    expect(connectSse).not.toHaveBeenCalled();
  });

  it('로그아웃은 SSE를 먼저 끊고 서버 무효화 후 스토어를 비운다 (서버 실패해도 비움)', async () => {
    login.mockResolvedValue(session);
    await loginWithAccessKey('DEMO-0000-0000');
    logout.mockRejectedValue(new Error('offline'));
    await logoutSession();
    expect(disconnectSse).toHaveBeenCalledOnce();
    expect(useAuthStore.getState().status).toBe('anonymous');
    expect(useWorldStore.getState().myUserId).toBeNull();
  });
});
