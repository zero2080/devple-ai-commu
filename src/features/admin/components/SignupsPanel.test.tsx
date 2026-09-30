import { QueryClientProvider } from '@tanstack/react-query';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import type { SignupRequest, SignupStatus } from '@/domain';
import { signIn } from '@/features/chat/testing';
import { queryClient } from '@/store/queryClient';
import { ApiError } from '@/transport/http';

import { signup } from '../testing';
import { SignupsPanel } from './SignupsPanel';

const api = vi.hoisted(() => ({
  fetchSignups:
    vi.fn<
      (q: {
        status?: SignupStatus;
      }) => Promise<{ items: SignupRequest[]; nextCursor: string | null }>
    >(),
  approveSignup: vi.fn<(id: string) => Promise<{ userId: string }>>(),
  rejectSignup: vi.fn<(id: string, reason: string) => Promise<void>>(),
}));
vi.mock('@/transport/api/admin', () => api);

function renderPanel() {
  return render(
    <QueryClientProvider client={queryClient}>
      <SignupsPanel />
    </QueryClientProvider>,
  );
}

beforeEach(() => {
  queryClient.clear();
  vi.clearAllMocks();
  signIn();
  api.fetchSignups.mockImplementation(({ status }) =>
    Promise.resolve({
      items:
        status === 'rejected'
          ? [signup('sr_09', '스팸봇', 'rejected', '연락처 확인 불가')]
          : [signup('sr_01', '신입'), signup('sr_02', '방문자')],
      nextCursor: null,
    }),
  );
});

describe('SignupsPanel', () => {
  it('대기 신청을 승인하면 안내하고 목록을 다시 받는다', async () => {
    api.approveSignup.mockResolvedValue({ userId: 'u_new' });
    renderPanel();
    const rows = await screen.findAllByTestId('signup-row');
    expect(rows.map((r) => within(r).getAllByRole('cell')[0]?.textContent)).toEqual([
      '신입',
      '방문자',
    ]);
    const [first] = rows;
    if (first === undefined) throw new Error('no rows');
    await userEvent.click(within(first).getByRole('button', { name: '승인' }));
    expect(api.approveSignup).toHaveBeenCalledWith('sr_01');
    expect(await screen.findByRole('status')).toHaveTextContent('‘신입’ 신청을 승인했어요');
    await waitFor(() => {
      expect(api.fetchSignups).toHaveBeenCalledTimes(2);
    });
  });

  it('거절은 사유를 적어야 확정할 수 있고, 앞뒤 공백을 빼고 보낸다', async () => {
    api.rejectSignup.mockResolvedValue(undefined);
    renderPanel();
    const rows = await screen.findAllByTestId('signup-row');
    const row = rows[1];
    if (row === undefined) throw new Error('no row');
    await userEvent.click(within(row).getByRole('button', { name: '거절' }));
    const confirm = within(row).getByRole('button', { name: '거절 확정' });
    expect(confirm).toBeDisabled();
    await userEvent.type(within(row).getByRole('textbox', { name: '거절 사유' }), '   ');
    expect(confirm).toBeDisabled();
    await userEvent.type(within(row).getByRole('textbox', { name: '거절 사유' }), '중복 신청 ');
    await userEvent.click(confirm);
    expect(api.rejectSignup).toHaveBeenCalledWith('sr_02', '중복 신청');
    expect(await screen.findByRole('status')).toHaveTextContent('‘방문자’ 신청을 거절했어요');
  });

  it('이미 처리된 신청(409)이면 안내하고, 거절됨 필터는 사유를 보여준다', async () => {
    api.approveSignup.mockRejectedValue(new ApiError(409, 'SIGNUP_ALREADY_REVIEWED', 'done'));
    renderPanel();
    const [first] = await screen.findAllByTestId('signup-row');
    if (first === undefined) throw new Error('no rows');
    await userEvent.click(within(first).getByRole('button', { name: '승인' }));
    expect(await screen.findByRole('status')).toHaveTextContent('이미 처리된 신청이에요.');
    await userEvent.click(screen.getByRole('button', { name: '거절됨' }));
    expect(await screen.findByText('거절 — 연락처 확인 불가')).toBeInTheDocument();
    expect(api.fetchSignups).toHaveBeenCalledWith({ status: 'rejected' });
    expect(screen.queryByRole('button', { name: '승인' })).toBeNull();
  });
});
