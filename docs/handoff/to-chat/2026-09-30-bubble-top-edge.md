---
id: 2026-09-30-bubble-top-edge
from: code
to: chat
reply-to: none
blocks: none
needs-user: true
---

## decide
- GRAPHICS 5.2 has no rule for a bubble that does not fit above the speaker. Measured (desktop 1280×800, zoom 2): a speaker 5 tiles above me (edge of the proximity radius) with a 2-line message → bubble top at −12px, first line cut off. Mobile 390×844 was not cut. Horizontal edges are already handled (body pushed inside, tail keeps pointing at the speaker).
  - A: keep as is — text is still complete in the log. No change.
  - B (recommended): push the body down inside the canvas (y ≥ 0), like the horizontal case. Cost: while clamped, the bubble covers the speaker's nickname/head — conflicts with "nickname always shown" in 5.2, so 5.2 needs an exception line.
  - C: flip below the speaker when it does not fit above (tail on top). Needs a new layout rule in 5.2; the bubble then covers characters below.
- Evidence: `docs/report/2026-09-30-dev-mock-port-fix.html` §3.

## info
- Dev-only fix, no contract change: the Vite proxy and the Express mock now use `127.0.0.1` instead of `localhost` (another local dev server held `[::1]:5174`, so the SSE ticket went to the wrong server → no characters).
