# handoff — chat ↔ Claude Code (web · server) inbox

Agent-to-agent channel. No side can invoke another; each reads its own inbox at session start or when the user says "인박스 확인".

Three agents:
- **chat** — Claude.ai conversation. Owns product/contract docs
- **code** — Claude Code session in this repo (`devple-ai-commu`, frontend)
- **server** — Claude Code session in `../devple-stories` (existing Spring Boot API repo; Commu lives in `net.devple.core.commu`, docs in `docs/commu/`). Reads this folder via `--add-dir`

**Audience: agents only.** Optimize for the reader agent — terse English, structured, no prose padding. Anything the *user* must read goes to `docs/report/` as HTML (see below), never here.

## Folders
| path | writer | reader | content |
|---|---|---|---|
| `to-chat/` | code, server | chat | change requests for contract/product docs, product decisions needed |
| `to-code/` | chat, server | code | change requests for frontend implementation docs, implementation instructions, server-side FYI (e.g. endpoint ready) |
| `to-server/` | chat, code | server | contract changes to implement, contract-asset changes (map, catalog, palette — API_CONTRACT 9), frontend-side FYI |
| `done/` | chat | code (deletes) | `to-chat/` files chat has finished (chat's MCP has no delete) |

## Doc ownership
- **chat**: `PRD`, `DOMAIN`, `API_CONTRACT`, `GRAPHICS`, `DEPLOYMENT` — product/contract/topology, read by both code and server
- **code**: this repo's `ROADMAP`, `ARCHITECTURE`, `CONVENTIONS`, `CLAUDE.md` — move with the frontend code
- **server**: `../devple-stories/` `CLAUDE.md`, `docs/commu/*` — move with the backend code. (That repo also hosts the unrelated Stories product; chat and code never request changes to Stories.)
- Never edit another side's docs. Send a request instead.
- Contract changes always go through chat. code ↔ server may message each other directly only for implementation coordination that does not change the contract (readiness, ports, test data).

## Message format
One request = one file: `YYYY-MM-DD-<slug>.md`

```yaml
---
id: 2026-09-30-avatar-viewport
from: chat            # chat | code | server
to: code              # chat | code | server
reply-to: 2026-09-30-graphics-reply   # optional
blocks: step-7        # step-N (frontend) | S-N (server) | none
needs-user: false     # true → also write docs/report/<id>.html
---
```
Body sections (omit empty ones):
- `## done` — what the sender already changed (doc@version, files)
- `## do` — requested changes, checklist `- [ ]`, each with target doc/section or file
- `## decide` — questions for the receiver, options + recommendation
- `## info` — FYI, no action

Rules:
- Receiver processes, then deletes the file (chat: moves to `done/`). Code empties `done/` when processing its own inbox. Server deletes its own `to-server/` files.
- Answers go in a new file in the sender's inbox with `reply-to`.
- Record the outcome in the owning doc's decision log, not in handoff files. Handoff files are transient.
- Docs themselves stay in Korean (user reads them). Only handoff messages are English.

## User reports — `docs/report/`
When the user needs to see something (decision needed, milestone summary, conflict, review). Each repo keeps its own: frontend `docs/report/`, server `../devple-stories/docs/report/`.
- Self-contained HTML, Korean, one file per topic: `docs/report/YYYY-MM-DD-<slug>.html`
- Inline CSS only, no external assets, readable when opened directly in a browser
- Lead with what the user must decide/know, then details
- Set `needs-user: true` on the related handoff message and mention the report path in the chat/terminal reply
- chat may deliver the same content as an in-chat artifact instead; the file is the durable copy
