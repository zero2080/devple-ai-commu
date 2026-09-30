import { describe, expect, it } from 'vitest';

import { rejectReasonError } from './admin';

describe('rejectReasonError (API_CONTRACT 2.8: 거절 사유 1~200자 필수)', () => {
  it('앞뒤 공백을 뺀 코드 포인트로 1~200', () => {
    expect(rejectReasonError('')).toBe('length');
    expect(rejectReasonError('   ')).toBe('length');
    expect(rejectReasonError('가')).toBeNull();
    expect(rejectReasonError('가'.repeat(200))).toBeNull();
    expect(rejectReasonError(`  ${'가'.repeat(200)}  `)).toBeNull();
    expect(rejectReasonError('가'.repeat(201))).toBe('length');
    expect(rejectReasonError('🙂'.repeat(200))).toBeNull(); // 이모지 1개 = 코드 포인트 1개
  });
});
