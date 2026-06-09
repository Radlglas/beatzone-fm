// ── Setup Wizard ──────────────────────────────────────────────────────────────
// Shown on first launch. Creates the complete radio station profile.

export class SetupWizard {
  constructor(onComplete) {
    this.onComplete = onComplete;
    this.step = 0;
    this.totalSteps = 6;
    this.data = {
      // Station identity
      stationName: '',
      slogan: '',
      genre: '',
      website: '',
      email: '',
      logoPath: '',
      // Streaming
      protocol: 'icecast2',
      host: '',
      port: 8000,
      mountpoint: '/live',
      streamUser: 'source',
      streamPass: '',
      format: 'mp3',
      bitrate: 128,
      // Wunschbox
      wunschboxEnabled: false,
      wunschboxPhone: '',
      wunschboxWhatsapp: '',
      wunschboxEmail: '',
      // Voicemail
      voicemailEnabled: false,
      voicemailGreeting: 'Hallo, hier ist {stationName}. Bitte hinterlass deinen Wunsch nach dem Signal.',
      voicemailSavePath: '',
      // Music
      musicFolders: [],
    };
    this._overlay = null;
    this._mediaRecorder = null;
    this._isRecording = false;
  }

  show() {
    this._build();
    this.step = 0;
    this._render();
    this._overlay.classList.add('wiz-visible');
  }

  hide() {
    this._overlay?.classList.remove('wiz-visible');
  }

  _build() {
    if (this._overlay) return;
    const ov = document.createElement('div');
    ov.id = 'wiz-overlay';
    ov.innerHTML = `
      <div id="wiz-dialog">
        <div id="wiz-sidebar">
          <div class="wiz-logo">
            <div class="wiz-gem"></div>
            <span>RadioFlare</span>
          </div>
          <div id="wiz-steps-nav"></div>
          <div class="wiz-skip" onclick="window.__wizard.skip()">Überspringen →</div>
        </div>
        <div id="wiz-main">
          <div id="wiz-content"></div>
          <div id="wiz-footer">
            <button id="wiz-back"  onclick="window.__wizard.prev()">← Zurück</button>
            <div id="wiz-progress-dots"></div>
            <button id="wiz-next"  onclick="window.__wizard.next()">Weiter →</button>
          </div>
        </div>
      </div>`;
    document.body.appendChild(ov);
    this._overlay = ov;
    window.__wizard = this;
  }

  _render() {
    const steps = [
      'Willkommen',
      'Radio-Profil',
      'Streaming',
      'Wunschbox',
      'Voicemail',
      'Musik-Ordner',
    ];

    // Sidebar nav
    const nav = document.getElementById('wiz-steps-nav');
    if (nav) {
      nav.innerHTML = steps.map((s, i) => `
        <div class="wiz-step-item ${i === this.step ? 'active' : ''} ${i < this.step ? 'done' : ''}">
          <div class="wiz-step-dot">${i < this.step ? '✓' : i + 1}</div>
          <span>${s}</span>
        </div>`).join('');
    }

    // Progress dots
    const dots = document.getElementById('wiz-progress-dots');
    if (dots) {
      dots.innerHTML = steps.map((_, i) => `<div class="wiz-dot ${i === this.step ? 'active' : i < this.step ? 'done' : ''}"></div>`).join('');
    }

    // Back/Next buttons
    const backBtn = document.getElementById('wiz-back');
    const nextBtn = document.getElementById('wiz-next');
    if (backBtn) backBtn.style.visibility = this.step === 0 ? 'hidden' : 'visible';
    if (nextBtn) nextBtn.textContent = this.step === this.totalSteps - 1 ? '🚀 Fertig & Starten' : 'Weiter →';

    // Content
    const content = document.getElementById('wiz-content');
    if (content) content.innerHTML = this._stepContent(this.step);

    // Bind inputs
    this._bindInputs();
  }

