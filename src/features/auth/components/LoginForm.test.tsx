import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { ApiError } from '@/transport/http';

import { LoginForm } from './LoginForm';

const loginWithAccessKey = vi.fn<(key: string) => Promise<void>>();
vi.mock('../session', () => ({
  loginWithAccessKey: (key: string) => loginWithAccessKey(key),
}));

function renderForm(onSuccess = vi.fn()) {
  const client = new QueryClient({ defaultOptions: { mutations: { retry: false } } });
  render(
    <QueryClientProvider client={client}>
      <LoginForm onSuccess={onSuccess} />
    </QueryClientProvider>,
  );
  return { onSuccess };
}

beforeEach(() => {
  loginWithAccessKey.mockReset();
});

describe('LoginForm', () => {
  it('접근 키를 제출하면 로그인하고 onSuccess를 부른다', async () => {
    loginWithAccessKey.mockResolvedValue(undefined);
    const { onSuccess } = renderForm();
    await userEvent.type(screen.getByLabelText('접근 키'), ' DEMO-0000-0000 ');
    await userEvent.click(screen.getByRole('button', { name: '입장' }));
    await waitFor(() => {
      expect(onSuccess).toHaveBeenCalledOnce();
    });
    expect(loginWithAccessKey).toHaveBeenCalledWith('DEMO-0000-0000');
  });

  it('빈 키는 제출하지 않는다', async () => {
    renderForm();
    await userEvent.click(screen.getByRole('button', { name: '입장' }));
    expect(loginWithAccessKey).not.toHaveBeenCalled();
  });

  it('키가 틀리면 계약 코드에 맞는 문구를 보여준다', async () => {
    loginWithAccessKey.mockRejectedValue(new ApiError(401, 'AUTH_INVALID_KEY', 'bad'));
    renderForm();
    await userEvent.type(screen.getByLabelText('접근 키'), 'WRONG');
    await userEvent.click(screen.getByRole('button', { name: '입장' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('접근 키가 올바르지 않아요.');
  });
});
