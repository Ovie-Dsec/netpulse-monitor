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
    this._bounceStart = null;
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
    this._bounceStart = Date.now();
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
      case 'gradient-fill':
        this._drawGradientFill(ctx, offset, renderCount, stepX, baselineY, amp, w);
        break;
      case 'scatter':
        this._drawScatter(ctx, offset, renderCount, stepX, baselineY, amp);
        break;
      case 'glow-bar':
        this._drawGlowBar(ctx, offset, renderCount, stepX, baselineY, amp);
        break;
      case 'radar':
        this._drawRadar(ctx, offset, renderCount, stepX, baselineY, amp);
        break;
      case 'candlestick':
        this._drawCandlestick(ctx, offset, renderCount, stepX, baselineY, amp);
        break;
      case 'heat-wave':
        this._drawHeatWave(ctx, offset, renderCount, stepX, baselineY, amp, w, h);
        break;
      case 'stem':
        this._drawStem(ctx, offset, renderCount, stepX, baselineY, amp);
        break;
      case 'mountain':
        this._drawMountain(ctx, offset, renderCount, stepX, baselineY, amp, w);
        break;
      case 'dot-matrix':
        this._drawDotMatrix(ctx, offset, renderCount, stepX, baselineY, amp, w, h);
        break;
      case 'bounce':
        this._drawBounce(ctx, offset, renderCount, stepX, baselineY, amp);
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

  _drawGradientFill(ctx, offset, count, stepX, baselineY, amp, w) {
    ctx.beginPath();
    ctx.moveTo(0, baselineY);
    for (let i = 0; i < count; i++) {
      const val = this.buffer[(offset + i) % this.bufferSize];
      const x = i * stepX;
      const y = val < 0 ? baselineY : baselineY - val * amp;
      ctx.lineTo(x, y);
    }
    ctx.lineTo((count - 1) * stepX, baselineY);
    ctx.closePath();
    const grad = ctx.createLinearGradient(0, 0, 0, baselineY);
    grad.addColorStop(0, this.color);
    grad.addColorStop(0.4, this.color + '80');
    grad.addColorStop(1, this.color + '05');
    ctx.fillStyle = grad;
    ctx.fill();
    ctx.beginPath();
    for (let i = 0; i < count; i++) {
      const val = this.buffer[(offset + i) % this.bufferSize];
      const x = i * stepX;
      const y = val < 0 ? baselineY : baselineY - val * amp;
      i === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y);
    }
    ctx.strokeStyle = this.color;
    ctx.lineWidth = this.lineWidth;
    ctx.shadowColor = this.color;
    ctx.shadowBlur = 6;
    ctx.stroke();
    ctx.shadowBlur = 0;
  }

  _drawScatter(ctx, offset, count, stepX, baselineY, amp) {
    for (let i = 0; i < count; i++) {
      const val = this.buffer[(offset + i) % this.bufferSize];
      if (val < 0) continue;
      const x = i * stepX;
      const y = baselineY - val * amp;
      const r = Math.max(2, val * 6);
      ctx.beginPath();
      ctx.arc(x, y, r, 0, Math.PI * 2);
      ctx.fillStyle = this.color;
      ctx.shadowColor = this.color;
      ctx.shadowBlur = 10;
      ctx.fill();
      ctx.shadowBlur = 0;
    }
  }

  _drawGlowBar(ctx, offset, count, stepX, baselineY, amp) {
    const barW = Math.max(2, stepX * 0.5);
    for (let i = 0; i < count; i++) {
      const val = this.buffer[(offset + i) % this.bufferSize];
      if (val < 0) continue;
      const x = i * stepX + (stepX - barW) / 2;
      const barH = val * amp;
      const y = baselineY - barH;
      const grad = ctx.createLinearGradient(0, y, 0, baselineY);
      grad.addColorStop(0, this.color);
      grad.addColorStop(0.3, this.color + '80');
      grad.addColorStop(0.7, this.color + '20');
      grad.addColorStop(1, this.color + '00');
      ctx.fillStyle = grad;
      ctx.shadowColor = this.color;
      ctx.shadowBlur = 12;
      ctx.fillRect(x, y, barW, barH);
      ctx.shadowBlur = 0;
    }
  }

  _drawRadar(ctx, offset, count, stepX, baselineY, amp) {
    ctx.beginPath();
    for (let i = 0; i < count; i++) {
      const val = this.buffer[(offset + i) % this.bufferSize];
      const x = i * stepX;
      const y = val < 0 ? baselineY : baselineY - val * amp;
      i === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y);
    }
    ctx.strokeStyle = this.color + '60';
    ctx.lineWidth = 1;
    ctx.stroke();
    if (count > 0) {
      const lastVal = this.buffer[(offset + count - 1) % this.bufferSize];
      const lx = (count - 1) * stepX;
      const ly = lastVal < 0 ? baselineY : baselineY - lastVal * amp;
      ctx.beginPath();
      ctx.arc(lx, ly, 4, 0, Math.PI * 2);
      ctx.fillStyle = this.color;
      ctx.shadowColor = this.color;
      ctx.shadowBlur = 16;
      ctx.fill();
      ctx.shadowBlur = 0;
    }
  }

  _drawCandlestick(ctx, offset, count, stepX, baselineY, amp) {
    const half = Math.floor(count / 2);
    for (let i = 0; i < count; i++) {
      const val = this.buffer[(offset + i) % this.bufferSize];
      if (val < 0) continue;
      const x = i * stepX + stepX / 2;
      const topY = baselineY - val * amp;
      const bottomY = i < half ? baselineY : baselineY + (baselineY - topY) * 0.3;
      ctx.beginPath();
      ctx.moveTo(x, bottomY);
      ctx.lineTo(x, topY);
      ctx.strokeStyle = i < half ? '#00ff66' : '#ff3355';
      ctx.lineWidth = 2;
      ctx.shadowColor = ctx.strokeStyle;
      ctx.shadowBlur = 4;
      ctx.stroke();
      ctx.shadowBlur = 0;
      ctx.fillStyle = ctx.strokeStyle;
      ctx.fillRect(x - 2, topY - 1, 4, 3);
    }
  }

  _drawHeatWave(ctx, offset, count, stepX, baselineY, amp, w, h) {
    const bands = 10;
    const bandH = h / bands;
    const colGrad = ctx.createLinearGradient(0, 0, 0, h);
    colGrad.addColorStop(0, '#00ff66');
    colGrad.addColorStop(0.3, '#66ff00');
    colGrad.addColorStop(0.5, '#ffaa00');
    colGrad.addColorStop(0.7, '#ff6600');
    colGrad.addColorStop(1, '#ff3355');
    for (let i = 0; i < count; i++) {
      const val = this.buffer[(offset + i) % this.bufferSize];
      if (val < 0) continue;
      const x = i * stepX;
      const heatH = Math.min(val * amp, h);
      ctx.fillStyle = colGrad;
      ctx.globalAlpha = 0.7;
      ctx.fillRect(x, h - heatH, stepX - 1, heatH);
      ctx.globalAlpha = 1;
    }
  }

  _drawStem(ctx, offset, count, stepX, baselineY, amp) {
    for (let i = 0; i < count; i++) {
      const val = this.buffer[(offset + i) % this.bufferSize];
      if (val < 0) continue;
      const x = i * stepX + stepX / 2;
      const y = baselineY - val * amp;
      ctx.beginPath();
      ctx.moveTo(x, baselineY);
      ctx.lineTo(x, y);
      ctx.strokeStyle = this.color + '80';
      ctx.lineWidth = 1;
      ctx.stroke();
      ctx.beginPath();
      ctx.arc(x, y, 3, 0, Math.PI * 2);
      ctx.fillStyle = this.color;
      ctx.shadowColor = this.color;
      ctx.shadowBlur = 8;
      ctx.fill();
      ctx.shadowBlur = 0;
    }
  }

  _drawMountain(ctx, offset, count, stepX, baselineY, amp, w) {
    ctx.beginPath();
    ctx.moveTo(0, baselineY);
    for (let i = 0; i < count; i++) {
      const val = this.buffer[(offset + i) % this.bufferSize];
      const x = i * stepX;
      const y = val < 0 ? baselineY : baselineY - val * amp;
      ctx.lineTo(x, y);
    }
    ctx.lineTo((count - 1) * stepX, baselineY);
    ctx.closePath();
    ctx.fillStyle = this.color + '25';
    ctx.fill();
    ctx.beginPath();
    for (let i = 0; i < count; i++) {
      const val = this.buffer[(offset + i) % this.bufferSize];
      const x = i * stepX;
      const y = val < 0 ? baselineY : baselineY - val * amp;
      i === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y);
    }
    ctx.strokeStyle = this.color;
    ctx.lineWidth = 1;
    ctx.stroke();
  }

  _drawDotMatrix(ctx, offset, count, stepX, baselineY, amp, w, h) {
    const dotR = Math.max(2, stepX * 0.3);
    const rows = Math.floor(h / (dotR * 3));
    for (let i = 0; i < count; i++) {
      const val = this.buffer[(offset + i) % this.bufferSize];
      const x = i * stepX + stepX / 2;
      const row = val < 0 ? -1 : Math.min(Math.floor(val * rows), rows - 1);
      for (let r = 0; r < rows; r++) {
        const y = (r + 0.5) * (h / rows);
        if (r <= row) {
          const t = r / rows;
          if (t < 0.33) ctx.fillStyle = '#00ff66';
          else if (t < 0.66) ctx.fillStyle = '#ffaa00';
          else ctx.fillStyle = '#ff3355';
          ctx.globalAlpha = 0.8;
        } else {
          ctx.fillStyle = this.color;
          ctx.globalAlpha = 0.08;
        }
        ctx.beginPath();
        ctx.arc(x, y, dotR, 0, Math.PI * 2);
        ctx.fill();
      }
    }
    ctx.globalAlpha = 1;
  }

  _drawBounce(ctx, offset, count, stepX, baselineY, amp) {
    for (let i = 0; i < count; i++) {
      const val = this.buffer[(offset + i) % this.bufferSize];
      if (val < 0) continue;
      const x = i * stepX + stepX / 2;
      const targetY = baselineY - val * amp;
      const distFromHead = (this.writeIndex - (offset + i) + this.bufferSize) % this.bufferSize;
      const ease = Math.min(distFromHead / 5, 1);
      const bounce = Math.pow(1 - ease, 2) * Math.sin((1 - ease) * Math.PI * 4) * 40;
      const y = targetY + bounce * (1 - ease);
      const r = Math.max(2, val * 4);
      ctx.beginPath();
      ctx.arc(x, y, r, 0, Math.PI * 2);
      ctx.fillStyle = this.color;
      ctx.shadowColor = this.color;
      ctx.shadowBlur = 12;
      ctx.fill();
      ctx.shadowBlur = 0;
      ctx.fillStyle = '#ffffff20';
      ctx.beginPath();
      ctx.arc(x - r * 0.3, y - r * 0.3, r * 0.3, 0, Math.PI * 2);
      ctx.fill();
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
    this._prevStatus = new Map();
    this.soundEnabled = localStorage.getItem('netpulse-sound') !== '0';
    this.notifEnabled = localStorage.getItem('netpulse-notif') === '1';
    this.dashboardVisible = false;
    this._particles = null;
    this._lastPingTime = Date.now();
    this._bindElements();
    this._bindEvents();
    this._initClock();
    this._connectWebSocket();
    this._fetchTargets();
    this._loadChartType();
    this._initResizeHandle();
    this._initParticles();
    this._startPingWatchdog();
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
    this.statusBar = document.getElementById('statusBar');
    this.soundToggle = document.getElementById('soundToggle');
    this.notifToggle = document.getElementById('notifToggle');
    this.exportConfigBtn = document.getElementById('exportConfigBtn');
    this.importConfigBtn = document.getElementById('importConfigBtn');
    this.importFileInput = document.getElementById('importFileInput');
    this.particleCanvas = document.getElementById('particleCanvas');
    this.dashboardToggle = document.getElementById('dashboardToggle');
    this.dashboardPanel = document.getElementById('dashboardPanel');
    this.dashboardClose = document.getElementById('dashboardClose');
    this.dashLatencyChart = document.getElementById('dashLatencyChart');
    this.dashUptimeChart = document.getElementById('dashUptimeChart');
    this.dashTimeline = document.getElementById('dashTimeline');
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

    this.soundToggle.addEventListener('change', () => {
      this.soundEnabled = this.soundToggle.checked;
      localStorage.setItem('netpulse-sound', this.soundEnabled ? '1' : '0');
    });
    this.soundToggle.checked = this.soundEnabled;

    this.notifToggle.addEventListener('change', () => {
      this.notifEnabled = this.notifToggle.checked;
      localStorage.setItem('netpulse-notif', this.notifEnabled ? '1' : '0');
      if (this.notifEnabled && Notification.permission === 'default') {
        Notification.requestPermission();
      }
    });
    this.notifToggle.checked = this.notifEnabled;

    this.exportConfigBtn.addEventListener('click', () => this._exportConfig());
    this.importConfigBtn.addEventListener('click', () => this.importFileInput.click());
    this.importFileInput.addEventListener('change', (e) => {
      if (e.target.files.length) this._importConfig(e.target.files[0]);
    });

    this.dashboardToggle.addEventListener('click', () => this._toggleDashboard());
    this.dashboardClose.addEventListener('click', () => this._toggleDashboard());

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
          this.addNode(t.ip, t.pollRate || 0);
        }
        this.nodeOrder.push(t.ip);
      });
      this._renderNodeList();
    } catch (err) {
      this._writeConsole('Failed to fetch targets: ' + err.message, 'fail');
    }
  }

  _startPingWatchdog() {
    setInterval(() => {
      if (Date.now() - this._lastPingTime > 15000) {
        this._writeConsole('No ping data for 15s — reloading page...', 'warn');
        location.reload();
      }
    }, 10000);
  }

  _connectWebSocket() {
    const proto = location.protocol === 'https:' ? 'wss:' : 'ws:';
    const url = proto + '//' + window.location.host;
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
        try { this._ingestPingResult(msg.data); } catch (e) { console.error('ingest error', e); }
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
    this._lastPingTime = Date.now();
    const engine = this.engines.get(data.ip);
    if (!engine) return;

    const card = this.nodes.get(data.ip);
    if (card && card.classList.contains('disabled')) {
      engine.pushEmpty();
      return;
    }

    const prev = this._prevStatus.get(data.ip);
    if (prev && prev !== data.status) {
      if (this.soundEnabled) this._playAlertSound(data.status === 'OFFLINE' ? 'offline' : 'recovery');
      if (this.notifEnabled && document.hidden) {
        const name = this.names.get(data.ip) || data.ip;
        if (data.status === 'OFFLINE') this._sendNotification(name + ' is OFFLINE', 'No response from ' + data.ip);
        else this._sendNotification(name + ' recovered', 'Status: ' + data.status + ' (' + data.latency + 'ms)');
      }
    }
    this._prevStatus.set(data.ip, data.status);

    if (data.status === 'OFFLINE') {
      engine.pushEmpty();
    } else {
      engine.pushPing(data.latency);
    }
    this._updateCardLed(data.ip, data.latency, data.status);
    this._writeGlobalConsole(data.ip, data.latency, data.status);

    this._updateDonutRing(data.ip, data.status);
    this._updateSparkline(data.ip, data.status === 'OFFLINE' ? -1 : data.latency);
    this._updateStatusBar();
    if (this._particles) {
      const px = Math.random() * window.innerWidth;
      const py = Math.random() * window.innerHeight;
      const col = data.status === 'ONLINE' ? '#00ff66' : data.status === 'DEGRADED' ? '#ffaa00' : '#ff3355';
      this._particles.pulse(px, py, col);
    }

    if (this.overlayIp === data.ip && this._overlayEngineInstance) {
      if (data.status === 'OFFLINE') {
        this._overlayEngineInstance.pushEmpty();
      } else {
        this._overlayEngineInstance.pushPing(data.latency);
      }
      this._writeOverlayConsole(data.ip, data.latency, data.status);
    }
  }

  _updateDonutRing(ip, status) {
    const card = this.nodes.get(ip);
    if (!card) return;
    const canvas = card.querySelector('.card-donut-canvas');
    if (!canvas) return;
    const d = canvas._donutData || { ok: 0, fail: 0 };
    if (status === 'ONLINE' || status === 'DEGRADED') d.ok++;
    else d.fail++;
    canvas._donutData = d;

    const total = d.ok + d.fail;
    const pct = total ? Math.round((d.ok / total) * 100) : 100;
    const ctx = canvas.getContext('2d');
    const rect = canvas.getBoundingClientRect();
    const dpr = window.devicePixelRatio || 1;
    canvas.width = rect.width * dpr;
    canvas.height = rect.height * dpr;
    ctx.scale(dpr, dpr);

    const w = rect.width, h = rect.height;
    const cx = w / 2, cy = h / 2, r = Math.min(cx, cy) - 2;
    ctx.clearRect(0, 0, w, h);

    ctx.lineWidth = 3;
    ctx.strokeStyle = '#1a2332';
    ctx.beginPath();
    ctx.arc(cx, cy, r, 0, Math.PI * 2);
    ctx.stroke();

    const frac = Math.min(pct / 100, 1);
    ctx.strokeStyle = pct >= 95 ? '#00ff66' : pct >= 80 ? '#ffaa00' : '#ff3355';
    ctx.shadowColor = ctx.strokeStyle;
    ctx.shadowBlur = 4;
    ctx.beginPath();
    ctx.arc(cx, cy, r, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * frac);
    ctx.stroke();
    ctx.shadowBlur = 0;

    if (total >= 3) {
      const pctEl = card.querySelector('.card-donut-pct');
      if (pctEl) pctEl.textContent = pct;
    }
  }

  _updateSparkline(ip, latency) {
    const card = this.nodes.get(ip);
    if (!card) return;
    const canvas = card.querySelector('.card-sparkline-canvas');
    if (!canvas) return;
    const data = canvas._sparkData || [];
    if (latency >= 0) data.push(Math.min(latency, 500));
    else data.push(500);
    if (data.length > 60) data.shift();
    canvas._sparkData = data;
    if (data.length < 2) return;

    const ctx = canvas.getContext('2d');
    const rect = canvas.getBoundingClientRect();
    const dpr = window.devicePixelRatio || 1;
    canvas.width = rect.width * dpr;
    canvas.height = rect.height * dpr;
    ctx.scale(dpr, dpr);

    const w = rect.width, h = rect.height;
    ctx.clearRect(0, 0, w, h);

    const step = w / Math.max(data.length - 1, 1);
    const maxVal = 500;
    ctx.beginPath();
    ctx.moveTo(0, h);
    for (let i = 0; i < data.length; i++) {
      const x = i * step;
      const y = h - (Math.min(data[i], maxVal) / maxVal) * (h - 1);
      ctx.lineTo(x, y);
    }
    ctx.lineTo((data.length - 1) * step, h);
    ctx.closePath();

    const grad = ctx.createLinearGradient(0, 0, 0, h);
    grad.addColorStop(0, 'rgba(0, 255, 102, 0.5)');
    grad.addColorStop(0.6, 'rgba(255, 170, 0, 0.3)');
    grad.addColorStop(1, 'rgba(255, 51, 85, 0.15)');
    ctx.fillStyle = grad;
    ctx.fill();

    ctx.strokeStyle = '#00ff66';
    ctx.lineWidth = 1;
    ctx.beginPath();
    for (let i = 0; i < data.length; i++) {
      const x = i * step;
      const y = h - (Math.min(data[i], maxVal) / maxVal) * (h - 1);
      i === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y);
    }
    ctx.stroke();
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

  addNode(ip, pollRate) {
    if (this.nodes.has(ip)) return;
    const card = this._createCard(ip);
    this.grid.appendChild(card);
    this.nodes.set(ip, card);
    if (!this.nodeOrder.includes(ip)) this.nodeOrder.push(ip);

    const nameEl = card.querySelector('.card-name');
    const displayName = this.names.get(ip) || ip;
    if (nameEl) nameEl.textContent = displayName;

    const pollSelect = card.querySelector('.card-poll-rate');
    if (pollSelect && pollRate) {
      pollSelect.value = String(pollRate);
    }

    const canvas = card.querySelector('.pulse-canvas');
    const engine = new PulseWaveEngine(canvas);
    engine.chartType = this.chartTypeSelect.value;
    this.engines.set(ip, engine);

    const donutCanvas = card.querySelector('.card-donut-canvas');
    const sparkCanvas = card.querySelector('.card-sparkline-canvas');
    if (donutCanvas) donutCanvas._donutData = { ok: 0, fail: 0 };
    if (sparkCanvas) sparkCanvas._sparkData = [];

    requestAnimationFrame(() => {
      engine.resize();
      engine.start();
    });

    card.querySelector('.btn-expand').addEventListener('click', () => this.openOverlay(ip));
    card.querySelector('.btn-edit').addEventListener('click', () => this._editNode(ip));
    card.querySelector('.btn-delete').addEventListener('click', () => this._deleteNode(ip));
    card.querySelector('.btn-disable').addEventListener('click', () => this.toggleNode(ip));

    if (pollSelect) {
      pollSelect.addEventListener('change', () => this._setNodePollRate(ip, parseInt(pollSelect.value, 10)));
    }

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
    const escName = this._escHtml(this.names.get(ip) || ip);
    const escIp = this._escHtml(ip);
    card.innerHTML =
      '<div class="card-grip">⠿</div>' +
      '<div class="card-header">' +
        '<div class="card-header-left">' +
          '<div class="card-name">' + escName + '</div>' +
          '<span class="card-address">' + escIp + '</span>' +
        '</div>' +
        '<div class="card-led-group">' +
          '<div class="card-donut-wrap">' +
            '<canvas class="card-donut-canvas"></canvas>' +
            '<span class="card-donut-pct">100</span>' +
          '</div>' +
          '<span class="status-led green"></span>' +
          '<span class="status-label">Online</span>' +
        '</div>' +
      '</div>' +
      '<div class="card-pulse-wrapper">' +
        '<canvas class="pulse-canvas"></canvas>' +
      '</div>' +
      '<div class="card-sparkline-wrap">' +
        '<canvas class="card-sparkline-canvas"></canvas>' +
      '</div>' +
      '<div class="card-controls">' +
        '<div class="card-poll-rate-wrap">' +
          '<label class="poll-rate-label">Poll:</label>' +
          '<select class="card-poll-rate">' +
            '<option value="500">500ms</option>' +
            '<option value="1000">1s</option>' +
            '<option value="2000" selected>2s</option>' +
            '<option value="3000">3s</option>' +
            '<option value="5000">5s</option>' +
            '<option value="10000">10s</option>' +
            '<option value="15000">15s</option>' +
            '<option value="30000">30s</option>' +
          '</select>' +
        '</div>' +
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

  async _setNodePollRate(ip, rate) {
    try {
      await fetch(this.backendUrl + '/api/nodes/' + encodeURIComponent(ip) + '/pollrate', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ pollRate: rate })
      });
      this._writeConsole(ip + ' poll rate set to ' + rate + 'ms', 'info');
    } catch (e) {
      this._writeConsole('Failed to set poll rate: ' + e.message, 'fail');
    }
  }

  _updateStatusBar() {
    let online = 0, degraded = 0, offline = 0, totalLat = 0, latCount = 0;
    let totalOk = 0, totalPings = 0;
    this.engines.forEach((engine, ip) => {
      const card = this.nodes.get(ip);
      if (!card || card.classList.contains('disabled')) return;
      const label = card.querySelector('.status-label');
      if (!label) return;
      const text = label.textContent;
      if (text === 'Online') { online++; }
      else if (text === 'Degraded' || text === 'Warning') { degraded++; }
      else { offline++; }
      const donut = card.querySelector('.card-donut-canvas');
      if (donut && donut._donutData) {
        totalOk += donut._donutData.ok;
        totalPings += donut._donutData.ok + donut._donutData.fail;
      }
      if (engine.buffer) {
        const vals = [];
        for (let i = 0; i < engine.sampleCount; i++) {
          const v = engine.buffer[(engine.writeIndex - engine.sampleCount + i + engine.bufferSize) % engine.bufferSize];
          if (v >= 0) vals.push(v);
        }
        if (vals.length > 0) {
          const avgNorm = vals.reduce((a, b) => a + b, 0) / vals.length;
          totalLat += (1 - avgNorm) * 500;
          latCount++;
        }
      }
    });
    const el = document.getElementById('statusBar');
    if (el) {
      const avgLat = latCount > 0 ? Math.round(totalLat / latCount) : 0;
      const uptimePct = totalPings > 0 ? Math.round((totalOk / totalPings) * 100) : 100;
      el.innerHTML =
        '<span class="status-bar-online">\u25CF Online: ' + online + '</span>' +
        '<span class="status-bar-degraded">\u25CF Degraded: ' + degraded + '</span>' +
        '<span class="status-bar-offline">\u25CF Offline: ' + offline + '</span>' +
        '<span class="status-bar-latency">\u26A1 Avg: ' + avgLat + 'ms</span>' +
        '<span class="status-bar-uptime">\u2191 Uptime: ' + uptimePct + '%</span>';
    }
  }

  _updateDonutRing(ip, status) {
    const card = this.nodes.get(ip);
    if (!card) return;
    const canvas = card.querySelector('.card-donut-canvas');
    if (!canvas) return;
    const data = canvas._donutData || { ok: 0, fail: 0 };
    if (status === 'ONLINE' || status === 'DEGRADED') data.ok++;
    else data.fail++;
    canvas._donutData = data;

    const pctEl = card.querySelector('.card-donut-pct');
    const total = data.ok + data.fail;
    const pct = total > 0 ? Math.round((data.ok / total) * 100) : 100;
    if (pctEl) pctEl.textContent = pct;

    const ctx = canvas.getContext('2d');
    const rect = canvas.getBoundingClientRect();
    const dpr = window.devicePixelRatio || 1;
    canvas.width = rect.width * dpr;
    canvas.height = rect.height * dpr;
    ctx.scale(dpr, dpr);
    const w = rect.width, h = rect.height;
    ctx.clearRect(0, 0, w, h);

    const cx = w / 2, cy = h / 2, r = Math.min(cx, cy) - 2;
    ctx.lineWidth = 3;
    ctx.strokeStyle = '#1a2332';
    ctx.beginPath();
    ctx.arc(cx, cy, r, 0, Math.PI * 2);
    ctx.stroke();

    const okFrac = total > 0 ? data.ok / total : 1;
    ctx.strokeStyle = pct >= 95 ? '#00ff66' : pct >= 80 ? '#ffaa00' : '#ff3355';
    ctx.shadowColor = ctx.strokeStyle;
    ctx.shadowBlur = 4;
    ctx.beginPath();
    ctx.arc(cx, cy, r, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * okFrac);
    ctx.stroke();
    ctx.shadowBlur = 0;
  }

  _updateSparkline(ip, latency) {
    const card = this.nodes.get(ip);
    if (!card) return;
    const canvas = card.querySelector('.card-sparkline-canvas');
    if (!canvas) return;
    const data = canvas._sparkData || [];
    data.push(latency);
    if (data.length > 60) data.shift();
    canvas._sparkData = data;

    const ctx = canvas.getContext('2d');
    const rect = canvas.getBoundingClientRect();
    const dpr = window.devicePixelRatio || 1;
    canvas.width = rect.width * dpr;
    canvas.height = rect.height * dpr;
    ctx.scale(dpr, dpr);
    const w = rect.width, h = rect.height;
    ctx.clearRect(0, 0, w, h);

    if (data.length < 2) return;
    const maxLat = Math.max(...data.filter(v => v >= 0), 1);
    const step = w / Math.max(data.length - 1, 1);

    ctx.beginPath();
    for (let i = 0; i < data.length; i++) {
      const x = i * step;
      const y = data[i] >= 0 ? h - (data[i] / maxLat) * (h - 2) - 1 : h - 1;
      i === 0 ? ctx.moveTo(x, h) : null;
      ctx.lineTo(x, y);
    }
    ctx.lineTo((data.length - 1) * step, h);
    ctx.closePath();
    ctx.fillStyle = 'rgba(0,255,102,0.08)';
    ctx.fill();

    ctx.strokeStyle = 'rgba(0,255,102,0.3)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    for (let i = 0; i < data.length; i++) {
      const x = i * step;
      const y = data[i] >= 0 ? h - (data[i] / maxLat) * (h - 2) - 1 : h - 1;
      i === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y);
    }
    ctx.stroke();
  }

  openOverlay(ip) {
    if (!this.nodes.has(ip)) return;
    this.overlayIp = ip;
    this.overlayEntries = [];
    const displayName = this.names.get(ip) || ip;
    this.overlayTitle.textContent = 'NODE VIEWPORT \u2014 ' + displayName + ' (' + ip + ')';
    this.overlayConsoleLog.textContent = '';
    const logLine = document.createElement('div');
    logLine.className = 'log-entry log-info';
    logLine.textContent = '[SYSTEM] Monitoring ' + ip;
    this.overlayConsoleLog.appendChild(logLine);
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

  _playAlertSound(type) {
    try {
      const actx = new (window.AudioContext || window.webkitAudioContext)();
      const osc = actx.createOscillator();
      const gain = actx.createGain();
      osc.connect(gain);
      gain.connect(actx.destination);
      gain.gain.value = 0.08;
      osc.type = 'sine';
      if (type === 'offline') {
        osc.frequency.setValueAtTime(880, actx.currentTime);
        osc.frequency.linearRampToValueAtTime(440, actx.currentTime + 0.3);
      } else {
        osc.frequency.setValueAtTime(440, actx.currentTime);
        osc.frequency.linearRampToValueAtTime(880, actx.currentTime + 0.2);
      }
      osc.start();
      osc.stop(actx.currentTime + 0.3);
    } catch (_) {}
  }

  _sendNotification(title, body) {
    if (!this.notifEnabled || Notification.permission !== 'granted') return;
    try { new Notification(title, { body, icon: 'NPM.png' }); } catch (_) {}
  }

  _exportConfig() {
    const nodes = [];
    this.names.forEach((name, ip) => nodes.push({ ip, name }));
    const blob = new Blob([JSON.stringify({ nodes }, null, 2)], { type: 'application/json' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = 'netpulse-config.json';
    a.click();
    URL.revokeObjectURL(a.href);
    this._writeConsole('Config exported (' + nodes.length + ' nodes)', 'info');
  }

  _importConfig(file) {
    const reader = new FileReader();
    reader.onload = async () => {
      try {
        const data = JSON.parse(reader.result);
        if (!data.nodes || !Array.isArray(data.nodes)) throw new Error('Invalid config');
        let count = 0;
        for (const n of data.nodes) {
          if (n.ip && !this.nodes.has(n.ip)) {
            await fetch(this.backendUrl + '/api/targets', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ ip: n.ip, name: n.name || n.ip })
            });
            count++;
          }
        }
        this._writeConsole('Imported ' + count + ' nodes from config', 'ok');
        this.importFileInput.value = '';
      } catch (e) {
        this._writeConsole('Import failed: ' + e.message, 'fail');
      }
    };
    reader.readAsText(file);
  }

  _initParticles() {
    if (!this.particleCanvas) return;
    this._particles = new ParticleBackground(this.particleCanvas);
  }

  _toggleDashboard() {
    this.dashboardVisible = !this.dashboardVisible;
    this.dashboardPanel.classList.toggle('active', this.dashboardVisible);
    if (this.dashboardVisible) this._loadDashboardData();
  }

  async _loadDashboardData() {
    const targets = Array.from(this.engines.keys());
    if (targets.length === 0) return;
    try {
      const allHistory = {};
      for (const ip of targets) {
        const res = await fetch(this.backendUrl + '/api/history/' + encodeURIComponent(ip) + '?limit=5000');
        const data = await res.json();
        if (data.history) allHistory[ip] = data.history;
      }
      this._drawLatencyChart(allHistory);
      this._drawUptimeChart(allHistory);
      this._renderDowntimeTimeline(allHistory);
    } catch (e) {
      this._writeConsole('Dashboard data error: ' + e.message, 'fail');
    }
  }

  _drawLatencyChart(allHistory) {
    const canvas = this.dashLatencyChart;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    const rect = canvas.getBoundingClientRect();
    const dpr = window.devicePixelRatio || 1;
    canvas.width = rect.width * dpr;
    canvas.height = rect.height * dpr;
    ctx.scale(dpr, dpr);
    const w = rect.width, h = rect.height;
    ctx.clearRect(0, 0, w, h);

    const colors = ['#00ff66', '#00ccff', '#ffaa00', '#ff3355', '#aa66ff', '#ff66aa'];
    let colorIdx = 0;
    let maxLat = 100;

    const allNames = {};
    this.names.forEach((name, ip) => { allNames[ip] = name; });

    for (const ip of Object.keys(allHistory)) {
      const data = allHistory[ip];
      if (!data || data.length < 2) continue;
      const vals = data.map(d => d.latency);
      const maxV = Math.max(...vals);
      if (maxV > maxLat) maxLat = maxV;
    }
    maxLat = Math.max(maxLat, 100);

    const color = colors[0];
    ctx.strokeStyle = '#1a2332';
    ctx.lineWidth = 1;
    ctx.beginPath();
    for (let i = 0; i <= 4; i++) {
      const y = (h / 4) * i;
      ctx.moveTo(0, y);
      ctx.lineTo(w, y);
    }
    ctx.stroke();

    colorIdx = 0;
    for (const ip of Object.keys(allHistory)) {
      const data = allHistory[ip];
      if (!data || data.length < 2) continue;
      const vals = data.map(d => d.latency);
      const label = allNames[ip] || ip;
      const col = colors[colorIdx % colors.length];
      colorIdx++;

      const step = w / Math.max(vals.length - 1, 1);
      ctx.strokeStyle = col;
      ctx.lineWidth = 1.5;
      ctx.shadowColor = col;
      ctx.shadowBlur = 4;
      ctx.beginPath();
      for (let i = 0; i < vals.length; i++) {
        const x = i * step;
        const y = h - (Math.min(vals[i], maxLat) / maxLat) * (h - 4) - 2;
        i === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y);
      }
      ctx.stroke();
      ctx.shadowBlur = 0;

      ctx.fillStyle = col;
      ctx.font = '9px monospace';
      ctx.fillText(label, 4, 12 + (colorIdx - 1) * 12);
    }

    ctx.fillStyle = '#6b7482';
    ctx.font = '8px monospace';
    ctx.fillText(maxLat + 'ms', w - 30, 10);
    ctx.fillText('0ms', w - 24, h - 2);
  }

  _drawUptimeChart(allHistory) {
    const canvas = this.dashUptimeChart;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    const rect = canvas.getBoundingClientRect();
    const dpr = window.devicePixelRatio || 1;
    canvas.width = rect.width * dpr;
    canvas.height = rect.height * dpr;
    ctx.scale(dpr, dpr);
    const w = rect.width, h = rect.height;

    let totalOk = 0, totalFail = 0;
    for (const ip of Object.keys(allHistory)) {
      const data = allHistory[ip];
      if (!data) continue;
      for (const d of data) {
        if (d.status === 'ONLINE' || d.status === 'DEGRADED') totalOk++;
        else totalFail++;
      }
    }
    const total = totalOk + totalFail;
    if (total === 0) return;

    const pct = Math.round((totalOk / total) * 100);
    const cx = w / 2, cy = h / 2, r = Math.min(cx, cy) - 8;

    ctx.clearRect(0, 0, w, h);
    ctx.lineWidth = 10;
    ctx.strokeStyle = '#1a2332';
    ctx.beginPath();
    ctx.arc(cx, cy, r, 0, Math.PI * 2);
    ctx.stroke();

    const okFrac = totalOk / total;
    ctx.strokeStyle = pct >= 95 ? '#00ff66' : pct >= 80 ? '#ffaa00' : '#ff3355';
    ctx.shadowColor = ctx.strokeStyle;
    ctx.shadowBlur = 8;
    ctx.beginPath();
    ctx.arc(cx, cy, r, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * okFrac);
    ctx.stroke();
    ctx.shadowBlur = 0;

    ctx.fillStyle = '#f0f6fc';
    ctx.font = 'bold 18px monospace';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(pct + '%', cx, cy - 6);
    ctx.fillStyle = '#6b7482';
    ctx.font = '9px monospace';
    ctx.fillText('uptime', cx, cy + 12);
  }

  _renderDowntimeTimeline(allHistory) {
    const el = this.dashTimeline;
    if (!el) return;
    el.innerHTML = '';
    let entries = [];
    for (const ip of Object.keys(allHistory)) {
      const data = allHistory[ip];
      if (!data) continue;
      for (const d of data) {
        if (d.status === 'OFFLINE' || d.status === 'DEGRADED') {
          entries.push({ ip, status: d.status === 'OFFLINE' ? 'offline' : 'degraded', time: d.timestamp, name: this.names.get(ip) || ip });
        }
      }
    }
    entries.sort((a, b) => b.time.localeCompare(a.time));
    entries = entries.slice(0, 50);

    for (const e of entries) {
      const div = document.createElement('div');
      div.className = 'dash-timeline-entry';
      const dot = document.createElement('span');
      dot.className = 'dash-timeline-dot';
      const statusCls = ['ONLINE', 'DEGRADED', 'OFFLINE'].includes(e.status) ? e.status.toLowerCase() : 'unknown';
      dot.classList.add(statusCls);
      const text = document.createElement('span');
      text.className = 'dash-timeline-text';
      text.textContent = this._escHtml(e.name) + ' (' + e.status + ')';
      const time = document.createElement('span');
      time.className = 'dash-timeline-time';
      time.textContent = e.time.replace('T', ' ').split('.')[0];
      div.appendChild(dot);
      div.appendChild(text);
      div.appendChild(time);
      el.appendChild(div);
    }
    if (entries.length === 0) {
      el.innerHTML = '<div style="color:#6b7482;font-size:10px;padding:8px;">No downtime events recorded.</div>';
    }
  }
}

