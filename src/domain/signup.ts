// 가입 신청·닉네임 규칙 (PRD 5.1, DOMAIN 8장, API_CONTRACT 2.1). 순수 함수 — Mock 서버와 신청 화면이 함께 쓴다
import { hasForbiddenNicknameChar, nfcLength } from './text';

const NICKNAME_MIN = 2;
const NICKNAME_MAX = 12;
const EMAIL = /^[^@\s]+@[^@\s.]+(\.[^@\s.]+)+$/;
const PHONE = /^[0-9-]{8,20}$/;

export type SignupField = 'email' | 'nickname' | 'phone';
/** API_CONTRACT 1.3 details.fields 사유 어휘 중 가입에 쓰는 것 */
export type SignupFieldReason = 'required' | 'length' | 'format' | 'invalid';
export type SignupFieldErrors = Partial<Record<SignupField, SignupFieldReason>>;

/** 앞뒤 공백 뺀 NFC 값의 코드 포인트 2~12, 닉네임 금지 문자(DOMAIN 2.3 8장 — 내용 금지 집합 + 줄바꿈 + ZWJ) 불가. 문제없으면 null */
export function nicknameError(nickname: string): 'length' | 'invalid' | null {
  const trimmed = nickname.trim();
  if (hasForbiddenNicknameChar(trimmed)) {
    return 'invalid';
  }
  const length = nfcLength(trimmed);
  return length < NICKNAME_MIN || length > NICKNAME_MAX ? 'length' : null;
}

/** 닉네임 유일성 비교 키: 앞뒤 공백 제거 + NFC + 대소문자 무시 (`Dot`과 `dot`은 같다) */
export function nicknameKey(nickname: string): string {
  return nickname.trim().normalize('NFC').toLowerCase();
}

export function emailError(email: string): 'format' | null {
  return EMAIL.test(email.trim()) ? null : 'format';
}

/** 숫자·하이픈 8~20자 */
export function phoneError(phone: string): 'format' | null {
  return PHONE.test(phone.trim()) ? null : 'format';
}

/** 가입 신청 사전 검증 (서버와 같은 판정, 권위는 서버). 비어 있으면 required */
export function validateSignup(input: Record<SignupField, string>): SignupFieldErrors {
  const errors: SignupFieldErrors = {};
  const check = (field: SignupField, rule: (value: string) => SignupFieldReason | null): void => {
    const value = input[field];
    if (value.trim() === '') {
      errors[field] = 'required';
      return;
    }
    const reason = rule(value);
    if (reason !== null) {
      errors[field] = reason;
    }
  };
  check('email', emailError);
  check('nickname', nicknameError);
  check('phone', phoneError);
  return errors;
}
