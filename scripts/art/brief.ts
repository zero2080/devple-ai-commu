// AI 생성 지시문 (ROADMAP 12b-2): 카탈로그 항목 하나 → art/ai/briefs/<id>.md. 순수 함수 — 파일 쓰기는 make-briefs.ts
// 규격 원문은 GRAPHICS.md. 여기 문구는 그 요약이며 생성 AI에 그대로 붙여 넣는 용도다
import { glyphColors, KEY_GLYPHS } from './pix.ts';
import { KEY_COLORS } from '../../src/game/assets/keyColors.ts';

export type BriefSlot = 'body' | 'hair' | 'hat' | 'face' | 'top' | 'bottom' | 'shoes' | 'hand';

export interface BriefItem {
  id: string;
  slot: BriefSlot;
  name: string;
  sheets: { front: string; back?: string };
  channels: ('primary' | 'secondary')[];
  defaultColors: { primary?: string; secondary?: string };
  coversBottom?: true;
}

/** 이미지 모델 프롬프트용 영어 묘사. 새 아이템을 카탈로그에 더하면 여기에도 더한다 (없으면 brief 생성이 실패) */
export const ITEM_PROMPTS: Readonly<Record<string, string>> = {
  body: 'bare base body with skin, two dot eyes and a small mouth, no hair, no clothes (plain skin torso and legs)',
  hair_bob: 'bob haircut, chin-length, straight bangs',
  hair_long: 'long straight hair reaching the middle of the back',
  hair_ponytail: 'high ponytail tied with a small ribbon',
  hair_curly: 'short curly hair with volume',
  hair_short: 'short neat hair with side-swept bangs',
  hair_pigtails: 'twin pigtails tied with small ribbons',
  hair_bun: 'hair tied in a top bun with a small hair tie',
  hair_buzz: 'buzz cut, very short hair hugging the scalp',
  hat_beanie: 'knit beanie with a folded cuff',
  hat_cap: 'baseball cap with a front brim',
  hat_straw: 'wide-brim straw hat with a ribbon band',
  hat_wizard: 'tall pointed wizard hat with a star band',
  hat_headband: 'thin headband across the top of the head',
  hat_helmet: 'round bicycle-style helmet with a stripe',
  face_round_glasses: 'round eyeglasses',
  face_sunglasses: 'dark sunglasses',
  face_mask: 'simple cloth face mask covering mouth and nose',
  face_beard: 'short full beard around the jaw',
  top_tshirt: 'plain short-sleeve t-shirt',
  top_hoodie: 'hoodie with drawstrings and a front pocket',
  top_shirt: 'button-up collared shirt',
  top_knit: 'cozy knit sweater',
  top_jacket: 'zip-up jacket worn open over an inner shirt',
  top_suspenders: 'shirt with suspender straps',
  top_dress: 'one-piece dress reaching the knees (covers the legs, replaces pants)',
  top_robe: 'long robe reaching the ankles (covers the legs, replaces pants)',
  bottom_jeans: 'long jeans',
  bottom_shorts: 'knee-length shorts',
  bottom_skirt: 'knee-length skirt',
  bottom_slacks: 'formal slacks',
  bottom_track: 'track pants with side stripes',
  bottom_overalls: 'overall pants with a bib',
  shoes_sneakers: 'sneakers with white soles',
  shoes_boots: 'ankle boots',
  shoes_loafers: 'leather loafers',
  shoes_sandals: 'strap sandals',
  hand_flower: 'a single flower held in the right hand',
  hand_balloon: 'a balloon on a string held in the right hand',
  hand_book: 'a closed book held in the right hand',
  hand_cup: 'a mug held in the right hand',
  hand_umbrella: 'a closed umbrella held in the right hand',
  hand_mic: 'a handheld microphone held in the right hand',
};

/** 슬롯별로 그릴 자리 (GRAPHICS 2.1·2.2·2.5·2.6) */
const SLOT_RULES: Readonly<Record<BriefSlot, readonly string[]>> = {
  body: [
    '머리 y 8–23(폭 약 14px, x 5–18), 몸통 y 24–31(폭 10–12px, 팔 포함), 다리 y 32–39, 발바닥 y 39',
    '눈은 y 16–17 부근 2px 높이, 고정색으로. 머리카락·옷은 그리지 않는다',
  ],
  hair: [
    '머리 영역(y 8–23) 위에 앞머리·옆머리. 좌우 여백(x 0–3, 20–23)에 머리숱이 나와도 된다. 위 여백(y 0–7)은 모자 전용이라 쓰지 않는다',
    'down·left·right에서 등 뒤로 넘어가는 머리는 back 시트, up에서는 뒷머리 전체를 front 시트에',
    '머리카락은 머리 키 색(a b c)으로만 칠한다. 리본 등 장식은 보조색(x y z)',
  ],
  hat: [
    '위 여백(y 0–7)과 좌우 여백을 쓸 수 있다. 정수리를 충분히 덮게 (모자가 머리카락 위에 그려지고, 가리는 처리는 없다)',
    '챙이 몸 뒤로 가는 방향이 있으면 그 부분은 back 시트',
  ],
  face: ['머리 영역 안(y 8–23). up 방향(뒤돌아봄)은 보이지 않으므로 비운다'],
  top: [
    '몸통 y 24–31, 소매·팔 포함. 목 부분은 몸 레이어의 피부가 보이게 비워 둔다',
    '원피스·로브(coversBottom)는 다리를 덮도록 아래로 길게 (하의 레이어를 그리지 않는다)',
  ],
  bottom: ['다리 y 32–36 부근. 발(y 37–39)은 신발 레이어에 맡긴다'],
  shoes: ['발 y 37–39. 발바닥은 y 39'],
  hand: [
    '오른손에 든 물건. 좌우 여백(x 0–3, 20–23)을 쓸 수 있다',
    '방향별 시트: down = 화면 왼쪽 front, right = 몸 앞 front, left = 몸 뒤 back, up = 몸 뒤 back(어깨 위로 보이는 부분만 front)',
  ],
};

