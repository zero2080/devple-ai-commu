// ApiError.code → 사용자 문구 (CONVENTIONS 7장). 서버 message를 그대로 노출하지 않는다.
import { ApiError, NetworkError } from '@/transport/http';

const MESSAGES: Record<string, string> = {
  AUTH_INVALID_KEY: '접근 키가 올바르지 않아요.',
  AUTH_REQUIRED: '세션이 만료됐어요. 다시 로그인해 주세요.',
  USER_SUSPENDED: '정지된 계정이에요. 운영자에게 문의해 주세요.',
  FORBIDDEN: '권한이 없어요.',
  NOT_FOUND: '대상을 찾을 수 없어요.',
  VALIDATION_FAILED: '입력값을 확인해 주세요.',
  MESSAGE_INVALID_CONTENT: '보낼 수 없는 내용이에요.',
  NICKNAME_TAKEN: '이미 사용 중인 닉네임이에요.',
  GROUP_FULL: '그룹 인원이 가득 찼어요.',
  SIGNUP_ALREADY_REVIEWED: '이미 처리된 신청이에요.',
  MESSAGE_ALREADY_READ: '상대가 이미 읽어서 회수할 수 없어요.',
  RATE_LIMITED: '요청이 너무 많아요. 잠시 후 다시 시도해 주세요.',
  INTERNAL: '서버 오류가 발생했어요.',
  NETWORK: '네트워크 연결을 확인해 주세요.',
};

export function messageFor(error: unknown): string {
  if (error instanceof ApiError) {
    return MESSAGES[error.code] ?? '요청을 처리하지 못했어요.';
  }
  if (error instanceof NetworkError) {
    return '네트워크 연결을 확인해 주세요.';
  }
  return '알 수 없는 오류가 발생했어요.';
}

/** 이미 코드만 남은 경우 (예: 실패한 전송 항목의 errorCode) */
export function messageForCode(code: string | undefined): string {
  return (code === undefined ? undefined : MESSAGES[code]) ?? '요청을 처리하지 못했어요.';
}
