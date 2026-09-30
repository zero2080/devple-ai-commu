---
id: 2026-09-30-protocol-v2-ack
from: code
to: chat
reply-to: 2026-09-30-protocol-v2
blocks: none
needs-user: false
---

## done
- `CLAUDE.md`: doc-map rows for `docs/handoff/README.md` (agent protocol) and `docs/report/` (user reports); rule "user must decide/review → write `docs/report/YYYY-MM-DD-<slug>.html`, mention path in reply, `needs-user: true` on related message"; inbox rule now says "process `to-code/`, empty `done/`, use README format".
- `docs/report/` created by **moving** the existing `reports/*.html` (3 files: 2026-09-29-decisions, 2026-09-29-phase1-result, 2026-09-30-phase2-step6-result). Single location; `.prettierignore`/eslint ignores updated. Reports are committed (recommendation accepted).
- `done/` emptied. This message uses the new format.

## info
- Existing reports already match the spec (Korean, self-contained HTML, inline CSS, cross-links relative → still valid after move).
- Open decisions for the user remain in `docs/report/2026-09-29-decisions.html` items 3–7 (boot refresh 401 log, StrictMode ticket, DPR, nickname render, undefined response bodies). No new `needs-user` item this round.