  _stepContent(step) {
    switch (step) {

      case 0: return `
        <div class="wiz-welcome">
          <div class="wiz-welcome-icon">📻</div>
          <h1>Willkommen bei RadioFlare</h1>
          <p>Richte in wenigen Minuten deine komplette Radiostation ein.</p>
          <p>Du kannst alle Einstellungen später jederzeit unter <strong>⚙ Einstellungen</strong> ändern.</p>
          <div class="wiz-features">
            <div class="wiz-feat"><span>🎵</span> DJ-Pult mit 2 Decks</div>
            <div class="wiz-feat"><span>📡</span> Live-Streaming zu Icecast/Shoutcast</div>
            <div class="wiz-feat"><span>🎤</span> Wunschbox & Voicemail</div>
            <div class="wiz-feat"><span>🤖</span> Auto-DJ & Sendeplan</div>
            <div class="wiz-feat"><span>📂</span> Musik-Bibliothek vom PC</div>
          </div>
        </div>`;

      case 1: return `
        <div class="wiz-section">
          <h2>📻 Radio-Profil</h2>
          <p class="wiz-desc">Wie heißt dein Radio? Diese Daten erscheinen im Stream und in der App.</p>
          <div class="wiz-form">
            <div class="wf-row">
              <label>Stationsname *</label>
              <input type="text" id="wi-sname" value="${this.data.stationName}" placeholder="z.B. Radio Sunshine" class="wiz-input big">
            </div>
            <div class="wf-row">
              <label>Slogan / Beschreibung</label>
              <input type="text" id="wi-slogan" value="${this.data.slogan}" placeholder="z.B. Der beste Mix für deine Region" class="wiz-input">
            </div>
            <div class="wf-row two-col">
              <div>
                <label>Genre / Musikrichtung</label>
                <input type="text" id="wi-genre" value="${this.data.genre}" placeholder="Pop, Rock, Electronic…" class="wiz-input">
              </div>
              <div>
                <label>Webseite</label>
                <input type="text" id="wi-web" value="${this.data.website}" placeholder="https://meinradio.de" class="wiz-input">
              </div>
            </div>
            <div class="wf-row">
              <label>E-Mail (für Hörer-Kontakt)</label>
              <input type="email" id="wi-email" value="${this.data.email}" placeholder="kontakt@meinradio.de" class="wiz-input">
            </div>
          </div>
        </div>`;

      case 2: return `
        <div class="wiz-section">
          <h2>📡 Streaming-Server</h2>
          <p class="wiz-desc">Verbinde die App mit deinem Radio-Server. Ohne Server kannst du trotzdem DJ-Modus und Automation nutzen.</p>
          <div class="wiz-form">
            <div class="wf-row two-col">
              <div>
                <label>Protokoll</label>
                <select id="wi-proto" class="wiz-input">
                  <option value="icecast2" ${this.data.protocol==='icecast2'?'selected':''}>Icecast 2</option>
                  <option value="shoutcast" ${this.data.protocol==='shoutcast'?'selected':''}>Shoutcast</option>
                </select>
              </div>
              <div>
                <label>Host / Server-Adresse</label>
                <input type="text" id="wi-host" value="${this.data.host}" placeholder="stream.meinradio.de" class="wiz-input">
              </div>
            </div>
            <div class="wf-row two-col">
              <div>
                <label>Port</label>
                <input type="number" id="wi-port" value="${this.data.port}" placeholder="8000" class="wiz-input">
              </div>
              <div>
                <label>Mountpoint</label>
                <input type="text" id="wi-mnt" value="${this.data.mountpoint}" placeholder="/live" class="wiz-input">
              </div>
            </div>
            <div class="wf-row two-col">
              <div>
                <label>Benutzername (meistens "source")</label>
                <input type="text" id="wi-user" value="${this.data.streamUser}" placeholder="source" class="wiz-input">
              </div>
              <div>
                <label>Passwort</label>
                <input type="password" id="wi-pass" value="${this.data.streamPass}" placeholder="••••••••" class="wiz-input">
              </div>
            </div>
            <div class="wf-row two-col">
              <div>
                <label>Format</label>
                <select id="wi-fmt" class="wiz-input">
                  <option value="mp3" ${this.data.format==='mp3'?'selected':''}>MP3</option>
                  <option value="ogg" ${this.data.format==='ogg'?'selected':''}>Ogg/Opus</option>
                </select>
              </div>
              <div>
                <label>Bitrate</label>
                <select id="wi-br" class="wiz-input">
                  <option value="64"  ${this.data.bitrate===64?'selected':''}>64 kbps (niedrig)</option>
                  <option value="128" ${this.data.bitrate===128?'selected':''}>128 kbps (Standard)</option>
                  <option value="192" ${this.data.bitrate===192?'selected':''}>192 kbps (gut)</option>
                  <option value="320" ${this.data.bitrate===320?'selected':''}>320 kbps (top)</option>
                </select>
              </div>
            </div>
          </div>
          <div class="wiz-hint">💡 Du hast noch keinen Server? Schau dir Anbieter wie <strong>Centova Cast</strong>, <strong>Shoutcast.com</strong> oder <strong>radio.co</strong> an — viele bieten kostenlose Testphasen.</div>
        </div>`;

      case 3: return `
        <div class="wiz-section">
          <h2>🎤 Wunschbox</h2>
          <p class="wiz-desc">Lass deine Hörer Songs und Nachrichten wünschen. Die Wünsche erscheinen direkt in der App.</p>
          <div class="wiz-toggle-row">
            <label class="wiz-toggle-label">Wunschbox aktivieren</label>
            <div class="wiz-switch ${this.data.wunschboxEnabled?'on':''}" id="wi-wb-toggle" onclick="window.__wizard.toggle('wunschboxEnabled')"></div>
          </div>
          <div class="wiz-form ${this.data.wunschboxEnabled?'':'wiz-disabled'}">
            <div class="wf-row">
              <label>📞 Telefonnummer (wird Hörern angezeigt)</label>
              <input type="tel" id="wi-wb-phone" value="${this.data.wunschboxPhone}" placeholder="+49 123 456789" class="wiz-input">
            </div>
            <div class="wf-row">
              <label>💬 WhatsApp-Nummer</label>
              <input type="tel" id="wi-wb-wa" value="${this.data.wunschboxWhatsapp}" placeholder="+49 123 456789" class="wiz-input">
            </div>
            <div class="wf-row">
              <label>📧 Wunsch-E-Mail</label>
              <input type="email" id="wi-wb-email" value="${this.data.wunschboxEmail}" placeholder="wuensche@meinradio.de" class="wiz-input">
            </div>
          </div>
          <div class="wiz-hint">💡 Wünsche, die per App eingehen, erscheinen automatisch in der Warteschlange des Automix.</div>
        </div>`;

      case 4: return `
        <div class="wiz-section">
          <h2>📨 Voicemail</h2>
          <p class="wiz-desc">Hörer können Sprachnachrichten hinterlassen, die du direkt in der App abhören und einplanen kannst.</p>
          <div class="wiz-toggle-row">
            <label class="wiz-toggle-label">Voicemail aktivieren</label>
            <div class="wiz-switch ${this.data.voicemailEnabled?'on':''}" id="wi-vm-toggle" onclick="window.__wizard.toggle('voicemailEnabled')"></div>
          </div>
          <div class="wiz-form ${this.data.voicemailEnabled?'':'wiz-disabled'}">
            <div class="wf-row">
              <label>Begrüßungsansage (Text → wird als Hinweis angezeigt)</label>
              <input type="text" id="wi-vm-greet" value="${this.data.voicemailGreeting}" class="wiz-input">
            </div>
            <div class="wf-row">
              <label>Speicherordner für Sprachnachrichten</label>
              <div style="display:flex;gap:8px">
                <input type="text" id="wi-vm-path" value="${this.data.voicemailSavePath}" placeholder="C:\\MeinRadio\\Voicemail" class="wiz-input" style="flex:1" readonly>
                <button class="wiz-btn-outline" onclick="window.__wizard.pickVoicemailFolder()">📁 Wählen</button>
              </div>
            </div>
            <div class="wf-row">
              <label>Voicemail-Test aufnehmen</label>
              <div style="display:flex;gap:8px;align-items:center">
                <button class="wiz-btn-outline" id="wi-rec-btn" onclick="window.__wizard.toggleRecord()">🎙 Aufnahme starten</button>
                <span id="wi-rec-status" style="font-size:10px;color:var(--acc)"></span>
              </div>
            </div>
          </div>
          <div class="wiz-hint">💡 Aufgenommene Sprachnachrichten kannst du im Automation-Tab als Moderation einplanen.</div>
        </div>`;

      case 5: return `
        <div class="wiz-section">
          <h2>📂 Musik-Bibliothek</h2>
          <p class="wiz-desc">Wähle Ordner mit deiner Musik. Die App liest alle MP3, WAV und FLAC Dateien aus den Ordnern.</p>
          <div class="wiz-folder-list" id="wi-folders">
            ${this.data.musicFolders.map((f, i) => `
              <div class="wiz-folder-item">
                <span class="wf-icon">📁</span>
                <span class="wf-path">${f}</span>
                <button onclick="window.__wizard.removeFolder(${i})">✕</button>
              </div>`).join('')}
            ${this.data.musicFolders.length === 0 ? '<div class="wiz-empty">Noch keine Ordner hinzugefügt</div>' : ''}
          </div>
          <button class="wiz-btn-add" onclick="window.__wizard.addMusicFolder()">+ Musik-Ordner hinzufügen</button>
          <div class="wiz-hint">💡 Tipp: Lege alle Sendungs-Musik in einen Hauptordner (z.B. <code>C:\\Musik\\Radio</code>) mit Unterordnern für Genres oder Kategorien.</div>
          <div class="wiz-summary" id="wi-folder-summary">
            ${this.data.musicFolders.length > 0 ? `<strong>${this.data.musicFolders.length} Ordner</strong> werden geladen wenn du auf "Fertig" klickst.` : ''}
          </div>
        </div>`;

      default: return '';
    }
  }

