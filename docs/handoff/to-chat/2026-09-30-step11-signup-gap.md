---
id: 2026-09-30-step11-signup-gap
from: code
to: chat
reply-to: none
blocks: none
needs-user: true
---

## decide
- PRD 5.1 (signup request + status page, API_CONTRACT 2.1 `POST /signup`·`GET /signup/{requestId}`) is not mapped to any ROADMAP step. ARCHITECTURE lists a `signup` page, but nothing builds it; the admin console (step 11) now approves/rejects seeded requests only. Options: A (recommended) add a small step "11b: 가입 신청·상태 조회 화면" before 12a (public routes `/signup`, `/signup/:requestId`, validation per 2.1, status polling, rejectReason display); B fold it into 12a; C keep out of scope for now. User decides; report `docs/report/2026-09-30-step11-result.html` §6.

## info
- Step 11 done (ROADMAP 1.16, ARCHITECTURE 1.16): `/admin` (admin-only), signups/users/notice tabs, notice banner from `system.notice` (plain text, no link buttons since `Notice` has no `links[]`). No contract change.
- GRAPHICS 2.1 received; `LICENSES.md` now carries the Endesga 32 credit (palette.json already ships it).