const CHANNEL_TEXT: Readonly<Record<string, string>> = {
  skin: '피부 `H S D`',
  hair: '머리 `a b c`',
  primary: '주색 `P Q R`',
  secondary: '보조색 `x y z`',
};

/** 이 레이어가 쓸 수 있는 키 채널 (GRAPHICS 2.7 표, 검수 8장) */
export function allowedKeys(slot: BriefSlot): string[] {
  if (slot === 'body') return ['skin'];
  if (slot === 'hair') return ['hair', 'secondary'];
  return ['primary', 'secondary'];
}

function keyHexList(channel: string): string {
  return Object.entries(KEY_GLYPHS)
    .filter(([, [c]]) => c === channel)
    .map(([glyph, [, shade]]) => `${glyph}=${shade}`)
    .join(' ');
}

function usedKeys(item: BriefItem): string[] {
  if (item.slot === 'body') return ['skin'];
  const channels: string[] = [...item.channels];
  return item.slot === 'hair' ? ['hair', ...channels] : channels;
}

export interface BriefContext {
  /** art/README.md의 팔레트 코드 표 (palette.json에서 만든 것) */
  paletteTable: string;
  /** 키 색 hex (프롬프트에 그대로) */
  keyHex: Readonly<Record<string, readonly [string, string, string]>>;
  /** palette.json colors (이미지 모델은 표를 못 읽으므로 프롬프트에 hex로) */
  paletteHex: readonly string[];
}

export function briefFor(item: BriefItem, ctx: BriefContext): string {
  const prompt = ITEM_PROMPTS[item.id];
  if (prompt === undefined) {
    throw new Error(`ITEM_PROMPTS에 "${item.id}" 묘사가 없음 — scripts/art/brief.ts에 더한다`);
  }
  const keys = usedKeys(item);
  const keyLine = keys
    .map((channel) => `${CHANNEL_TEXT[channel] ?? channel} (${keyHexList(channel)})`)
    .join(', ');
  const hexes = keys
    .map((channel) => {
      const [hi, base, shadow] = ctx.keyHex[channel] ?? ['', '', ''];
      return `${channel}: ${hi} / ${base} / ${shadow}`;
    })
    .join('; ');
  const back = item.sheets.back !== undefined;
  const pixPath =
    item.slot === 'body'
      ? 'art/source/avatar/body/body_base.pix'
      : `art/source/avatar/${item.slot}/${item.id}.pix`;
  const colors = Object.entries(item.defaultColors)
    .map(([channel, ramp]) => `${channel} = \`${ramp}\``)
    .join(', ');
  return `# ${item.id} — ${item.name}

> 자동 생성 (\`pnpm art:brief\`) — 고치지 말고 카탈로그·\`scripts/art/brief.ts\`를 고친다. 규격 원문은 \`docs/GRAPHICS.md\`, 키트 안내는 \`art/ai/README.md\`.

## 무엇
| 항목 | 값 |
|---|---|
| 슬롯 | \`${item.slot}\`${item.slot === 'top' || item.slot === 'bottom' || item.slot === 'shoes' ? ' (필수 슬롯)' : ''} |
| 묘사 | ${item.name} — ${prompt} |
| 바뀌는 색 (키 색) | ${keyLine} |
| 기본 색 | ${colors === '' ? '없음' : colors} |
| 시트 | front${back ? ' + **back**(몸보다 뒤에 그릴 부분)' : ''} |${item.coversBottom === true ? '\n| 하의 덮음 | 예 (`coversBottom`) |' : ''}
| 원본 파일 | \`${pixPath}\` |

## 어디에 그리나
${SLOT_RULES[item.slot].map((rule) => `- ${rule}`).join('\n')}
- 방향마다 서기 1장(24×40). 걷기 프레임은 빌드가 만든다 (머리·몸통 1px 흔들림, 다리 교대)
- 4방향을 각각 그린다. 좌우 반전 금지

## 참고 파일
- \`art/templates/avatar-guide.png\` — 프레임·몸 박스·여백·앵커
- \`art/templates/key-colors.png\` — 키 색 견본
- \`src/assets/sprites/avatar/body/body_base.png\` — 기준 몸 (이 위에 겹친다)
- \`src/assets/sprites/avatar/${item.sheets.front}\`${back ? ` · \`${item.sheets.back ?? ''}\`` : ''} — 지금 쓰는 개발용 그림 (자리·크기 참고)

