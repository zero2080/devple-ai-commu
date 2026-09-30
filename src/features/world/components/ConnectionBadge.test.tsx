import { render, screen } from '@testing-library/react';
import { act } from 'react';
import { beforeEach, describe, expect, it } from 'vitest';

import { useWorldStore } from '@/store/worldStore';
import { TEST_APPEARANCE } from '@/test/fixtures';

import { ConnectionBadge } from './ConnectionBadge';

const presence = (userId: string, state: 'online' | 'away') => ({
  userId,
  nickname: userId,
  appearance: TEST_APPEARANCE,
  position: { mapId: 'main', x: 1, y: 1, dir: 'down' as const },
  state,
  updatedAt: 1,
});

beforeEach(() => {
  const world = useWorldStore.getState();
  world.reset();
  world.setMyUserId('me');
  world.setSseState('open');
});

describe('ConnectionBadge', () => {
  it('연결 상태·접속자 수, 내가 자리비움이면 표시 (남의 자리비움은 표시하지 않음)', () => {
    useWorldStore.getState().applySnapshot({
      mapId: 'main',
      presences: [presence('me', 'online'), presence('other', 'away')],
      serverTime: 1,
    });
    render(<ConnectionBadge />);
    const badge = screen.getByTestId('sse-state');
    expect(badge).toHaveTextContent('실시간 연결됨 · 접속자 2명');
    expect(badge).toHaveAttribute('data-away', 'false');
    act(() => {
      useWorldStore.getState().updatePresence({ userId: 'me', state: 'away' });
    });
    expect(badge).toHaveTextContent('실시간 연결됨 · 접속자 2명 · 자리비움');
    expect(badge).toHaveAttribute('data-away', 'true');
  });
});
