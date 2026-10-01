// 아바타 레이어 빌드 (ROADMAP 12b-1): art/avatar/**/*.pix → src/assets/sprites/avatar/** PNG. 사용: pnpm art:build (이어서 check:assets)
import { existsSync, mkdirSync } from 'node:fs';
import { dirname, join, relative } from 'node:path';

import { AVATAR_SOURCE_DIR, hasSide, loadPix, renderSheet, sourceOf } from './build.ts';
import { AVATAR_DIR, readCatalog, readPalette } from './catalog.ts';
import { glyphColors, PixError } from './pix.ts';

const catalog = readCatalog();
const colors = glyphColors(readPalette().colors);
const entries = [
  { id: 'body', sheets: { front: catalog.body.front } as { front: string; back?: string } },
  ...catalog.items,
];
const errors: string[] = [];
const missing: string[] = [];
let written = 0;

for (const entry of entries) {
  const source = join(AVATAR_SOURCE_DIR, sourceOf(entry.sheets.front));
  if (!existsSync(source)) {
    missing.push(entry.id);
    continue;
  }
  try {
    const doc = loadPix(source, relative(process.cwd(), source), colors);
    const wantsBack = entry.sheets.back !== undefined;
    if (wantsBack !== hasSide(doc, 'back')) {
      errors.push(
        `${entry.id}: catalog back 시트 ${wantsBack ? '있음' : '없음'} ↔ 원본 @sheet back ${wantsBack ? '없음' : '있음'}`,
      );
      continue;
    }
    for (const [side, path] of [
      ['front', entry.sheets.front],
      ['back', entry.sheets.back],
    ] as const) {
      if (path === undefined) continue;
      const out = join(AVATAR_DIR, path);
      mkdirSync(dirname(out), { recursive: true });
      renderSheet(doc, side, colors).save(out);
      written += 1;
    }
  } catch (error) {
    errors.push(error instanceof PixError ? error.message : `${entry.id}: ${String(error)}`);
  }
}

for (const id of missing) {
  errors.push(`${id}: 원본 .pix가 없음 (art/avatar/, art/ai/briefs/${id}.md)`);
}
if (errors.length > 0) {
  console.error(
    `art:build: ${String(errors.length)}건 실패\n${errors.map((e) => `  - ${e}`).join('\n')}`,
  );
  process.exit(1);
}
console.log(`art:build: 시트 ${String(written)}장 생성`);
