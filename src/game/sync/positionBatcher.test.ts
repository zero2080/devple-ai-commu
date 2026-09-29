import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import type { Position } from '@/domain';
import { ApiError } from '@/transport/http';

import { isSamePosition, PositionBatcher, type PositionRejectedDetails } from './positionBatcher';

const T0 = 1_700_000_000_000;

function pos(x: number, y = 0): Position {
  return { mapId: 'main', x, y, dir: 'down' };
}

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(T0);
});

afterEach(() => {
  vi.useRealTimers();
});

describe('PositionBatcher', () => {
  it('200ms 안에 5회 이동하면 마지막 위치 1회만 보낸다', async () => {
    const send = vi.fn(() => Promise.resolve());
    const batcher = new PositionBatcher({ intervalMs: 200, send, pageHideTarget: null });
    batcher.start();

    for (let x = 1; x <= 5; x += 1) {
      batcher.push(pos(x));
      await vi.advanceTimersByTimeAsync(30);
    }
    await vi.advanceTimersByTimeAsync(50); // t = 200ms
    expect(send).toHaveBeenCalledTimes(1);
    expect(send).toHaveBeenCalledWith({ ...pos(5), seq: T0 + 200 }, { keepalive: false });
    batcher.stop();
  });

  it('위치가 바뀌지 않았으면 보내지 않는다', async () => {
    const send = vi.fn(() => Promise.resolve());
    const batcher = new PositionBatcher({ intervalMs: 200, send, pageHideTarget: null });
    batcher.start();
    batcher.push(pos(1));
    await vi.advanceTimersByTimeAsync(200);
    await vi.advanceTimersByTimeAsync(200); // pending 없음
    batcher.push(pos(1)); // 같은 위치
    await vi.advanceTimersByTimeAsync(200);
    expect(send).toHaveBeenCalledTimes(1);
    batcher.stop();
  });

  it('seq는 Date.now() 기반이며 같은 ms에서도 단조 증가한다', async () => {
    const send = vi.fn(() => Promise.resolve());
    const batcher = new PositionBatcher({
      intervalMs: 200,
      send,
      pageHideTarget: null,
      now: () => T0,
    });
    batcher.push(pos(1));
    await batcher.flush();
    batcher.push(pos(2));
    await batcher.flush();
    const seqs = send.mock.calls.map((call) => (call as unknown as [{ seq: number }])[0].seq);
    expect(seqs).toEqual([T0, T0 + 1]);
  });

  it('409 POSITION_REJECTED면 onRejected에 details를 넘기고 서버 위치를 인정값으로 삼는다', async () => {
    const details: PositionRejectedDetails = { position: pos(2), seq: 1, reason: 'occupied' };
    const send = vi.fn(() =>
      Promise.reject(new ApiError(409, 'POSITION_REJECTED', 'occupied', { ...details })),
    );
    const onRejected = vi.fn();
    const batcher = new PositionBatcher({
      intervalMs: 200,
      send,
      onRejected,
      pageHideTarget: null,
    });
    batcher.push(pos(3));
    await batcher.flush();
    expect(onRejected).toHaveBeenCalledWith(details);
    expect(batcher.lastAcknowledged).toEqual(pos(2));
  });

  it('네트워크 실패면 onError 후 다음 틱에 같은 위치를 다시 보낸다', async () => {
    const send = vi
      .fn<(body: unknown, options: unknown) => Promise<void>>()
      .mockRejectedValueOnce(new Error('offline'))
      .mockResolvedValue(undefined);
    const onError = vi.fn();
    const batcher = new PositionBatcher({ intervalMs: 200, send, onError, pageHideTarget: null });
    batcher.start();
    batcher.push(pos(1));
    await vi.advanceTimersByTimeAsync(200);
    expect(onError).toHaveBeenCalledOnce();
    await vi.advanceTimersByTimeAsync(200);
    expect(send).toHaveBeenCalledTimes(2);
    expect(send.mock.calls[1]?.[0]).toMatchObject(pos(1));
    batcher.stop();
  });

  it('pagehide 시 keepalive로 마지막 위치를 보낸다', async () => {
    const send = vi.fn(() => Promise.resolve());
    const target = new EventTarget();
    const batcher = new PositionBatcher({ intervalMs: 200, send, pageHideTarget: target });
    batcher.start();
    batcher.push(pos(7));
    target.dispatchEvent(new Event('pagehide'));
    await vi.advanceTimersByTimeAsync(0);
    expect(send).toHaveBeenCalledWith({ ...pos(7), seq: T0 }, { keepalive: true });
    batcher.stop();
    batcher.push(pos(8));
    target.dispatchEvent(new Event('pagehide')); // stop 후에는 리스너 없음
    await vi.advanceTimersByTimeAsync(0);
    expect(send).toHaveBeenCalledTimes(1);
  });
});

describe('isSamePosition', () => {
  it('mapId·x·y·dir이 모두 같아야 같다', () => {
    expect(isSamePosition(pos(1), pos(1))).toBe(true);
    expect(isSamePosition(pos(1), { ...pos(1), dir: 'up' })).toBe(false);
    expect(isSamePosition(pos(1), { ...pos(1), mapId: 'other' })).toBe(false);
  });
});
