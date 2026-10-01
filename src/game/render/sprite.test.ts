import { describe, expect, it, vi } from 'vitest';

import { advanceWalk, createWalkState, drawAvatarFrame, rowOf, WALK_FRAME_MS } from './sprite';

describe('걷기 프레임 (GRAPHICS 2.3)', () => {
  it('이동 중에는 1→2→3→0을 75ms씩 순환한다', () => {
    const walk = createWalkState();
    const frames = [0, 74, 75, 150, 225, 300, 375].map((t) => advanceWalk(walk, true, 1000 + t));
    expect(frames).toEqual([1, 1, 2, 3, 0, 1, 2]);
  });

  it('멈추면 0. 다시 걸으면 1부터', () => {
    const walk = createWalkState();
    expect(advanceWalk(walk, false, 0)).toBe(0);
    advanceWalk(walk, true, 100);
    expect(advanceWalk(walk, true, 260)).toBe(3);
    advanceWalk(walk, false, 300); // 멈춤 시작
    expect(advanceWalk(walk, false, 300 + WALK_FRAME_MS + 1)).toBe(0);
    expect(advanceWalk(walk, true, 1000)).toBe(1);
    // 멈춘 뒤 프레임이 한동안 오지 않았다가 다시 걸어도 1부터
    advanceWalk(walk, false, 1100);
    expect(advanceWalk(walk, true, 2000)).toBe(1);
  });

  it('75ms 이하의 짧은 정지(타일·보간 구간 경계)는 주기를 끊지 않는다', () => {
    const walk = createWalkState();
    advanceWalk(walk, true, 0);
    advanceWalk(walk, true, 140);
    expect(advanceWalk(walk, false, 160)).toBe(3); // 아직 걷는 중으로 본다
    expect(advanceWalk(walk, true, 200)).toBe(3); // 처음부터가 아니라 이어서
    expect(advanceWalk(walk, true, 230)).toBe(0);
  });
});

describe('프레임 자르기 (GRAPHICS 2.4)', () => {
  it('행 = down·left·right·up, (frame×24, row×40)에서 24×40을 1x로', () => {
    expect(['down', 'left', 'right', 'up'].map((d) => rowOf(d as 'down'))).toEqual([0, 1, 2, 3]);
    const drawImage = vi.fn();
    const ctx = { drawImage } as unknown as CanvasRenderingContext2D;
    const sheet = {} as CanvasImageSource;
    drawAvatarFrame(ctx, sheet, 'right', 3, 10, 20);
    expect(drawImage).toHaveBeenCalledWith(sheet, 72, 80, 24, 40, 10, 20, 24, 40);
  });
});
