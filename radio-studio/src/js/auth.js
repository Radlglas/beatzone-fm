// ── RadioFlare Auth ───────────────────────────────────────────────────────────
// Handles login screen, first-run setup, and user management panel.

export class Auth {
  constructor(onLogin) {
    this._onLogin = onLogin;
    this._overlay = null;
    this._currentUser = null;
  }

  get currentUser() { return this._currentUser; }

  async init() {
    this._buildOverlay();
    try {
      const hasUsers = await window.radioAPI.authHasUsers();
      if (!hasUsers) {
        this._showSetup();
      } else {
        this._showLogin();
      }
    } catch(e) {
      console.error('[Auth] init failed:', e);
      // Fallback: show setup if IPC fails
      this._showSetup();
    }
  }

  // ── Build DOM ──────────────────────────────────────────────────────────────
  _buildOverlay() {
    const el = document.createElement('div');
    el.id = 'auth-overlay';
    el.innerHTML = `
      <div class="auth-bg"></div>
      <div class="auth-card" id="auth-card">
        <!-- content injected per screen -->
      </div>
    `;
    document.body.appendChild(el);
    this._overlay = el;
    this._card = el.querySelector('#auth-card');
  }

  // ── Setup Screen (first run) ───────────────────────────────────────────────
  _showSetup() {
    this._card.innerHTML = `
      <div class="auth-logo"><span class="auth-gem"></span>RadioFlare</div>
      <div class="auth-title">Radio einrichten</div>
      <div class="auth-sub">Erstelle den Admin-Account für dein Radio</div>

      <label class="auth-lbl">Name des Radios</label>
      <input class="auth-inp" id="a-station" placeholder="z.B. BeatZone FM" autocomplete="off">

      <label class="auth-lbl" style="margin-top:12px">Admin-Benutzername</label>
      <input class="auth-inp" id="a-uname" placeholder="admin" autocomplete="off">

      <label class="auth-lbl" style="margin-top:12px">Passwort</label>
      <input class="auth-inp" id="a-pw" type="password" placeholder="••••••••">

      <label class="auth-lbl" style="margin-top:12px">Passwort wiederholen</label>
      <input class="auth-inp" id="a-pw2" type="password" placeholder="••••••••">

      <div class="auth-err" id="a-err"></div>
      <button class="auth-btn" id="a-go">Radio erstellen →</button>
    `;
    this._card.querySelector('#a-go').addEventListener('click', () => this._doSetup());
    this._card.querySelectorAll('.auth-inp').forEach(inp => {
      inp.addEventListener('keydown', e => { if (e.key === 'Enter') this._doSetup(); });
    });
    setTimeout(() => this._card.querySelector('#a-station').focus(), 50);
  }

  async _doSetup() {
    const station  = this._card.querySelector('#a-station').value.trim();
    const username = this._card.querySelector('#a-uname').value.trim();
    const pw       = this._card.querySelector('#a-pw').value;
    const pw2      = this._card.querySelector('#a-pw2').value;
    const err      = this._card.querySelector('#a-err');
    const btn      = this._card.querySelector('#a-go');

    if (!station)      return this._err(err, 'Bitte Radio-Namen eingeben');
    if (!username)     return this._err(err, 'Bitte Benutzernamen eingeben');
    if (pw.length < 4) return this._err(err, 'Passwort muss mind. 4 Zeichen haben');
    if (pw !== pw2)    return this._err(err, 'Passwörter stimmen nicht überein');

    btn.disabled = true;
    btn.textContent = '⏳ Wird gespeichert…';
    err.textContent = '';

    try {
      const res = await window.radioAPI.authSetup({ stationName: station, username, password: pw });
      if (res.success) {
        this._currentUser = { username, role: 'admin', displayName: username };
        this._hide();
        this._onLogin(this._currentUser);
      } else {
        btn.disabled = false;
        btn.textContent = 'Radio erstellen →';
        this._err(err, res.error || 'Fehler beim Speichern');
      }
    } catch(e) {
      console.error('[Auth] setup error:', e);
      btn.disabled = false;
      btn.textContent = 'Radio erstellen →';
      this._err(err, 'Verbindungsfehler: ' + (e.message || e));
    }
  }

  // ── Login Screen ───────────────────────────────────────────────────────────
  _showLogin() {
    this._card.innerHTML = `
      <div class="auth-logo"><span class="auth-gem"></span>RadioFlare</div>
      <div class="auth-title">Anmelden</div>

      <label class="auth-lbl">Benutzername</label>
      <input class="auth-inp" id="a-uname" placeholder="Benutzername" autocomplete="username">

      <label class="auth-lbl" style="margin-top:12px">Passwort</label>
      <input class="auth-inp" id="a-pw" type="password" placeholder="••••••••" autocomplete="current-password">

      <div class="auth-err" id="a-err"></div>
      <button class="auth-btn" id="a-go">Anmelden →</button>
    `;
    this._card.querySelector('#a-go').addEventListener('click', () => this._doLogin());
    this._card.querySelectorAll('.auth-inp').forEach(inp => {
      inp.addEventListener('keydown', e => { if (e.key === 'Enter') this._doLogin(); });
    });
    setTimeout(() => this._card.querySelector('#a-uname').focus(), 50);
  }

