import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { useChatStore } from '@/store/chatStore';

import { signIn } from '../testing';
import { PublicLog } from './PublicLog';

const actions = vi.hoisted(() => ({ retryPublic: vi.fn(), dismissPublic: vi.fn() }));
vi.mock('../actions', () => ({
  retryPublic: actions.retryPublic,
  dismissPublic: actions.dismissPublic,
}));

beforeEach(() => {
  vi.clearAllMocks();
  useChatStore.getState().reset();
  signIn();
});

describe('PublicLog', () => {
  it('확정 항목을 닉네임·본문(텍스트 그대로)·링크 버튼으로 보여준다', () => {
    useChatStore.getState().receivePublic(
      {
        id: 'pm_1',
        kind: 'public',
        senderId: 'u_01',
        content: '<b>굵게</b> https://example.com/x',
        links: ['https://example.com/x', 'https://example.com/x'],
        createdAt: 1,
        position: { mapId: 'main', x: 1, y: 1, dir: 'down' },
        sender: { nickname: '도트' },
      },
      'u_me',
      1,
    );
    render(<PublicLog />);
    const log = screen.getByRole('log', { name: '근접 대화 기록' });
    const entry = within(log).getByTestId('public-log-entry');
    expect(entry).toHaveTextContent('도트');
    expect(entry).toHaveTextContent('<b>굵게</b> https://example.com/x'); // HTML로 해석하지 않음
    expect(entry.querySelector('b')).toBeNull();
    expect(within(entry).getAllByRole('button', { name: '↗ example.com' })).toHaveLength(1); // 같은 링크는 하나로
  });

  it('전송 중·실패 상태와 다시 보내기·지우기를 보여준다', async () => {
    const sending = useChatStore.getState().addPending('보내는 중', 1);
    const failed = useChatStore.getState().addPending('실패함', 2);
    useChatStore.getState().failPending(failed, 'RATE_LIMITED');
    render(<PublicLog />);
    const [sendingItem, failedItem] = screen.getAllByTestId('public-log-pending');
    if (sendingItem === undefined || failedItem === undefined)
      throw new Error('pending items missing');
    expect(sendingItem).toHaveAttribute('data-status', 'sending');
    expect(sendingItem).toHaveTextContent('전송 중…');
    expect(within(failedItem).getByRole('alert')).toHaveTextContent('요청이 너무 많아요');
    await userEvent.click(within(failedItem).getByRole('button', { name: '다시 보내기' }));
    expect(actions.retryPublic).toHaveBeenCalledWith(failed);
    await userEvent.click(within(failedItem).getByRole('button', { name: '지우기' }));
    expect(actions.dismissPublic).toHaveBeenCalledWith(failed);
    expect(sending).not.toBe(failed);
  });
});
