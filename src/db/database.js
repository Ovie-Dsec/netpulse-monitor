const initSqlJs = require('sql.js');
const path = require('path');
const fs = require('fs');

const baseDir = process.pkg ? path.dirname(process.execPath) : process.cwd();
const DB_DIR = path.join(baseDir, 'data');
const DB_PATH = path.join(DB_DIR, 'netpulse.db');

let db = null;
let SQL = null;

async function getDb() {
  if (db) return db;

  if (!SQL) {
    SQL = await initSqlJs();
  }

  if (!fs.existsSync(DB_DIR)) {
    fs.mkdirSync(DB_DIR, { recursive: true });
  }

  if (fs.existsSync(DB_PATH)) {
    const buffer = fs.readFileSync(DB_PATH);
    db = new SQL.Database(buffer);
  } else {
    db = new SQL.Database();
  }

  db.run('PRAGMA journal_mode=WAL');
  db.run('PRAGMA synchronous=NORMAL');
  _initSchema();

  return db;
}

function _initSchema() {
  db.run(`
    CREATE TABLE IF NOT EXISTS ping_history (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      ip_address TEXT NOT NULL,
      latency INTEGER NOT NULL,
      status TEXT NOT NULL CHECK (status IN ('ONLINE', 'DEGRADED', 'OFFLINE')),
      timestamp TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
    )
  `);
  db.run('CREATE INDEX IF NOT EXISTS idx_ping_history_ip ON ping_history(ip_address)');
  db.run('CREATE INDEX IF NOT EXISTS idx_ping_history_ts ON ping_history(timestamp)');
  db.run(`
    CREATE TABLE IF NOT EXISTS nodes (
      ip_address TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      sort_order INTEGER DEFAULT 0
    )
  `);
  try { db.run('ALTER TABLE nodes ADD COLUMN sort_order INTEGER DEFAULT 0'); } catch (_) {}
  try { db.run('ALTER TABLE nodes ADD COLUMN poll_rate INTEGER DEFAULT 0'); } catch (_) {}
  _save();
}

function _save() {
  try {
    const data = db.export();
    const buffer = Buffer.from(data);
    fs.writeFileSync(DB_PATH, buffer);
  } catch (err) {
    console.error(`[DB] _save failed: ${err.message}`);
    console.error(`[DB] DB_PATH=${DB_PATH}`);
    console.error(`[DB] DB_DIR=${DB_DIR}`);
  }
}

function closeDb() {
  try {
    if (db) {
      _save();
    }
  } catch (_) {}
  db = null;
  SQL = null;
}

async function logPingResult(ip, latency, status) {
  const d = await getDb();
  d.run(
    'INSERT INTO ping_history (ip_address, latency, status) VALUES (?, ?, ?)',
    [ip, latency, status]
  );
  _save();
}

async function getLatestForTarget(ip) {
  const d = await getDb();
  const stmt = d.prepare(
    'SELECT latency, status, timestamp FROM ping_history WHERE ip_address = ? ORDER BY timestamp DESC LIMIT 1'
  );
  stmt.bind([ip]);
  let row = null;
  if (stmt.step()) {
    row = stmt.getAsObject();
  }
  stmt.free();
  return row;
}

async function getTargets() {
  const d = await getDb();
  const results = d.exec('SELECT ip_address FROM nodes ORDER BY sort_order ASC, ip_address ASC');
  if (results.length === 0) return [];
  return results[0].values.map(row => row[0]);
}

async function setNodePollRate(ip, pollRate) {
  const d = await getDb();
  d.run('UPDATE nodes SET poll_rate = ? WHERE ip_address = ?', [pollRate, ip]);
  _save();
}

