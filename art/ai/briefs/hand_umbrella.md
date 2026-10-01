# hand_umbrella — 우산

> 자동 생성 (`pnpm art:brief`) — 고치지 말고 카탈로그·`scripts/art/brief.ts`를 고친다. 규격 원문은 `docs/GRAPHICS.md`, 키트 안내는 `art/ai/README.md`.

## 무엇
| 항목 | 값 |
|---|---|
| 슬롯 | `hand` |
| 묘사 | 우산 — a closed umbrella held in the right hand |
| 바뀌는 색 (키 색) | 주색 `P Q R` (P=hi Q=base R=shadow), 보조색 `x y z` (x=hi y=base z=shadow) |
| 기본 색 | primary = `item_yellow`, secondary = `item_charcoal` |
| 시트 | front + **back**(몸보다 뒤에 그릴 부분) |
| 원본 파일 | `art/avatar/hand/hand_umbrella.pix` |

## 어디에 그리나
- 오른손에 든 물건. 좌우 여백(x 0–3, 20–23)을 쓸 수 있다
- 방향별 시트: down = 화면 왼쪽 front, right = 몸 앞 front, left = 몸 뒤 back, up = 몸 뒤 back(어깨 위로 보이는 부분만 front)
- 방향마다 서기 1장(24×40). 걷기 프레임은 빌드가 만든다 (머리·몸통 1px 흔들림, 다리 교대)
- 4방향을 각각 그린다. 좌우 반전 금지

## 참고 파일
- `art/templates/avatar-guide.png` — 프레임·몸 박스·여백·앵커
- `art/templates/key-colors.png` — 키 색 견본
- `src/assets/sprites/avatar/body/body_base.png` — 기준 몸 (이 위에 겹친다)
- `src/assets/sprites/avatar/hand/hand_umbrella.png` · `hand/hand_umbrella.back.png` — 지금 쓰는 개발용 그림 (자리·크기 참고)

## 경로 ① 이미지 생성 모델
아래 프롬프트와 참고 파일을 함께 준다. 결과(PNG)를 `pnpm art:ingest <파일> --id hand_umbrella [--sheet back]`로 정리한다.

```text
Pixel art sprite layer for a 1990s 16-bit console RPG (SNES era), 3/4 top-down view, chibi with a 2-head-tall body.
Draw ONLY this item, no body, no background: a closed umbrella held in the right hand.
Output one horizontal strip of 4 frames, each exactly 24x40 pixels, no gaps, in this order: facing down, facing left, facing right, facing up (strip = 96x40 pixels; integer upscaling allowed).
Standing pose only. Align to the attached avatar-guide.png: body box x4-19, y8-39, feet at y39; the top 8 rows are for hats only; the 4-pixel side margins are only for held items, hair volume and hat brims.
Recolorable parts must use these exact key colors (hi / base / shadow): primary: #ff8080 / #ff0000 / #800000; secondary: #80ff80 / #00ff00 / #008000.
Everything else uses only these palette colors: #be4a2f #d77643 #ead4aa #e4a672 #b86f50 #733e39 #3e2731 #a22633 #e43b44 #f77622 #feae34 #fee761 #63c74d #3e8948 #265c42 #193c3e #124e89 #0099db #2ce8f5 #ffffff #c0cbdc #8b9bb4 #5a6988 #3a4466 #262b44 #181425 #ff0044 #68386c #b55088 #f6757a #e8b796 #c28569; 1px outline in #181425; at most 4 other fixed colors.
No anti-aliasing, no semi-transparent pixels, no shadows, no text or logos. Left and right views must be drawn separately (not mirrored).
Also output a second strip with only the parts that go BEHIND the body (back sheet), same layout.
Transparent background (or one flat background color that is not used anywhere in the sprite).
```

## 경로 ② 텍스트 에이전트 (.pix 직접 작성)
`art/README.md`의 형식으로 `art/avatar/hand/hand_umbrella.pix`를 쓰고 `pnpm art:build`로 검수한다. 이 레이어가 쓸 글자: 외곽선 `o`, 주색 `P Q R` (P=hi Q=base R=shadow), 보조색 `x y z` (x=hi y=base z=shadow), 팔레트 코드(외곽선 빼고 4색까지):

| 코드 | 색 | 이름 |
|---|---|---|
| `1` | `#be4a2f` | 적갈 |
| `2` | `#d77643` | 주황갈 |
| `3` | `#ead4aa` | 크림 |
| `4` | `#e4a672` | 살구 |
| `5` | `#b86f50` | 갈색 |
| `6` | `#733e39` | 고동 |
| `7` | `#3e2731` | 흑갈 |
| `8` | `#a22633` | 진홍 |
| `9` | `#e43b44` | 빨강 |
| `A` | `#f77622` | 주황 |
| `B` | `#feae34` | 귤색 |
| `C` | `#fee761` | 노랑 |
| `E` | `#63c74d` | 연두 |
| `F` | `#3e8948` | 초록 |
| `G` | `#265c42` | 숲 |
| `J` | `#193c3e` | 심록 |
| `K` | `#124e89` | 남색 |
| `L` | `#0099db` | 파랑 |
| `M` | `#2ce8f5` | 하늘 |
| `N` | `#ffffff` | 흰색 |
| `T` | `#c0cbdc` | 연회색 |
| `U` | `#8b9bb4` | 회색 |
| `V` | `#5a6988` | 청회색 |
| `W` | `#3a4466` | 짙은 청회 |
| `X` | `#262b44` | 먹색 |
| `Y` | `#ff0044` | 진분홍 |
| `Z` | `#68386c` | 자주 |
| `d` | `#b55088` | 자홍 |
| `e` | `#f6757a` | 분홍 |
| `f` | `#e8b796` | 살색 |
| `g` | `#c28569` | 황갈 |
