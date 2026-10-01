// 아바타 자산 데이터 (GRAPHICS 1.1 palette.json, 2.8 catalog.json). JSON은 여기서만 읽고 zod로 검증한다.
// 합성 계획(render/avatarCompose.ts)과 합성 전 대체 그림의 색(render/avatarPlaceholder.ts)이 쓴다. 시트 이미지는 loader.ts
import { z } from 'zod';

import paletteJson from '@/assets/palette.json';
import catalogJson from '@/assets/sprites/avatar/catalog.json';
import type { EquippedItem, SlotId } from '@/domain';

const hex = z.string().regex(/^#[0-9a-f]{6}$/);
const rampSchema = z.object({ hi: hex, base: hex, shadow: hex });
const paletteSchema = z.object({
  name: z.string(),
  colors: z.array(hex).min(1).max(32),
  ramps: z.record(z.string(), rampSchema),
  rampGroups: z.object({
    skin: z.array(z.string()).min(1),
    hair: z.array(z.string()).min(1),
    item: z.array(z.string()).min(1),
  }),
});
const slotSchema = z.enum(['hair', 'hat', 'face', 'top', 'bottom', 'shoes', 'hand']);
const channelSchema = z.enum(['primary', 'secondary']);
const catalogItemSchema = z.object({
  id: z.string(),
  slot: slotSchema,
  name: z.string(),
  sheets: z.object({ front: z.string(), back: z.string().optional() }),
  channels: z.array(channelSchema),
  defaultColors: z.object({ primary: z.string().optional(), secondary: z.string().optional() }),
  coversBottom: z.literal(true).optional(),
});
const catalogSchema = z.object({
  body: z.object({ front: z.string() }),
  items: z.array(catalogItemSchema),
});

export type ColorRamp = z.infer<typeof rampSchema>;
export type PaletteFile = z.infer<typeof paletteSchema>;
export type CatalogItem = z.infer<typeof catalogItemSchema>;
export type AvatarCatalog = z.infer<typeof catalogSchema>;
export type RampGroup = keyof PaletteFile['rampGroups'];
export type ColorChannel = z.infer<typeof channelSchema>;

export const AVATAR_PALETTE: PaletteFile = paletteSchema.parse(paletteJson);
export const AVATAR_CATALOG: AvatarCatalog = catalogSchema.parse(catalogJson);

const itemsById = new Map(AVATAR_CATALOG.items.map((item) => [item.id, item]));

export function catalogItem(itemId: string): CatalogItem | undefined {
  return itemsById.get(itemId);
}

/** 슬롯의 첫 아이템 (서버 목록에 있는데 카탈로그에 없는 필수 슬롯 아이템의 대체, GRAPHICS 2.8) */
export function firstCatalogItem(slot: SlotId): CatalogItem | undefined {
  return AVATAR_CATALOG.items.find((item) => item.slot === slot);
}

/** rampId의 램프. 없는 id면 그룹의 첫 램프 */
export function rampOf(rampId: string | undefined, group: RampGroup): ColorRamp {
  const fallbackId = AVATAR_PALETTE.rampGroups[group][0] ?? '';
  const ramp =
    (rampId === undefined ? undefined : AVATAR_PALETTE.ramps[rampId]) ??
    AVATAR_PALETTE.ramps[fallbackId];
  if (ramp === undefined) {
    throw new Error(`palette.json: ramp group "${group}" has no ramps`);
  }
  return ramp;
}

/** 아이템 채널 색 (GRAPHICS 2.9): 사용자가 고른 램프 → 아이템 defaultColors → item 그룹 첫 램프 */
export function itemRamp(item: EquippedItem, channel: ColorChannel): ColorRamp {
  return rampOf(item[channel] ?? catalogItem(item.itemId)?.defaultColors[channel], 'item');
}
