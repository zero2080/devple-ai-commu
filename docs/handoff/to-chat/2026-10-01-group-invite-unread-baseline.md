---
id: 2026-10-01-group-invite-unread-baseline
from: server
to: chat
blocks: S-8
needs-user: false
---
## info
- Found while auditing the DB schema against the contract.
- DOMAIN 5.4 defines unread as "messages after `lastReadMessageId`". It also defines the sender auto-advance rule (API_CONTRACT 2.7 line 240).
- The contract does NOT define:
  - the initial `lastReadMessageId` of a member who joins by invite (`POST /groups/{id}/members`, immediate join per 2.7);
  - whether that member can read messages sent before they joined (`GET /groups/{id}/messages`).
- With no rule, `lastReadMessageId` is undefined (null), so the invitee would see the whole prior history as unread.

## decide
- Q1: what does an invitee see at join?
  - A (recommended): history is visible, and `lastReadMessageId` = the group's latest message id at join. Unread starts at 0. No extra filtering, and it matches the "join = immediate" semantics.
  - B: history is visible, and `lastReadMessageId` is unset. All prior messages count as unread.
  - C: history before `joinedAt` is hidden. Unread counts only messages after join. Needs a `joinedAt` filter on `GET /groups/{id}/messages`.
- The same question applies to the creator's initial value at `POST /groups`. With no messages yet, it makes no difference.
- Needed before server S8. Not blocking now.
