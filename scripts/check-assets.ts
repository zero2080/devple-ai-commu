// 자산 검수 (GRAPHICS 8장 캐릭터 레이어). 사용: pnpm check:assets — 하나라도 실패하면 종료 코드 1
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { join, relative } from 'node:path';

import { briefContext, briefFor, briefItems } from './art/brief.ts';
import { tileColors, TILE_SOURCE_DIR, TILESET_DIR } from './art/build-tiles.ts';
import {
  ART_DIR,
  AVATAR_SOURCE_DIR,
  loadPix,
  renderSheet,
  samePixels,
  sourceOf,
} from './art/build.ts';
import { AVATAR_DIR, readCatalog, readPalette } from './art/catalog.ts';
import {
  channelMismatch,
  checkLayer,
  isMirrorOfRight,
  MAX_FILE_BYTES,
  namingProblems,
  pngMetadataChunks,
  type LayerKind,
} from './art/checks.ts';
import { glyphColors, PixError } from './art/pix.ts';
import { Sheet } from './art/sheet.ts';
import {
  parseTiles,
  renderTileset,
  tilesetJson,
  tilesetProblems,
  type MapLike,
  type TilesetJson,
} from './art/tiles.ts';
import type { KeyChannel } from '../src/game/assets/keyColors.ts';

const catalog = readCatalog();
const palette = readPalette().colors;
const glyphs = glyphColors(palette);
const failures: string[] = [];
const referenced = new Set<string>();
let checked = 0;

/** .pix 원본이 있으면 그 원본으로 그린 시트와 커밋된 PNG가 같은지 (다르면 pnpm art:build를 안 돌린 것) */
function checkSource(label: string, file: string, sheet: Sheet): void {
  const source = join(AVATAR_SOURCE_DIR, sourceOf(file));
  if (!existsSync(source)) return;
  try {
    const doc = loadPix(source, relative(process.cwd(), source), glyphs);
    const side = file.endsWith('.back.png') ? 'back' : 'front';
    if (!samePixels(renderSheet(doc, side, glyphs), sheet)) {
      failures.push(`${label} (${file}): PNG가 원본 ${sourceOf(file)}와 다름 — pnpm art:build`);
    }
  } catch (error) {
    failures.push(error instanceof PixError ? error.message : `${label}: ${String(error)}`);
  }
}

function inspect(kind: LayerKind, label: string, file: string) {
  const path = join(AVATAR_DIR, file);
  referenced.add(file);
  if (!existsSync(path)) {
    failures.push(`${label}: 파일 없음 ${file}`);
    return null;
  }
  checked += 1;
  const buffer = readFileSync(path);
  if (buffer.length > MAX_FILE_BYTES)
    failures.push(`${label}: ${String(buffer.length)} B (256 KB 이하)`);
  const metadata = pngMetadataChunks(buffer);
  if (metadata.length > 0)
    failures.push(`${label} (${file}): 메타데이터 청크 ${metadata.join(', ')}`);
  const sheet = Sheet.fromPng(buffer);
  checkSource(label, file, sheet);
  const report = checkLayer(kind, sheet, palette);
  for (const problem of report.problems) failures.push(`${label} (${file}): ${problem}`);
  if (isMirrorOfRight(sheet)) failures.push(`${label} (${file}): left가 right의 단순 좌우 반전`);
  return report;
}

inspect('body', 'body', catalog.body.front);
for (const item of catalog.items) {
  for (const problem of namingProblems(item)) failures.push(`${item.id}: ${problem}`);
  const used = new Set<KeyChannel>();
  for (const file of [item.sheets.front, item.sheets.back]) {
    if (file === undefined) continue;
    const report = inspect(item.slot, item.id, file);
    report?.usedKeys.forEach((key) => used.add(key));
  }
  const mismatch = channelMismatch(item.slot, used, item.channels);
  if (mismatch !== null) failures.push(`${item.id}: ${mismatch}`);
}

