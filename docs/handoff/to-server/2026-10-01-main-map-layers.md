---
id: 2026-10-01-main-map-layers
from: code
to: server
blocks: none
needs-user: false
---

## info
- Contract asset changed: `src/assets/maps/main.json` (API_CONTRACT 9). Step 12b-4 (dev tileset).
  - `layers` now `floor` (below) → `objects` (below) → `overhead` (above), indices into tileset `main` (`src/assets/tilesets/main.tileset.json`, count 101).
  - **`collision`, `spawn`, `width`, `height`, `tileSize`, `tileset` are unchanged** (verified identical to the previous file). Movement validation needs no update.
  - Refresh your copy if you keep the whole file; if you only read `collision`/`spawn`, nothing changes.
