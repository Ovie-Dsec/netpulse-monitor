const ping = require('ping');
const db = require('../db/database');

class PingerService {
  constructor() {
    this.targets = new Map();
    this.pollRate = 2000;
    this._intervals = new Map();
    this._targetRates = new Map();
    this.onResult = null;
  }

  setPollRate(ms) {
    this.pollRate = ms;
    this._targetRates.clear();
    this.restart();
  }

  setTargetPollRate(ip, ms) {
    this._targetRates.set(ip, ms);
    if (this._intervals.has(ip)) {
      clearInterval(this._intervals.get(ip));
      this._intervals.set(ip, setInterval(() => this._ping(ip), ms));
    }
  }

  getTargetPollRate(ip) {
    return this._targetRates.get(ip) || this.pollRate;
  }

  onPingResult(callback) {
    this.onResult = callback;
  }

  addTarget(ip) {
    this.targets.set(ip, { lastLatency: -1, lastStatus: 'UNKNOWN' });
    if (this._intervals.size > 0) {
      const rate = this._targetRates.get(ip) || this.pollRate;
      this._intervals.set(ip, setInterval(() => this._ping(ip), rate));
      this._ping(ip);
    }
  }

  removeTarget(ip) {
    this.targets.delete(ip);
    this._targetRates.delete(ip);
    if (this._intervals.has(ip)) {
      clearInterval(this._intervals.get(ip));
      this._intervals.delete(ip);
    }
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
    if (this._intervals.size > 0) return;
    for (const ip of this.targets.keys()) {
      const rate = this._targetRates.get(ip) || this.pollRate;
      this._intervals.set(ip, setInterval(() => this._ping(ip), rate));
      this._ping(ip);
    }
  }

  stop() {
    for (const [ip, id] of this._intervals) {
      clearInterval(id);
    }
    this._intervals.clear();
  }

  restart() {
    this.stop();
    this.start();
  }

  _ping(ip) {
    const start = Date.now();
    ping.promise.probe(ip, {
      timeout: 3,
      min_reply: 1,
      extra: ['-n', '1']
    }).then(result => {
      const elapsed = Date.now() - start;
      const timeNum = typeof result.time === 'number' ? result.time : 0;
      let latency, status;
      if (result.alive) {
        latency = timeNum || elapsed;
        status = latency < 100 ? 'ONLINE' : latency < 300 ? 'DEGRADED' : 'OFFLINE';
      } else {
        latency = timeNum;
        status = 'OFFLINE';
      }
      const entry = { ip, latency: Math.round(latency), status, timestamp: new Date().toISOString() };
      if (this.hasTarget(ip)) {
        db.logPingResult(entry.ip, entry.latency, entry.status);
        this._updateTargetState(ip, entry.latency, entry.status);
        if (this.onResult) this.onResult(entry);
      }
    }).catch(() => {
      const entry = { ip, latency: 0, status: 'OFFLINE', timestamp: new Date().toISOString() };
      if (this.hasTarget(ip)) {
        db.logPingResult(entry.ip, entry.latency, entry.status);
        this._updateTargetState(ip, 0, 'OFFLINE');
        if (this.onResult) this.onResult(entry);
      }
    });
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