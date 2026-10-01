// 키 색 (GRAPHICS 2.7). 레이어에서 "색이 바뀌는 부분"은 이 색으로만 칠하고, 합성 시 램프 색으로 치환한다.
// 런타임 합성기와 자리표시 생성기·검수 스크립트(scripts/art)가 함께 쓰므로 다른 모듈을 import하지 않는다
export type KeyChannel = 'skin' | 'hair' | 'primary' | 'secondary';
export type Shade = 'hi' | 'base' | 'shadow';

export const KEY_COLORS: Readonly<Record<KeyChannel, Readonly<Record<Shade, string>>>> = {
  skin: { hi: '#ffff80', base: '#ffff00', shadow: '#808000' },
  hair: { hi: '#8080ff', base: '#0000ff', shadow: '#000080' },
  primary: { hi: '#ff8080', base: '#ff0000', shadow: '#800000' },
  secondary: { hi: '#80ff80', base: '#00ff00', shadow: '#008000' },
};

export const KEY_CHANNELS: readonly KeyChannel[] = ['skin', 'hair', 'primary', 'secondary'];
export const SHADES: readonly Shade[] = ['hi', 'base', 'shadow'];

/** 외곽선 고정색 (GRAPHICS 1). 치환 대상이 아니고 레이어 고정색 4색 제한에서도 뺀다 */
export const OUTLINE_COLOR = '#181425';

/** '#rrggbb' → 0xRRGGBB */
export function rgbOf(hex: string): number {
  return Number.parseInt(hex.slice(1), 16);
}

/** 0xRRGGBB → 키 채널·단계. 키 색이 아니면 null */
export function keyOf(rgb: number): { channel: KeyChannel; shade: Shade } | null {
  for (const channel of KEY_CHANNELS) {
    for (const shade of SHADES) {
      if (rgbOf(KEY_COLORS[channel][shade]) === rgb) {
        return { channel, shade };
      }
    }
  }
  return null;
}