## 경로 ① 이미지 생성 모델
아래 프롬프트와 참고 파일을 함께 준다. 결과(PNG)를 \`pnpm art:ingest <파일> --id ${item.id}${back ? ' [--sheet back]' : ''}\`로 정리한다.

\`\`\`text
Pixel art sprite layer for a 1990s 16-bit console RPG (SNES era), 3/4 top-down view, chibi with a 2-head-tall body.
Draw ONLY this item, no body, no background: ${prompt}.
Output one horizontal strip of 4 frames, each exactly 24x40 pixels, no gaps, in this order: facing down, facing left, facing right, facing up (strip = 96x40 pixels; integer upscaling allowed).
Standing pose only. Align to the attached avatar-guide.png: body box x4-19, y8-39, feet at y39; the top 8 rows are for hats only; the 4-pixel side margins are only for held items, hair volume and hat brims.
Recolorable parts must use these exact key colors (hi / base / shadow): ${hexes}.
Everything else uses only these palette colors: ${ctx.paletteHex.join(' ')}; 1px outline in #181425; at most 4 other fixed colors.
No anti-aliasing, no semi-transparent pixels, no shadows, no text or logos. Left and right views must be drawn separately (not mirrored).${back ? '\nAlso output a second strip with only the parts that go BEHIND the body (back sheet), same layout.' : ''}
Transparent background (or one flat background color that is not used anywhere in the sprite).
\`\`\`

## 경로 ② 텍스트 에이전트 (.pix 직접 작성)
\`art/README.md\`의 형식으로 \`${pixPath}\`를 쓰고 \`pnpm art:build\`로 검수한다. 이 레이어가 쓸 글자: 외곽선 \`o\`, ${keyLine}, 팔레트 코드(외곽선 빼고 4색까지):

${ctx.paletteTable}
`;
}

/** 팔레트 고정색 이름 (표 읽기용). palette.json 색이 바뀌면 이름 없이 hex만 나온다 */
const COLOR_NAMES: Readonly<Record<string, string>> = {
  '#be4a2f': '적갈',
  '#d77643': '주황갈',
  '#ead4aa': '크림',
  '#e4a672': '살구',
  '#b86f50': '갈색',
  '#733e39': '고동',
  '#3e2731': '흑갈',
  '#a22633': '진홍',
  '#e43b44': '빨강',
  '#f77622': '주황',
  '#feae34': '귤색',
  '#fee761': '노랑',
  '#63c74d': '연두',
  '#3e8948': '초록',
  '#265c42': '숲',
  '#193c3e': '심록',
  '#124e89': '남색',
  '#0099db': '파랑',
  '#2ce8f5': '하늘',
  '#ffffff': '흰색',
  '#c0cbdc': '연회색',
  '#8b9bb4': '회색',
  '#5a6988': '청회색',
  '#3a4466': '짙은 청회',
  '#262b44': '먹색',
  '#ff0044': '진분홍',
  '#68386c': '자주',
  '#b55088': '자홍',
  '#f6757a': '분홍',
  '#e8b796': '살색',
  '#c28569': '황갈',
};

/** 팔레트 코드 표 (markdown). glyphs = glyphColors(palette) */
export function paletteGlyphTable(glyphs: ReadonlyMap<string, string>): string {
  const rows = [...glyphs]
    .filter(([glyph]) => !(glyph in KEY_GLYPHS) && glyph !== 'o')
    .map(([glyph, hex]) => `| \`${glyph}\` | \`${hex}\` | ${COLOR_NAMES[hex] ?? ''} |`);
  return ['| 코드 | 색 | 이름 |', '|---|---|---|', ...rows].join('\n');
}

/** 지시문을 만들 대상: 기준 몸 + 카탈로그 전부 */
export function briefItems(catalog: {
  body: { front: string };
  items: readonly BriefItem[];
}): BriefItem[] {
  return [
    {
      id: 'body',
      slot: 'body',
      name: '기준 몸',
      sheets: { front: catalog.body.front },
      channels: [],
      defaultColors: {},
    },
    ...catalog.items,
  ];
}

export function briefContext(palette: readonly string[]): BriefContext {
  return {
    paletteTable: paletteGlyphTable(glyphColors(palette)),
    keyHex: Object.fromEntries(
      Object.entries(KEY_COLORS).map(([channel, ramp]) => [
        channel,
        [ramp.hi, ramp.base, ramp.shadow] as const,
      ]),
    ),
    paletteHex: palette,
  };
}
