# Changelog

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
