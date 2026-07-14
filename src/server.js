const path = require('path');
const fs = require('fs');
const net = require('net');
const express = require('express');
const http = require('http');
const { WebSocketServer } = require('ws');
const db = require('./db/database');
const pinger = require('./services/pinger');

let PORT = 3000;
const HOST = '0.0.0.0';

async function getAvailablePort(start) {
  for (let port = start; port < start + 100; port++) {
    try {
      await new Promise((resolve, reject) => {
        const srv = net.createServer();
        srv.on('error', reject);
        srv.listen(port, HOST, () => { srv.close(() => resolve()); });
      });
      return port;
    } catch (e) {
      if (e.code !== 'EADDRINUSE') throw e;
    }
  }
  throw new Error('No available port found in range ' + start + '-' + (start + 99));
}

let app, server, wss, clients;

function createApp() {
  if (server) {
    try { server.close(); } catch (_) {}
  }
  app = express();
  server = http.createServer(app);
  wss = new WebSocketServer({ server });
  clients = new Set();
}

createApp();

app.use(express.json());

const publicDir = (process.pkg)
  ? (fs.existsSync(path.join(path.dirname(process.execPath), 'public'))
      ? path.join(path.dirname(process.execPath), 'public')
      : path.join(__dirname, '..', 'public'))
  : path.join(__dirname, '..', 'public');
app.use(express.static(publicDir));

wss.on('connection', (ws) => {
  clients.add(ws);

  ws.on('close', () => {
    clients.delete(ws);
  });

  ws.send(JSON.stringify({
    type: 'connected',
    targets: pinger.getTargets()
  }));
});

function broadcast(msg) {
  const data = JSON.stringify(msg);
  for (const ws of clients) {
    if (ws.readyState === 1) {
      ws.send(data);
    }
  }
}

pinger.onPingResult((entry) => {
  broadcast({ type: 'ping', data: entry });
});

