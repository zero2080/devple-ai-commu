import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import type { UserProfile } from '@/domain';
import { signIn } from '@/features/chat/testing';
import { useUiStore } from '@/store/uiStore';
import { useWorldStore } from '@/store/worldStore';
import { TEST_APPEARANCE } from '@/test/fixtures';
import { ApiError } from '@/transport/http';

import { ProfileCard } from './ProfileCard';

const api = vi.hoisted(() => ({ getUserProfile: vi.fn<(id: string) => Promise<UserProfile>>() }));
vi.mock('@/transport/api/users', () => ({ getUserProfile: api.getUserProfile }));

const profile = (id: string, online: boolean, statusMessage?: string): UserProfile => ({
  user: {
    id,
    nickname: `닉-${id}`,
    appearance: TEST_APPEARANCE,
    ...(statusMessage === undefined ? {} : { statusMessage }),
    role: 'member',
    status: 'active',
    createdAt: 1,
  },
  online,
});

function renderCard() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={client}>
      <ProfileCard />
    </QueryClientProvider>,
  );
}

beforeEach(() => {
  api.getUserProfile.mockReset();
  useUiStore.getState().resetUi();
  signIn(); // me = u_me
});

describe('ProfileCard', () => {
  it('열린 프로필이 없으면 아무것도 그리지 않는다', () => {
    const { container } = renderCard();
    expect(container).toBeEmptyDOMElement();
  });

  it('닉네임·접속 여부·상태 메시지를 보여주고 DM 보내기로 DM 탭 스레드를 연다', async () => {
    api.getUserProfile.mockResolvedValue(profile('u_01', true, '반가워요'));
    useUiStore.getState().openProfile('u_01');
    renderCard();
    const card = await screen.findByRole('dialog', { name: '프로필: 닉-u_01' });
    expect(card).toHaveTextContent('접속 중');
    expect(card).toHaveTextContent('반가워요');
    const dmButton = screen.getByRole('button', { name: 'DM 보내기' });
    expect(dmButton).toHaveFocus();
    await userEvent.click(dmButton);
    expect(useUiStore.getState()).toMatchObject({
      chatTab: 'dm',
      dmPeerId: 'u_01',
      profileUserId: null,
    });
  });

  it('접속 중이어도 월드에서 자리비움이면 "자리비움" (presence.updated, ARCHITECTURE 3.5)', async () => {
    const world = useWorldStore.getState();
    world.reset();
    world.addPresence({
      userId: 'u_02',
      nickname: '닉-u_02',
      appearance: TEST_APPEARANCE,
      position: { mapId: 'main', x: 1, y: 1, dir: 'down' },
      state: 'away',
      updatedAt: 1,
    });
    api.getUserProfile.mockResolvedValue(profile('u_02', true));
    useUiStore.getState().openProfile('u_02');
    renderCard();
    const card = await screen.findByRole('dialog', { name: '프로필: 닉-u_02' });
    expect(card).toHaveTextContent('자리비움');
    expect(card).not.toHaveTextContent('접속 중');
    world.reset();
  });

  it('본인 프로필에는 DM 버튼이 없고, 상태 메시지가 없으면 안내 문구', async () => {
    api.getUserProfile.mockResolvedValue(profile('u_me', false));
    useUiStore.getState().openProfile('u_me');
    renderCard();
    await screen.findByRole('dialog', { name: '프로필: 닉-u_me' });
    expect(screen.queryByRole('button', { name: 'DM 보내기' })).toBeNull();
    expect(screen.getByText('상태 메시지 없음')).toBeInTheDocument();
    expect(screen.getByText('오프라인')).toBeInTheDocument();
  });

  it('Esc와 닫기 버튼으로 닫는다', async () => {
    api.getUserProfile.mockResolvedValue(profile('u_01', true));
    useUiStore.getState().openProfile('u_01');
    renderCard();
    await screen.findByRole('dialog');
    await userEvent.keyboard('{Escape}');
    expect(useUiStore.getState().profileUserId).toBeNull();
  });

  it('조회 실패는 계약 코드 문구로 보여준다', async () => {
    api.getUserProfile.mockRejectedValue(new ApiError(404, 'NOT_FOUND', 'x'));
    useUiStore.getState().openProfile('u_ghost');
    renderCard();
    expect(await screen.findByRole('alert')).toHaveTextContent('대상을 찾을 수 없어요.');
    await userEvent.click(screen.getByRole('button', { name: '닫기' }));
    expect(useUiStore.getState().profileUserId).toBeNull();
  });
});
