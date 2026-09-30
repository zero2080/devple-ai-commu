import { act, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { useChatStore } from '@/store/chatStore';

import { fakeFrame, withWorld, type WorldHarness } from '../testing';
import { SpeechBubbleLayer } from './SpeechBubbleLayer';

const NOW = 1_700_000_000_000;

function say(id: string, userId: string, content: string, links: string[] = []): void {
  useChatStore.getState().receivePublic(
    {
      id,
      kind: 'public',
      senderId: userId,
      content,
      links,
      createdAt: NOW,
      position: { mapId: 'main', x: 1, y: 1, dir: 'down' },
      sender: { nickname: userId },
    },
    'u_me',
    NOW,
  );
}

beforeEach(() => {
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(NOW);
  useChatStore.getState().reset();
});

afterEach(() => {
  vi.useRealTimers();
});

describe('SpeechBubbleLayer', () => {
  it('프레임마다 꼬리 끝이 anchor에 오도록 transform을 쓰고, 캐릭터가 없으면 숨긴다', () => {
    const harness: WorldHarness = { emit: () => undefined };
    say('m1', 'a', '안녕');
    say('m2', 'ghost', '어디?');
    render(withWorld(<SpeechBubbleLayer />, harness));
    act(() => {
      harness.emit(fakeFrame({ a: { x: 400, y: 300 } }));
    });
    const [first, second] = screen.getAllByTestId('speech-bubble');
    // jsdom 크기는 0 → x = 400, y = 300 - 0 - 3*2
    expect(first?.style.transform).toBe('translate(400px, 294px)');
    expect(first?.style.visibility).toBe('visible');
    expect(second?.style.visibility).toBe('hidden');
    expect(first).toHaveTextContent('안녕');
  });

  it('만료가 지나면 지우지만, 포인터가 올라가 있으면 벗어날 때까지 유지한다', () => {
    const harness: WorldHarness = { emit: () => undefined };
    say('plain', 'a', '짧게');
    say('linked', 'b', '링크 https://x.io', ['https://x.io']);
    render(withWorld(<SpeechBubbleLayer />, harness));
    const linked = screen.getAllByTestId('speech-bubble').find((el) => el.dataset.userId === 'b');
    if (linked === undefined) throw new Error('missing');
    fireEvent.pointerEnter(linked);

    vi.setSystemTime(NOW + 10_000);
    act(() => {
      harness.emit(fakeFrame({ a: { x: 100, y: 100 }, b: { x: 300, y: 100 } }));
    });
    expect(useChatStore.getState().bubbles.map((b) => b.id)).toEqual(['linked']);

    fireEvent.pointerLeave(linked);
    act(() => {
      harness.emit(fakeFrame({ b: { x: 300, y: 100 } }));
    });
    expect(useChatStore.getState().bubbles).toEqual([]);
    expect(screen.queryAllByTestId('speech-bubble')).toHaveLength(0);
  });

  it('본문은 텍스트로만 렌더한다', () => {
    say('m1', 'a', '<img src=x onerror=alert(1)>');
    render(withWorld(<SpeechBubbleLayer />));
    const bubble = screen.getByTestId('speech-bubble');
    expect(bubble.querySelector('img')).toBeNull();
    expect(bubble).toHaveTextContent('<img src=x onerror=alert(1)>');
  });
});