  _bindInputs() {
    // Auto-save inputs on change
    const map = {
      'wi-sname':    'stationName',
      'wi-slogan':   'slogan',
      'wi-genre':    'genre',
      'wi-web':      'website',
      'wi-email':    'email',
      'wi-proto':    'protocol',
      'wi-host':     'host',
      'wi-mnt':      'mountpoint',
      'wi-user':     'streamUser',
      'wi-pass':     'streamPass',
      'wi-fmt':      'format',
      'wi-wb-phone': 'wunschboxPhone',
      'wi-wb-wa':    'wunschboxWhatsapp',
      'wi-wb-email': 'wunschboxEmail',
      'wi-vm-greet': 'voicemailGreeting',
    };
    for (const [id, key] of Object.entries(map)) {
      const el = document.getElementById(id);
      if (el) el.addEventListener('input', () => { this.data[key] = el.value; });
    }
    // Number inputs
    const portEl = document.getElementById('wi-port');
    const brEl   = document.getElementById('wi-br');
    if (portEl) portEl.addEventListener('input', () => { this.data.port = parseInt(portEl.value); });
    if (brEl)   brEl.addEventListener('change',  () => { this.data.bitrate = parseInt(brEl.value); });
  }

  toggle(key) {
    this.data[key] = !this.data[key];
    const toggle = document.querySelector(`#wiz-dialog .wiz-switch`);
    // Re-render just this step
    this._render();
  }

