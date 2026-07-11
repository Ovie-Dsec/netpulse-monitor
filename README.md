# Netpulse Monitor

A real-time local network diagnostics dashboard with a dark-mode cyber-medical UI. Monitors multiple IP targets via ICMP ping, renders live ECG-style waveforms, and syncs across all LAN clients via WebSocket.

![Netpulse Monitor Screenshot](NPM%20Screenshot.png)

## Features

- **Live Ping Monitoring** — ICMP ping up to 10 targets with configurable intervals
- **ECG-Style Waveforms** — Three chart types: Heartbeat ECG, Solid Step Area, Digital Grid Bar
- **Real-Time Sync** — All LAN clients see the same data simultaneously via WebSocket
- **Drag-to-Reorder Cards** — Grip handle to rearrange; order persists across restarts and syncs to all clients
- **Node Naming** — Human-readable labels alongside IP addresses
- **Global Live Console** — Timestamped event log with CSV export and resizable panel
- **Offline Detection** — Slow-pulsing red glow animation (2.5s breathing loop) on unreachable nodes
- **Self-Restart Watchdog** — Process auto-restarts on crash; Ctrl+C to exit cleanly
- **Standalone EXE** — Packaged with pkg; no Node.js installation required

## Quick Start

### Option 1: Portable EXE (Windows — no Node.js needed)

1. Download `netpulse.exe` from the [latest release](https://github.com/Ovie-Dsec/netpulse-monitor/releases)
2. Place it in a folder alongside the `public/` directory
3. Double-click `netpulse.exe`
4. Open a browser to `http://localhost:3000`
5. For LAN access from other devices, use the IP shown in the console output

### Option 2: From Source (requires Node.js 18+)

```bash
git clone https://github.com/Ovie-Dsec/netpulse-monitor.git
cd netpulse-monitor
npm install
npm start
```

Open `http://localhost:3000` in your browser.

## Configuration

Edit `src/server.js` to adjust:

| Variable | Default | Description |
|---|---|---|
| `PORT` | `3000` | HTTP server port |
| `HOST` | `0.0.0.0` | Bind address (all interfaces) |
| `PING_INTERVAL` | `5000` | Ping interval in milliseconds |
| `PING_TIMEOUT` | `4000` | Ping timeout in milliseconds |
| `DEGRADED_THRESHOLD` | `150` | Latency threshold (ms) for DEGRADED status |
| `SEED_DATA` | *(see code)* | Default monitored IPs on first run |

## Building the EXE

```bash
npm run build:portable    # Build portable version (exe + public/)
npm run build:single      # Build single-file version (self-contained)
npm run build             # Build both
```

## Data

- **Database**: SQLite (`data/netpulse.db`) — created automatically on first run
- **Ping History**: Pruned automatically after 24 hours
- **Card Order**: Persisted and synced across all LAN clients

## Tech Stack

- **Backend**: Node.js, Express, ws (WebSocket), sql.js, ping npm package
- **Frontend**: Vanilla JS, HTML5 Canvas, CSS Grid
- **Packaging**: pkg (Node.js → Windows EXE)

## License

MIT
