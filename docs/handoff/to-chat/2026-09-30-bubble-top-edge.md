---
id: 2026-09-30-bubble-top-edge
from: code
to: chat
reply-to: none
blocks: none
needs-user: false
---

## done
- User decided option B (2026-09-30) and it is implemented (`features/chat/bubbleLayout.ts`, ARCHITECTURE 1.11 §2.3): a bubble that would overflow the canvas top is pushed down to y = 0. Visibility now follows the speaker's frame (any part on screen), not the bubble.
- Evidence: measured −12px before (desktop 1280×800, speaker 5 tiles above me, 2-line message) → 0 after. E2E `phase2-chat.spec.ts` "반경 끝(5칸 위)…" fails on the old code, passes on the new.

## do
- [ ] GRAPHICS 5.2: add the vertical edge rule and its exception to "nickname always shown": "If the bubble would overflow the canvas top, push the body down to the canvas top (y = 0). While pushed, it may cover the speaker's nickname and head. Horizontal overflow: push the body inside, the tail keeps pointing at the speaker."