class ParticleBackground {
  constructor(canvas) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    this.particles = [];
    this.width = 0;
    this.height = 0;
    this.rafId = null;
    this._resize();
    this._spawn(80);
    this._animate();
    window.addEventListener('resize', () => this._resize());
  }
  _resize() {
    this.width = window.innerWidth;
    this.height = window.innerHeight;
    this.canvas.width = this.width;
    this.canvas.height = this.height;
  }
  _spawn(count) {
    for (let i = 0; i < count; i++) {
      this.particles.push({
        x: Math.random() * this.width,
        y: Math.random() * this.height,
        vx: (Math.random() - 0.5) * 0.3,
        vy: -(Math.random() * 0.2 + 0.05),
        size: Math.random() * 2 + 0.5,
        opacity: Math.random() * 0.3 + 0.1,
        pulse: 0
      });
    }
  }
  pulse(cx, cy, color) {
    for (const p of this.particles) {
      const dx = p.x - cx;
      const dy = p.y - cy;
      const dist = Math.sqrt(dx * dx + dy * dy);
      if (dist < 120) {
        p.pulse = Math.max(p.pulse, (1 - dist / 120) * 0.6);
        if (color) p.lastColor = color;
      }
    }
  }
  _animate() {
    this.ctx.clearRect(0, 0, this.width, this.height);
    for (const p of this.particles) {
      p.x += p.vx;
      p.y += p.vy;
      if (p.y < -5) { p.y = this.height + 5; p.x = Math.random() * this.width; }
      if (p.x < -5) p.x = this.width + 5;
      if (p.x > this.width + 5) p.x = -5;
      p.pulse = Math.max(0, p.pulse - 0.02);
      const opacity = Math.min(p.opacity + p.pulse, 0.8);
      const color = p.lastColor || '#00ff66';
      this.ctx.fillStyle = color;
      this.ctx.globalAlpha = opacity;
      this.ctx.beginPath();
      this.ctx.arc(p.x, p.y, p.size + p.pulse * 2, 0, Math.PI * 2);
      this.ctx.fill();
    }
    this.ctx.globalAlpha = 1;
    this.rafId = requestAnimationFrame(() => this._animate());
  }
}

document.addEventListener('DOMContentLoaded', () => {
  window.app = new NetpulseMonitorApp();
});
