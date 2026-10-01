# art — 그림 원본

빌드에 포함하지 않는 그림 원본과 제작 도구다. 규격은 `docs/GRAPHICS.md`가 기준이고, 이 문서는 원본 파일 형식만 정한다 (ROADMAP 12b).

| 경로 | 내용 |
|---|---|
| `avatar/body/body_base.pix` | 기준 몸 (GRAPHICS 2.2) |
| `avatar/<slot>/<id>.pix` | 아바타 레이어 원본. `<id>`는 `catalog.json`의 아이템 ID |
| `templates/` | 제작 템플릿 (`pnpm art:templates`, GRAPHICS 7.2) |
| `ai/` | AI 생성 키트 — 안내 `ai/README.md`, 아이템별 지시문 `ai/briefs/`(자동 생성), 코드표 `ai/glyphs.md`(자동 생성) |

## 명령

| 명령 | 하는 일 |
|---|---|
| `pnpm art:build` | `.pix` → `src/assets/sprites/avatar/**` PNG(96×160), 이어서 `check:assets` |
| `pnpm check:assets` | GRAPHICS 8장 검수 + PNG가 `.pix` 원본과 같은지 (CI에서도 돈다) |
| `pnpm art:templates` | `templates/` 다시 만들기 |
| `pnpm art:brief` | `ai/briefs/<id>.md`·`ai/glyphs.md` 다시 만들기 (카탈로그·팔레트가 바뀌면) |
| `pnpm art:ingest <png> --id <id>` | AI가 그린 이미지를 `.pix`로 정리 (`ai/README.md`) |

PNG만 고치고 원본을 안 고치면 `check:assets`가 실패한다. 언제나 `.pix`를 고치고 `pnpm art:build`를 돌린다.

## `.pix` 형식

텍스트 파일 하나 = 아이템 하나. 방향마다 **서기 프레임(24×40) 1장**만 그린다. 걷기 프레임 1–3은 빌드가 만든다(아래 "걷기 파생").

```
# hat_cap — 야구모자          ← '#'로 시작하면 주석 (파일 맨 위 주석은 보존)
@sheet front                  ← front(기본) 또는 back(몸보다 뒤에 그릴 부분, GRAPHICS 2.6)
@dir down                     ← down · left · right · up. 뒤에 숫자를 붙이면(@dir down 1) 그 걷기 프레임을 직접 그린다
 4 ......ooooooooooo.....     ← "<y> <24글자>". y = 0–39, 픽셀이 있는 행만 적는다
 5 .....oPPPPQQQQQQo.....
@dir left
 ...
@sheet back
@dir down
 ...
```

- 적지 않은 행·방향은 투명이다. 같은 블록에 같은 y를 두 번 쓰거나, 같은 블록을 두 번 쓰면 오류다
- 오류는 `파일:줄: 이유`로 알려 준다
- 4방향은 각각 그린다. 좌우 반전으로 만들지 않는다 (GRAPHICS 2.1, 검수가 막는다)

### 걷기 파생 (GRAPHICS 2.3)

- 프레임 0·2: 서기 그대로
- 프레임 1·3: 머리·몸통(y 0–31)을 1px 아래로. 다리(y 32–39)는 프레임 1이면 화면 왼쪽 절반(x < 12), 프레임 3이면 오른쪽 절반을 1px 들어 발바닥이 y 38
- 모든 레이어가 같은 규칙이라 겹쳐도 어긋나지 않는다. `@dir <방향> <1–3>` 블록이 있으면 그 프레임은 파생 대신 블록을 쓴다

### 글자표

**키 색** (합성 때 사용자가 고른 램프로 바뀐다, GRAPHICS 2.7):

| 채널 | hi | base | shadow | 쓸 수 있는 레이어 |
|---|---|---|---|---|
| 피부 | `H` | `S` | `D` | body |
| 머리 | `a` | `b` | `c` | hair |
| 주색 | `P` | `Q` | `R` | hair 외 아이템 |
| 보조색 | `x` | `y` | `z` | 모든 아이템 |

**외곽선** `o` = `#181425`, **투명** `.`

**팔레트 고정색** (바뀌지 않는 색): `palette.json`의 `colors` 순서대로 코드를 매긴다. 외곽선 색은 `o`. 레이어당 외곽선을 빼고 4색까지 쓴다. 표는 [`ai/glyphs.md`](ai/glyphs.md)에 있고, `pnpm art:brief`가 팔레트에서 다시 만든다.
