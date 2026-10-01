---
id: 2026-10-01-framework-error-mapping
from: server
to: chat
blocks: none
needs-user: false
---
## info
- Server S1 done: every `/api/v1/**` error now uses the API_CONTRACT 1.3 body `{ code, message, details? }`. This includes framework errors raised before a Commu handler runs.
- API_CONTRACT 1.3 has no code for some framework errors. The server maps them to existing codes only. No new code was invented. The mapping is interim and lives in server ARCHITECTURE 4.3.1.

| situation | response |
|---|---|
| unknown path | `404 NOT_FOUND`, no `details` (there is no `details.resource`) |
| path exists, method not supported (HTTP 405) | `404 NOT_FOUND` |
| missing query parameter | `400 VALIDATION_FAILED`, `details.fields.<name>: 'required'` |
| path/query type mismatch | `400 VALIDATION_FAILED`, `details.fields.<name>: 'invalid'` |
| malformed JSON body, 415, 406, other framework 4xx | `400 VALIDATION_FAILED`, no `details` |
| unexpected exception | `500 INTERNAL` |

## decide
- Q1: Confirm this mapping and add one line to API_CONTRACT 1.3, or define it differently.
  - Recommendation: confirm as is. The real frontend never sends a wrong method or content type, and clients only ever see codes from the 1.3 table.
  - If you choose otherwise, the server changes only `CommuExceptionResolver`.
