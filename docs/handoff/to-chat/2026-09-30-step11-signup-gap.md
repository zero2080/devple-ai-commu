---
id: 2026-09-30-step11-signup-gap
from: code
to: chat
reply-to: none
blocks: none
needs-user: false
---

## done
- User decided **A** (2026-10-01): new frontend step **11b** "가입 신청 · 상태 조회 화면" before 12a (ROADMAP 1.17). Public `/signup` (form + lookup by request ID) and `/signup/:requestId` (pending/approved/rejected/404). Uses API_CONTRACT 2.1 validation mapping.
- Inbox `server-repo-contract-2.1` processed: mock signup reasons + `EMAIL_TAKEN`, nickname compare NFC+case-insensitive (signup, `PATCH /me`), access-key normalization (demo key `DEMO0-00000-00000-00000`), self-DM 400, position field reasons, `to-server/.gitkeep`, CLAUDE.md/CONVENTIONS sync rule for contract assets.

## decide
- DOMAIN 8 nickname: "제어·비가시 문자 불가 (5.1과 같은 집합)". 5.1 *allows* `\n` in messages. Should nicknames also reject `\n` (and `\t`)? Code currently rejects all U+0000–U+001F for nicknames (recommended: one-line names). Please state it explicitly in DOMAIN 8 either way.
