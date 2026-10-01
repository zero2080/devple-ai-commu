// 옷장 선택지와 편집 (ROADMAP 12a, GRAPHICS 2.7·2.8, ARCHITECTURE 7장). 선택지 = 서버 avatarOptions ∩ catalog.json·palette.json.
// 서버 목록의 순서를 그대로 쓴다 (DOMAIN 3.6 — 선택 UI 순서). 색은 프리셋 램프만
import {
  REQUIRED_SLOTS,
  SLOT_IDS,
  slotOfItemId,
  type Appearance,
  type AvatarOptions,
  type EquippedItem,
  type SlotId,
} from '@/domain';
import {
  AVATAR_PALETTE,
  catalogItem,
  type CatalogItem,
  type ColorChannel,
  type ColorRamp,
  type RampGroup,
} from '@/game';

export interface RampChoice {
  id: string;
  label: string;
  ramp: ColorRamp;
}

export interface WardrobeChoices {
  skins: RampChoice[];
  hairColors: RampChoice[];
  itemColors: RampChoice[];
  items: Record<SlotId, CatalogItem[]>;
}

export const SLOT_LABELS: Readonly<Record<SlotId, string>> = {
  hair: '머리',
  hat: '모자',
  face: '얼굴',
  top: '상의',
  bottom: '하의',
  shoes: '신발',
  hand: '손',
};

export const CHANNEL_LABELS: Readonly<Record<ColorChannel, string>> = {
  primary: '주색',
  secondary: '보조색',
};

/** 램프 표시 이름은 화면 문구로 코드에 둔다 (palette.json은 계약 자산이라 바꾸지 않는다, ROADMAP 12a) */
const RAMP_LABELS: Readonly<Record<string, string>> = {
  skin_1: '피부 1',
  skin_2: '피부 2',
  skin_3: '피부 3',
  skin_4: '피부 4',
  skin_5: '피부 5',
  hair_black: '검정',
  hair_brown: '갈색',
  hair_blonde: '금발',
  hair_ginger: '주황',
  hair_red: '빨강',
  hair_pink: '분홍',
  hair_blue: '파랑',
  hair_green: '초록',
  hair_gray: '회색',
  hair_white: '흰색',
  item_red: '빨강',
  item_orange: '주황',
  item_yellow: '노랑',
  item_green: '초록',
  item_forest: '숲색',
  item_cyan: '하늘',
  item_navy: '남색',
  item_purple: '보라',
  item_pink: '분홍',
  item_brown: '갈색',
  item_tan: '황갈',
  item_beige: '베이지',
  item_white: '흰색',
  item_gray: '회색',
  item_charcoal: '먹색',
  item_black: '검정',
};

export function rampLabel(id: string): string {
  return RAMP_LABELS[id] ?? id;
}

function ramps(ids: readonly string[], group: RampGroup): RampChoice[] {
  const inGroup = new Set(AVATAR_PALETTE.rampGroups[group]);
  return ids.flatMap((id) => {
    const ramp = AVATAR_PALETTE.ramps[id];
    return ramp !== undefined && inGroup.has(id) ? [{ id, label: rampLabel(id), ramp }] : [];
  });
}

export function wardrobeChoices(options: AvatarOptions): WardrobeChoices {
  const items = Object.fromEntries(SLOT_IDS.map((slot) => [slot, [] as CatalogItem[]])) as Record<
    SlotId,
    CatalogItem[]
  >;
  for (const itemId of options.itemIds) {
    const item = catalogItem(itemId);
    const slot = slotOfItemId(itemId);
    if (item !== undefined && slot !== null && item.slot === slot) {
      items[slot].push(item);
    }
  }
  return {
    skins: ramps(options.skinRampIds, 'skin'),
    hairColors: ramps(options.hairRampIds, 'hair'),
    itemColors: ramps(options.itemRampIds, 'item'),
    items,
  };
}

export function isRequiredSlot(slot: SlotId): boolean {
  return REQUIRED_SLOTS.includes(slot);
}

/** 편집할 수 있는 색 채널 = 카탈로그 channels (hair의 primary는 머리색이 대신한다) */
export function editableChannels(slot: SlotId, itemId: string): ColorChannel[] {
  const channels = catalogItem(itemId)?.channels ?? [];
  return slot === 'hair' ? channels.filter((channel) => channel === 'secondary') : channels;
}

/** 지금 그려지는 채널 색 (GRAPHICS 2.9 — 합성과 같은 순서): 고른 램프 → 아이템 defaultColors → item 그룹 첫 램프 */
export function shownColor(item: EquippedItem, channel: ColorChannel): string | null {
  return (
    item[channel] ??
    catalogItem(item.itemId)?.defaultColors[channel] ??
    AVATAR_PALETTE.rampGroups.item[0] ??
    null
  );
}

/** 아이템 바꾸기. 새 아이템에도 있는 채널만 고른 색을 이어 쓴다. null = 빼기 (선택 슬롯만) */
export function withItem(draft: Appearance, slot: SlotId, itemId: string | null): Appearance {
  if (itemId === null) {
    return isRequiredSlot(slot) ? draft : { ...draft, [slot]: null };
  }
  const previous = draft[slot];
  const next: EquippedItem = { itemId };
  for (const channel of editableChannels(slot, itemId)) {
    const color = previous?.[channel];
    if (color !== undefined) {
      next[channel] = color;
    }
  }
  return { ...draft, [slot]: next };
}

export function withColor(
  draft: Appearance,
  slot: SlotId,
  channel: ColorChannel,
  rampId: string,
): Appearance {
  const item = draft[slot];
  return item === null ? draft : { ...draft, [slot]: { ...item, [channel]: rampId } };
}
