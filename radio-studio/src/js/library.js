// ── Music Library ─────────────────────────────────────────────────────────────

export class Library {
  constructor() {
    this.tracks = [];
    this.history = [];
    this.queue = [];
    this.requests = [];
    this.folders = [];
    this._listeners = {};
    this._filterQuery = '';
    this._sortCol = 'title';
    this._sortDir = 1;
  }

  get filteredTracks() {
    let list = this.tracks;
    if (this._filterQuery) {
      const q = this._filterQuery.toLowerCase();
      list = list.filter(t =>
        t.title.toLowerCase().includes(q) ||
        t.artist.toLowerCase().includes(q) ||
        t.album.toLowerCase().includes(q) ||
        (t.genre || '').toLowerCase().includes(q)
      );
    }
    return [...list].sort((a, b) => {
      const av = (a[this._sortCol] || '').toString().toLowerCase();
      const bv = (b[this._sortCol] || '').toString().toLowerCase();
      return av.localeCompare(bv) * this._sortDir;
    });
  }

  async addFolder(folderPath) {
    if (this.folders.includes(folderPath)) return;
    this.folders.push(folderPath);
    this._emit('status', { msg: `Scanning ${folderPath}...` });

    const files = await window.radioAPI.scanFolder(folderPath);
    const known = new Set(this.tracks.map(t => t.path));
    const newFiles = files.filter(f => !known.has(f));

    const BATCH = 20;
    for (let i = 0; i < newFiles.length; i += BATCH) {
      const batch = newFiles.slice(i, i + BATCH);
      const metas = await window.radioAPI.getMetadataBatch(batch);
      for (const m of metas) this.tracks.push(this._normalize(m));
      this._emit('update', {});
      this._emit('status', { msg: `Loading... ${Math.min(i + BATCH, newFiles.length)}/${newFiles.length}` });
    }

    this._emit('status', { msg: `${this.tracks.length} tracks loaded` });
    this._emit('update', {});
  }

  async addFiles(filePaths) {
    const known = new Set(this.tracks.map(t => t.path));
    const newFiles = filePaths.filter(f => !known.has(f));
    const metas = await window.radioAPI.getMetadataBatch(newFiles);
    for (const m of metas) this.tracks.push(this._normalize(m));
    this._emit('update', {});
  }

  _normalize(m) {
    return {
      path: m.path,
      title: m.title || 'Unknown Title',
      artist: m.artist || 'Unknown Artist',
      album: m.album || '',
      genre: m.genre || '',
      duration: m.duration || 0,
      bpm: m.bpm || null,
      key: m.key || null,
      year: m.year || null
    };
  }

  setFilter(q) {
    this._filterQuery = q;
    this._emit('update', {});
  }

  setSort(col) {
    if (this._sortCol === col) this._sortDir *= -1;
    else { this._sortCol = col; this._sortDir = 1; }
    this._emit('update', {});
  }

  addToHistory(track) {
    this.history.unshift({ ...track, playedAt: new Date() });
    if (this.history.length > 200) this.history.pop();
    this._emit('historyupdate', {});
  }

  addToQueue(track) {
    this.queue.push(track);
    this._emit('queueupdate', {});
  }

  removeFromQueue(idx) {
    this.queue.splice(idx, 1);
    this._emit('queueupdate', {});
  }

  addRequest(track, requester = 'Listener') {
    this.requests.push({ ...track, requester, requestedAt: new Date() });
    this._emit('requestupdate', {});
  }

  nextQueueTrack() {
    if (this.queue.length > 0) return this.queue.shift();
    if (this.requests.length > 0) return this.requests.shift();
    return null;
  }

  exportLog() {
    const rows = ['Date,Time,Artist,Title,Album,Duration'];
    for (const h of this.history) {
      const d = new Date(h.playedAt);
      rows.push([
        d.toLocaleDateString('de-DE'),
        d.toLocaleTimeString('de-DE'),
        `"${h.artist}"`, `"${h.title}"`, `"${h.album}"`,
        this._fmtDuration(h.duration)
      ].join(','));
    }
    return rows.join('\n');
  }

  _fmtDuration(s) {
    if (!s) return '0:00';
    const m = Math.floor(s / 60);
    const sec = Math.floor(s % 60);
    return `${m}:${sec.toString().padStart(2, '0')}`;
  }

  on(event, cb) {
    if (!this._listeners[event]) this._listeners[event] = [];
    this._listeners[event].push(cb);
  }

  _emit(event, data) {
    (this._listeners[event] || []).forEach(cb => cb(data));
  }
}
