// Webserver des Teambots:
//  • öffentliche JSON-API  (/api/status, /api/sendeplan)  → für die Website
//  • Login-geschütztes Admin-Panel (/)                    → Warns/Notizen/Modlog verwalten
//
// Läuft auf dem vom Host bereitgestellten Port (SERVER_PORT).

const express = require('express');
const crypto = require('crypto');
const config = require('./config');
const store = require('./store');

const TAGE = [['Mo','Montag'],['Di','Dienstag'],['Mi','Mittwoch'],['Do','Donnerstag'],['Fr','Freitag'],['Sa','Samstag'],['So','Sonntag']];

function esc(s = '') {
    return String(s).replace(/[&<>"']/g, c => ({ '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;' }[c]));
}

module.exports = function startWeb(client) {
    if (!config.WEB.ENABLE) { console.log('🌐 Webserver deaktiviert (WEB_ENABLE=false).'); return; }

    const app = express();
    app.disable('x-powered-by');
    app.use(express.urlencoded({ extended: false }));

    // Namen zu einer User-ID auflösen (aus dem Client-Cache)
    const tagOf = id => client.users.cache.get(id)?.tag || id;

    // ── Öffentliche API (für die Website) ────────────────
    app.use('/api', (req, res, next) => {
        res.set('Access-Control-Allow-Origin', '*');
        res.set('Cache-Control', 'no-store');
        next();
    });

    app.get('/api/status', (req, res) => {
        const onair = store.getOnair();
        const guild = client.guilds.cache.first();
        res.json({
            online: client.isReady(),
            onair: onair ? { show: onair.show, dj: tagOf(onair.djId), seit: onair.seit } : null,
            uptimeSeconds: Math.floor((client.uptime || 0) / 1000),
            members: guild?.memberCount ?? null,
            updated: Date.now(),
        });
    });

    app.get('/api/sendeplan', (req, res) => {
        const plan = store.getSendeplan();
        const out = TAGE.map(([k, name]) => ({
            tag: k, name,
            slots: plan[k].map(s => ({ von: s.von, bis: s.bis, show: s.show, dj: tagOf(s.userId) })),
        }));
        res.json(out);
    });

    // ── Auth fürs Admin-Panel (einfache Cookie-Session) ──
    const sessions = new Set();
    const cookie = req => Object.fromEntries((req.headers.cookie || '').split(';').map(c => c.trim().split('=').map(decodeURIComponent)).filter(p => p[0]));
    const authed = req => config.WEB.PASSWORD && sessions.has(cookie(req).sid);

    function requireLogin(req, res, next) {
        if (!config.WEB.PASSWORD) return res.status(503).send(page('Panel gesperrt', '<p>Setze <code>PANEL_PASSWORD</code> in der <code>.env</code>, um das Admin-Panel zu aktivieren.</p>'));
        if (!authed(req)) return res.redirect('/login');
        next();
    }

    app.get('/login', (req, res) => {
        res.send(page('Login', `
            <form method="post" action="/login" class="login">
              <h1>🔒 Team-Panel</h1>
              <p class="muted">Joy Stream FM — Verwaltung</p>
              <input type="text" name="user" placeholder="Benutzer" autocomplete="username" required>
              <input type="password" name="password" placeholder="Passwort" autocomplete="current-password" required>
              <button type="submit">Anmelden</button>
              ${req.query.err ? '<p class="err">Falsche Zugangsdaten.</p>' : ''}
            </form>`));
    });

    app.post('/login', (req, res) => {
        const okUser = (req.body.user || '') === config.WEB.USER;
        const okPass = config.WEB.PASSWORD && req.body.password === config.WEB.PASSWORD;
        if (!okUser || !okPass) return res.redirect('/login?err=1');
        const sid = crypto.randomBytes(24).toString('hex');
        sessions.add(sid);
        res.set('Set-Cookie', `sid=${sid}; HttpOnly; SameSite=Lax; Path=/; Max-Age=86400`);
        res.redirect('/');
    });

    app.get('/logout', (req, res) => { sessions.delete(cookie(req).sid); res.redirect('/login'); });

    // ── Aktionen ─────────────────────────────────────────
    app.post('/action/warn-delete', requireLogin, (req, res) => {
        store.removeWarn(req.body.userId, parseInt(req.body.id, 10));
        res.redirect('/#warns');
    });
    app.post('/action/warn-clear', requireLogin, (req, res) => {
        store.clearWarns(req.body.userId);
        res.redirect('/#warns');
    });
    app.post('/action/note-delete', requireLogin, (req, res) => {
        store.removeNote(req.body.userId, parseInt(req.body.id, 10));
        res.redirect('/#notes');
    });

    // ── Dashboard ────────────────────────────────────────
    app.get('/', requireLogin, (req, res) => {
        const onair = store.getOnair();
        const warns = store.allWarns();
        const notes = store.allNotes();
        const modlog = store.getModlog(20);
        const plan = store.getSendeplan();
        const guild = client.guilds.cache.first();

        const stat = (label, val) => `<div class="stat"><b>${esc(val)}</b><span>${esc(label)}</span></div>`;
        const dt = ts => new Date(ts).toLocaleString('de-DE');

        const warnRows = warns.length ? warns.map(w => `
            <tr>
              <td>#${w.id}</td>
              <td>${esc(tagOf(w.userId))}<br><span class="mono">${w.userId}</span></td>
              <td>${esc(w.reason)}</td>
              <td>${esc(tagOf(w.modId))}</td>
              <td>${dt(w.ts)}</td>
              <td><form method="post" action="/action/warn-delete" onsubmit="return confirm('Warn #${w.id} löschen?')">
                <input type="hidden" name="userId" value="${w.userId}"><input type="hidden" name="id" value="${w.id}">
                <button class="mini danger">Löschen</button></form></td>
            </tr>`).join('') : '<tr><td colspan="6" class="muted">Keine Verwarnungen.</td></tr>';

        const noteRows = notes.length ? notes.map(n => `
            <tr>
              <td>#${n.id}</td>
              <td>${esc(tagOf(n.userId))}<br><span class="mono">${n.userId}</span></td>
              <td>${esc(n.text)}</td>
              <td>${esc(tagOf(n.modId))}</td>
              <td>${dt(n.ts)}</td>
              <td><form method="post" action="/action/note-delete" onsubmit="return confirm('Notiz #${n.id} löschen?')">
                <input type="hidden" name="userId" value="${n.userId}"><input type="hidden" name="id" value="${n.id}">
                <button class="mini danger">Löschen</button></form></td>
            </tr>`).join('') : '<tr><td colspan="6" class="muted">Keine Notizen.</td></tr>';

        const logRows = modlog.length ? modlog.map(e => `
            <tr><td>${dt(e.ts)}</td><td><b>${esc(e.action)}</b></td><td>${esc(tagOf(e.targetId))}</td><td>${esc(tagOf(e.modId))}</td><td>${esc(e.reason || '—')}</td></tr>`).join('')
            : '<tr><td colspan="5" class="muted">Noch keine Aktionen.</td></tr>';

        const planRows = TAGE.map(([k, name]) => {
            const slots = plan[k];
            return `<tr><td>${name}</td><td>${slots.length ? slots.map(s => `${s.von}–${s.bis} · ${esc(s.show)} (${esc(tagOf(s.userId))})`).join('<br>') : '<span class="muted">frei</span>'}</td></tr>`;
        }).join('');

        res.send(page('Dashboard', `
          <header class="top">
            <div class="brand">📻 <b>Joy<span>Stream</span> FM</b> · Team-Panel</div>
            <a class="mini" href="/logout">Abmelden</a>
          </header>

          <div class="stats">
            ${stat('Status', client.isReady() ? 'Online' : 'Offline')}
            ${stat('Jetzt läuft', onair ? onair.show : '— AutoDJ —')}
            ${stat('Mitglieder', guild?.memberCount ?? '—')}
            ${stat('Offene Warns', warns.length)}
          </div>

          <section id="warns"><h2>⚠️ Verwarnungen</h2>
            <table><thead><tr><th>ID</th><th>User</th><th>Grund</th><th>Mod</th><th>Datum</th><th></th></tr></thead>
            <tbody>${warnRows}</tbody></table></section>

          <section id="notes"><h2>📝 Notizen</h2>
            <table><thead><tr><th>ID</th><th>User</th><th>Notiz</th><th>Mod</th><th>Datum</th><th></th></tr></thead>
            <tbody>${noteRows}</tbody></table></section>

          <section><h2>🗂️ Modlog</h2>
            <table><thead><tr><th>Datum</th><th>Aktion</th><th>User</th><th>Mod</th><th>Grund</th></tr></thead>
            <tbody>${logRows}</tbody></table></section>

          <section><h2>📻 Sendeplan</h2>
            <table><thead><tr><th>Tag</th><th>Sendungen</th></tr></thead><tbody>${planRows}</tbody></table></section>

          <footer class="foot">Joy Stream FM Teambot · Panel-Daten aktualisieren sich beim Neuladen</footer>
        `));
    });

    app.listen(config.WEB.PORT, '0.0.0.0', () => {
        console.log(`🌐 Webserver läuft auf Port ${config.WEB.PORT}  (API: /api/status · Panel: /)`);
        if (!config.WEB.PASSWORD) console.log('   ⚠️  PANEL_PASSWORD nicht gesetzt — Admin-Panel ist gesperrt, API läuft.');
    });
};

// ── HTML-Grundgerüst (dunkel, im Joy-Stream-Look) ────────
function page(title, body) {
    return `<!doctype html><html lang="de"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1"><title>${esc(title)} · Joy Stream FM</title>
<style>
  :root{--bg:#0a0a0b;--elev:#161619;--line:#26262b;--text:#f6f5f4;--muted:#9b9ba3;--orange:#f0863a;--red:#e5484d}
  *{box-sizing:border-box}
  body{margin:0;background:var(--bg);color:var(--text);font-family:system-ui,Segoe UI,Roboto,sans-serif;line-height:1.6}
  .wrap{max-width:1100px;margin:0 auto;padding:22px}
  a{color:var(--orange);text-decoration:none}
  .top{display:flex;justify-content:space-between;align-items:center;margin-bottom:24px;padding-bottom:16px;border-bottom:1px solid var(--line)}
  .brand b{font-weight:800}.brand span{font-weight:300;color:#d4d4d8}
  h1{margin:0 0 4px}h2{margin:36px 0 12px;font-size:19px}
  .muted{color:var(--muted)}.mono{color:var(--muted);font-family:ui-monospace,monospace;font-size:12px}
  .stats{display:grid;grid-template-columns:repeat(4,1fr);gap:14px}
  .stat{background:var(--elev);border:1px solid var(--line);border-radius:14px;padding:16px}
  .stat b{display:block;font-size:24px;color:var(--orange);font-weight:800}
  .stat span{font-size:13px;color:var(--muted)}
  table{width:100%;border-collapse:collapse;background:var(--elev);border:1px solid var(--line);border-radius:14px;overflow:hidden}
  th,td{text-align:left;padding:11px 14px;border-bottom:1px solid var(--line);font-size:14px;vertical-align:top}
  th{background:#1c1c20;color:var(--muted);font-size:12px;letter-spacing:.04em;text-transform:uppercase}
  tr:last-child td{border-bottom:0}
  button{cursor:pointer;font-family:inherit;border:0;border-radius:9px;padding:9px 16px;font-weight:600;background:var(--orange);color:#160c04}
  button.mini{padding:6px 12px;font-size:13px}
  button.danger{background:var(--red);color:#fff}
  .mini{background:var(--elev);border:1px solid var(--line);color:var(--text);border-radius:9px;padding:7px 14px;font-size:13px}
  form{margin:0}
  .login{max-width:340px;margin:12vh auto;background:var(--elev);border:1px solid var(--line);padding:32px;border-radius:18px;display:flex;flex-direction:column;gap:12px}
  .login h1{font-size:22px}.login input{padding:12px 14px;border-radius:10px;border:1px solid var(--line);background:#0f0f12;color:var(--text);font-size:15px}
  .login button{padding:12px;font-size:15px}
  .err{color:var(--red);font-size:14px;margin:0}
  .foot{margin:40px 0 10px;color:var(--muted);font-size:13px;text-align:center}
  @media(max-width:700px){.stats{grid-template-columns:1fr 1fr}}
</style></head><body><div class="wrap">${body}</div></body></html>`;
}
