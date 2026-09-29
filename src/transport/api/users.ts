// API_CONTRACT 2.3 사용자 조회
import { z } from 'zod';

import type { UserProfile } from '@/domain';

import { request } from '../http';
import { userProfileSchema } from '../schemas';
import { ENDPOINTS } from './endpoints';

const searchUsersResponseSchema = z.object({ items: z.array(userProfileSchema) });

/** GET /users/{userId} → 프로필 카드 */
export function getUserProfile(userId: string): Promise<UserProfile> {
  return request({ ...ENDPOINTS.userProfile, params: { userId } }, userProfileSchema);
}

/** GET /users?nickname= → 부분 일치, 최대 20건, 본인 제외 (페이지네이션 없음) */
export function searchUsers(nickname: string): Promise<{ items: UserProfile[] }> {
  return request({ ...ENDPOINTS.searchUsers, query: { nickname } }, searchUsersResponseSchema);
}
