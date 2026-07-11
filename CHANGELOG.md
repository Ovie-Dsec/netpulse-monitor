# Changelog

## v1.2.3 — 2026-07-11

### Fixed
- `SyntaxError: Identifier 'pollSelect' has already been declared` in `addNode()` — duplicate `const pollSelect` declaration prevented the entire app.js from executing, causing all frontend functionality (cards, pings, etc.) to silently fail

## v1.2.2 — 2026-07-11

### Fixed
- WebSocket orphaned after watchdog restart — `createApp()` now closes the old HTTP server before creating a new one, preventing EADDRINUSE and ensuring WS broadcasts reach connected clients
- Frontend now monitors ping receipt — if no ping is received for 15 seconds, the page auto-reloads to recover from a disconnected WS

## v1.2.1 — 2026-07-11

### Fixed
- Card ECG waveforms not rendering — duplicate `_updateStatusBar` method used `engine.data` which doesn't exist on PulseWaveEngine (`engine.buffer` is the correct property), throwing a TypeError that silently killed all subsequent WebSocket ping handling
- Removed duplicate `_updateStatusBar` and consolidated to a single implementation

## v1.2.0 — 2026-07-11

### Added
- Sound Alerts — Web Audio API oscillator plays descending tone on OFFLINE, ascending tone on recovery; toggle in Visual settings
- Desktop Notifications — Notification API fires when tab is backgrounded and a node transitions OFFLINE/ONLINE; permission requested on first enable
- Config Export/Import — download node list as JSON, upload to bulk-add nodes; buttons in Add IP settings pane
- Per-Node Ping Schedule — `poll_rate` column on `nodes` table with backward-compatible migration; per-target `setInterval` via `setTargetPollRate()`; interval `<select>` on each card (500ms – 30s); `PUT /api/nodes/:ip/pollrate` endpoint
- Particle Background — 80 floating particles with upward drift, pulse on each ping in status color; fixed `<canvas>` at z-index -1
- Historical Dashboard — toggle from header button; fetches history per node; renders latency-over-time line chart, aggregate uptime donut, and scrollable downtime timeline

### Fixed
- `NaN` latency crash on Windows when ping module returns `"unknown"` string for unreachable hosts (now properly type-checks `result.time`)

## v1.1.0 — 2026-07-11

### Added
- Global Status Summary Bar — shows Online/Degraded/Offline counts, average latency, and overall uptime percentage below the header
- Uptime Donut Ring — mini circular chart on each card showing uptime ratio as a green/red arc with percentage text
- Mini Latency Sparkline — filled-area trend chart below each card's ECG waveform plotting the last 60 pings

### Changed
- Rebuilt portable EXE with all visualization updates

## v1.0.0 — 2026-07-11

### Added
- Dynamic port allocation — server scans ports 3000–3099 for the first available port instead of hardcoding 3000
- CHANGELOG.md to track version history

### Changed
- Frontend WebSocket URL now uses `window.location.host` instead of hardcoded `:3000`, matching whatever port the server actually uses
- Rebuilt portable EXE with all updates

### Fixed
- Corrupted `data/netpulse.db` in portable folder (removed — fresh DB created on startup)
- Stale `portable Backup.zip` removed from deployment folder
- pkg `--public` flag removed from build (was preventing `sql-wasm.wasm` from being embedded)
- Child-process watchdog replaced with in-process `uncaughtException` handler (child spawn didn't work with pkg)
