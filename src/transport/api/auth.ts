// API_CONTRACT 2.1 가입 · 인증. 함수 하나 = 엔드포인트 하나
import type { AccessKeyLogin, AuthSession } from '@/domain';

import { refreshAccessToken, request } from '../http';
import {
  authSessionSchema,
  signupResponseSchema,
  signupStatusResponseSchema,
  sseTicketResponseSchema,
} from '../schemas';
import { ENDPOINTS } from './endpoints';

export interface SignupBody {
  email: string;
  nickname: string;
  phone: string;
}

export interface SignupResponse {
  requestId: string;
  status: 'pending' | 'approved' | 'rejected';
}

export interface SignupStatusResponse {
  status: 'pending' | 'approved' | 'rejected';
  rejectReason?: string;
}

export interface SseTicketResponse {
  ticket: string;
  expiresIn: number;
}

/** POST /signup → 201 */
export function signup(body: SignupBody): Promise<SignupResponse> {
  return request({ ...ENDPOINTS.signup, body, auth: false }, signupResponseSchema);
}

/** GET /signup/{requestId} */
export function getSignupStatus(requestId: string): Promise<SignupStatusResponse> {
  return request(
    { ...ENDPOINTS.signupStatus, params: { requestId }, auth: false },
    signupStatusResponseSchema,
  );
}

/** POST /auth/login → accessToken + me + config (+ refresh 쿠키) */
export function login(body: AccessKeyLogin): Promise<AuthSession> {
  return request({ ...ENDPOINTS.login, body, auth: false, credentials: true }, authSessionSchema);
}

/** POST /auth/refresh. 단일 진행 구현은 http.ts에 있다 */
export function refresh(): Promise<string> {
  return refreshAccessToken();
}

/** POST /auth/logout → refresh 무효화 */
export function logout(): Promise<void> {
  return request({ ...ENDPOINTS.logout, credentials: true });
}

/** POST /sse/ticket → 30초 유효 1회용 티켓 */
export function createSseTicket(): Promise<SseTicketResponse> {
  return request({ ...ENDPOINTS.sseTicket }, sseTicketResponseSchema);
}