app.get('/api/targets', async (req, res) => {
  try {
    const targets = await db.getTargets();
    const nodes = await db.getAllNodes();
    const nodeMap = {};
    nodes.forEach(n => { nodeMap[n.ip] = { name: n.name, pollRate: n.pollRate }; });

    const withState = await Promise.all(targets.map(async ip => {
      const state = pinger.getTargetState(ip);
      const latest = await db.getLatestForTarget(ip);
      return {
        ip,
        name: (nodeMap[ip] && nodeMap[ip].name) || ip,
        pollRate: (nodeMap[ip] && nodeMap[ip].pollRate) || 0,
        state: state ? { latency: state.lastLatency, status: state.lastStatus } : null,
        latest
      };
    }));

    res.json({
      targets: withState,
      polling: pinger.getTargets()
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/history/:ip', async (req, res) => {
  try {
    const ip = req.params.ip;
    const limit = parseInt(req.query.limit, 10) || 200;

    const history = await db.getHistoryWindow(ip, limit);
    const downtime = await db.getHistoricalDowntime(ip);

    res.json({ ip, history, downtime });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/targets', async (req, res) => {
  try {
    const { ip, name } = req.body;
    if (!ip) {
      return res.status(400).json({ error: 'ip is required' });
    }

    if (pinger.hasTarget(ip)) {
      return res.status(409).json({ error: 'target already exists' });
    }

    pinger.addTarget(ip);
    await db.setNodeName(ip, name || ip);
    await db.logPingResult(ip, -1, 'ONLINE');
    const nodes = await db.getAllNodes();
    const maxOrder = nodes.reduce((m, n) => Math.max(m, n.sortOrder || 0), 0);
    await db.updateNodeOrder(nodes.map(n => n.ip).concat(ip));
    broadcast({ type: 'target-added', ip, name: name || ip });
    res.status(201).json({ ip, name: name || ip, status: 'added' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.put('/api/targets/:ip', async (req, res) => {
  try {
    const oldIp = req.params.ip;
    const { ip: newIp, name } = req.body;

    if (!newIp) {
      return res.status(400).json({ error: 'new ip is required' });
    }
    if (!pinger.hasTarget(oldIp)) {
      return res.status(404).json({ error: 'target not found' });
    }
    if (pinger.hasTarget(newIp)) {
      return res.status(409).json({ error: 'target ' + newIp + ' already exists' });
    }

    await db.renameTarget(oldIp, newIp);
    if (name) await db.setNodeName(newIp, name);
    pinger.removeTarget(oldIp);
    pinger.addTarget(newIp);
    const node = await db.getNode(newIp);
    broadcast({ type: 'target-updated', oldIp, ip: newIp, name: node ? node.name : (name || newIp) });
    res.json({ oldIp, ip: newIp, status: 'updated' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.delete('/api/targets/:ip', async (req, res) => {
  try {
    const ip = req.params.ip;
    if (pinger.hasTarget(ip)) {
      pinger.removeTarget(ip);
    }
    await db.deleteTarget(ip);
    broadcast({ type: 'target-removed', ip });
    res.json({ ip, status: 'removed' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/settings', (req, res) => {
  res.json({ pollRate: 2000 });
});

app.put('/api/settings', (req, res) => {
  const { pollRate } = req.body;
  if (pollRate && pollRate >= 500 && pollRate <= 30000) {
    pinger.setPollRate(pollRate);
    broadcast({ type: 'settings-updated', pollRate });
    res.json({ pollRate });
  } else {
    res.status(400).json({ error: 'pollRate must be between 500 and 30000' });
  }
});

app.get('/api/nodes', async (req, res) => {
  try {
    const nodes = await db.getAllNodes();
    const withStatus = nodes.map(n => {
      const state = pinger.getTargetState(n.ip);
      return {
        ip: n.ip,
        name: n.name,
        state: state ? { latency: state.lastLatency, status: state.lastStatus } : null
      };
    });
    res.json({ nodes: withStatus });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.put('/api/nodes/reorder', async (req, res) => {
  try {
    const { order } = req.body;
    if (!Array.isArray(order) || order.length === 0) {
      return res.status(400).json({ error: 'order array is required' });
    }
    await db.updateNodeOrder(order);
    broadcast({ type: 'nodes-reordered', order });
    res.json({ status: 'reordered' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.put('/api/nodes/:ip/pollrate', async (req, res) => {
  try {
    const ip = req.params.ip;
    const { pollRate } = req.body;
    const rate = parseInt(pollRate, 10);
    if (isNaN(rate) || rate < 500) {
      return res.status(400).json({ error: 'pollRate must be >= 500' });
    }
    await db.setNodePollRate(ip, rate);
    pinger.setTargetPollRate(ip, rate);
    res.json({ ip, pollRate: rate, status: 'updated' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.put('/api/nodes/:ip', async (req, res) => {
  try {
    const ip = req.params.ip;
    const { name } = req.body;
    if (!name) {
      return res.status(400).json({ error: 'name is required' });
    }
    await db.setNodeName(ip, name);
    broadcast({ type: 'node-renamed', ip, name });
    res.json({ ip, name, status: 'updated' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

const SEED_DATA = [
  { ip: '8.8.8.8', name: 'Google DNS' },
  { ip: '1.1.1.1', name: 'Cloudflare DNS' },
  { ip: '192.168.1.1', name: 'Local Router' },
  { ip: '10.0.0.1', name: 'Gateway' }
];

async function seedInitialTargets() {
  if (pinger.getTargets().length > 0) return;
  try {
    const existing = await db.getAllNodes();
    if (existing.length > 0) {
      existing.forEach(n => pinger.addTarget(n.ip));
      return;
    }
  } catch (_) {
  }
  for (const s of SEED_DATA) {
    pinger.addTarget(s.ip);
    await db.setNodeName(s.ip, s.name);
  }
}

setInterval(async () => {
  try {
    await db.pruneOldRecords(24);
  } catch (err) {
    console.error('Prune error:', err);
  }
}, 3600000);

function getLanIps() {
  const os = require('os');
  const ifaces = os.networkInterfaces();
  const ips = [];
  for (const name of Object.keys(ifaces)) {
    for (const iface of ifaces[name]) {
      if (iface.family === 'IPv4' && !iface.internal) ips.push(iface.address);
    }
  }
  return ips;
}

async function startServer() {
  await seedInitialTargets();
  pinger.start();
  server.listen(PORT, HOST, () => {
    const ips = getLanIps();
    console.log(`Netpulse Monitor running on http://localhost:${PORT}`);
    for (const ip of ips) {
      console.log(`LAN access:      http://${ip}:${PORT}`);
    }
    console.log(`[TIP] If LAN clients cannot connect, run as Admin:`);
    console.log(`      netsh advfirewall firewall add rule name="Netpulse Monitor" dir=in action=allow protocol=TCP localport=${PORT}`);
  });
}

let restarting = true;
let restartCount = 0;

process.on('SIGINT', () => { restarting = false; process.exit(0); });
process.on('SIGTERM', () => { restarting = false; process.exit(0); });

process.on('uncaughtException', (err) => {
  console.error(`\nFatal error: ${err.message}`);
  if (!restarting) return;
  restartCount++;
  if (restartCount > 3) {
    console.error('Max restarts reached. Shutting down.');
    console.error(`Check DB_PATH for permission/disk issues.`);
    restarting = false;
    process.exit(1);
  }
  console.log('Restarting in 3s... (attempt ' + restartCount + '/3)');
  db.closeDb();
  setTimeout(() => {
    createApp();
    startServer().catch(() => {});
  }, 3000);
});

async function main() {
  PORT = await getAvailablePort(3000);
  startServer().catch(() => {});
}

main();
