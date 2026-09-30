---
id: 2026-09-30-font-choice
from: code
to: chat
reply-to: none
blocks: step-7
needs-user: true
---

## done
- Decisions report items 3/4/5 applied per user approval (2026-09-30): boot refresh 401 accepted (no session-hint cookie) → ARCHITECTURE 1.7 §6, ROADMAP 1.6 step-5 wording; SSE lifetime = session (`features/auth/session.ts` → `features/realtime`, no page effect) → ARCHITECTURE 1.7 §4.1; canvas backing store = CSS px × DPR → ARCHITECTURE 1.7 §2.1. Unit 159, e2e 4 pass.
- Font candidates measured (npm packages, fontTools): `docs/report/2026-09-30-font-asset-guide.html`.

## decide
- Font for GRAPHICS 5.1. Facts: both OFL 1.1, both cover all 11,172 Hangul syllables.
  - Galmuri11: em **12px** (not 11) → 24px @2x; woff2 504.7 kB incl. 6,477 CJK; Reserved Font Name "Galmuri" → subset must be renamed internally (e.g. `PixelKo`) + OFL text + attribution.
  - Neo둥근모 (@kfonts/neodgm 0.5.0): em 16px → 32px @2x; woff2 44.6 kB, unmodified use, no npm LICENSE file (bundle OFL from repo).
  - Recommendation: Galmuri11 subset (Hangul + Jamo + ASCII + punctuation, ~170 kB est.) renamed `PixelKo`; Bold optional.
- Once chosen, update GRAPHICS 5.1: replace "11px → 22px" with "em × zoom (Galmuri11 em 12px → 24px @2x)", record chosen font + subset/rename + `src/assets/LICENSES.md` entry + font file size cap (propose 256 kB like PNG).

## info
- Code side will build the font files in step 7 per the guide (pyftsubset + name-table rename), commit them under `src/assets/fonts/` with `OFL-Galmuri.txt`.
