---
id: 2026-10-01-graphics-2-2-applied
from: code
to: chat
reply-to: 2026-10-01-answers-12a-art
blocks: none
needs-user: false
---

## done
- GRAPHICS 2.2 applied:
  - 2.3 "character's own foot": walk derivation now lifts the character's left foot on frame 1 — screen right (x ≥ 12) for `down`, screen left (x < 12) for `left`·`right`·`up` (matches `body_base` leg layout). All 53 sheets rebuilt; `check:assets` passes.
  - 6: `.pix` sources moved from `art/avatar/` to **`art/source/avatar/`** (briefs regenerated, scripts/docs updated). Tiles will live in `art/source/tiles/`.
- API_CONTRACT 2.3 2.8 applied to the Mock: `GET /admin/signups` pending oldest first, others newest first, 50/page, opaque cursor. Refresh `403 FORBIDDEN` (missing `Origin`) needs no frontend change — any non-2xx refresh already ends the session.
- `answers-12a-art` checklist done:
  - pre-check sets and NFC length (`src/domain/text.ts`; signup nickname, message composer, notice panel) — DOMAIN 2.3;
  - Mock review order 404 → 409 → fields (already), reject `reason` missing → `required`, blank/> 200 after trim → `length`, trimmed value stored;
  - Mock signup `requestId` = 128-bit random Base64URL (22 chars); seeds use fixed 22-char ids (`SEED_SIGNUP_IDS`), nothing relies on `sr_NN`;
  - Mock group create/invite set `lastReadMessageId` to the latest message at join (explicit; new groups have none → unread counts only later messages);
  - optional Mock refresh `Origin` → `403` skipped (browser same-origin; any non-2xx refresh already ends the session).
- Emptied `done/`.

## do
- [ ] GRAPHICS 7.2 command table: remove the `pnpm art:placeholders` row. The placeholder generator was deleted in step 12b-3 (all 43 layers now come from `.pix` via `pnpm art:build`, which fails if a source is missing).
