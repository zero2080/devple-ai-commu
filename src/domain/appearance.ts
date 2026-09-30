// 캐릭터 외형 규칙 (DOMAIN 3.7, API_CONTRACT 2.2 PATCH /me). 순수 함수 — 서버 검증과 같은 판정을
// Mock 서버와 옷장 UI(사전 검증)가 함께 쓴다
import type { Appearance, AvatarOptions, EquippedItem, SlotId } from './types';

export const SLOT_IDS: readonly SlotId[] = [
  'hair',
  'hat',
  'face',
  'top',
  'bottom',
  'shoes',
  'hand',
];
export const REQUIRED_SLOTS: readonly SlotId[] = ['top', 'bottom', 'shoes'];

export type AppearanceFieldError = 'required' | 'unknown' | 'slot_mismatch';

function isSlotId(value: string): value is SlotId {
  return (SLOT_IDS as readonly string[]).includes(value);
}

/** 'hat_beanie' → 'hat' (GRAPHICS 2.8 아이템 ID 접두사 = 슬롯). 슬롯이 아니면 null */
export function slotOfItemId(itemId: string): SlotId | null {
  const underscore = itemId.indexOf('_');
  if (underscore <= 0) {
    return null;
  }
  const prefix = itemId.slice(0, underscore);
  return isSlotId(prefix) ? prefix : null;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

/**
 * API_CONTRACT 2.2 검증 표와 같은 판정. 문제없으면 빈 객체, 있으면 `appearance.<경로>` → 이유.
 * 키 누락·필수 슬롯 null → required, 접두사 ≠ 슬롯 → slot_mismatch, 목록에 없는 아이템·램프 → unknown.
 * hair.primary는 판정하지 않는다 (서버가 버린다)
 */
export function validateAppearance(
  value: unknown,
  options: AvatarOptions,
): Record<string, AppearanceFieldError> {
  const errors: Record<string, AppearanceFieldError> = {};
  const input = isRecord(value) ? value : {};

  const ramp = (key: 'skin' | 'hairColor', allowed: readonly string[]): void => {
    const id = input[key];
    if (id === undefined || id === null) {
      errors[`appearance.${key}`] = 'required';
    } else if (typeof id !== 'string' || !allowed.includes(id)) {
      errors[`appearance.${key}`] = 'unknown';
    }
  };
  ramp('skin', options.skinRampIds);
  ramp('hairColor', options.hairRampIds);

  for (const slot of SLOT_IDS) {
    const path = `appearance.${slot}`;
    if (!(slot in input) || input[slot] === undefined) {
      errors[path] = 'required';
      continue;
    }
    const item = input[slot];
    if (item === null) {
      if (REQUIRED_SLOTS.includes(slot)) {
        errors[path] = 'required';
      }
      continue;
    }
    if (!isRecord(item) || typeof item.itemId !== 'string') {
      errors[path] = 'unknown';
      continue;
    }
    if (slotOfItemId(item.itemId) !== slot) {
      errors[path] = 'slot_mismatch';
    } else if (!options.itemIds.includes(item.itemId)) {
      errors[path] = 'unknown';
    }
    for (const channel of ['primary', 'secondary'] as const) {
      if (slot === 'hair' && channel === 'primary') {
        continue;
      }
      const id = item[channel];
      if (id !== undefined && (typeof id !== 'string' || !options.itemRampIds.includes(id))) {
        errors[`${path}.${channel}`] = 'unknown';
      }
    }
  }
  return errors;
}

function normalizeItem(item: EquippedItem, slot: SlotId): EquippedItem {
  const primary = slot === 'hair' ? undefined : item.primary;
  return {
    itemId: item.itemId,
    ...(primary === undefined ? {} : { primary }),
    ...(item.secondary === undefined ? {} : { secondary: item.secondary }),
  };
}

/** 저장·비교용 정규형: 키 순서 고정, hair.primary와 비어 있는 색 키 제거, 알 수 없는 키 제거 */
export function normalizeAppearance(appearance: Appearance): Appearance {
  const optional = (slot: SlotId, item: EquippedItem | null): EquippedItem | null =>
    item === null ? null : normalizeItem(item, slot);
  return {
    skin: appearance.skin,
    hairColor: appearance.hairColor,
    hair: optional('hair', appearance.hair),
    hat: optional('hat', appearance.hat),
    face: optional('face', appearance.face),
    top: normalizeItem(appearance.top, 'top'),
    bottom: normalizeItem(appearance.bottom, 'bottom'),
    shoes: normalizeItem(appearance.shoes, 'shoes'),
    hand: optional('hand', appearance.hand),
  };
}
