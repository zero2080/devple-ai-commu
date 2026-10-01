// 자산 검수 (GRAPHICS 8장 캐릭터 레이어). 사용: pnpm check:assets — 하나라도 실패하면 종료 코드 1
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { join, relative } from 'node:path';

import { AVATAR_SOURCE_DIR, loadPix, renderSheet, samePixels, sourceOf } from './art/build.ts';
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
      failures.push(`카탈로그에 없는 원본: art/avatar/${file}`);
    }
  }
}
for (const path of walk(AVATAR_DIR)) {
  const file = relative(AVATAR_DIR, path);
  if (file.endsWith('.png') && !referenced.has(file))
    failures.push(`카탈로그에 없는 시트: ${file}`);
}

if (failures.length > 0) {
  console.error(
    `check-assets: ${String(failures.length)}건 실패\n${failures.map((f) => `  - ${f}`).join('\n')}`,
  );
  process.exit(1);
}
console.log(`check-assets: 시트 ${String(checked)}장 통과 (GRAPHICS 8장 캐릭터 레이어)`);
