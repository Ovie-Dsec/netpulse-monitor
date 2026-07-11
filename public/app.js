class PulseWaveEngine {
  constructor(canvas) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    this.bufferSize = 200;
    this.buffer = new Float32Array(this.bufferSize);
    this.writeIndex = 0;
    this.sampleCount = 0;
    this.running = false;
    this.rafId = null;
    this.color = '#00ff66';
    this.lineWidth = 1.5;
    this.baseline = 0.78;
    this.amplitude = 0.35;
    this.chartType = 'ecg';
    this.displayWindow = 20;
    this._initCanvas();
  }

  _initCanvas() {
    const rect = this.canvas.getBoundingClientRect();
    const dpr = window.devicePixelRatio || 1;
    this.canvas.width = rect.width * dpr;
    this.canvas.height = rect.height * dpr;
    this.ctx.scale(dpr, dpr);
    this.width = rect.width;
    this.height = rect.height;
  }

  resize() {
    this._initCanvas();
  }

  pushValue(value) {
    this.buffer[this.writeIndex] = value;
    this.writeIndex = (this.writeIndex + 1) % this.bufferSize;
    if (this.sampleCount < this.bufferSize) {
      this.sampleCount++;
    }
  }

  pushPing(ms) {
    const normalized = Math.min(ms / 500, 1);
    const spike = 1 - normalized;
    this.pushValue(Math.max(spike, 0));
  }

  pushEmpty() {
    this.pushValue(-1);
  }

  start() {
    if (this.running) return;
    this.running = true;
    this._tick();
  }

  stop() {
    this.running = false;
    if (this.rafId) {
      cancelAnimationFrame(this.rafId);
      this.rafId = null;
    }
  }

  _tick() {
    if (!this.running) return;
    this._draw();
    this.rafId = requestAnimationFrame(() => this._tick());
  }

  _draw() {
    const ctx = this.ctx;
    const w = this.width;
    const h = this.height;
    const baselineY = h * this.baseline;
    const amp = h * this.amplitude;

    ctx.clearRect(0, 0, w, h);

    const total = Math.min(this.sampleCount, this.bufferSize);
    const renderCount = Math.min(total, this.displayWindow);
    if (renderCount < 2) return;

    const startIdx = this.writeIndex - renderCount;
    const offset = startIdx < 0 ? this.bufferSize + startIdx : startIdx;
    const stepX = w / (renderCount - 1);

    switch (this.chartType) {
      case 'step-area':
        this._drawStepArea(ctx, offset, renderCount, stepX, baselineY, amp, w);
        break;
      case 'grid-bar':
        this._drawGridBar(ctx, offset, renderCount, stepX, baselineY, amp);
        break;
      default:
        this._drawEcg(ctx, offset, renderCount, stepX, baselineY, amp);
        break;
    }
  }

  _drawEcg(ctx, offset, count, stepX, baselineY, amp) {
    ctx.beginPath();
    let first = true;
    for (let i = 0; i < count; i++) {
      const val = this.buffer[(offset + i) % this.bufferSize];
      const x = i * stepX;
      const y = val < 0 ? baselineY : baselineY - val * amp;
      if (first) { ctx.moveTo(x, y); first = false; }
      else { ctx.lineTo(x, y); }
    }
    ctx.strokeStyle = this.color;
    ctx.lineWidth = this.lineWidth;
    ctx.shadowColor = this.color;
    ctx.shadowBlur = 8;
    ctx.stroke();
    ctx.shadowBlur = 0;

    ctx.beginPath();
    for (let i = 0; i < count; i++) {
      const val = this.buffer[(offset + i) % this.bufferSize];
      if (val >= 0) {
        const x = i * stepX;
        const y = baselineY - val * amp;
        ctx.moveTo(x + 3, y);
        ctx.arc(x, y, 2, 0, Math.PI * 2);
      }
    }
    ctx.fillStyle = this.color;
    ctx.shadowColor = this.color;
    ctx.shadowBlur = 6;
    ctx.fill();
    ctx.shadowBlur = 0;

    ctx.fillStyle = 'rgba(0, 255, 102, 0.04)';
    ctx.fillRect(0, 0, this.width, this.height);
  }

  _drawStepArea(ctx, offset, count, stepX, baselineY, amp) {
    ctx.beginPath();
    ctx.moveTo(0, baselineY);
    for (let i = 0; i < count; i++) {
      const val = this.buffer[(offset + i) % this.bufferSize];
      const x = i * stepX;
      const y = val < 0 ? baselineY : baselineY - val * amp;
      ctx.lineTo(x, y);
      ctx.lineTo(x + stepX, y);
    }
    ctx.lineTo((count - 1) * stepX, baselineY);
    ctx.closePath();
    const grad = ctx.createLinearGradient(0, 0, 0, baselineY);
    grad.addColorStop(0, this.color + '60');
    grad.addColorStop(1, this.color + '08');
    ctx.fillStyle = grad;
    ctx.shadowColor = this.color;
    ctx.shadowBlur = 4;
    ctx.fill();
    ctx.shadowBlur = 0;

    ctx.beginPath();
    ctx.moveTo(0, baselineY);
    for (let i = 0; i < count; i++) {
      const val = this.buffer[(offset + i) % this.bufferSize];
      const x = i * stepX;
      const y = val < 0 ? baselineY : baselineY - val * amp;
      ctx.lineTo(x, y);
      ctx.lineTo(x + stepX, y);
    }
    ctx.strokeStyle = this.color;
    ctx.lineWidth = this.lineWidth;
    ctx.shadowColor = this.color;
    ctx.shadowBlur = 6;
    ctx.stroke();
    ctx.shadowBlur = 0;
  }

  _drawGridBar(ctx, offset, count, stepX, baselineY, amp) {
    const barWidth = Math.max(2, stepX * 0.6);
    const gap = stepX - barWidth;

    for (let i = 0; i < count; i++) {
      const val = this.buffer[(offset + i) % this.bufferSize];
      if (val < 0) continue;
      const x = i * stepX + gap / 2;
      const y = baselineY - val * amp;
      const barH = baselineY - y;
      ctx.fillStyle = this.color;
      ctx.shadowColor = this.color;
      ctx.shadowBlur = 6;
      ctx.fillRect(x, y, barWidth, barH);
      ctx.shadowBlur = 0;
      ctx.fillStyle = this.color + '40';
      ctx.fillRect(x, y, barWidth, barH);
    }
  }
}

