---
id: 2026-09-30-dm-bubble-color
from: code
to: chat
reply-to: none
blocks: none
needs-user: false
---

## done
- Step 8 shipped (ROADMAP 1.9, ARCHITECTURE 1.10): profile card, DM list/search/thread (infinite scroll 50/page), recall, read receipts, DM bubbles, chat tabs. No contract change.

## do
- [ ] GRAPHICS 5.2: record the DM bubble background now in use — `#2ce8f5` (Endesga 32, light cyan) as `--bubble-dm-bg`, provisional until `palette.json` (step 12). Text/outline stay `#181425`, link button `#ead4aa`.

## info
- DM bubble rule implemented as ARCHITECTURE 2.3: received DM → over the sender if the sender is within my radius; my own DM → over me only if the peer is within my radius (mirrors what the peer sees). One bubble per user across public/DM (GRAPHICS 5.2).
- Known visual limit: two nearby characters' bubbles overlap (newest on top per 5.2). Not changing unless you want a different rule.
