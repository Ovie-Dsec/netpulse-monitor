const ping = require('ping');
const db = require('../db/database');

class PingerService {
  constructor() {
    this.targets = new Map();
    this.interval = null;
    this.pollRate = 2000;
    this.onResult = null;
  }

  setPollRate(ms) {
    this.pollRate = ms;
    if (this.interval) {
      this.restart();
    }
  }

  onPingResult(callback) {
    this.onResult = callback;
  }

  addTarget(ip) {
    this.targets.set(ip, { lastLatency: -1, lastStatus: 'UNKNOWN' });
  }

  removeTarget(ip) {
    this.targets.delete(ip);
  }

  hasTarget(ip) {
    return this.targets.has(ip);
  }

  getTargets() {
    return Array.from(this.targets.keys());
  }

  getTargetState(ip) {
    return this.targets.get(ip) || null;
  }

  start() {
    if (this.interval) return;
    this._tick();
    this.interval = setInterval(() => this._tick(), this.pollRate);
  }

  stop() {
    if (this.interval) {
      clearInterval(this.interval);
      this.interval = null;
    }
  }

  restart() {
    this.stop();
    this.start();
  }

  _tick() {
    for (const ip of this.targets.keys()) {
      this._ping(ip);
    }
  }

  async _ping(ip) {
    const start = Date.now();

    try {
      const result = await ping.promise.probe(ip, {
        timeout: 3,
        min_reply: 1,
        extra: ['-n', '1']
      });

      const elapsed = Date.now() - start;
      let latency, status;

      if (result.alive) {
        latency = result.time || elapsed;
        status = latency < 100 ? 'ONLINE' : latency < 300 ? 'DEGRADED' : 'OFFLINE';
      } else {
        latency = result.time || 0;
        status = 'OFFLINE';
      }

      const entry = {
        ip,
        latency: Math.round(latency),
        status,
        timestamp: new Date().toISOString()
      };

      if (this.hasTarget(ip)) {
        await db.logPingResult(entry.ip, entry.latency, entry.status);
        this._updateTargetState(ip, entry.latency, entry.status);
        if (this.onResult) {
          this.onResult(entry);
        }
      }
    } catch (err) {
      const entry = {
        ip,
        latency: 0,
        status: 'OFFLINE',
        timestamp: new Date().toISOString()
      };

      if (this.hasTarget(ip)) {
        await db.logPingResult(entry.ip, entry.latency, entry.status);
        this._updateTargetState(ip, 0, 'OFFLINE');
        if (this.onResult) {
          this.onResult(entry);
        }
      }
    }
  }

  _updateTargetState(ip, latency, status) {
    const state = this.targets.get(ip);
    if (state) {
      state.lastLatency = latency;
      state.lastStatus = status;
    }
  }
}

module.exports = new PingerService();