class NetpulseMonitorApp {
  constructor() {
    this.nodes = new Map();
    this.engines = new Map();
    this.backendUrl = window.location.origin;
    this.ws = null;
    this.overlayIp = null;
    this.overlayEntries = [];
    this.names = new Map();
    this.globalLogEntries = [];
    this.nodeOrder = [];
    this._bindElements();
    this._bindEvents();
    this._initClock();
    this._connectWebSocket();
    this._fetchTargets();
    this._loadChartType();
    this._initResizeHandle();
  }

  _bindElements() {
    this.grid = document.getElementById('monitorGrid');
    this.overlay = document.getElementById('overlayPanel');
    this.overlayTitle = document.getElementById('overlayTitle');
    this.overlayCanvas = document.getElementById('overlayCanvas');
    this.overlayClose = document.getElementById('overlayClose');
    this.overlayConsoleLog = document.getElementById('overlayConsoleLog');
    this.overlayConsoleCount = document.getElementById('overlayConsoleCount');
    this.exportCsvBtn = document.getElementById('exportCsvBtn');
    this.systemLog = document.getElementById('systemLog');
    this.settingsOverlay = document.getElementById('settingsOverlay');
    this.settingsToggle = document.getElementById('settingsToggle');
    this.settingsClose = document.getElementById('settingsCloseBtn');
    this.ipInput = document.getElementById('ipAddressInput');
    this.nodeNameInput = document.getElementById('nodeNameInput');
    this.addIpBtn = document.getElementById('addIpBtn');
    this.chartTypeSelect = document.getElementById('chartTypeSelect');
    this.waveformColor = document.getElementById('waveformColor');
    this.currentNodeList = document.getElementById('currentNodeList');
    this.globalConsoleBody = document.getElementById('globalConsoleBody');
    this.globalExportLogBtn = document.getElementById('globalExportLogBtn');
    this.globalConsole = document.getElementById('global-live-console');
  }

