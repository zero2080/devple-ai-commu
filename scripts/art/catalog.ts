// 스크립트용 자산 JSON 읽기 (src/assets — 계약 자산 원본, API_CONTRACT 9장)
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import type { CatalogItemLike } from './placeholders.ts';

export const ASSETS_DIR = join(import.meta.dirname, '../../src/assets');
export const AVATAR_DIR = join(ASSETS_DIR, 'sprites/avatar');

export interface CatalogFile {
  body: { front: string };
  items: (CatalogItemLike & { name: string })[];
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
