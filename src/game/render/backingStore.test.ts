import { describe, expect, it } from 'vitest';

import { backingStoreSize, normalizeDpr } from './backingStore';

describe('backingStoreSize', () => {
  it('CSS px에 DPR을 곱해 반올림한다', () => {
    expect(backingStoreSize(640, 480, 2)).toEqual({ width: 1280, height: 960, dpr: 2 });
    expect(backingStoreSize(641, 480, 1.5)).toEqual({ width: 962, height: 720, dpr: 1.5 });
  });

  it('비정상 DPR은 1로 취급하고 0 크기는 1로 올린다', () => {
    expect(normalizeDpr(0)).toBe(1);
    expect(normalizeDpr(Number.NaN)).toBe(1);
    expect(backingStoreSize(0, 0, -1)).toEqual({ width: 1, height: 1, dpr: 1 });
  });
});