  async _doLogin() {
    const username = this._card.querySelector('#a-uname').value.trim();
    const password = this._card.querySelector('#a-pw').value;
    const err      = this._card.querySelector('#a-err');

    if (!username || !password) return this._err(err, 'Bitte alle Felder ausfüllen');

    const btn = this._card.querySelector('#a-go');
    btn.disabled = true; btn.textContent = '…';

    const res = await window.radioAPI.authLogin({ username, password });
    if (res.success) {
      this._currentUser = res.user;
      this._hide();
      this._onLogin(res.user);
    } else {
      btn.disabled = false; btn.textContent = 'Anmelden →';
      this._err(err, res.error || 'Anmeldung fehlgeschlagen');
    }
  }

  // ── User Management Panel ─────────────────────────────────────────────────
  async showUserPanel() {
    if (!this._currentUser || this._currentUser.role !== 'admin') return;

    const modal = document.createElement('div');
    modal.id = 'user-panel';
    modal.innerHTML = `
      <div class="up-backdrop"></div>
      <div class="up-box">
        <div class="up-head">
          <span class="up-title">Benutzer verwalten</span>
          <button class="up-close" id="up-cls">✕</button>
        </div>
        <div class="up-list" id="up-list">Lade…</div>
        <div class="up-sep"></div>
        <div class="up-add-hdr">Neuen Moderator anlegen</div>
        <div class="up-form">
          <input class="auth-inp sm" id="up-uname" placeholder="Benutzername">
          <input class="auth-inp sm" id="up-dname" placeholder="Anzeigename (optional)">
          <input class="auth-inp sm" id="up-pw" type="password" placeholder="Passwort">
          <button class="auth-btn sm" id="up-add">+ Hinzufügen</button>
        </div>
        <div class="auth-err" id="up-err"></div>
      </div>
    `;
    document.body.appendChild(modal);
    setTimeout(() => modal.classList.add('visible'), 10);

    const close = () => { modal.classList.remove('visible'); setTimeout(() => modal.remove(), 200); };
    modal.querySelector('#up-cls').addEventListener('click', close);
    modal.querySelector('.up-backdrop').addEventListener('click', close);
    modal.querySelector('#up-add').addEventListener('click', () => this._addUser(modal));

    await this._renderUserList(modal);
  }

  async _renderUserList(modal) {
    const list = modal.querySelector('#up-list');
    const users = await window.radioAPI.authGetUsers();
    list.innerHTML = users.map(u => `
      <div class="up-row" data-id="${u.id}">
        <div class="up-avatar">${u.displayName[0].toUpperCase()}</div>
        <div class="up-info">
          <div class="up-uname">${u.displayName}</div>
          <div class="up-meta">${u.username} · <span class="up-role ${u.role}">${u.role === 'admin' ? 'Admin' : 'Moderator'}</span></div>
        </div>
        ${u.id !== this._currentUser.id ? `<button class="up-del" data-id="${u.id}" title="Löschen">🗑</button>` : '<span class="up-self">Du</span>'}
      </div>
    `).join('');

    list.querySelectorAll('.up-del').forEach(btn => {
      btn.addEventListener('click', async () => {
        const id = btn.dataset.id;
        const res = await window.radioAPI.authDeleteUser({ id });
        if (res.success) await this._renderUserList(modal);
        else this._err(modal.querySelector('#up-err'), res.error);
      });
    });
  }

  async _addUser(modal) {
    const username    = modal.querySelector('#up-uname').value.trim();
    const displayName = modal.querySelector('#up-dname').value.trim();
    const password    = modal.querySelector('#up-pw').value;
    const err         = modal.querySelector('#up-err');

    if (!username) return this._err(err, 'Benutzername fehlt');
    if (password.length < 4) return this._err(err, 'Passwort mind. 4 Zeichen');

    const res = await window.radioAPI.authCreateUser({ username, displayName, password, role: 'moderator' });
    if (res.success) {
      modal.querySelector('#up-uname').value = '';
      modal.querySelector('#up-dname').value = '';
      modal.querySelector('#up-pw').value = '';
      err.textContent = '';
      await this._renderUserList(modal);
    } else {
      this._err(err, res.error);
    }
  }

  // ── Helpers ────────────────────────────────────────────────────────────────
  _err(el, msg) {
    el.textContent = msg;
    el.classList.add('shake');
    setTimeout(() => el.classList.remove('shake'), 400);
  }

  _hide() {
    this._overlay.classList.add('auth-out');
    setTimeout(() => this._overlay.remove(), 400);
  }
}
