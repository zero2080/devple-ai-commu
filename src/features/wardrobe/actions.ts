// 옷장 저장 (ROADMAP 12a, API_CONTRACT 2.2 PATCH /me). 사전 검증은 서버와 같은 domain/appearance, 권위는 서버.
// 성공하면 authStore.me를 갱신한다. 월드 캐릭터는 presence.updated로 바뀐다 (ARCHITECTURE 7장)
import { normalizeAppearance, validateAppearance, type Appearance } from '@/domain';
import { messageFor } from '@/shared/errorMessages';
import { useAuthStore } from '@/store/authStore';
import { updateMe } from '@/transport/api/me';
import { ApiError } from '@/transport/http';

/** 'appearance.<경로>' → 그 선택지 옆에 보여줄 문구 */
export type AppearanceFieldMessages = Record<string, string>;

export type SaveResult =
  { ok: true } | { ok: false; fields: AppearanceFieldMessages; message: string | null };

const REASONS: Readonly<Record<string, string>> = {
  required: '꼭 골라 주세요.',
  unknown: '지금은 고를 수 없는 항목이에요. 다른 것을 골라 주세요.',
  slot_mismatch: '이 자리에 둘 수 없는 아이템이에요.',
};

function toMessages(reasons: Record<string, unknown>): AppearanceFieldMessages {
  const fields: AppearanceFieldMessages = {};
  for (const [path, reason] of Object.entries(reasons)) {
    if (path.startsWith('appearance.') && typeof reason === 'string') {
      fields[path] = REASONS[reason] ?? '선택을 확인해 주세요.';
    }
  }
  return fields;
}

/** 전체 교체로 저장한다 (부분 갱신 없음, DOMAIN 3.7) */
export async function saveAppearance(draft: Appearance): Promise<SaveResult> {
  const appearance = normalizeAppearance(draft);
  const options = useAuthStore.getState().config?.avatarOptions;
  if (options !== undefined) {
    const local = validateAppearance(appearance, options);
    if (Object.keys(local).length > 0) {
      return { ok: false, fields: toMessages(local), message: null };
    }
  }
  try {
    const me = await updateMe({ appearance });
    const config = useAuthStore.getState().config;
    if (config !== null) {
      useAuthStore.getState().setMe(me, config);
    }
    return { ok: true };
  } catch (error) {
    if (error instanceof ApiError && error.code === 'VALIDATION_FAILED') {
      const reasons = error.details?.fields;
      if (typeof reasons === 'object' && reasons !== null) {
        const fields = toMessages(reasons as Record<string, unknown>);
        if (Object.keys(fields).length > 0) {
          return { ok: false, fields, message: null };
        }
      }
    }
    return { ok: false, fields: {}, message: messageFor(error) };
  }
}
