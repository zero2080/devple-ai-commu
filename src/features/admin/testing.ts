// 운영자 콘솔 테스트 데이터
import type { Me, SignupRequest } from '@/domain';
import { TEST_APPEARANCE } from '@/test/fixtures';

export const signup = (
  id: string,
  nickname: string,
  status: SignupRequest['status'] = 'pending',
  rejectReason?: string,
): SignupRequest => ({
  id,
  email: `${id}@example.com`,
  nickname,
  phone: '010-1234-5678',
  status,
  createdAt: 1_727_600_000_000,
  ...(rejectReason === undefined ? {} : { rejectReason }),
});

export const adminUser = (
  id: string,
  nickname: string,
  extra: Partial<Pick<Me, 'role' | 'status'>> = {},
): Me => ({
  id,
  nickname,
  appearance: TEST_APPEARANCE,
  role: 'member',
  status: 'active',
  createdAt: 1,
  email: `${id}@example.com`,
  phone: '010-0000-0000',
  ...extra,
});
