// ── Jog Wheel Renderer ────────────────────────────────────────────────────────
// Draws a vinyl-style turntable, animates with playback, supports scratch

export class JogWheel {
  constructor(canvas, opts = {}) {
    this.canvas   = canvas;
    this.ctx      = canvas.getContext('2d');
    this.angle    = 0;          // current rotation in radians
    this.spinning = false;
    this.deckColor= opts.color || '#FF6A00';
    this.label    = opts.label || 'A';
    this._scratch = false;
    this._scratchStartAngle = 0;
    this._scratchStartY     = 0;
    this._onSeek  = opts.onSeek || null;
    this._onScratch = opts.onScratch || null;
    this._bindEvents();
    this.draw();
  }

  setAngle(rad) { this.angle = rad; }

  tick(deltaMs, bpm) {
    if (!this.spinning) return;
    // 1 revolution per 2 seconds at normal speed (or sync to BPM)
    const rpm = bpm ? bpm / 2 : 33.3;
    this.angle += (rpm / 60) * (deltaMs / 1000) * Math.PI * 2;
    this.draw();
  }

  draw() {
    const canvas = this.canvas;
    const dpr = window.devicePixelRatio || 1;
    const W = canvas.clientWidth  || 180;
    const H = canvas.clientHeight || 180;
    if (canvas.width !== W * dpr || canvas.height !== H * dpr) {
      canvas.width  = W * dpr;
      canvas.height = H * dpr;
      this.ctx.scale(dpr, dpr);
    }
    const ctx = this.ctx;
    const cx = W / 2, cy = H / 2;
    const R  = Math.min(W, H) / 2 - 3;

    ctx.clearRect(0, 0, W, H);

    // ── Outer glow ring ──────────────────────────────────────────────
    if (this.spinning) {
      ctx.beginPath();
      ctx.arc(cx, cy, R + 1, 0, Math.PI * 2);
      ctx.strokeStyle = this.deckColor;
      ctx.lineWidth = 1.5;
      ctx.shadowColor = this.deckColor;
      ctx.shadowBlur = 10;
      ctx.stroke();
      ctx.shadowBlur = 0;
    }

    // ── Outer edge ring ──────────────────────────────────────────────
    ctx.beginPath();
    ctx.arc(cx, cy, R, 0, Math.PI * 2);
    ctx.strokeStyle = '#2a2a2a';
    ctx.lineWidth = 2;
    ctx.stroke();

    // ── Vinyl background ─────────────────────────────────────────────
    const bg = ctx.createRadialGradient(cx, cy, 0, cx, cy, R);
    bg.addColorStop(0,   '#1c1c1c');
    bg.addColorStop(0.6, '#141414');
    bg.addColorStop(1,   '#0a0a0a');
    ctx.beginPath();
    ctx.arc(cx, cy, R - 1, 0, Math.PI * 2);
    ctx.fillStyle = bg;
    ctx.fill();

    // ── Spinning record grooves ──────────────────────────────────────
    ctx.save();
    ctx.translate(cx, cy);
    ctx.rotate(this.angle);

    // Concentric groove rings (subtle)
    for (let i = 1; i <= 5; i++) {
      const gr = R * (0.45 + i * 0.09);
      ctx.beginPath();
      ctx.arc(0, 0, gr, 0, Math.PI * 2);
      ctx.strokeStyle = `rgba(60,60,60,${0.5 - i * 0.07})`;
      ctx.lineWidth = 0.5;
      ctx.stroke();
    }

    // Position dots on outer ring
    const dotR = R * 0.86;
    const numDots = 36;
    for (let i = 0; i < numDots; i++) {
      const a   = (i / numDots) * Math.PI * 2;
      const big = i % 9 === 0;
      const x   = Math.cos(a) * dotR;
      const y   = Math.sin(a) * dotR;
      ctx.beginPath();
      ctx.arc(x, y, big ? 3.5 : 1.5, 0, Math.PI * 2);
      ctx.fillStyle = big ? this.deckColor : '#333';
      if (big) { ctx.shadowColor = this.deckColor; ctx.shadowBlur = 5; }
      ctx.fill();
      ctx.shadowBlur = 0;
    }

    // Radial lines (like vinyl label edge)
    for (let i = 0; i < 12; i++) {
      const a = (i / 12) * Math.PI * 2;
      ctx.beginPath();
      ctx.moveTo(Math.cos(a) * R * 0.38, Math.sin(a) * R * 0.38);
      ctx.lineTo(Math.cos(a) * R * 0.72, Math.sin(a) * R * 0.72);
      ctx.strokeStyle = 'rgba(50,50,50,0.6)';
      ctx.lineWidth = 0.8;
      ctx.stroke();
    }

    ctx.restore();

    // ── Center label (non-spinning) ───────────────────────────────────
    const cR = R * 0.28;
    const cGrad = ctx.createRadialGradient(cx - 3, cy - 3, 0, cx, cy, cR);
    cGrad.addColorStop(0, '#3a3a3a');
    cGrad.addColorStop(0.7, '#1e1e1e');
    cGrad.addColorStop(1, '#111');
    ctx.beginPath();
    ctx.arc(cx, cy, cR, 0, Math.PI * 2);
    ctx.fillStyle = cGrad;
    ctx.fill();
    ctx.strokeStyle = '#3a3a3a';
    ctx.lineWidth = 1;
    ctx.stroke();

    // Center crosshair
    ctx.strokeStyle = '#333';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(cx - cR * 0.5, cy); ctx.lineTo(cx + cR * 0.5, cy);
    ctx.moveTo(cx, cy - cR * 0.5); ctx.lineTo(cx, cy + cR * 0.5);
    ctx.stroke();

    // Center dot
    ctx.beginPath();
    ctx.arc(cx, cy, 5, 0, Math.PI * 2);
    ctx.fillStyle = this.deckColor;
    ctx.shadowColor = this.deckColor;
    ctx.shadowBlur = 8;
    ctx.fill();
    ctx.shadowBlur = 0;

    // Center label letter
    ctx.font = `bold ${Math.floor(cR * 0.6)}px -apple-system, sans-serif`;
    ctx.fillStyle = 'rgba(255,106,0,0.3)';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(this.label, cx, cy + cR * 0.6);

    // ── Position indicator (spinning orange dot on outer rim) ─────────
    const indicAngle = this.angle - Math.PI / 2;
    const indR = R - 4;
    const ix = cx + Math.cos(indicAngle) * indR;
    const iy = cy + Math.sin(indicAngle) * indR;
    ctx.beginPath();
    ctx.arc(ix, iy, 4, 0, Math.PI * 2);
    ctx.fillStyle = this.deckColor;
    ctx.shadowColor = this.deckColor;
    ctx.shadowBlur = 8;
    ctx.fill();
    ctx.shadowBlur = 0;
  }

  _bindEvents() {
    const c = this.canvas;

    c.addEventListener('mousedown', (e) => {
      this._scratch = true;
      this._scratchStartY = e.clientY;
      const rect = c.getBoundingClientRect();
      const dx = e.clientX - rect.left - c.clientWidth / 2;
      const dy = e.clientY - rect.top  - c.clientHeight / 2;
      this._scratchStartAngle = Math.atan2(dy, dx);
      e.preventDefault();
    });

    window.addEventListener('mousemove', (e) => {
      if (!this._scratch) return;
      const deltaY = e.clientY - this._scratchStartY;
      this._scratchStartY = e.clientY;
      if (this._onScratch) this._onScratch(deltaY);
    });

    window.addEventListener('mouseup', () => { this._scratch = false; });

    // Click = cue jump
    c.addEventListener('click', () => {
      if (this._onSeek) this._onSeek();
    });
  }
}
