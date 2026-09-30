import { act, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it } from 'vitest';

import { useUiStore } from '@/store/uiStore';
import { ALL_SSE_HANDLERS } from '@/transport/sse/handlers';
import { SseRegistry } from '@/transport/sse/registry';

import { NoticeBanner } from './NoticeBanner';

const registry = new SseRegistry();
registry.registerAll(ALL_SSE_HANDLERS);

beforeEach(() => {
  useUiStore.getState().resetUi();
});

describe('NoticeBanner', () => {
  it('system.notice를 받으면 본문을 plain text로 보여주고(링크 버튼 없음), 닫으면 사라진다', async () => {
    render(<NoticeBanner placement="overlay" />);
    expect(screen.queryByTestId('notice-banner')).toBeNull();
    act(() => {
      registry.dispatch({
        id: '1',
        type: 'system.notice',
        ts: 1,
        payload: {
          id: 'n1',
          content: '<b>점검</b> https://example.com',
          createdBy: 'u_me',
          createdAt: 1,
        },
      });
    });
    const banner = screen.getByRole('status', { name: '공지' });
    expect(banner).toHaveTextContent('<b>점검</b> https://example.com');
    expect(banner.querySelector('b')).toBeNull();
    expect(screen.queryByRole('link')).toBeNull();
    await userEvent.click(screen.getByRole('button', { name: '공지 닫기' }));
    expect(screen.queryByTestId('notice-banner')).toBeNull();
  });
});
