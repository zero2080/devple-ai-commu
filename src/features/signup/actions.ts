// 가입 신청 (PRD 5.1, API_CONTRACT 2.1). 사전 검증은 domain/signup(서버와 같은 규칙), 권위는 서버
import { validateSignup, type SignupField } from '@/domain';
import { messageFor, messageForCode, messageForFieldReason } from '@/shared/errorMessages';
import { signup } from '@/transport/api/auth';
import { ApiError } from '@/transport/http';

export type SignupValues = Record<SignupField, string>;
export type FieldMessages = Partial<Record<SignupField, string>>;

export type SubmitResult =
  { ok: true; requestId: string } | { ok: false; fields: FieldMessages; message: string | null };

/** 필드마다 무엇을 고치면 되는지 알려 주는 문구 (사유 어휘 API_CONTRACT 1.3) */
const FIELD_HINTS: Record<SignupField, Partial<Record<string, string>>> = {
  email: {
    required: '이메일을 입력해 주세요.',
    format: '이메일 형식을 확인해 주세요. (예: name@example.com)',
  },
  nickname: {
    required: '닉네임을 입력해 주세요.',
    length: '닉네임은 2~12자로 정해 주세요.',
    invalid: '보이지 않는 문자나 제어 문자는 쓸 수 없어요.',
  },
  phone: {
    required: '연락처를 입력해 주세요.',
    format: '숫자와 하이픈으로 8~20자예요. (예: 010-1234-5678)',
  },
};

const FIELDS: readonly SignupField[] = ['email', 'nickname', 'phone'];

export function fieldMessage(field: SignupField, reason: string): string {
  return FIELD_HINTS[field][reason] ?? messageForFieldReason(reason);
}

function toFieldMessages(reasons: Partial<Record<string, unknown>>): FieldMessages {
  const fields: FieldMessages = {};
  for (const field of FIELDS) {
    const reason = reasons[field];
    if (typeof reason === 'string') {
      fields[field] = fieldMessage(field, reason);
    }
  }
  return fields;
}

/** 앞뒤 공백을 지우고 보낸다. 서버의 필드 사유·중복(409)은 해당 필드 문구로 바꿔 돌려준다 */
export async function submitSignup(values: SignupValues): Promise<SubmitResult> {
  const local = validateSignup(values);
  if (Object.keys(local).length > 0) {
    return { ok: false, fields: toFieldMessages(local), message: null };
  }
  try {
    const { requestId } = await signup({
      email: values.email.trim(),
      nickname: values.nickname.trim(),
      phone: values.phone.trim(),
    });
    return { ok: true, requestId };
  } catch (error) {
    if (error instanceof ApiError) {
      if (error.code === 'NICKNAME_TAKEN') {
        return { ok: false, fields: { nickname: messageForCode('NICKNAME_TAKEN') }, message: null };
      }
      if (error.code === 'EMAIL_TAKEN') {
        return { ok: false, fields: { email: messageForCode('EMAIL_TAKEN') }, message: null };
      }
      const reasons = error.details?.fields;
      if (error.code === 'VALIDATION_FAILED' && typeof reasons === 'object' && reasons !== null) {
        const fields = toFieldMessages(reasons);
        if (Object.keys(fields).length > 0) {
          return { ok: false, fields, message: null };
        }
      }
    }
    return { ok: false, fields: {}, message: messageFor(error) };
  }
}
