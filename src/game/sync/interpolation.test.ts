import { describe, expect, it } from 'vitest';

import type { Presence } from '@/domain';
import { TEST_APPEARANCE } from '@/test/fixtures';

import { RemoteInterpolator } from './interpolation';

function presence(userId: string, x: number, y: number): Presence {
  return {
    userId,
    nickname: userId,
    appearance: TEST_APPEARANCE,
    position: { mapId: 'main', x, y, dir: 'down' },
    state: 'online',
    updatedAt: 1,
  };
}

describe('RemoteInterpolator', () => {
  it('새 캐릭터는 즉시 배치하고 본인은 제외한다', () => {
    const it_ = new RemoteInterpolator(200);
    it_.sync(
      new Map([
        ['me', presence('me', 0, 0)],
        ['a', presence('a', 2, 3)],
      ]),
      0,
      'me',
    );
    expect(it_.size).toBe(1);
    expect(it_.get('a')?.renderPixel).toEqual({ x: 32, y: 48 });
  });

  it('위치가 바뀌면 200ms 동안 선형 보간한다', () => {
    const it_ = new RemoteInterpolator(200);
    it_.sync(new Map([['a', presence('a', 0, 0)]]), 0, null);
    it_.sync(new Map([['a', presence('a', 1, 0)]]), 1000, null);
    it_.update(1100);
    expect(it_.get('a')?.renderPixel).toEqual({ x: 8, y: 0 });
    it_.update(1200);
    expect(it_.get('a')?.renderPixel).toEqual({ x: 16, y: 0 });
    it_.update(1500);
    expect(it_.get('a')?.renderPixel).toEqual({ x: 16, y: 0 });
  });

  it('보간 중 새 목표가 오면 현재 렌더 위치에서 다시 시작한다', () => {
    const it_ = new RemoteInterpolator(200);
    it_.sync(new Map([['a', presence('a', 0, 0)]]), 0, null);
    it_.sync(new Map([['a', presence('a', 2, 0)]]), 1000, null);
    it_.update(1100); // 16px
    it_.sync(new Map([['a', presence('a', 2, 2)]]), 1100, null);
    it_.update(1200); // x: 16→32 절반, y: 0→32 절반
    expect(it_.get('a')?.renderPixel).toEqual({ x: 24, y: 16 });
  });

  it('사라진 캐릭터는 제거한다', () => {
    const it_ = new RemoteInterpolator(200);
    it_.sync(new Map([['a', presence('a', 0, 0)]]), 0, null);
    it_.sync(new Map(), 1, null);
    expect(it_.size).toBe(0);
  });
});
