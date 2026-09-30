import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import type { Notice } from '@/domain';
import { signIn } from '@/features/chat/testing';
import { ApiError } from '@/transport/http';

import { NoticePanel } from './NoticePanel';

const api = vi.hoisted(() => ({ postNotice: vi.fn<(content: string) => Promise<Notice>>() }));
vi.mock('@/transport/api/admin', () => api);

beforeEach(() => {
  vi.clearAllMocks();
  signIn(); // maxMessageLength 10
});

describe('NoticePanel', () => {
  it('빈 본문·공백·길이 초과는 막고, 보내면 안내 후 비운다', async () => {
    api.postNotice.mockResolvedValue({
      id: 'n1',
      content: '점검',
      createdBy: 'u_me',
      createdAt: 1,
    });
    render(<NoticePanel />);
    const input = screen.getByRole('textbox', { name: /공지 내용/ });
    const send = screen.getByRole('button', { name: '공지 보내기' });
    expect(send).toBeDisabled();
    await userEvent.type(input, '   ');
    expect(send).toBeDisabled();
    await userEvent.clear(input);
    await userEvent.type(input, '열한글자가넘는긴공지문');
    expect(send).toBeDisabled();
    expect(screen.getByText('11/10')).toBeInTheDocument();
    await userEvent.clear(input);
    await userEvent.type(input, '오늘 점검');
    await userEvent.click(send);
    expect(api.postNotice).toHaveBeenCalledWith('오늘 점검');
    expect(await screen.findByRole('status')).toHaveTextContent('공지를 보냈어요');
    expect(input).toHaveValue('');
  });

  it('서버가 내용을 거부하면 이유를 알려 준다', async () => {
    api.postNotice.mockRejectedValue(new ApiError(400, 'MESSAGE_INVALID_CONTENT', 'control'));
    render(<NoticePanel />);
    await userEvent.type(screen.getByRole('textbox', { name: /공지 내용/ }), '이상한 글');
    await userEvent.click(screen.getByRole('button', { name: '공지 보내기' }));
    expect(await screen.findByRole('status')).toHaveTextContent('보낼 수 없는 내용이에요');
  });
});
