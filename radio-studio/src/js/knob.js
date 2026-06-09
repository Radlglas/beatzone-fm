// ── Canvas Knob Renderer ──────────────────────────────────────────────────────
// Draws professional-looking rotary knobs on <canvas> elements

export class Knob {
  /**
   * @param {HTMLCanvasElement} canvas
   * @param {object} opts  { min, max, value, color, label, onChange }
   */
  constructor(canvas, opts = {}) {
    this.canvas  = canvas;
    this.ctx     = canvas.getContext('2d');
    this.min     = opts.min     ?? 0;
    this.max     = opts.max     ?? 1;
    this.value   = opts.value   ?? (this.min + this.max) / 2;
    this.color   = opts.color   ?? '#FF6A00';
    this.label   = opts.label   ?? '';
    this.onChange = opts.onChange ?? null;
    this.defaultValue = opts.value ?? (this.min + this.max) / 2;

    this._dragging = false;
    this._startY   = 0;
    this._startVal = 0;

    this._resize();
    this.draw();
    this._bindEvents();
  }

  _resize() {
    const dpr = window.devicePixelRatio || 1;
    const size = this.canvas.clientWidth || 44;
    this.canvas.width  = size * dpr;
    this.canvas.height = size * dpr;
    this.ctx.scale(dpr, dpr);
    this._size = size;
  }

  normalised() {
    return (this.value - this.min) / (this.max - this.min);
  }

  draw() {
    const { ctx } = this;
    const s  = this._size;
    const cx = s / 2;
    const cy = s / 2;
    const r  = s / 2 - 3;
    const n  = this.normalised();

    ctx.clearRect(0, 0, s, s);

    // Arc track: from 135° to 405° (270° sweep)
    const startAngle = Math.PI * 0.75;
    const sweep      = Math.PI * 1.5;
    const valAngle   = startAngle + n * sweep;

    // Shadow for depth
    ctx.save();
    ctx.shadowColor = 'rgba(0,0,0,0.7)';
    ctx.shadowBlur  = 4;
    ctx.shadowOffsetY = 2;
    ctx.beginPath();
    ctx.arc(cx, cy, r + 1, 0, Math.PI * 2);
    ctx.fillStyle = '#0a0a0a';
    ctx.fill();
    ctx.restore();

    // Background arc track
    ctx.beginPath();
    ctx.arc(cx, cy, r - 1, startAngle, startAngle + sweep);
    ctx.strokeStyle = '#1e1e1e';
    ctx.lineWidth   = 4;
    ctx.lineCap     = 'round';
    ctx.stroke();

    // Value arc (orange)
    if (n > 0) {
      ctx.beginPath();
      ctx.arc(cx, cy, r - 1, startAngle, valAngle);
      ctx.strokeStyle = this.color;
      ctx.lineWidth   = 4;
      ctx.lineCap     = 'round';
      ctx.shadowColor = this.color;
      ctx.shadowBlur  = 6;
      ctx.stroke();
      ctx.shadowBlur  = 0;
    }

    // Knob body
    const bodyR = r - 6;
    const grad = ctx.createRadialGradient(cx - bodyR * 0.3, cy - bodyR * 0.3, 0, cx, cy, bodyR);
    grad.addColorStop(0,   '#3e3e3e');
    grad.addColorStop(0.4, '#222');
    grad.addColorStop(1,   '#0d0d0d');
    ctx.beginPath();
    ctx.arc(cx, cy, bodyR, 0, Math.PI * 2);
    ctx.fillStyle = grad;
    ctx.fill();

    // Rim
    ctx.beginPath();
    ctx.arc(cx, cy, bodyR, 0, Math.PI * 2);
    ctx.strokeStyle = '#3a3a3a';
    ctx.lineWidth   = 1;
    ctx.stroke();

    // Specular highlight (top-left)
    ctx.beginPath();
    ctx.arc(cx - 2, cy - 2, bodyR * 0.55, -Math.PI * 0.85, -Math.PI * 0.25);
    ctx.strokeStyle = 'rgba(255,255,255,0.07)';
    ctx.lineWidth   = 2;
    ctx.stroke();

    // Indicator line
    const indicAngle = valAngle - Math.PI / 2;
    const iR1 = bodyR - 2;
    const iR2 = bodyR - 8;
    ctx.beginPath();
    ctx.moveTo(cx + Math.cos(indicAngle) * iR1, cy + Math.sin(indicAngle) * iR1);
    ctx.lineTo(cx + Math.cos(indicAngle) * iR2, cy + Math.sin(indicAngle) * iR2);
    ctx.strokeStyle = this.color;
    ctx.lineWidth   = 2.5;
    ctx.lineCap     = 'round';
    ctx.shadowColor = this.color;
    ctx.shadowBlur  = 5;
    ctx.stroke();
    ctx.shadowBlur  = 0;
  }

