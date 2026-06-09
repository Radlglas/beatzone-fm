// ── Waveform Renderer ─────────────────────────────────────────────────────────
// Renders audio peaks onto a canvas with scrolling playhead

export class WaveformRenderer {
  constructor(canvas, overviewCanvas) {
    this.canvas = canvas;
    this.overview = overviewCanvas;
    this.ctx = canvas.getContext('2d');
    this.ovCtx = overviewCanvas ? overviewCanvas.getContext('2d') : null;
    this.peaks = null;
    this.position = 0;
    this.hotCues = new Array(8).fill(null);
    this.loopStart = null;
    this.loopEnd = null;
    this.looping = false;
    this.zoom = 4;
    this._raf = null;
    this._lastPos = -1;
  }

  setPeaks(peaks) {
    this.peaks = peaks;
    this._drawOverview();
    this.draw();
  }

  setPosition(pos) {
    this.position = Math.max(0, Math.min(1, pos));
    if (Math.abs(this.position - this._lastPos) > 0.0002) {
      this.draw();
      this._drawOverviewPlayhead();
      this._lastPos = this.position;
    }
  }

  setHotCue(index, pos) {
    this.hotCues[index] = pos;
    this.draw();
  }

  setLoop(start, end) {
    this.loopStart = start;
    this.loopEnd = end;
    this.looping = true;
    this.draw();
  }

  clearLoop() {
    this.loopStart = null;
    this.loopEnd = null;
    this.looping = false;
    this.draw();
  }

  draw() {
    if (!this.peaks || !this.canvas) return;
    const { ctx, canvas } = this;
    const W = canvas.width;
    const H = canvas.height;
    const midY = H / 2;

    ctx.clearRect(0, 0, W, H);

    // Background
    ctx.fillStyle = '#0a0a0a';
    ctx.fillRect(0, 0, W, H);

    // Center line
    ctx.strokeStyle = '#2a2a2a';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(0, midY);
    ctx.lineTo(W, midY);
    ctx.stroke();

    const numPeaks = this.peaks.length / 2;
    const visibleWindow = numPeaks / this.zoom;
    const startIdx = Math.floor(this.position * numPeaks - visibleWindow / 2);
    const endIdx = startIdx + visibleWindow;

    const pixPerPeak = W / visibleWindow;

    for (let i = 0; i < visibleWindow; i++) {
      const peakIdx = startIdx + i;
      if (peakIdx < 0 || peakIdx >= numPeaks) continue;

      const absPos = peakIdx / numPeaks;
      const x = i * pixPerPeak;
      const min = this.peaks[peakIdx * 2];
      const max = this.peaks[peakIdx * 2 + 1];

      const yMax = midY - max * midY * 0.95;
      const yMin = midY - min * midY * 0.95;

      // Color: played = orange, unplayed = dim
      const played = absPos < this.position;
      const inLoop = this.looping && this.loopStart !== null &&
                     absPos >= this.loopStart && absPos <= this.loopEnd;

      let color;
      if (inLoop) {
        color = 'rgba(255, 180, 50, 0.9)';
      } else if (played) {
        color = '#FF6A00';
      } else {
        const alpha = 0.35 + Math.abs(max) * 0.5;
        color = `rgba(180, 120, 60, ${alpha.toFixed(2)})`;
      }

      ctx.fillStyle = color;
      ctx.fillRect(Math.floor(x), yMax, Math.max(1, Math.floor(pixPerPeak - 0.5)), yMin - yMax);
    }

    // Loop region highlight
    if (this.looping && this.loopStart !== null) {
      const lsX = ((this.loopStart - this.position) * numPeaks + visibleWindow / 2) * pixPerPeak;
      const leX = ((this.loopEnd - this.position) * numPeaks + visibleWindow / 2) * pixPerPeak;
      ctx.fillStyle = 'rgba(255, 180, 50, 0.08)';
      ctx.fillRect(lsX, 0, leX - lsX, H);
      ctx.fillStyle = 'rgba(255, 180, 50, 0.6)';
      ctx.fillRect(lsX, 0, 2, H);
      ctx.fillRect(leX, 0, 2, H);
    }

    // Hot cue markers
    const hotCueColors = ['#FF6A00', '#00BFFF', '#00FF88', '#FF2255', '#FFD700', '#CC44FF', '#FF8C00', '#00CED1'];
    for (let i = 0; i < 8; i++) {
      if (this.hotCues[i] === null) continue;
      const hcX = ((this.hotCues[i] - this.position) * numPeaks + visibleWindow / 2) * pixPerPeak;
      if (hcX < 0 || hcX > W) continue;
      ctx.fillStyle = hotCueColors[i];
      ctx.fillRect(hcX - 1, 0, 2, H);
      // Triangle marker
      ctx.beginPath();
      ctx.moveTo(hcX - 6, 0);
      ctx.lineTo(hcX + 6, 0);
      ctx.lineTo(hcX, 10);
      ctx.closePath();
      ctx.fill();
      ctx.fillStyle = '#fff';
      ctx.font = 'bold 8px monospace';
      ctx.fillText(i + 1, hcX - 3, 9);
    }

    // Playhead
    const phX = W / 2;
    const grad = ctx.createLinearGradient(phX - 1, 0, phX + 1, 0);
    grad.addColorStop(0, 'rgba(255, 106, 0, 0)');
    grad.addColorStop(0.5, '#FF6A00');
    grad.addColorStop(1, 'rgba(255, 106, 0, 0)');
    ctx.fillStyle = grad;
    ctx.fillRect(phX - 2, 0, 4, H);

    // Glow
    ctx.shadowColor = '#FF6A00';
    ctx.shadowBlur = 8;
    ctx.strokeStyle = '#FF6A00';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(phX, 0);
    ctx.lineTo(phX, H);
    ctx.stroke();
    ctx.shadowBlur = 0;
  }

  _drawOverview() {
    if (!this.ovCtx || !this.peaks) return;
    const ctx = this.ovCtx;
    const W = this.overview.width;
    const H = this.overview.height;
    const numPeaks = this.peaks.length / 2;
    const midY = H / 2;

    ctx.clearRect(0, 0, W, H);
    ctx.fillStyle = '#0a0a0a';
    ctx.fillRect(0, 0, W, H);

    const pixPerPeak = W / numPeaks;
    for (let i = 0; i < numPeaks; i++) {
      const max = this.peaks[i * 2 + 1];
      const min = this.peaks[i * 2];
      const x = i * pixPerPeak;
      const yMax = midY - max * midY * 0.9;
      const yMin = midY - min * midY * 0.9;
      ctx.fillStyle = 'rgba(255, 106, 0, 0.5)';
      ctx.fillRect(x, yMax, Math.max(1, pixPerPeak - 0.3), yMin - yMax);
    }
    this._drawOverviewPlayhead();
  }

  _drawOverviewPlayhead() {
    if (!this.ovCtx) return;
    const ctx = this.ovCtx;
    const W = this.overview.width;
    const H = this.overview.height;
    const x = this.position * W;

    // Re-draw just the playhead area (draw thin line)
    ctx.fillStyle = 'rgba(255, 106, 0, 0.25)';
    ctx.fillRect(0, H - 3, x, 3);
    ctx.fillStyle = '#FF6A00';
    ctx.fillRect(x - 1, 0, 2, H);
  }

  zoomIn()  { this.zoom = Math.min(32, this.zoom * 2); this.draw(); }
  zoomOut() { this.zoom = Math.max(1, this.zoom / 2);  this.draw(); }

  destroy() {
    if (this._raf) cancelAnimationFrame(this._raf);
  }
}
