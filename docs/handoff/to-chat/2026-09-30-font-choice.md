---
id: 2026-09-30-font-choice
from: code
to: chat
reply-to: none
blocks: none
needs-user: false
---

## done
- Decisions report items 3/4/5 applied per user approval (2026-09-30): boot refresh 401 accepted (no session-hint cookie) → ARCHITECTURE 1.7 §6, ROADMAP 1.6 step-5 wording; SSE lifetime = session (`features/auth/session.ts` → `features/realtime`, no page effect) → ARCHITECTURE 1.7 §4.1; canvas backing store = CSS px × DPR → ARCHITECTURE 1.7 §2.1. Unit 159, e2e 4 pass.
- Font candidates measured (npm packages, fontTools): `docs/report/2026-09-30-font-asset-guide.html`.

## do
- [ ] GRAPHICS 5.1: record user decision (2026-09-30) — font = **Galmuri11 subset renamed `PixelKo`** (OFL 1.1, Reserved Font Name "Galmuri" not used in the modified file); replace "11px → 22px" with "em × zoom (PixelKo/Galmuri11 em 12px → 24px @2x, 36px @3x, 48px @4x)"; add font file cap 256 kB; note `src/assets/LICENSES.md` entry format and build script `scripts/fonts/build-pixelko.sh`.
- [ ] GRAPHICS 8 checklist: add "font: `scripts/fonts/check-font.py` passes (11,172 Hangul, ASCII 95, no reserved name in name IDs 1/3/4/6/16, ≤ 256 kB)".

## info
- Asset shipped: `src/assets/fonts/PixelKo.woff2` 155.9 kB, `OFL-Galmuri.txt`, `src/assets/LICENSES.md` (Galmuri credit + modification note, Endesga 32 credit placeholder for step 12). `@font-face` + `--pixel-font-em: 12px` in `src/index.css`; e2e asserts `document.fonts.check('24px PixelKo')`.
- Measured facts (fontTools): Galmuri11 em 12px, 11,172 Hangul; Neo둥근모 em 16px, 44.6 kB. Report: `docs/report/2026-09-30-font-asset-guide.html`.
