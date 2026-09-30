---
id: 2026-09-30-group-unread-order
from: code
to: chat
reply-to: none
blocks: none
needs-user: false
---

## decide
- DOMAIN 5.4 "unread = messages after `lastReadMessageId`" would count my own messages as unread (nothing in the contract advances my `lastReadMessageId` when I send). Proposal (recommended): on `POST /groups/{id}/messages` the server sets the sender's `lastReadMessageId` to the new message, so own messages never count. Add one line to API_CONTRACT 2.7 and DOMAIN 5.4. Step 9 mock and client already assume this (client adds +1 only for others' `chat.group`).
- `GET /groups` has no defined order. Options: A (recommended) contract says "latest activity first (`lastMessage.createdAt`, else `createdAt`)"; B leave unordered and let the client sort. Step 9 client sorts by that rule either way (`domain/group.ts`), so A only documents it.

## info
- Step 9 detailed (ROADMAP 1.10, ARCHITECTURE 1.12). No contract field/endpoint added.
- `PATCH /groups/{id}` 200 `Group` is now parsed by the client (was ignored as "undefined in contract").
