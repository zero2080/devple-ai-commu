// 스크립트용 자산 JSON 읽기 (src/assets — 계약 자산 원본, API_CONTRACT 9장)
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

export const ASSETS_DIR = join(import.meta.dirname, '../../src/assets');
export const AVATAR_DIR = join(ASSETS_DIR, 'sprites/avatar');

export type SlotId = 'hair' | 'hat' | 'face' | 'top' | 'bottom' | 'shoes' | 'hand';

/** catalog.json 항목 (GRAPHICS 2.8). 런타임은 game/assets/avatarAssets.ts가 zod로 검증하고, 스크립트는 이 타입으로 읽는다 */
export interface CatalogItem {
  id: string;
  slot: SlotId;
  name: string;
  sheets: { front: string; back?: string };
  channels: ('primary' | 'secondary')[];
  defaultColors: { primary?: string; secondary?: string };
  coversBottom?: true;
}

export interface CatalogFile {
  body: { front: string };
  items: CatalogItem[];
}

export interface PaletteFileLike {
  colors: string[];
}

export function readCatalog(): CatalogFile {
  return JSON.parse(readFileSync(join(AVATAR_DIR, 'catalog.json'), 'utf8')) as CatalogFile;
}

export function readPalette(): PaletteFileLike {
  return JSON.parse(readFileSync(join(ASSETS_DIR, 'palette.json'), 'utf8')) as PaletteFileLike;
}