  _bindEvents() {
    this.overlayClose.addEventListener('click', () => this.closeOverlay());
    this.exportCsvBtn.addEventListener('click', () => this._exportCsv());
    this.settingsToggle.addEventListener('click', () => this.toggleSettings());
    this.settingsClose.addEventListener('click', () => this.closeSettings());
    this.addIpBtn.addEventListener('click', () => this.handleAddIp());
    this.ipInput.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') this.handleAddIp();
    });
    this.nodeNameInput.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') this.handleAddIp();
    });
    this.globalExportLogBtn.addEventListener('click', () => this._exportGlobalLog());

    this.settingsOverlay.addEventListener('click', (e) => {
      if (e.target === this.settingsOverlay) this.closeSettings();
    });

    document.querySelectorAll('.settings-nav-item').forEach(item => {
      item.addEventListener('click', () => {
        document.querySelectorAll('.settings-nav-item').forEach(n => n.classList.remove('active'));
        document.querySelectorAll('.settings-pane').forEach(p => p.classList.remove('active'));
        item.classList.add('active');
        const pane = document.getElementById('pane-' + item.dataset.pane);
        if (pane) pane.classList.add('active');
      });
    });

    this.chartTypeSelect.addEventListener('change', () => {
      const type = this.chartTypeSelect.value;
      this.engines.forEach(e => { e.chartType = type; });
      if (this._overlayEngineInstance) {
        this._overlayEngineInstance.chartType = type;
      }
      localStorage.setItem('netpulse-chart-type', type);
    });

    this.waveformColor.addEventListener('input', () => {
      const c = this.waveformColor.value;
      this.engines.forEach(e => { e.color = c; });
      if (this._overlayEngineInstance) {
        this._overlayEngineInstance.color = c;
      }
    });

    window.addEventListener('resize', () => {
      this.engines.forEach(engine => engine.resize());
    });

    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') {
        if (this.overlay.classList.contains('active')) this.closeOverlay();
        if (this.settingsOverlay.classList.contains('active')) this.closeSettings();
      }
    });
  }

  _loadChartType() {
    const saved = localStorage.getItem('netpulse-chart-type');
    if (saved && ['ecg', 'step-area', 'grid-bar'].includes(saved)) {
      this.chartTypeSelect.value = saved;
      this.engines.forEach(e => { e.chartType = saved; });
    }
  }

  _timestamp() {
    const now = new Date();
    return (
      now.getFullYear() + '-' +
      String(now.getMonth() + 1).padStart(2, '0') + '-' +
      String(now.getDate()).padStart(2, '0') + ' ' +
      String(now.getHours()).padStart(2, '0') + ':' +
      String(now.getMinutes()).padStart(2, '0') + ':' +
      String(now.getSeconds()).padStart(2, '0')
    );
  }

  _initClock() {
    const update = () => {
      const now = new Date();
      document.getElementById('clockDisplay').textContent =
        String(now.getHours()).padStart(2, '0') + ':' +
        String(now.getMinutes()).padStart(2, '0') + ':' +
        String(now.getSeconds()).padStart(2, '0');
    };
    update();
    setInterval(update, 1000);
  }

  _writeConsole(msg, type) {
    const entry = document.createElement('span');
    entry.className = 'log-entry log-' + type;
    entry.textContent = '[' + this._timestamp() + '] ' + msg;
    this.systemLog.appendChild(entry);
    this.systemLog.scrollLeft = this.systemLog.scrollWidth;
    if (this.systemLog.children.length > 20) {
      this.systemLog.removeChild(this.systemLog.firstChild);
    }
  }

  _writeOverlayConsole(ip, latency, status) {
    if (ip !== this.overlayIp) return;
    const ts = this._timestamp();
    const statusLabel = status === 'ONLINE' ? 'ok' : status === 'DEGRADED' ? 'warn' : 'fail';
    const entry = document.createElement('div');
    entry.className = 'log-entry log-' + statusLabel;
    entry.textContent = '[' + ts + '] ' + ip + ' \u2014 ' + latency + 'ms [' + status + ']';
    this.overlayConsoleLog.appendChild(entry);
    this.overlayConsoleLog.scrollTop = this.overlayConsoleLog.scrollHeight;
    this.overlayEntries.push({ ip, latency, status, timestamp: ts });
    this.overlayConsoleCount.textContent = this.overlayEntries.length + ' entries';
  }

  async _exportCsv() {
    if (!this.overlayIp) return;
    try {
      const res = await fetch(this.backendUrl + '/api/history/' + this.overlayIp + '?limit=10000');
      const data = await res.json();
      let csv = 'Timestamp,IP,Latency (ms),Status\n';
      for (const row of data.history) {
        csv += row.timestamp + ',' + this.overlayIp + ',' + row.latency + ',' + row.status + '\n';
      }
      for (const entry of this.overlayEntries) {
        csv += entry.timestamp + ',' + entry.ip + ',' + entry.latency + ',' + entry.status + '\n';
      }
      const blob = new Blob([csv], { type: 'text/csv' });
      const a = document.createElement('a');
      a.href = URL.createObjectURL(blob);
      a.download = 'netpulse-' + this.overlayIp + '-' + new Date().toISOString().slice(0, 10) + '.csv';
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(a.href);
      this._writeConsole('Exported CSV for ' + this.overlayIp, 'ok');
    } catch (err) {
      this._writeConsole('CSV export failed: ' + err.message, 'fail');
    }
  }

  async _fetchTargets() {
    try {
      const res = await fetch(this.backendUrl + '/api/targets');
      const data = await res.json();
      this.nodeOrder = [];
      data.targets.forEach(t => {
        if (t.name) this.names.set(t.ip, t.name);
        if (!this.nodes.has(t.ip)) {
          this.addNode(t.ip);
        }
        this.nodeOrder.push(t.ip);
      });
      this._renderNodeList();
    } catch (err) {
      this._writeConsole('Failed to fetch targets: ' + err.message, 'fail');
    }
  }

  _connectWebSocket() {
    const proto = location.protocol === 'https:' ? 'wss:' : 'ws:';
    const url = proto + '//' + window.location.hostname + ':3000';
    this.ws = new WebSocket(url);

    this.ws.onopen = () => {
      this._writeConsole('Connected to backend engine', 'ok');
    };

    this.ws.onmessage = (event) => {
      try {
        const msg = JSON.parse(event.data);
        this._handleWsMessage(msg);
      } catch (e) {
        console.error('WS parse error', e);
      }
    };

    this.ws.onclose = () => {
      this._writeConsole('Backend connection lost \u2014 retrying in 3s', 'warn');
      setTimeout(() => this._connectWebSocket(), 3000);
    };

    this.ws.onerror = () => {
      this._writeConsole('Backend connection error', 'fail');
    };
  }

  _handleWsMessage(msg) {
    switch (msg.type) {
      case 'connected':
        this._writeConsole('Engine synchronized \u2014 ' + msg.targets.length + ' targets', 'info');
        break;
      case 'ping':
        this._ingestPingResult(msg.data);
        break;
      case 'target-added':
        if (!this.nodes.has(msg.ip)) {
          if (msg.name) this.names.set(msg.ip, msg.name);
          this.addNode(msg.ip);
          this._writeConsole('Node added: ' + (msg.name || msg.ip), 'ok');
        }
        break;
      case 'target-removed':
        if (this.nodes.has(msg.ip)) {
          this.names.delete(msg.ip);
          this.removeNode(msg.ip);
        }
        break;
      case 'target-updated':
        if (this.nodes.has(msg.oldIp)) {
          this.names.delete(msg.oldIp);
          this.removeNode(msg.oldIp);
        }
        if (msg.name) this.names.set(msg.ip, msg.name);
        this.addNode(msg.ip);
        this._writeConsole('Node updated: ' + msg.oldIp + ' \u2192 ' + msg.ip, 'info');
        break;
      case 'node-renamed':
        if (msg.name) {
          this.names.set(msg.ip, msg.name);
          const card = this.nodes.get(msg.ip);
          if (card) {
            const nameEl = card.querySelector('.card-name');
            if (nameEl) nameEl.textContent = msg.name;
          }
          if (this.overlayIp === msg.ip) {
            this.overlayTitle.textContent = 'NODE VIEWPORT \u2014 ' + msg.name + ' (' + msg.ip + ')';
          }
          this._renderNodeList();
          this._writeConsole('Node renamed: ' + msg.ip + ' \u2192 ' + msg.name, 'info');
        }
        break;
      case 'nodes-reordered':
        if (Array.isArray(msg.order)) {
          const prevOrder = this.nodeOrder.slice();
          this.nodeOrder = msg.order;
          const grid = this.grid;
          msg.order.forEach(ip => {
            const card = this.nodes.get(ip);
            if (card) grid.appendChild(card);
          });
          this._renderNodeList();
        }
        break;
    }
  }

  _writeGlobalConsole(ip, latency, status) {
    if (!this.globalConsoleBody) return;
    const ts = this._timestamp();
    const statusLabel = status === 'ONLINE' ? 'ok' : status === 'DEGRADED' ? 'warn' : 'fail';
    const name = this.names.get(ip) || ip;
    const entry = document.createElement('div');
    entry.className = 'log-entry log-' + statusLabel;
    entry.textContent = '[' + ts + '] ' + name + ' -> Response: ' + latency + 'ms | Status: ' + status;
    this.globalConsoleBody.appendChild(entry);
    this.globalConsoleBody.scrollTop = this.globalConsoleBody.scrollHeight;
    this.globalLogEntries.push({ timestamp: ts, name, ip, latency, status });
    if (this.globalConsoleBody.children.length > 500) {
      this.globalConsoleBody.removeChild(this.globalConsoleBody.firstChild);
    }
  }

  _ingestPingResult(data) {
    const engine = this.engines.get(data.ip);
    if (!engine) return;

    const card = this.nodes.get(data.ip);
    if (card && card.classList.contains('disabled')) {
      engine.pushEmpty();
      return;
    }

    if (data.status === 'OFFLINE') {
      engine.pushEmpty();
    } else {
      engine.pushPing(data.latency);
    }
    this._updateCardLed(data.ip, data.latency, data.status);
    this._writeGlobalConsole(data.ip, data.latency, data.status);

    if (this.overlayIp === data.ip && this._overlayEngineInstance) {
      if (data.status === 'OFFLINE') {
        this._overlayEngineInstance.pushEmpty();
      } else {
        this._overlayEngineInstance.pushPing(data.latency);
      }
      this._writeOverlayConsole(data.ip, data.latency, data.status);
    }
  }

  isValidIp(str) {
    const parts = str.trim().split('.');
    if (parts.length !== 4) return false;
    return parts.every(p => {
      const n = Number(p);
      return !isNaN(n) && n >= 0 && n <= 255 && String(n) === p;
    });
  }

  async handleAddIp() {
    const ip = this.ipInput.value.trim();
    const name = this.nodeNameInput.value.trim() || ip;
    if (!ip) return;
    if (!this.isValidIp(ip)) {
      alert('Invalid IP address format.');
      return;
    }
    if (this.nodes.has(ip)) {
      alert('Node ' + ip + ' already exists.');
      return;
    }
    try {
      const res = await fetch(this.backendUrl + '/api/targets', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ip, name })
      });
      if (!res.ok) {
        const err = await res.json();
        alert(err.error || 'Failed to add target');
        return;
      }
      this.ipInput.value = '';
      this.nodeNameInput.value = '';
    } catch (err) {
      alert('Cannot reach backend: ' + err.message);
    }
  }

  addNode(ip) {
    if (this.nodes.has(ip)) return;
    const card = this._createCard(ip);
    this.grid.appendChild(card);
    this.nodes.set(ip, card);
    if (!this.nodeOrder.includes(ip)) this.nodeOrder.push(ip);

    const nameEl = card.querySelector('.card-name');
    const displayName = this.names.get(ip) || ip;
    if (nameEl) nameEl.textContent = displayName;

    const canvas = card.querySelector('.pulse-canvas');
    const engine = new PulseWaveEngine(canvas);
    engine.chartType = this.chartTypeSelect.value;
    this.engines.set(ip, engine);

    requestAnimationFrame(() => {
      engine.resize();
      engine.start();
    });

    card.querySelector('.btn-expand').addEventListener('click', () => this.openOverlay(ip));
    card.querySelector('.btn-edit').addEventListener('click', () => this._editNode(ip));
    card.querySelector('.btn-delete').addEventListener('click', () => this._deleteNode(ip));
    card.querySelector('.btn-disable').addEventListener('click', () => this.toggleNode(ip));
    this._addDragHandlers(card, ip);
    this._renderNodeList();
  }

  removeNode(ip) {
    const card = this.nodes.get(ip);
    if (!card) return;
    const engine = this.engines.get(ip);
    if (engine) engine.stop();
    this.engines.delete(ip);
    card.remove();
    this.nodes.delete(ip);
    const idx = this.nodeOrder.indexOf(ip);
    if (idx !== -1) this.nodeOrder.splice(idx, 1);
    if (this.overlayIp === ip) {
      this.closeOverlay();
    }
    this._writeConsole('Node removed: ' + ip, 'warn');
    this._renderNodeList();
  }

  _addDragHandlers(card, ip) {
    const grip = card.querySelector('.card-grip');
    if (!grip) return;

    grip.addEventListener('mousedown', () => {
      card.draggable = true;
    });

    card.addEventListener('dragstart', (e) => {
      e.dataTransfer.setData('text/plain', ip);
      card.classList.add('dragging');
    });

    card.addEventListener('dragend', () => {
      card.classList.remove('dragging');
      document.querySelectorAll('.netpulse-card').forEach(c => c.classList.remove('drag-over'));
    });

    card.addEventListener('dragover', (e) => {
      e.preventDefault();
      card.classList.add('drag-over');
    });

    card.addEventListener('dragleave', () => {
      card.classList.remove('drag-over');
    });

    card.addEventListener('drop', (e) => {
      e.preventDefault();
      card.classList.remove('drag-over');
      const fromIp = e.dataTransfer.getData('text/plain');
      if (!fromIp || fromIp === ip) return;
      this._reorderCards(fromIp, ip);
    });
  }

  _reorderCards(fromIp, toIp) {
    const fromIdx = this.nodeOrder.indexOf(fromIp);
    const toIdx = this.nodeOrder.indexOf(toIp);
    if (fromIdx === -1 || toIdx === -1) return;

    this.nodeOrder.splice(fromIdx, 1);
    const newToIdx = this.nodeOrder.indexOf(toIp);
    this.nodeOrder.splice(newToIdx, 0, fromIp);

    const fromCard = this.nodes.get(fromIp);
    const toCard = this.nodes.get(toIp);
    if (fromCard && toCard) {
      const toRect = toCard.getBoundingClientRect();
      const gridRect = this.grid.getBoundingClientRect();
      const insertAfter = newToIdx > this.nodeOrder.indexOf(fromIp) ? toCard.nextSibling : toCard;
      if (insertAfter) {
        this.grid.insertBefore(fromCard, insertAfter);
      }
    }
    this._commitReorder();
    this._renderNodeList();
  }

  async _commitReorder() {
    try {
      await fetch(this.backendUrl + '/api/nodes/reorder', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ order: this.nodeOrder })
      });
    } catch (err) {
      this._writeConsole('Reorder sync failed: ' + err.message, 'fail');
    }
  }

  async _deleteNode(ip) {
    if (!this.nodes.has(ip)) return;
    this.removeNode(ip);
    try {
      const res = await fetch(this.backendUrl + '/api/targets/' + encodeURIComponent(ip), {
        method: 'DELETE'
      });
      if (!res.ok) {
        const err = await res.json();
        this._writeConsole('Delete confirmation failed for ' + ip + ': ' + (err.error || 'unknown'), 'fail');
      }
    } catch (err) {
      console.error('Netpulse DELETE failed for ' + ip + ':', err);
      this._writeConsole('Delete sync error for ' + ip + ': ' + err.message, 'fail');
    }
  }

  _editNode(ip) {
    const card = this.nodes.get(ip);
    if (!card) return;
    const nameSpan = card.querySelector('.card-name');
    const addrSpan = card.querySelector('.card-address');
    if (nameSpan.querySelector('input') || addrSpan.querySelector('input')) return;

    const nameInput = document.createElement('input');
    nameInput.type = 'text';
    nameInput.className = 'card-name-input';
    nameInput.value = this.names.get(ip) || ip;
    nameSpan.textContent = '';
    nameSpan.appendChild(nameInput);

    const addrInput = document.createElement('input');
    addrInput.type = 'text';
    addrInput.className = 'card-address-input';
    addrInput.value = ip;
    addrSpan.textContent = '';
    addrSpan.appendChild(addrInput);

    nameInput.focus();
    nameInput.select();

    const finish = () => {
      const newName = nameInput.value.trim() || ip;
      const newIp = addrInput.value.trim();
      if (newIp && newIp !== ip && this.isValidIp(newIp)) {
        this._commitEdit(ip, newIp, newName);
      } else if (newName !== (this.names.get(ip) || ip)) {
        this._commitNameEdit(ip, newName);
      } else {
        nameSpan.textContent = this.names.get(ip) || ip;
        addrSpan.textContent = ip;
      }
    };

    nameInput.addEventListener('blur', finish);
    nameInput.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') { addrInput.focus(); }
      if (e.key === 'Escape') { nameSpan.textContent = this.names.get(ip) || ip; addrSpan.textContent = ip; }
    });

    addrInput.addEventListener('blur', finish);
    addrInput.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') { addrInput.blur(); }
      if (e.key === 'Escape') { nameSpan.textContent = this.names.get(ip) || ip; addrSpan.textContent = ip; }
    });
  }

  async _commitNameEdit(ip, newName) {
    this.names.set(ip, newName);
    const card = this.nodes.get(ip);
    if (card) {
      const nameEl = card.querySelector('.card-name');
      if (nameEl) nameEl.textContent = newName;
    }
    if (this.overlayIp === ip) {
      this.overlayTitle.textContent = 'NODE VIEWPORT \u2014 ' + newName + ' (' + ip + ')';
    }
    this._renderNodeList();
    try {
      const res = await fetch(this.backendUrl + '/api/nodes/' + encodeURIComponent(ip), {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: newName })
      });
      if (!res.ok) {
        const err = await res.json();
        this._writeConsole('Name update failed: ' + (err.error || 'unknown'), 'fail');
      }
    } catch (err) {
      this._writeConsole('Name update error: ' + err.message, 'fail');
    }
  }

  async _commitEdit(oldIp, newIp, name) {
    if (this.nodes.has(newIp)) {
      alert('Node ' + newIp + ' already exists.');
      const card = this.nodes.get(oldIp);
      if (card) {
        card.querySelector('.card-name').textContent = this.names.get(oldIp) || oldIp;
        card.querySelector('.card-address').textContent = oldIp;
      }
      return;
    }
    try {
      const res = await fetch(this.backendUrl + '/api/targets/' + encodeURIComponent(oldIp), {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ip: newIp, name })
      });
      if (!res.ok) {
        const err = await res.json();
        alert(err.error || 'Edit failed');
        const card = this.nodes.get(oldIp);
        if (card) {
          card.querySelector('.card-name').textContent = this.names.get(oldIp) || oldIp;
          card.querySelector('.card-address').textContent = oldIp;
        }
        return;
      }
      this.names.delete(oldIp);
      this.names.set(newIp, name);
    } catch (err) {
      alert('Cannot reach backend: ' + err.message);
      const card = this.nodes.get(oldIp);
      if (card) {
        card.querySelector('.card-name').textContent = this.names.get(oldIp) || oldIp;
        card.querySelector('.card-address').textContent = oldIp;
      }
    }
  }

  _createCard(ip) {
    const card = document.createElement('div');
    card.className = 'netpulse-card';
    card.dataset.ip = ip;
    card.draggable = true;
    card.innerHTML =
      '<div class="card-grip">⠿</div>' +
      '<div class="card-header">' +
        '<div class="card-header-left">' +
          '<div class="card-name">' + (this.names.get(ip) || ip) + '</div>' +
          '<span class="card-address">' + ip + '</span>' +
        '</div>' +
        '<div class="card-led-group">' +
          '<span class="status-led green"></span>' +
          '<span class="status-label">Online</span>' +
        '</div>' +
      '</div>' +
      '<div class="card-pulse-wrapper">' +
        '<canvas class="pulse-canvas"></canvas>' +
      '</div>' +
      '<div class="card-controls">' +
        '<button class="btn btn-expand">EXPAND VIEWPORT</button>' +
        '<button class="btn btn-edit">EDIT</button>' +
        '<button class="btn btn-delete">DELETE</button>' +
        '<button class="btn btn-disable">DISABLE NODE</button>' +
      '</div>';
    return card;
  }

  _updateCardLed(ip, ping, status) {
    const card = this.nodes.get(ip);
    if (!card) return;
    const led = card.querySelector('.status-led');
    const label = card.querySelector('.status-label');
    card.className = 'netpulse-card';

    card.classList.remove('offline-pulse-alert');

    if (status === 'ONLINE' || (status === undefined && ping < 80)) {
      led.className = 'status-led green';
      label.textContent = 'Online';
    } else if (status === 'DEGRADED' || (status === undefined && ping < 250)) {
      led.className = 'status-led yellow';
      label.textContent = 'Degraded';
      card.classList.add('warning');
    } else {
      led.className = 'status-led red';
      label.textContent = 'Latent';
      card.classList.add('offline');
      card.classList.add('offline-pulse-alert');
    }
    this._renderNodeList();
  }

  _getNodeStatus(ip) {
    const card = this.nodes.get(ip);
    if (!card) return 'unknown';
    if (card.classList.contains('disabled')) return 'disabled';
    const led = card.querySelector('.status-led');
    if (led.classList.contains('green')) return 'online';
    if (led.classList.contains('yellow')) return 'degraded';
    if (led.classList.contains('red')) return 'offline';
    return 'unknown';
  }

  _renderNodeList() {
    if (!this.currentNodeList) return;
    this.currentNodeList.innerHTML = '';
    for (const ip of this.nodeOrder) {
      if (!this.nodes.has(ip)) continue;
      const status = this._getNodeStatus(ip);
      const name = this.names.get(ip) || ip;
      const li = document.createElement('li');
      li.className = 'current-node-item';
      li.innerHTML =
        '<span class="node-led ' + status + '"></span>' +
        '<div class="node-info">' +
          '<span class="node-info-name">' + this._escHtml(name) + '</span>' +
          '<span class="node-info-ip">' + this._escHtml(ip) + '</span>' +
        '</div>' +
        '<button class="node-remove-btn" data-ip="' + ip + '">\u2715</button>';
      li.querySelector('.node-remove-btn').addEventListener('click', () => this._deleteNode(ip));
      this.currentNodeList.appendChild(li);
    }
  }

  _escHtml(str) {
    const div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
  }

  toggleNode(ip) {
    const card = this.nodes.get(ip);
    if (!card) return;
    card.classList.toggle('disabled');
    const btn = card.querySelector('.btn-disable');
    const led = card.querySelector('.status-led');
    const label = card.querySelector('.status-label');

    if (card.classList.contains('disabled')) {
      btn.textContent = 'ENABLE NODE';
      card.style.opacity = '0.4';
      led.className = 'status-led red';
      led.style.boxShadow = 'none';
      label.textContent = 'Disabled';
      card.classList.remove('offline-pulse-alert');
      this._writeConsole('Node ' + ip + ' disabled', 'warn');
    } else {
      btn.textContent = 'DISABLE NODE';
      card.style.opacity = '1';
      led.className = 'status-led green';
      led.style.boxShadow = '';
      label.textContent = 'Online';
      card.classList.remove('offline-pulse-alert');
      this._writeConsole('Node ' + ip + ' enabled', 'ok');
    }
    this._renderNodeList();
  }

  openOverlay(ip) {
    if (!this.nodes.has(ip)) return;
    this.overlayIp = ip;
    this.overlayEntries = [];
    const displayName = this.names.get(ip) || ip;
    this.overlayTitle.textContent = 'NODE VIEWPORT \u2014 ' + displayName + ' (' + ip + ')';
    this.overlayConsoleLog.innerHTML = '<div class="log-entry log-info">[SYSTEM] Monitoring ' + ip + '</div>';
    this.overlayConsoleCount.textContent = '0 entries';
    this.overlay.classList.add('active');

    this._writeConsole('Opened viewport for ' + ip, 'info');

    requestAnimationFrame(() => {
      const engine = this.engines.get(ip);
      const overlayEng = new PulseWaveEngine(this.overlayCanvas);
      overlayEng.resize();
      overlayEng.buffer = engine ? engine.buffer.slice() : new Float32Array(200);
      overlayEng.sampleCount = engine ? engine.sampleCount : 0;
      overlayEng.writeIndex = engine ? engine.writeIndex : 0;
      overlayEng.color = engine ? engine.color : '#00ff66';
      overlayEng.chartType = this.chartTypeSelect.value;
      overlayEng.start();
      this._overlayEngineInstance = overlayEng;
    });
  }

  closeOverlay() {
    this.overlay.classList.remove('active');
    if (this._overlayEngineInstance) {
      this._overlayEngineInstance.stop();
      this._overlayEngineInstance = null;
    }
    this.overlayIp = null;
    this.overlayEntries = [];
    this._writeConsole('Viewport minimized', 'info');
  }

  toggleSettings() {
    this.settingsOverlay.classList.toggle('active');
  }

  closeSettings() {
    this.settingsOverlay.classList.remove('active');
  }

  _exportGlobalLog() {
    if (this.globalLogEntries.length === 0) {
      this._writeConsole('Global log is empty — nothing to export', 'warn');
      return;
    }
    let csv = 'Timestamp,Name,IP,Latency (ms),Status\n';
    for (const e of this.globalLogEntries) {
      csv += e.timestamp + ',' + e.name + ',' + e.ip + ',' + e.latency + ',' + e.status + '\n';
    }
    const blob = new Blob([csv], { type: 'text/csv' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = 'netpulse-global-log-' + new Date().toISOString().slice(0, 10) + '.csv';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(a.href);
    this._writeConsole('Exported global telemetry log (' + this.globalLogEntries.length + ' entries)', 'ok');
  }

  _initResizeHandle() {
    const handle = document.querySelector('.console-resize-handle');
    if (!handle || !this.globalConsole) return;
    let startY, startH;
    const onMouseMove = (e) => {
      const delta = e.clientY - startY;
      const newH = Math.max(100, Math.min(window.innerHeight * 0.6, startH - delta));
      this.globalConsole.style.height = newH + 'px';
    };
    const onMouseUp = () => {
      document.removeEventListener('mousemove', onMouseMove);
      document.removeEventListener('mouseup', onMouseUp);
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
    };
    handle.addEventListener('mousedown', (e) => {
      startY = e.clientY;
      startH = this.globalConsole.offsetHeight;
      document.body.style.cursor = 'ns-resize';
      document.body.style.userSelect = 'none';
      document.addEventListener('mousemove', onMouseMove);
      document.addEventListener('mouseup', onMouseUp);
      e.preventDefault();
    });
  }
}

document.addEventListener('DOMContentLoaded', () => {
  window.app = new NetpulseMonitorApp();
});
