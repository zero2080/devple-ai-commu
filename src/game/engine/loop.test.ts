import { describe, expect, it, vi } from 'vitest';

import { GameLoop } from './loop';

/** 수동 rAF: 테스트가 프레임 시각을 직접 넣는다 */
function manualRaf() {
  let pending: ((t: number) => void) | null = null;
  return {
    requestFrame: (cb: (t: number) => void) => {
      pending = cb;
      return 1;
    },
    cancelFrame: () => {
      pending = null;
    },
    frame: (t: number) => {
      const cb = pending;
      pending = null;
      cb?.(t);
    },
    get hasPending() {
      return pending !== null;
    },
  };
}

describe('GameLoop', () => {
  it('경과 시간만큼 고정 틱을 돌리고 프레임마다 render를 1회 부른다', () => {
    const raf = manualRaf();
    const update = vi.fn();
    const render = vi.fn();
    const loop = new GameLoop(
      { update, render },
      { tickMs: 10, requestFrame: raf.requestFrame, cancelFrame: raf.cancelFrame },
    );
    loop.start();
    raf.frame(0);
    expect(update).not.toHaveBeenCalled();
    expect(render).toHaveBeenCalledTimes(1);
    raf.frame(35);
    expect(update).toHaveBeenCalledTimes(3); // 30ms → 3틱, 5ms 남김
    expect(render).toHaveBeenLastCalledWith(0.5, 35);
    raf.frame(40);
    expect(update).toHaveBeenCalledTimes(4);
    loop.stop();
  });

  it('긴 공백은 maxFrameMs로 잘라 폭주하지 않는다', () => {
    const raf = manualRaf();
    const update = vi.fn();
    const loop = new GameLoop(
      { update, render: () => undefined },
      { tickMs: 10, maxFrameMs: 50, requestFrame: raf.requestFrame, cancelFrame: raf.cancelFrame },
    );
    loop.start();
    raf.frame(0);
    raf.frame(10_000);
    expect(update).toHaveBeenCalledTimes(5);
  });

  it('stop 후에는 프레임을 요청하지 않는다', () => {
    const raf = manualRaf();
    const loop = new GameLoop(
      { update: () => undefined, render: () => undefined },
      { requestFrame: raf.requestFrame, cancelFrame: raf.cancelFrame },
    );
    loop.start();
    expect(raf.hasPending).toBe(true);
    loop.stop();
    expect(raf.hasPending).toBe(false);
    expect(loop.isRunning).toBe(false);
  });
});
