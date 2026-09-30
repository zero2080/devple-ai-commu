import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it } from 'vitest';

import { useUiStore } from '@/store/uiStore';

import { signIn, withWorld } from '../testing';
import { ChatPanel } from './ChatPanel';

beforeEach(() => {
  useUiStore.getState().resetUi();
  signIn();
});

describe('ChatPanel 탭', () => {
  it('근접 탭이 기본이고 DM 탭에 안 읽음 합계를 보여준다', async () => {
    render(withWorld(<ChatPanel dmPane={<p>DM 내용</p>} dmUnread={3} />));
    expect(screen.getByRole('tab', { name: '근접' })).toHaveAttribute('aria-selected', 'true');
    expect(screen.getByRole('log', { name: '근접 대화 기록' })).toBeInTheDocument();
    expect(screen.getByTestId('dm-unread')).toHaveTextContent('3');
    await userEvent.click(screen.getByRole('tab', { name: /DM/ }));
    expect(screen.getByRole('tab', { name: /DM/ })).toHaveAttribute('aria-selected', 'true');
    expect(screen.getByText('DM 내용')).toBeInTheDocument();
    expect(screen.queryByRole('log', { name: '근접 대화 기록' })).toBeNull();
  });

  it('안 읽음이 없으면 배지를 그리지 않는다', () => {
    render(withWorld(<ChatPanel dmPane={null} dmUnread={0} />));
    expect(screen.queryByTestId('dm-unread')).toBeNull();
  });
});
