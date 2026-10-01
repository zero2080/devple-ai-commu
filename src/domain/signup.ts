// 가입 신청·닉네임 규칙 (PRD 5.1, DOMAIN 8장, API_CONTRACT 2.1). 순수 함수 — Mock 서버와 신청 화면이 함께 쓴다

const NICKNAME_MIN = 2;
const NICKNAME_MAX = 12;
// 제어·비가시 문자 (DOMAIN 5.1 집합). 닉네임은 한 줄이므로 줄바꿈도 막는다 (to-chat 확인 요청)
// eslint-disable-next-line no-control-regex -- 제어 문자 검출이 목적
const CONTROL_OR_INVISIBLE = /[\u0000-\u001F\u007F\u200B-\u200F]/;
const EMAIL = /^[^@\s]+@[^@\s.]+(\.[^@\s.]+)+$/;
const PHONE = /^[0-9-]{8,20}$/;

export type SignupField = 'email' | 'nickname' | 'phone';
/** API_CONTRACT 1.3 details.fields 사유 어휘 중 가입에 쓰는 것 */
export type SignupFieldReason = 'required' | 'length' | 'format' | 'invalid';
export type SignupFieldErrors = Partial<Record<SignupField, SignupFieldReason>>;

/** 앞뒤 공백 뺀 코드 포인트 2~12, 제어·비가시 문자 불가. 문제없으면 null */
export function nicknameError(nickname: string): 'length' | 'invalid' | null {
  const trimmed = nickname.trim();
  if (CONTROL_OR_INVISIBLE.test(trimmed)) {
    return 'invalid';
  }
  const length = Array.from(trimmed).length;
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
