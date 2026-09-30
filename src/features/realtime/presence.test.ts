import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import type { PresenceState } from '@/domain';

import { PresenceTracker } from './presence';

const TIMEOUT = 5 * 60_000;

function setup() {
  const sent: PresenceState[] = [];
  let fail = false;
  const send = vi.fn((state: PresenceState) => {
    sent.push(state);
    return fail ? Promise.reject(new Error('offline')) : Promise.resolve();
  });
  const tracker = new PresenceTracker({ timeoutMs: TIMEOUT, send, now: () => Date.now() });
  return {
    tracker,
    send,
    sent,
    setFail: (value: boolean) => {
      fail = value;
    },
  };
}

beforeEach(() => {
  vi.useFakeTimers();
  vi.spyOn(console, 'warn').mockImplementation(() => undefined);
});
afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
});

describe('PresenceTracker (ARCHITECTURE 3.5)', () => {
  it('5분 입력이 없으면 away 한 번, 입력하면 online 한 번', async () => {
    const { tracker, sent } = setup();
    tracker.start();
    await vi.advanceTimersByTimeAsync(TIMEOUT - 1);
    expect(sent).toEqual([]);
    await vi.advanceTimersByTimeAsync(1);
    expect(sent).toEqual(['away']);
    await vi.advanceTimersByTimeAsync(TIMEOUT * 3); // 계속 자리를 비워도 다시 보내지 않는다
    expect(sent).toEqual(['away']);
    expect(tracker.state).toBe('away');
    tracker.input();
    tracker.input();
    await vi.advanceTimersByTimeAsync(0);
    expect(sent).toEqual(['away', 'online']);
    expect(tracker.state).toBe('online');
    tracker.stop();
  });

  it('입력이 있으면 만료가 밀리고, 입력마다 타이머를 다시 걸지 않는다', async () => {
    const { tracker, sent } = setup();
    const setTimeoutSpy = vi.spyOn(globalThis, 'setTimeout');
    tracker.start();
    const armed = setTimeoutSpy.mock.calls.length;
    for (let i = 0; i < 100; i += 1) {
      await vi.advanceTimersByTimeAsync(TIMEOUT / 100);
      tracker.input(); // pointermove처럼 잦은 입력
    }
    // 100번 입력 중 타이머는 만료 시점에 깨어날 때만 다시 건다
    expect(setTimeoutSpy.mock.calls.length - armed).toBeLessThanOrEqual(2);
    expect(sent).toEqual([]);
    await vi.advanceTimersByTimeAsync(TIMEOUT);
    expect(sent).toEqual(['away']);
    tracker.stop();
  });

  it('전송이 실패하면 상태를 바꾸지 않고, 다음 만료·입력 때 다시 보낸다', async () => {
    const { tracker, sent, setFail } = setup();
    setFail(true);
    tracker.start();
    await vi.advanceTimersByTimeAsync(TIMEOUT);
    expect(sent).toEqual(['away']);
    expect(tracker.state).toBe('online');
    setFail(false);
    await vi.advanceTimersByTimeAsync(TIMEOUT);
    expect(sent).toEqual(['away', 'away']);
    expect(tracker.state).toBe('away');

    setFail(true);
    tracker.input();
    await vi.advanceTimersByTimeAsync(0);
    expect(tracker.state).toBe('away');
    setFail(false);
    tracker.input();
    await vi.advanceTimersByTimeAsync(0);
    expect(sent).toEqual(['away', 'away', 'online', 'online']);
    expect(tracker.state).toBe('online');
    tracker.stop();
  });

  it('보내는 중에 입력이 오면 끝난 뒤 이어서 online을 보낸다', async () => {
    const { tracker, sent } = setup();
    tracker.start();
    await vi.advanceTimersByTimeAsync(TIMEOUT); // away 전송 시작 (마이크로태스크 대기 중)
    tracker.input();
    await vi.advanceTimersByTimeAsync(0);
    expect(sent).toEqual(['away', 'online']);
    expect(tracker.state).toBe('online');
    tracker.stop();
  });

  it('중지 후에는 입력·만료에 반응하지 않고, 만료 시간을 바꾸면 지금부터 다시 잰다', async () => {
    const { tracker, sent } = setup();
    tracker.start();
    await vi.advanceTimersByTimeAsync(1000);
    tracker.setTimeoutMs(2000);
    await vi.advanceTimersByTimeAsync(999);
    expect(sent).toEqual([]);
    await vi.advanceTimersByTimeAsync(1);
    expect(sent).toEqual(['away']);
    tracker.stop();
    tracker.input();
    await vi.advanceTimersByTimeAsync(TIMEOUT);
    expect(sent).toEqual(['away']);
  });
});
