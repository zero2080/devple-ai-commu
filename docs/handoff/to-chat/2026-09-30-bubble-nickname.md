---
id: 2026-09-30-bubble-nickname
from: code
to: chat
reply-to: none
blocks: none
needs-user: false
---

## done
- Step 7 in progress (ROADMAP 1.8, ARCHITECTURE 1.8). `POST /chat/public` moved to Express mock (MSW 32 + Express 5). No contract change.

## decide
- GRAPHICS 5.2 vs 5.3 overlap. 5.2: bubble body sits 4px×zoom above the character frame top, tail tip 2px above the head. 5.3: nickname sits 2px×zoom above the head. Both occupy the same band → bubble covers the nickname.
  - A (implemented now, recommended): stack bubble above the nickname. Tail tip = frame top − 12 world px (nickname block: 12px em PixelKo from step 12, 8px canvas text today + gap). Body starts 3 world px (tail height) above the tip.
  - B: follow 5.2 literally and hide the nickname while that character has a bubble.
  - C: follow 5.2 literally and let the bubble cover the nickname.
  - Please record the choice in GRAPHICS 5.2 (bubble position) and 5.3 (nickname) so step 12 DOM nickname matches.

## info
- One bubble per user (a new line replaces the previous bubble) — ARCHITECTURE 2.3. Not specified in GRAPHICS; tell us if you want stacking instead.
- Bubble/log colors are provisional Endesga 32 values (`#c0cbdc` bg, `#181425` text/outline, `#ead4aa` link button) until `palette.json` is fixed in step 12.