function walk(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) =>
    entry.isDirectory() ? walk(join(dir, entry.name)) : [join(dir, entry.name)],
  );
}
const sources = new Set(
  [catalog.body.front, ...catalog.items.map((item) => item.sheets.front)].map(sourceOf),
);
if (existsSync(AVATAR_SOURCE_DIR)) {
  for (const path of walk(AVATAR_SOURCE_DIR)) {
    const file = relative(AVATAR_SOURCE_DIR, path);
    if (file.endsWith('.pix') && !sources.has(file)) {
      failures.push(`카탈로그에 없는 원본: art/source/avatar/${file}`);
    }
  }
}
for (const path of walk(AVATAR_DIR)) {
  const file = relative(AVATAR_DIR, path);
  if (file.endsWith('.png') && !referenced.has(file))
    failures.push(`카탈로그에 없는 시트: ${file}`);
}

// 타일셋 (GRAPHICS 3장·4장·8장 타일셋): 규칙 + 원본(.tiles)·PNG·JSON 동기화 + 맵 레이어 인덱스
const MAPS_DIR = join(import.meta.dirname, '../src/assets/maps');
const maps = readdirSync(MAPS_DIR)
  .filter((f) => f.endsWith('.json'))
  .map((f) => JSON.parse(readFileSync(join(MAPS_DIR, f), 'utf8')) as MapLike);
let tilesets = 0;
for (const map of maps) {
  const png = join(TILESET_DIR, `${map.tileset}.png`);
  const jsonPath = join(TILESET_DIR, `${map.tileset}.tileset.json`);
  const sourcePath = join(TILE_SOURCE_DIR, `${map.tileset}.tiles`);
  if (!existsSync(png) || !existsSync(jsonPath) || !existsSync(sourcePath)) {
    failures.push(
      `맵 ${map.id}: 타일셋 ${map.tileset}의 PNG·JSON·원본(.tiles) 중 없는 것이 있음 — pnpm art:build`,
    );
    continue;
  }
  tilesets += 1;
  const buffer = readFileSync(png);
  if (buffer.length > MAX_FILE_BYTES)
    failures.push(`${map.tileset}.png: ${String(buffer.length)} B (256 KB 이하)`);
  const metadata = pngMetadataChunks(buffer);
  if (metadata.length > 0)
    failures.push(`${map.tileset}.png: 메타데이터 청크 ${metadata.join(', ')}`);
  const sheet = Sheet.fromPng(buffer);
  const json = JSON.parse(readFileSync(jsonPath, 'utf8')) as TilesetJson;
  for (const problem of tilesetProblems(sheet, json, palette, maps))
    failures.push(`타일셋 ${map.tileset}: ${problem}`);
  try {
    const colors = tileColors(palette);
    const doc = parseTiles(
      readFileSync(sourcePath, 'utf8'),
      relative(process.cwd(), sourcePath),
      new Set(colors.keys()),
    );
    if (!samePixels(renderTileset(doc, colors), sheet))
      failures.push(`${map.tileset}.png가 원본 .tiles와 다름 — pnpm art:build`);
    if (JSON.stringify(tilesetJson(doc, map.tileset)) !== JSON.stringify(json)) {
      failures.push(`${map.tileset}.tileset.json이 원본 .tiles와 다름 — pnpm art:build`);
    }
  } catch (error) {
    failures.push(error instanceof PixError ? error.message : `${map.tileset}: ${String(error)}`);
  }
}

// AI 키트 지시문이 카탈로그·팔레트와 같은지 (다르면 pnpm art:brief를 안 돌린 것)
const context = briefContext(palette);
let briefs = 0;
for (const item of briefItems(catalog)) {
  const path = join(ART_DIR, 'ai/briefs', `${item.id}.md`);
  let expected: string;
  try {
    expected = briefFor(item, context);
  } catch (error) {
    failures.push(`${item.id}: ${String(error)}`);
    continue;
  }
  briefs += 1;
  if (!existsSync(path) || readFileSync(path, 'utf8') !== expected) {
    failures.push(`art/ai/briefs/${item.id}.md가 카탈로그·팔레트와 다름 — pnpm art:brief`);
  }
}

if (failures.length > 0) {
  console.error(
    `check-assets: ${String(failures.length)}건 실패\n${failures.map((f) => `  - ${f}`).join('\n')}`,
  );
  process.exit(1);
}
console.log(
  `check-assets: 시트 ${String(checked)}장 통과 (GRAPHICS 8장 캐릭터 레이어), 타일셋 ${String(tilesets)}개, AI 지시문 ${String(briefs)}개 최신`,
);
