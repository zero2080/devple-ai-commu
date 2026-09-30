// API_CONTRACT 2.8 운영자 (role: 'admin' 전용)
import { z } from 'zod';

import type { Me, Notice, SignupRequest, SignupStatus, UserStatus } from '@/domain';

import { request } from '../http';
import { meSchema, noticeSchema, paginated, signupRequestSchema } from '../schemas';
import type { Page } from './dm';
import { ENDPOINTS } from './endpoints';

const signupsPage = paginated(signupRequestSchema);
const adminUsersPage = paginated(meSchema);
const approveResponseSchema = z.object({ userId: z.string() });

/** GET /admin/signups?status=pending */
export function fetchSignups(
  query: { status?: SignupStatus; cursor?: string } = {},
): Promise<Page<SignupRequest>> {
  return request({ ...ENDPOINTS.adminSignups, query }, signupsPage);
}

/** POST /admin/signups/{id}/approve → { userId } / 409 SIGNUP_ALREADY_REVIEWED */
export function approveSignup(id: string): Promise<{ userId: string }> {
  return request({ ...ENDPOINTS.approveSignup, params: { id } }, approveResponseSchema);
}

/** POST /admin/signups/{id}/reject { reason } */
export function rejectSignup(id: string, reason: string): Promise<void> {
  return request({ ...ENDPOINTS.rejectSignup, params: { id }, body: { reason } });
}

/** GET /admin/users?status=&cursor= → Me[] (email/phone 포함) */
export function fetchAdminUsers(
  query: { status?: UserStatus; cursor?: string } = {},
): Promise<Page<Me>> {
  return request({ ...ENDPOINTS.adminUsers, query }, adminUsersPage);
}

/** POST /admin/users/{id}/suspend → SSE 강제 종료 */
export function suspendUser(id: string): Promise<void> {
  return request({ ...ENDPOINTS.suspendUser, params: { id } });
}

/** POST /admin/users/{id}/unsuspend */
export function unsuspendUser(id: string): Promise<void> {
  return request({ ...ENDPOINTS.unsuspendUser, params: { id } });
}

/** POST /admin/users/{id}/reissue-key → 204. 기존 키·Refresh 무효, 새 키 이메일 */
export function reissueAccessKey(id: string): Promise<void> {
  return request({ ...ENDPOINTS.reissueAccessKey, params: { id } });
}

/** POST /admin/notices { content } → 201 Notice, 접속자 전원에게 system.notice */
export function postNotice(content: string): Promise<Notice> {
  return request({ ...ENDPOINTS.postNotice, body: { content } }, noticeSchema);
}
