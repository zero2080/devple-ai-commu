// 운영자 동작 (PRD 5.9, API_CONTRACT 2.8). 성공하면 영향받는 목록을 다시 받는다 (ARCHITECTURE 7장)
import { rejectReasonError } from '@/domain';
import { messageFor } from '@/shared/errorMessages';
import { queryClient } from '@/store/queryClient';
import { queryKeys } from '@/store/queryKeys';
import {
  approveSignup,
  postNotice,
  reissueAccessKey,
  rejectSignup,
  suspendUser,
  unsuspendUser,
} from '@/transport/api/admin';
import { ApiError } from '@/transport/http';

/** 실패하면 사용자 문구, 성공하면 null */
export type ActionResult = string | null;

async function run(
  action: () => Promise<unknown>,
  refresh: readonly (readonly string[])[],
): Promise<ActionResult> {
  try {
    await action();
    return null;
  } catch (error) {
    return messageFor(error);
  } finally {
    // 409(이미 처리됨)여도 화면이 서버와 어긋나 있으므로 다시 받는다
    for (const queryKey of refresh) {
      void queryClient.invalidateQueries({ queryKey });
    }
  }
}

const SIGNUPS = queryKeys.adminSignupLists();
const USERS = queryKeys.adminUserLists();

export function approve(signupId: string): Promise<ActionResult> {
  return run(() => approveSignup(signupId), [SIGNUPS, USERS]);
}

export async function reject(signupId: string, reason: string): Promise<ActionResult> {
  if (rejectReasonError(reason) !== null) {
    return '거절 사유를 1~200자로 적어 주세요.';
  }
  return run(() => rejectSignup(signupId, reason.trim()), [SIGNUPS]);
}

export function suspend(userId: string): Promise<ActionResult> {
  return run(() => suspendUser(userId), [USERS]);
}

export function unsuspend(userId: string): Promise<ActionResult> {
  return run(() => unsuspendUser(userId), [USERS]);
}

export function reissueKey(userId: string): Promise<ActionResult> {
  return run(() => reissueAccessKey(userId), []);
}

/** 공지 발송. 배너는 모두에게 오는 system.notice로 뜬다 (보낸 운영자 포함) */
export async function sendNotice(content: string): Promise<ActionResult> {
  try {
    await postNotice(content);
    return null;
  } catch (error) {
    return error instanceof ApiError && error.code === 'MESSAGE_INVALID_CONTENT'
      ? '보낼 수 없는 내용이에요. 제어 문자나 길이를 확인해 주세요.'
      : messageFor(error);
  }
}
