import { beforeEach, describe, expect, it, vi } from 'vitest';

import type { Appearance, Me } from '@/domain';
import { signIn } from '@/features/chat/testing';
import { useAuthStore } from '@/store/authStore';
import { TEST_APPEARANCE } from '@/test/fixtures';
import { ApiError, NetworkError } from '@/transport/http';

import { saveAppearance } from './actions';

const api = vi.hoisted(() => ({
  updateMe: vi.fn<(body: { appearance?: Appearance }) => Promise<Me>>(),
}));
vi.mock('@/transport/api/me', () => ({ updateMe: api.updateMe }));

beforeEach(() => {
  api.updateMe.mockReset();
  signIn(); // avatarOptions = TEST_AVATAR_OPTIONS
});

describe('saveAppearance (PATCH /me 전체 교체)', () => {
  it('정규화한 전체 외형을 보내고, 성공하면 authStore.me를 갱신한다', async () => {
    const me = useAuthStore.getState().me;
    if (me === null) throw new Error('signed out');
    const look: Appearance = {
      ...TEST_APPEARANCE,
      hair: { itemId: 'hair_bob', primary: 'item_red' },
    };
    api.updateMe.mockResolvedValue({ ...me, appearance: { ...TEST_APPEARANCE, skin: 'skin_1' } });
    await expect(saveAppearance(look)).resolves.toEqual({ ok: true });
    // hair.primary는 정규화에서 빠진다 (DOMAIN 3.7)
    expect(api.updateMe).toHaveBeenCalledWith({ appearance: TEST_APPEARANCE });
    expect(useAuthStore.getState().me?.appearance).toEqual({ ...TEST_APPEARANCE, skin: 'skin_1' });
  });

  it('서버와 같은 사전 검증에 걸리면 보내지 않고 경로별 문구를 돌려준다', async () => {
    const result = await saveAppearance({
      ...TEST_APPEARANCE,
      skin: 'skin_5', // 목록에 없음
      top: { itemId: 'top_tshirt', primary: 'item_navy' }, // 목록에 없는 램프
    });
    expect(api.updateMe).not.toHaveBeenCalled();
    expect(result).toEqual({
      ok: false,
      fields: {
        'appearance.skin': '지금은 고를 수 없는 항목이에요. 다른 것을 골라 주세요.',
        'appearance.top.primary': '지금은 고를 수 없는 항목이에요. 다른 것을 골라 주세요.',
      },
      message: null,
    });
  });

  it('서버 VALIDATION_FAILED의 appearance 필드는 경로별 문구로, 그 밖의 오류는 공통 문구로', async () => {
    api.updateMe.mockRejectedValueOnce(
      new ApiError(400, 'VALIDATION_FAILED', 'x', {
        fields: {
          'appearance.shoes': 'slot_mismatch',
          'appearance.top': 'required',
          nickname: 'length',
        },
      }),
    );
    expect(await saveAppearance(TEST_APPEARANCE)).toEqual({
      ok: false,
      fields: {
        'appearance.shoes': '이 자리에 둘 수 없는 아이템이에요.',
        'appearance.top': '꼭 골라 주세요.',
      },
      message: null,
    });
    api.updateMe.mockRejectedValueOnce(new NetworkError(new Error('offline')));
    expect(await saveAppearance(TEST_APPEARANCE)).toEqual({
      ok: false,
      fields: {},
      message: '네트워크 연결을 확인해 주세요.',
    });
  });
});
