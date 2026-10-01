// 걷기 프레임 파생 (ROADMAP 12b-1, GRAPHICS 2.3): 방향별 서기 1장에서 4프레임을 만든다. 모든 레이어가 같은 규칙이라 겹쳐도 어긋나지 않는다.
// - 0·2: 서기 그대로
// - 1·3: 머리·몸통(y 0–31) 1px 아래. 다리(y 32–39)는 1 = 화면 왼쪽 절반(x < 12), 3 = 오른쪽 절반을 1px 들어 발바닥이 y 38
//   (위로 밀린 다리 맨 윗줄은 내려온 몸통이 덮는다)
import { TRANSPARENT } from './pix.ts';
import { FRAME_H, FRAME_W } from './sheet.ts';

export const LEG_TOP = 32;
const HALF = FRAME_W / 2;

export function deriveWalkFrame(idle: readonly string[], frame: number): string[] {
  if (frame === 0 || frame === 2) {
    return [...idle];
  }
  const out = Array.from({ length: FRAME_H }, () => Array<string>(FRAME_W).fill(TRANSPARENT));
  const put = (x: number, y: number, glyph: string): void => {
    const target = out[y];
    if (glyph !== TRANSPARENT && target !== undefined) target[x] = glyph;
  };
  for (let y = LEG_TOP; y < FRAME_H; y += 1) {
    const row = idle[y] ?? '';
    for (let x = 0; x < row.length; x += 1) {
      const lifted = frame === 1 ? x < HALF : x >= HALF;
      put(x, lifted ? y - 1 : y, row.charAt(x));
    }
  }
  for (let y = 0; y < LEG_TOP; y += 1) {
    const row = idle[y] ?? '';
    for (let x = 0; x < row.length; x += 1) {
      put(x, y + 1, row.charAt(x));
    }
  }
  return out.map((row) => row.join(''));
}
