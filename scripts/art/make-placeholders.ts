// 자리표시 레이어 PNG를 src/assets/sprites/avatar/에 쓴다 (ROADMAP 12a). 12b에서 같은 경로의 실제 그림으로 바뀐다.
// 사용: pnpm art:placeholders  (이미 있는 파일은 덮어쓴다 — 실제 그림이 들어온 뒤에는 실행하지 않는다)
import { mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';

import { AVATAR_DIR, readCatalog } from './catalog.ts';
import { bodySheet, itemSheets } from './placeholders.ts';
import type { Sheet } from './sheet.ts';

function write(relative: string, sheet: Sheet): void {
  const path = join(AVATAR_DIR, relative);
  mkdirSync(dirname(path), { recursive: true });
  sheet.save(path);
}

const catalog = readCatalog();
write(catalog.body.front, bodySheet());
let count = 1;
for (const item of catalog.items) {
  const sheets = itemSheets(item);
  write(item.sheets.front, sheets.front);
  count += 1;
  if (item.sheets.back !== undefined && sheets.back !== undefined) {
    write(item.sheets.back, sheets.back);
    count += 1;
  }
}
console.log(`placeholders: ${String(count)} sheets → ${AVATAR_DIR}`);
