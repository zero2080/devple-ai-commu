// 타일셋 빌드 (ROADMAP 12b-4): art/source/tiles/<id>.tiles → src/assets/tilesets/<id>.png + <id>.tileset.json
import { mkdirSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join, relative } from 'node:path';

import { ART_DIR } from './build.ts';
import { ASSETS_DIR, readPalette } from './catalog.ts';
import { glyphColors, KEY_GLYPHS, PixError } from './pix.ts';
import { parseTiles, renderTileset, tilesetJson } from './tiles.ts';

export const TILE_SOURCE_DIR = join(ART_DIR, 'source/tiles');
export const TILESET_DIR = join(ASSETS_DIR, 'tilesets');

/** 타일에 쓸 수 있는 글자 → 색: 팔레트 코드 + 외곽선 (키 색 금지, GRAPHICS 3.2) */
export function tileColors(palette: readonly string[]): Map<string, string> {
  return new Map([...glyphColors(palette)].filter(([glyph]) => KEY_GLYPHS[glyph] === undefined));
}

const isMain = process.argv[1]?.endsWith('build-tiles.ts') ?? false;
if (isMain) {
  const colors = tileColors(readPalette().colors);
  mkdirSync(TILESET_DIR, { recursive: true });
  let built = 0;
  for (const file of readdirSync(TILE_SOURCE_DIR).filter((f) => f.endsWith('.tiles'))) {
    const id = file.replace(/\.tiles$/, '');
    const source = join(TILE_SOURCE_DIR, file);
    try {
      const doc = parseTiles(
        readFileSync(source, 'utf8'),
        relative(process.cwd(), source),
        new Set(colors.keys()),
      );
      renderTileset(doc, colors).save(join(TILESET_DIR, `${id}.png`));
      writeFileSync(
        join(TILESET_DIR, `${id}.tileset.json`),
        `${JSON.stringify(tilesetJson(doc, id), null, 2)}\n`,
      );
      built += 1;
    } catch (error) {
      console.error(error instanceof PixError ? error.message : String(error));
      process.exit(1);
    }
  }
  console.log(`art:build: 타일셋 ${String(built)}개 생성`);
}