async function getHistoricalDowntime(ip) {
  const d = await getDb();
  const stmt = d.prepare(
    'SELECT latency, status, timestamp FROM ping_history WHERE ip_address = ? ORDER BY timestamp ASC'
  );
  stmt.bind([ip]);

  const rows = [];
  while (stmt.step()) {
    rows.push(stmt.getAsObject());
  }
  stmt.free();

  const blocks = [];
  let currentBlock = null;

  for (const row of rows) {
    if (row.status === 'OFFLINE' || row.status === 'DEGRADED') {
      if (!currentBlock) {
        currentBlock = { start: row.timestamp, end: row.timestamp, events: [] };
      } else {
        currentBlock.end = row.timestamp;
      }
      currentBlock.events.push({ latency: row.latency, status: row.status, timestamp: row.timestamp });
    } else {
      if (currentBlock) {
        blocks.push(currentBlock);
        currentBlock = null;
      }
    }
  }
  if (currentBlock) {
    blocks.push(currentBlock);
  }
  return blocks;
}

async function getHistoryWindow(ip, limit) {
  const d = await getDb();
  const stmt = d.prepare(
    'SELECT latency, status, timestamp FROM ping_history WHERE ip_address = ? ORDER BY timestamp DESC LIMIT ?'
  );
  stmt.bind([ip, limit || 200]);

  const rows = [];
  while (stmt.step()) {
    rows.push(stmt.getAsObject());
  }
  stmt.free();

  return rows.reverse();
}

async function deleteTarget(ip) {
  const d = await getDb();
  d.run('DELETE FROM ping_history WHERE ip_address = ?', [ip]);
  d.run('DELETE FROM nodes WHERE ip_address = ?', [ip]);
  _save();
}

async function renameTarget(oldIp, newIp) {
  const d = await getDb();
  d.run('UPDATE ping_history SET ip_address = ? WHERE ip_address = ?', [newIp, oldIp]);
  d.run('UPDATE nodes SET ip_address = ? WHERE ip_address = ?', [newIp, oldIp]);
  _save();
}

async function pruneOldRecords(hours) {
  const d = await getDb();
  d.run(
    "DELETE FROM ping_history WHERE timestamp < datetime('now', '-' || ? || ' hours')",
    [hours || 24]
  );
  _save();
}

async function setNodeName(ip, name) {
  const d = await getDb();
  d.run(
    'INSERT INTO nodes (ip_address, name) VALUES (?, ?) ON CONFLICT(ip_address) DO UPDATE SET name = excluded.name',
    [ip, name]
  );
  _save();
}

async function updateNodeOrder(orderedIps) {
  const d = await getDb();
  for (let i = 0; i < orderedIps.length; i++) {
    d.run('UPDATE nodes SET sort_order = ? WHERE ip_address = ?', [i, orderedIps[i]]);
  }
  _save();
}

async function getNodeName(ip) {
  const d = await getDb();
  const stmt = d.prepare('SELECT name FROM nodes WHERE ip_address = ?');
  stmt.bind([ip]);
  let name = null;
  if (stmt.step()) {
    name = stmt.getAsObject().name;
  }
  stmt.free();
  return name;
}

async function getNode(ip) {
  const d = await getDb();
  const stmt = d.prepare('SELECT ip_address, name FROM nodes WHERE ip_address = ?');
  stmt.bind([ip]);
  let node = null;
  if (stmt.step()) {
    node = stmt.getAsObject();
  }
  stmt.free();
  return node;
}

async function getAllNodes() {
  const d = await getDb();
  const results = d.exec('SELECT ip_address, name, sort_order, poll_rate FROM nodes ORDER BY sort_order ASC, ip_address ASC');
  if (results.length === 0) return [];
  return results[0].values.map(row => ({ ip: row[0], name: row[1], sortOrder: row[2], pollRate: row[3] || 0 }));
}

module.exports = {
  logPingResult,
  getLatestForTarget,
  getTargets,
  getHistoricalDowntime,
  getHistoryWindow,
  deleteTarget,
  renameTarget,
  pruneOldRecords,
  setNodeName,
  getNodeName,
  getNode,
  getAllNodes,
  setNodePollRate,
  updateNodeOrder,
  getDb,
  closeDb
};
