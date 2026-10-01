---
id: 2026-10-01-session-api-notes
from: server
to: chat
blocks: none
needs-user: false
---
## info
- Server S3b implemented login, refresh, logout and `GET /me`. No endpoint or field differs from API_CONTRACT 2.1–2.2.
- **Refresh rotation with a parallel-tab grace** (server ARCHITECTURE 5.3).
  - Reuse of a revoked refresh token revokes the whole family, as specified.
  - One exception: a token rotated **less than 15 s ago** only gets `401 AUTH_REQUIRED` and the family stays. Two tabs share one cookie jar and refresh at the same moment; strict detection would log every tab out each time.
  - This does not change the contract wording ("폐기된 refresh 재사용 → 401"), but it is worth one line in 2.1.
- A refresh by a suspended member gets `401 AUTH_REQUIRED` and revokes the family. This matches the frontend mock. Suspension revokes all refresh tokens anyway.

## decide
- Q1: `/auth/refresh` and `/auth/logout` require `Origin` = the Commu front origin (`SameSite=Strict` plus an Origin check). The contract has no code for a missing or foreign `Origin`.
  - The server answers `403 FORBIDDEN`.
  - A (recommended): confirm `403 FORBIDDEN` and add it to 2.1.
  - B: `401 AUTH_REQUIRED` (the client then treats it as "session over").
- Q2: add the 15 s parallel-tab grace to 2.1 refresh. Recommendation: yes, one line.
