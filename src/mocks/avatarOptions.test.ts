import { describe, expect, it } from 'vitest';

import { validateAppearance } from '@/domain';
import { AVATAR_CATALOG, AVATAR_PALETTE } from '@/game/assets/avatarAssets';

import { AVATAR_OPTIONS, defaultAppearance, ME_APPEARANCE, seedAppearance } from './data/avatar.ts';
import { FAKE_USERS } from './data/users.ts';

describe('Mock 외형 선택지 (DOMAIN 3.6, GRAPHICS 2.8)', () => {
  it('아이템 목록 = catalog.json, 램프 목록 = palette.json (UI는 서버 목록 ∩ 자산만 보여준다)', () => {
    expect(new Set(AVATAR_OPTIONS.itemIds)).toEqual(new Set(AVATAR_CATALOG.items.map((i) => i.id)));
    expect(AVATAR_OPTIONS.skinRampIds).toEqual(AVATAR_PALETTE.rampGroups.skin);
    expect(AVATAR_OPTIONS.hairRampIds).toEqual(AVATAR_PALETTE.rampGroups.hair);
    expect(AVATAR_OPTIONS.itemRampIds).toEqual(AVATAR_PALETTE.rampGroups.item);
  });

  it('시드·기본·내 외형은 모두 유효하고, 시드 사용자끼리 대부분 다르다', () => {
    for (let i = 0; i < 60; i += 1) {
      expect(validateAppearance(seedAppearance(i), AVATAR_OPTIONS), `seed ${String(i)}`).toEqual(
        {},
      );
    }
    expect(validateAppearance(ME_APPEARANCE, AVATAR_OPTIONS)).toEqual({});
    expect(validateAppearance(defaultAppearance(), AVATAR_OPTIONS)).toEqual({});
    const distinct = new Set(FAKE_USERS.map((u) => JSON.stringify(u.appearance)));
    expect(distinct.size).toBe(FAKE_USERS.length);
  });
});
