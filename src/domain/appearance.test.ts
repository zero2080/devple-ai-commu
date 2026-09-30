import { describe, expect, it } from 'vitest';

import {
  normalizeAppearance,
  REQUIRED_SLOTS,
  SLOT_IDS,
  slotOfItemId,
  validateAppearance,
} from './appearance';
import type { Appearance, AvatarOptions } from './types';

const OPTIONS: AvatarOptions = {
  itemIds: [
    'hair_bob',
    'hat_beanie',
    'face_mask',
    'top_tshirt',
    'top_hoodie',
    'bottom_jeans',
    'shoes_boots',
    'hand_book',
  ],
  skinRampIds: ['skin_1', 'skin_2'],
  hairRampIds: ['hair_black', 'hair_red'],
  itemRampIds: ['item_red', 'item_navy'],
};

const valid = (): Appearance => ({
  skin: 'skin_1',
  hairColor: 'hair_black',
  hair: { itemId: 'hair_bob' },
  hat: null,
  face: null,
  top: { itemId: 'top_tshirt', primary: 'item_red', secondary: 'item_navy' },
  bottom: { itemId: 'bottom_jeans' },
  shoes: { itemId: 'shoes_boots' },
  hand: null,
});

describe('슬롯', () => {
  it('7슬롯, 필수는 top·bottom·shoes', () => {
    expect(SLOT_IDS).toEqual(['hair', 'hat', 'face', 'top', 'bottom', 'shoes', 'hand']);
    expect(REQUIRED_SLOTS).toEqual(['top', 'bottom', 'shoes']);
  });

  it('itemId 접두사로 슬롯을 판별한다 (GRAPHICS 2.8)', () => {
    expect(slotOfItemId('hat_beanie')).toBe('hat');
    expect(slotOfItemId('top_round_neck')).toBe('top');
    expect(slotOfItemId('body_base')).toBeNull();
    expect(slotOfItemId('hat')).toBeNull();
    expect(slotOfItemId('')).toBeNull();
  });
});

describe('validateAppearance (API_CONTRACT 2.2)', () => {
  it('유효하면 빈 객체', () => {
    expect(validateAppearance(valid(), OPTIONS)).toEqual({});
    expect(validateAppearance({ ...valid(), hand: { itemId: 'hand_book' } }, OPTIONS)).toEqual({});
  });

  it('키 누락·필수 슬롯 null은 required, 선택 슬롯 null은 허용', () => {
    const missingHat: Record<string, unknown> = { ...valid(), top: null, skin: undefined };
    delete missingHat.hat;
    expect(validateAppearance(missingHat, OPTIONS)).toEqual({
      'appearance.hat': 'required',
      'appearance.top': 'required',
      'appearance.skin': 'required',
    });
  });

  it('객체가 아니면 모든 키가 required', () => {
    const errors = validateAppearance('char_01', OPTIONS);
    expect(Object.keys(errors)).toHaveLength(9);
    expect(new Set(Object.values(errors))).toEqual(new Set(['required']));
    expect(Object.keys(validateAppearance(null, OPTIONS))).toHaveLength(9);
  });

  it('목록에 없는 아이템은 unknown, 접두사가 다르면 slot_mismatch (접두사 먼저)', () => {
    expect(
      validateAppearance(
        {
          ...valid(),
          hat: { itemId: 'hat_crown' },
          top: { itemId: 'bottom_jeans' },
          face: { itemId: 42 },
        },
        OPTIONS,
      ),
    ).toEqual({
      'appearance.hat': 'unknown',
      'appearance.top': 'slot_mismatch',
      'appearance.face': 'unknown',
    });
  });

  it('램프는 그룹별 목록에서만 — 피부·머리색·아이템 색 경로로 알린다', () => {
    expect(
      validateAppearance(
        {
          ...valid(),
          skin: 'hair_black',
          hairColor: 'hair_pink',
          top: { itemId: 'top_tshirt', primary: 'skin_1', secondary: 7 },
        },
        OPTIONS,
      ),
    ).toEqual({
      'appearance.skin': 'unknown',
      'appearance.hairColor': 'unknown',
      'appearance.top.primary': 'unknown',
      'appearance.top.secondary': 'unknown',
    });
  });

  it('hair.primary는 오류가 아니다 (서버가 버림, DOMAIN 3.7)', () => {
    expect(
      validateAppearance({ ...valid(), hair: { itemId: 'hair_bob', primary: 'nope' } }, OPTIONS),
    ).toEqual({});
  });
});

describe('normalizeAppearance', () => {
  it('hair.primary와 비어 있는 색 키를 버리고 키 순서를 고정한다', () => {
    const input = {
      hand: null,
      shoes: { itemId: 'shoes_boots', primary: undefined },
      bottom: { itemId: 'bottom_jeans' },
      top: { secondary: 'item_navy', itemId: 'top_tshirt' },
      face: null,
      hat: null,
      hair: { itemId: 'hair_bob', primary: 'item_red', secondary: 'item_red' },
      hairColor: 'hair_black',
      skin: 'skin_1',
      extra: 'x',
    } as unknown as Appearance;
    const normalized = normalizeAppearance(input);
    expect(normalized).toEqual({
      skin: 'skin_1',
      hairColor: 'hair_black',
      hair: { itemId: 'hair_bob', secondary: 'item_red' },
      hat: null,
      face: null,
      top: { itemId: 'top_tshirt', secondary: 'item_navy' },
      bottom: { itemId: 'bottom_jeans' },
      shoes: { itemId: 'shoes_boots' },
      hand: null,
    });
    expect(Object.keys(normalized)).toEqual(['skin', 'hairColor', ...SLOT_IDS]);
    expect(JSON.stringify(normalizeAppearance(normalized))).toBe(JSON.stringify(normalized));
  });
});
