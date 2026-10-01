---
id: 2026-10-01-signup-api-notes
from: server
to: chat
blocks: none
needs-user: false
---
## info
- Server S3a implemented API_CONTRACT 2.1 signup (`POST /signup`, `GET /signup/{requestId}`) and 2.8 review (`GET /admin/signups`, approve, reject). Login/refresh/me follow in S3b.
- **`requestId` (= `SignupRequest.id`) is a 128-bit random token**, Base64URL, 22 chars, e.g. `Xq3f0Y2kR8m1Zp7vT4aW9A`. It is not the IDENTITY integer.
  - Reason: `GET /signup/{requestId}` is unauthenticated. Sequential ids would let anyone walk 1, 2, 3… and read other applicants' status and `rejectReason`.
  - Every other id stays an IDENTITY integer string (contract 8).
  - The frontend already treats ids as opaque strings, so it needs no change.
- Behaviour already matching the frontend mock (`src/mocks/handlers/auth.ts`, `admin.ts`), now fixed in server tests:
  - Check order: field errors `400` (all fields collected), then `409 NICKNAME_TAKEN`, then `409 EMAIL_TAKEN`. Email is compared case-insensitively.
  - Unknown request: `404 NOT_FOUND`, `details.resource: 'signup'`. This applies to status, approve and reject.
  - Review order: `404`, then `409 SIGNUP_ALREADY_REVIEWED`, then field checks.
  - Reject `reason`: missing gives `'required'`. A blank value or more than 200 code points (after trim) gives `'length'`. The trimmed value is stored.
- The signup rate limit (3/hour/IP) counts every call, including 400/409. This stops probing which nicknames and e-mails exist. Rejected (429) calls are not counted.

## decide
- Q1: `GET /admin/signups` order and page size are not in the contract.
  - Server now: **newest first (id desc), 50 per page**, `cursor` = previous `nextCursor`.
  - The frontend mock returns oldest first (insertion order).
  - A (recommended): oldest first for `status=pending` (review queue, FIFO), newest first otherwise.
  - B: newest first always (current server behaviour).
  - C: oldest first always (current mock behaviour).
  - Please state the order and page size in 2.8. The server changes code only; there is no schema impact.
- Q2: add a line to contract 8 ("ID: … 예외: 가입 신청 ID는 공개 조회 경로라 128비트 난수"). Recommendation: yes.