  setValue(v) {
    this.value = Math.max(this.min, Math.min(this.max, v));
    this.draw();
  }

  _bindEvents() {
    const el = this.canvas;

    el.addEventListener('mousedown', (e) => {
      this._dragging = true;
      this._startY   = e.clientY;
      this._startVal = this.value;
      e.preventDefault();
    });

    el.addEventListener('dblclick', () => {
      this.setValue(this.defaultValue);
      this.onChange?.(this.value);
    });

    el.addEventListener('wheel', (e) => {
      e.preventDefault();
      const range = this.max - this.min;
      const step  = range / 100;
      this.setValue(this.value + (e.deltaY < 0 ? step : -step));
      this.onChange?.(this.value);
    }, { passive: false });

    window.addEventListener('mousemove', (e) => {
      if (!this._dragging) return;
      const delta = (this._startY - e.clientY) / 120;
      const range = this.max - this.min;
      this.setValue(this._startVal + delta * range);
      this.onChange?.(this.value);
    });

    window.addEventListener('mouseup', () => { this._dragging = false; });
  }
}

// ── LED VU Meter ──────────────────────────────────────────────────────────────
export class VUMeter {
  constructor(canvasL, canvasR) {
    this.canvL = canvasL;
    this.canvR = canvasR;
    this._peak = [0, 0];
    this._peakHold = [0, 0];
    this._peakTimer = [0, 0];
  }

  setLevels(left, right) {
    this._draw(this.canvL, left,  0);
    this._draw(this.canvR, right, 1);
  }

  _draw(canvas, rms, ch) {
    if (!canvas) return;
    const ctx  = canvas.getContext('2d');
    const W    = canvas.width;
    const H    = canvas.height;
    const segs = 24;
    const sw   = W - 2;
    const sh   = Math.floor(H / segs) - 1;

    ctx.clearRect(0, 0, W, H);

    // Convert RMS to dB
    const db  = 20 * Math.log10(Math.max(rms, 1e-6));
    const lvl = Math.max(0, Math.min(1, (db + 60) / 60));

    // Peak hold
    if (lvl > this._peakHold[ch]) {
      this._peakHold[ch] = lvl;
      this._peakTimer[ch] = 60;
    } else if (this._peakTimer[ch] > 0) {
      this._peakTimer[ch]--;
    } else {
      this._peakHold[ch] = Math.max(0, this._peakHold[ch] - 0.008);
    }

    const activeSeg = Math.floor(lvl * segs);
    const peakSeg   = Math.floor(this._peakHold[ch] * segs);

    for (let i = 0; i < segs; i++) {
      const y   = H - (i + 1) * (H / segs);
      const pos = i / segs;
      let color;
      if (pos < 0.6)       color = '#00CC44';
      else if (pos < 0.85) color = '#CCCC00';
      else                  color = '#FF2244';

      if (i <= activeSeg) {
        ctx.fillStyle = color;
      } else if (i === peakSeg) {
        ctx.fillStyle = color;
      } else {
        ctx.fillStyle = '#1a1a1a';
      }
      ctx.fillRect(1, y, sw, sh);
    }
  }
}
