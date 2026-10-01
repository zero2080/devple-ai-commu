import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { ApiError } from '@/transport/http';

import { SignupStatus } from './SignupStatus';

interface Status {
  status: 'pending' | 'approved' | 'rejected';
  rejectReason?: string;
}
const api = vi.hoisted(() => ({ getSignupStatus: vi.fn<(id: string) => Promise<Status>>() }));
vi.mock('@/transport/api/auth', () => api);

function renderStatus(requestId = 'sr_01', client = new QueryClient()) {
  return render(
    <QueryClientProvider client={client}>
      <MemoryRouter>
        <SignupStatus requestId={requestId} />
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe('SignupStatus', () => {
  it('대기: 안내와 다시 확인 버튼, 신청 번호를 보여 준다', async () => {
    api.getSignupStatus.mockResolvedValue({ status: 'pending' });
    renderStatus('sr_01');
    expect(await screen.findByRole('status')).toHaveTextContent('운영자가 확인하고 있어요');
    expect(screen.getByText('sr_01')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '다시 확인' })).toBeInTheDocument();
    expect(api.getSignupStatus).toHaveBeenCalledWith('sr_01');
  });

  it('승인: 로그인 안내, 거절: 사유', async () => {
    api.getSignupStatus.mockResolvedValueOnce({ status: 'approved' });
    const view = renderStatus('sr_03');
    expect(await screen.findByRole('status')).toHaveTextContent('승인됐어요');
    expect(screen.getByRole('link', { name: '로그인하러 가기' })).toHaveAttribute('href', '/login');
    view.unmount();
    api.getSignupStatus.mockResolvedValueOnce({ status: 'rejected', rejectReason: '중복 신청' });
    renderStatus('sr_04');
    expect(await screen.findByRole('status')).toHaveTextContent('신청이 거절됐어요');
    expect(screen.getByText('사유: 중복 신청')).toBeInTheDocument();
  });

  it('없는 번호(404)는 다시 시도하지 않고 안내한다', async () => {
    api.getSignupStatus.mockRejectedValue(new ApiError(404, 'NOT_FOUND', 'missing'));
    renderStatus('sr_404');
    expect(await screen.findByRole('alert')).toHaveTextContent('이 번호의 신청을 찾을 수 없어요');
    expect(api.getSignupStatus).toHaveBeenCalledTimes(1);
  });

  it('다시 열면 캐시가 신선해도 서버에 다시 묻는다 (승인 뒤 예전 대기가 보이지 않게)', async () => {
    const shared = new QueryClient({ defaultOptions: { queries: { staleTime: 30_000 } } });
    api.getSignupStatus.mockResolvedValueOnce({ status: 'pending' });
    const first = renderStatus('sr_10', shared);
    expect(await screen.findByRole('status')).toHaveTextContent('운영자가 확인하고 있어요');
    first.unmount();
    api.getSignupStatus.mockResolvedValueOnce({ status: 'approved' });
    renderStatus('sr_10', shared);
    expect(await screen.findByText('승인됐어요')).toBeInTheDocument();
    expect(api.getSignupStatus).toHaveBeenCalledTimes(2);
  });
});
