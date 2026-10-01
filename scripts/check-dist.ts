// 운영 번들에 Mock이 없는지 (DEPLOYMENT 3.1). 사용: VITE_MOCK=false pnpm build && pnpm check:dist — Docker 빌드와 CI에서 돈다
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';

import { distProblems, type DistFile } from './dist-checks.ts';

const DIST = join(import.meta.dirname, '../dist');

function walk(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name);
    return statSync(path).isDirectory() ? walk(path) : [path];
  });
}

if (!existsSync(DIST)) {
  console.error('check-dist: dist 없음 — VITE_MOCK=false pnpm build를 먼저');
  process.exit(1);
}
const files: DistFile[] = walk(DIST).map((path) => ({
  path: relative(DIST, path),
  content: /\.(js|html|css)$/.test(path) ? readFileSync(path, 'utf8') : '',
}));
const problems = distProblems(files);
if (problems.length > 0) {
  console.error(
    `check-dist: ${String(problems.length)}건 실패\n${problems.map((p) => `  - ${p}`).join('\n')}`,
  );
  process.exit(1);
}
console.log(`check-dist: 파일 ${String(files.length)}개, Mock 흔적 없음`);
