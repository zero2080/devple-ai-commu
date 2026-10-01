// 운영 번들 검사 (DEPLOYMENT 3.1): dist에 Mock이 들어가면 안 된다. 순수 함수 — 파일 읽기는 check-dist.ts
export interface DistFile {
  /** dist 기준 상대 경로 */
  path: string;
  content: string;
}

/** 운영 번들에 있으면 안 되는 Mock 흔적 (MSW·Mock 핸들러·DEV 전용 트리거) */
export const MOCK_MARKERS: readonly string[] = [
  'mockServiceWorker',
  'setupWorker',
  'HttpResponse',
  '__devpleMock',
  '/__mock/',
  'DEMO0-00000-00000-00000',
];

const DATA_URL = /data:[a-z]+\/[a-z0-9.+-]+;base64,[A-Za-z0-9+/=]+/g;

/** 문제 목록 (없으면 빈 배열). base64 data URL(작은 그림)은 우연히 글자가 겹칠 수 있어 빼고 찾는다 */
export function distProblems(files: readonly DistFile[]): string[] {
  const problems: string[] = [];
  if (!files.some((file) => file.path === 'index.html')) {
    problems.push('index.html 없음 — pnpm build를 먼저');
  }
  for (const file of files) {
    if (file.path === 'mockServiceWorker.js') {
      problems.push('mockServiceWorker.js가 dist에 있음 (VITE_MOCK=false로 빌드했는지)');
      continue;
    }
    if (!/\.(js|html|css)$/.test(file.path)) {
      continue;
    }
    const text = file.content.replace(DATA_URL, '');
    for (const marker of MOCK_MARKERS) {
      if (text.includes(marker)) {
        problems.push(`${file.path}: Mock 흔적 "${marker}"`);
      }
    }
  }
  return problems;
}
