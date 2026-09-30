import { QueryClientProvider } from '@tanstack/react-query';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import type { Me, UserStatus } from '@/domain';
import { signIn } from '@/features/chat/testing';
import { queryClient } from '@/store/queryClient';

import { adminUser } from '../testing';
import { UsersPanel } from './UsersPanel';

const api = vi.hoisted(() => ({
  fetchAdminUsers:
    vi.fn<(q: { status?: UserStatus }) => Promise<{ items: Me[]; nextCursor: string | null }>>(),
  suspendUser: vi.fn<(id: string) => Promise<void>>(),
  unsuspendUser: vi.fn<(id: string) => Promise<void>>(),
  reissueAccessKey: vi.fn<(id: string) => Promise<void>>(),
}));
vi.mock('@/transport/api/admin', () => api);

function renderPanel() {
  return render(
    <QueryClientProvider client={queryClient}>
      <UsersPanel />
    </QueryClientProvider>,
  );
}

const rowOf = async (nickname: string) =>
  (await screen.findAllByTestId('admin-user-row')).find((r) => r.textContent.includes(nickname));

beforeEach(() => {
  queryClient.clear();
  vi.clearAllMocks();
  signIn(); // u_me
  api.fetchAdminUsers.mockResolvedValue({
    items: [
      adminUser('u_me', '데모', { role: 'admin' }),
      adminUser('u_01', '도트'),
      adminUser('u_20', '롬팩', { status: 'suspended' }),
    ],
    nextCursor: null,
  });
  api.suspendUser.mockResolvedValue(undefined);
  api.unsuspendUser.mockResolvedValue(undefined);
  api.reissueAccessKey.mockResolvedValue(undefined);
});

describe('UsersPanel', () => {
  it('본인은 정지 버튼이 없고, 운영자·나 표시와 정지 상태를 보여준다', async () => {
    renderPanel();
    const me = await rowOf('데모');
    if (me === undefined) throw new Error('no me row');
    expect(me).toHaveTextContent('운영자');
    expect(me).toHaveTextContent('나');
    expect(within(me).queryByRole('button', { name: '정지' })).toBeNull();
    const suspended = await rowOf('롬팩');
    expect(suspended).toHaveTextContent('정지');
    expect(
      within(suspended ?? document.body).getByRole('button', { name: '해제' }),
    ).toBeInTheDocument();
  });

  it('정지는 한 번 더 확인한 뒤 보내고, 취소하면 보내지 않는다', async () => {
    renderPanel();
    const row = await rowOf('도트');
    if (row === undefined) throw new Error('no row');
    await userEvent.click(within(row).getByRole('button', { name: '정지' }));
    expect(row).toHaveTextContent('다시 로그인할 수 없어요');
    await userEvent.click(within(row).getByRole('button', { name: '취소' }));
    expect(api.suspendUser).not.toHaveBeenCalled();
    await userEvent.click(within(row).getByRole('button', { name: '정지' }));
    await userEvent.click(within(row).getByRole('button', { name: '정지 확정' }));
    expect(api.suspendUser).toHaveBeenCalledWith('u_01');
    expect(await screen.findByRole('status')).toHaveTextContent('‘도트’님을 정지했어요');
    await waitFor(() => {
      expect(api.fetchAdminUsers).toHaveBeenCalledTimes(2);
    });
  });

  it('해제는 바로, 키 재발급은 확인 후 보낸다', async () => {
    renderPanel();
    const suspended = await rowOf('롬팩');
    if (suspended === undefined) throw new Error('no row');
    await userEvent.click(within(suspended).getByRole('button', { name: '해제' }));
    expect(api.unsuspendUser).toHaveBeenCalledWith('u_20');
    const row = await rowOf('도트');
    if (row === undefined) throw new Error('no row');
    await userEvent.click(within(row).getByRole('button', { name: '키 재발급' }));
    expect(row).toHaveTextContent('기존 접근 키와 세션이 즉시 무효');
    await userEvent.click(within(row).getByRole('button', { name: '재발급 확정' }));
    expect(api.reissueAccessKey).toHaveBeenCalledWith('u_01');
    expect(await screen.findByRole('status')).toHaveTextContent('접근 키를 재발급했어요');
  });
});
