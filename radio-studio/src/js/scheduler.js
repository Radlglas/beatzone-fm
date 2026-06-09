// ── Scheduler / Automation ────────────────────────────────────────────────────

export class Scheduler {
  constructor() {
    this.events = [];
    this.rotations = [];
    this.categories = { music: [], jingle: [], ad: [] };
    this.running = false;
    this._interval = null;
    this._listeners = {};
    this._rotationIdx = 0;
    this._rotationStep = 0;
    this._autoDJ = false;
    this._autoDJRunning = false;
    this._crossfadeTime = 5;
    this._nextEventId = 1;
  }

  // ── Events ──────────────────────────────────────────────────────────────────
  addEvent(time, type, data, repeat = 'none') {
    const id = this._nextEventId++;
    this.events.push({ id, time, type, data, repeat, fired: false, active: true });
    this.events.sort((a, b) => a.time.localeCompare(b.time));
    this._emit('update', {});
    return id;
  }

  removeEvent(id) {
    this.events = this.events.filter(e => e.id !== id);
    this._emit('update', {});
  }

  toggleEvent(id) {
    const e = this.events.find(e => e.id === id);
    if (e) { e.active = !e.active; this._emit('update', {}); }
  }

  // ── Rotations ────────────────────────────────────────────────────────────────
  addRotation(name, pattern) {
    this.rotations.push({ name, pattern, idx: 0 });
    this._emit('update', {});
  }

  // ── Auto-DJ ─────────────────────────────────────────────────────────────────
  setAutoDJ(enabled, crossfadeTime = 5) {
    this._autoDJ = enabled;
    this._crossfadeTime = crossfadeTime;
    this._emit('autodj', { enabled });
  }

  start() {
    if (this.running) return;
    this.running = true;
    this._interval = setInterval(() => this._tick(), 1000);
    this._emit('started', {});
  }

  stop() {
    this.running = false;
    if (this._interval) clearInterval(this._interval);
    this._interval = null;
    this._emit('stopped', {});
  }

  _tick() {
    const now = new Date();
    const hhmm = now.toTimeString().slice(0, 5); // HH:MM
    const hhmmss = now.toTimeString().slice(0, 8); // HH:MM:SS

    for (const ev of this.events) {
      if (!ev.active) continue;
      if (ev.time === hhmm || ev.time === hhmmss) {
        if (!ev.fired || ev.repeat !== 'none') {
          ev.fired = true;
          this._emit('event', ev);
          this._emit('log', {
            time: now.toLocaleTimeString(),
            type: ev.type,
            data: ev.data,
            msg: `Scheduler: ${ev.type} event fired`
          });
          if (ev.repeat === 'none') ev.active = false;
        }
      } else {
        if (hhmm !== ev.time) ev.fired = false;
      }
    }

    this._emit('tick', { time: now });
  }

  getNextEvents(count = 5) {
    const now = new Date();
    const nowMins = now.getHours() * 60 + now.getMinutes();
    return this.events
      .filter(e => e.active)
      .map(e => {
        const [hh, mm] = e.time.split(':').map(Number);
        const mins = hh * 60 + mm;
        const diff = mins >= nowMins ? mins - nowMins : 1440 - nowMins + mins;
        return { ...e, diffMins: diff };
      })
      .sort((a, b) => a.diffMins - b.diffMins)
      .slice(0, count);
  }

  on(event, cb) {
    if (!this._listeners[event]) this._listeners[event] = [];
    this._listeners[event].push(cb);
  }

  _emit(event, data) {
    (this._listeners[event] || []).forEach(cb => cb(data));
  }
}

// ── Clockwheel ────────────────────────────────────────────────────────────────
export class Clockwheel {
  constructor(name) {
    this.name = name;
    this.slots = [];
    this._idx = 0;
  }

  addSlot(type, category, label = '') {
    this.slots.push({ type, category, label });
  }

  next() {
    if (this.slots.length === 0) return null;
    const slot = this.slots[this._idx % this.slots.length];
    this._idx++;
    return slot;
  }

  reset() { this._idx = 0; }
}
