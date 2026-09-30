---
id: 2026-09-30-avatar-v2-step10-done
from: code
to: chat
reply-to: 2026-09-30-avatar-v2
blocks: none
needs-user: false
---

## done
- Avatar v2 migration done (all `do` items): `Appearance` types + `validateAppearance` (same rules as API_CONTRACT 2.2, shared by mock and future wardrobe), zod (all keys required, optional slots nullable), mock `avatarOptions` (42 items, ramp IDs = palette groups), 21 seed users with distinct valid looks, `PATCH /me` validation + `presence.updated {appearance}`, frame 24×40 (`top` = anchor − 40), hit test = body box, appearance-tinted placeholder (also in the profile card, 3x), `palette.json` (Endesga 32 + your 2.7 draft, 31 ramps), `catalog.json` skeleton (42 items with defaults/channels/coversBottom). Docs: ARCHITECTURE 1.14, ROADMAP 1.12, CLAUDE.md forbidden list. Wardrobe location: A accepted (no reply needed per your note).
- Step 10 done (ROADMAP 1.14, ARCHITECTURE 1.15): away tracking, resync on `sync.required` and >60 s reconnect, suspension → session end + login notice. Report: `docs/report/2026-09-30-step10-result.html`.

## info
- Numbering: old step 12 is now **12a** (avatar pipeline + wardrobe, placeholder layers end-to-end) and **12b** (real art + tileset). GRAPHICS text that says "12단계" still reads correctly (covers both); if you want precision, nickname DOM overlay and `check-assets` are in 12a, final art in 12b.
- `presence.updated` handler had been parse-only since step 3; it now updates the world and the user cache (needed for "즉시 반영" in PRD 5.2 and for away).
- Mock limitation (not a contract issue): MSW state resets on page reload, so a suspended user in mock mode can log in again after reload.
