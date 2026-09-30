// 운영자 규칙 (PRD 5.9, API_CONTRACT 2.8). 순수 함수 — 서버 검증과 같은 사전 확인 (권위는 서버)

const REJECT_REASON_MAX = 200;

/** 거절 사유: 앞뒤 공백 뺀 1~200 코드 포인트, 필수. 문제없으면 null */
export function rejectReasonError(reason: string): 'length' | null {
  const length = Array.from(reason.trim()).length;
  return length < 1 || length > REJECT_REASON_MAX ? 'length' : null;
}