  async addMusicFolder() {
    const path = await window.radioAPI.openFolderDialog();
    if (path && !this.data.musicFolders.includes(path)) {
      this.data.musicFolders.push(path);
      this._render();
    }
  }

  removeFolder(idx) {
    this.data.musicFolders.splice(idx, 1);
    this._render();
  }

  async pickVoicemailFolder() {
    const path = await window.radioAPI.openFolderDialog();
    if (path) {
      this.data.voicemailSavePath = path;
      const el = document.getElementById('wi-vm-path');
      if (el) el.value = path;
    }
  }

  async toggleRecord() {
    const btn    = document.getElementById('wi-rec-btn');
    const status = document.getElementById('wi-rec-status');
    if (!this._isRecording) {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        this._mediaRecorder = new MediaRecorder(stream);
        this._mediaRecorder.start();
        this._isRecording = true;
        if (btn) btn.textContent = '⏹ Aufnahme stoppen';
        if (status) {
          status.textContent = '● Aufnahme läuft…';
          status.style.color = 'var(--red)';
        }
        this._mediaRecorder.ondataavailable = (e) => {
          if (status) { status.textContent = '✓ Test-Aufnahme gespeichert'; status.style.color = 'var(--grn)'; }
        };
      } catch (err) {
        if (status) { status.textContent = '✗ Mikrofon nicht verfügbar'; status.style.color = 'var(--red)'; }
      }
    } else {
      this._mediaRecorder?.stop();
      this._isRecording = false;
      if (btn) btn.textContent = '🎙 Aufnahme starten';
    }
  }

  prev() {
    if (this.step > 0) { this.step--; this._render(); }
  }

  next() {
    // Validate required fields
    if (this.step === 1 && !this.data.stationName.trim()) {
      const el = document.getElementById('wi-sname');
      if (el) { el.style.borderColor = 'var(--red)'; el.focus(); return; }
    }
    if (this.step < this.totalSteps - 1) {
      this.step++;
      this._render();
    } else {
      this._finish();
    }
  }

  skip() {
    this._finish(true);
  }

  async _finish(skipped = false) {
    this.hide();
    // Save profile to settings
    const settings = {
      setupDone: true,
      stationName:        this.data.stationName,
      slogan:             this.data.slogan,
      genre:              this.data.genre,
      website:            this.data.website,
      email:              this.data.email,
      wunschboxEnabled:   this.data.wunschboxEnabled,
      wunschboxPhone:     this.data.wunschboxPhone,
      wunschboxWhatsapp:  this.data.wunschboxWhatsapp,
      wunschboxEmail:     this.data.wunschboxEmail,
      voicemailEnabled:   this.data.voicemailEnabled,
      voicemailGreeting:  this.data.voicemailGreeting,
      voicemailSavePath:  this.data.voicemailSavePath,
      musicFolders:       this.data.musicFolders,
      profiles: [{
        protocol:   this.data.protocol,
        host:       this.data.host,
        port:       String(this.data.port),
        mount:      this.data.mountpoint,
        user:       this.data.streamUser,
        pass:       this.data.streamPass,
        format:     this.data.format,
        bitrate:    String(this.data.bitrate),
        channels:   '2',
      }, {}, {}]
    };
    await window.radioAPI.saveSettings(settings);
    if (this.onComplete) this.onComplete(settings, skipped);
  }
}
