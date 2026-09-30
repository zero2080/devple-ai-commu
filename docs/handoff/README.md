# handoff — chat ↔ Claude Code inbox

Agent-to-agent channel. Neither side can invoke the other; each reads its own inbox at session start or when the user says "인박스 확인".

**Audience: agents only.** Optimize for the reader agent — terse English, structured, no prose padding. Anything the *user* must read goes to `docs/report/` as HTML (see below), never here.

## Folders
| path | writer | reader | content |
|---|---|---|---|
| `to-chat/` | code | chat | change requests for contract/product docs, product decisions needed |
| `to-code/` | chat | code | change requests for implementation docs, implementation instructions |
| `done/` | chat | code (deletes) | `to-chat/` files chat has finished (chat's MCP has no delete) |

## Doc ownership
- **chat**: `PRD`, `DOMAIN`, `API_CONTRACT`, `GRAPHICS` — product/contract, also read by backend
- **code**: `ROADMAP`, `ARCHITECTURE`, `CONVENTIONS`, `CLAUDE.md` — move with the code
- Never edit the other side's docs. Send a request instead.

## Message format
One request = one file: `YYYY-MM-DD-<slug>.md`

```yaml
---
id: 2026-09-30-avatar-viewport
from: chat            # chat | code
to: code
reply-to: 2026-09-30-graphics-reply   # optional
blocks: step-7        # step-N | none
needs-user: false     # true → also write docs/report/<id>.html
---
```
Body sections (omit empty ones):
- `## done` — what the sender already changed (doc@version, files)
- `## do` — requested changes, checklist `- [ ]`, each with target doc/section or file
- `## decide` — questions for the receiver, options + recommendation
- `## info` — FYI, no action

Rules:
- Receiver processes, then deletes the file (chat: moves to `done/`). Code empties `done/` when processing its own inbox.
- Answers go in a new file in the sender's inbox with `reply-to`.
- Record the outcome in the owning doc's decision log, not in handoff files. Handoff files are transient.
- Docs themselves stay in Korean (user reads them). Only handoff messages are English.

## User reports — `docs/report/`
When the user needs to see something (decision needed, milestone summary, conflict, review):
- Self-contained HTML, Korean, one file per topic: `docs/report/YYYY-MM-DD-<slug>.html`
- Inline CSS only, no external assets, readable when opened directly in a browser
- Lead with what the user must decide/know, then details
- Set `needs-user: true` on the related handoff message and mention the report path in the chat/terminal reply
- chat may deliver the same content as an in-chat artifact instead; the file is the durable copy
