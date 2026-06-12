const { app, BrowserWindow, ipcMain, dialog } = require('electron');
const path = require('path');
const fs = require('fs');
const net = require('net');

let Store, parseFile;

async function loadModules() {
  const storeModule = await import('electron-store');
  Store = storeModule.default;
  const mmModule = await import('music-metadata');
  parseFile = mmModule.parseFile;
}

let mainWindow = null;
let store = null;
let streamingSocket = null;
let isStreaming = false;

app.whenReady().then(async () => {
  await loadModules();
  store = new Store();
  createWindow();
});

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1600,
    height: 960,
    minWidth: 1280,
    minHeight: 800,
    backgroundColor: '#0D0D0D',
    frame: false,
    show: false,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      webSecurity: false,
      sandbox: false
    }
  });

  mainWindow.loadFile(path.join(__dirname, 'src', 'index.html'));

  mainWindow.once('ready-to-show', () => {
    mainWindow.show();
    mainWindow.maximize();
    if (process.env.NODE_ENV === 'development') {
      mainWindow.webContents.openDevTools({ mode: 'detach' });
    }
  });

  mainWindow.on('closed', () => {
    if (streamingSocket) streamingSocket.destroy();
    mainWindow = null;
  });
}

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) createWindow();
});

// ── Window Controls ──────────────────────────────────────────────────────────
ipcMain.handle('window-minimize', () => mainWindow?.minimize());
ipcMain.handle('window-maximize', () => {
  if (mainWindow?.isMaximized()) mainWindow.restore();
  else mainWindow?.maximize();
});
ipcMain.handle('window-close', () => mainWindow?.close());

// ── File Dialogs ──────────────────────────────────────────────────────────────
ipcMain.handle('open-file-dialog', async () => {
  const result = await dialog.showOpenDialog(mainWindow, {
    properties: ['openFile', 'multiSelections'],
    filters: [{ name: 'Audio', extensions: ['mp3', 'wav', 'flac', 'aac', 'ogg', 'm4a'] }]
  });
  return result.filePaths;
});

ipcMain.handle('open-folder-dialog', async () => {
  const result = await dialog.showOpenDialog(mainWindow, {
    properties: ['openDirectory']
  });
  return result.filePaths[0] || null;
});

// ── File System ───────────────────────────────────────────────────────────────
ipcMain.handle('read-file-buffer', async (_, filePath) => {
  const buf = fs.readFileSync(filePath);
  return buf;
});

ipcMain.handle('scan-folder', async (_, folderPath) => {
  const exts = new Set(['.mp3', '.wav', '.flac', '.aac', '.ogg', '.m4a', '.wma']);
  const files = [];

  function walk(dir) {
    try {
      for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
        const full = path.join(dir, entry.name);
        if (entry.isDirectory()) walk(full);
        else if (exts.has(path.extname(entry.name).toLowerCase())) files.push(full);
      }
    } catch (_) {}
  }

  walk(folderPath);
  return files;
});

ipcMain.handle('get-metadata', async (_, filePath) => {
  try {
    const meta = await parseFile(filePath);
    return {
      path: filePath,
      title: meta.common.title || path.basename(filePath, path.extname(filePath)),
      artist: meta.common.artist || 'Unknown Artist',
      album: meta.common.album || '',
      duration: meta.format.duration || 0,
      bpm: meta.common.bpm || null,
      key: meta.common.key || null,
      genre: meta.common.genre?.[0] || '',
      year: meta.common.year || null,
      bitrate: meta.format.bitrate || null,
      sampleRate: meta.format.sampleRate || null
    };
  } catch (_) {
    return {
      path: filePath,
      title: path.basename(filePath, path.extname(filePath)),
      artist: 'Unknown', album: '', duration: 0,
      bpm: null, key: null, genre: ''
    };
  }
});

ipcMain.handle('get-metadata-batch', async (_, filePaths) => {
  const results = [];
  for (const fp of filePaths) {
    try {
      const meta = await parseFile(fp);
      results.push({
        path: fp,
        title: meta.common.title || path.basename(fp, path.extname(fp)),
        artist: meta.common.artist || 'Unknown Artist',
        album: meta.common.album || '',
        duration: meta.format.duration || 0,
        bpm: meta.common.bpm || null,
        key: meta.common.key || null,
        genre: meta.common.genre?.[0] || ''
      });
    } catch (_) {
      results.push({
        path: fp,
        title: path.basename(fp, path.extname(fp)),
        artist: 'Unknown', album: '', duration: 0, bpm: null
      });
    }
  }
  return results;
});

// ── Settings ──────────────────────────────────────────────────────────────────
ipcMain.handle('get-settings', () => store.store);
ipcMain.handle('save-settings', (_, settings) => { store.set(settings); return true; });
ipcMain.handle('get-setting', (_, key) => store.get(key));
ipcMain.handle('set-setting', (_, key, value) => { store.set(key, value); return true; });

// ── Icecast / Shoutcast Streaming ─────────────────────────────────────────────
ipcMain.handle('stream-connect', async (_, cfg) => {
  if (streamingSocket) { streamingSocket.destroy(); streamingSocket = null; }

  return new Promise((resolve) => {
    const sock = net.createConnection(cfg.port, cfg.host, () => {
      const auth = Buffer.from(`source:${cfg.password}`).toString('base64');
      const contentType = cfg.format === 'ogg' ? 'audio/ogg' : 'audio/mpeg';

      const headers = cfg.protocol === 'shoutcast'
        ? [
            `SOURCE ${cfg.mountpoint} HTTP/1.0`,
            `icy-password: ${cfg.password}`,
            `icy-name: ${cfg.stationName || 'Radio'}`,
            `icy-genre: ${cfg.genre || 'Various'}`,
            `icy-url: ${cfg.website || ''}`,
            `icy-pub: 0`,
            `icy-br: ${cfg.bitrate || 128}`,
            `\r\n`
          ].join('\r\n')
        : [
            `SOURCE ${cfg.mountpoint} HTTP/1.0`,
            `Authorization: Basic ${auth}`,
            `Content-Type: ${contentType}`,
            `ice-name: ${cfg.stationName || 'Radio'}`,
            `ice-description: ${cfg.description || ''}`,
            `ice-genre: ${cfg.genre || 'Various'}`,
            `ice-url: ${cfg.website || ''}`,
            `ice-public: 0`,
            `ice-audio-info: bitrate=${cfg.bitrate || 128};samplerate=44100;channels=2`,
            `\r\n`
          ].join('\r\n');

      sock.write(headers);
    });

    let buf = '';
    let resolved = false;

    sock.on('data', (d) => {
      buf += d.toString();
      if (!resolved && (buf.includes('\r\n\r\n') || buf.includes('\n\n'))) {
        resolved = true;
        streamingSocket = sock;
        isStreaming = true;
        mainWindow?.webContents.send('stream-status-push', { connected: true });
        resolve({ success: true });
      }
    });

    sock.on('error', (err) => {
      if (!resolved) { resolved = true; resolve({ success: false, error: err.message }); }
    });

    sock.on('close', () => {
      isStreaming = false;
      streamingSocket = null;
      mainWindow?.webContents.send('stream-status-push', { connected: false });
    });

    setTimeout(() => {
      if (!resolved) {
        resolved = true;
        // Assume OK if no error yet (some servers don't send response header)
        streamingSocket = sock;
        isStreaming = true;
        mainWindow?.webContents.send('stream-status-push', { connected: true });
        resolve({ success: true });
      }
    }, 5000);
  });
});

ipcMain.handle('stream-disconnect', () => {
  if (streamingSocket) { streamingSocket.destroy(); streamingSocket = null; }
  isStreaming = false;
  return true;
});

ipcMain.handle('stream-status', () => ({ connected: isStreaming }));

ipcMain.on('stream-audio-chunk', (_, chunk) => {
  if (!streamingSocket || !isStreaming) return;
  try { streamingSocket.write(Buffer.from(chunk)); } catch (_) {}
});

// ── Auth / User Management ────────────────────────────────────────────────────
const crypto = require('crypto');

function hashPassword(password, salt) {
  return crypto.createHmac('sha256', salt).update(password).digest('hex');
}

ipcMain.handle('auth-setup', (_, { stationName, username, password }) => {
  const salt = crypto.randomBytes(16).toString('hex');
  const hash = hashPassword(password, salt);
  const adminUser = { id: '1', username, displayName: username, role: 'admin', salt, hash };
  store.set('station.name', stationName);
  store.set('users', [adminUser]);
  return { success: true };
});

ipcMain.handle('auth-login', (_, { username, password }) => {
  const users = store.get('users', []);
  const user = users.find(u => u.username.toLowerCase() === username.toLowerCase());
  if (!user) return { success: false, error: 'Benutzer nicht gefunden' };
  const hash = hashPassword(password, user.salt);
  if (hash !== user.hash) return { success: false, error: 'Falsches Passwort' };
  return { success: true, user: { id: user.id, username: user.username, displayName: user.displayName, role: user.role } };
});

ipcMain.handle('auth-get-users', () => {
  const users = store.get('users', []);
  return users.map(u => ({ id: u.id, username: u.username, displayName: u.displayName, role: u.role }));
});

ipcMain.handle('auth-create-user', (_, { username, password, displayName, role }) => {
  const users = store.get('users', []);
  if (users.find(u => u.username.toLowerCase() === username.toLowerCase()))
    return { success: false, error: 'Benutzername bereits vergeben' };
  const salt = crypto.randomBytes(16).toString('hex');
  const hash = hashPassword(password, salt);
  const id = Date.now().toString();
  users.push({ id, username, displayName: displayName || username, role: role || 'moderator', salt, hash });
  store.set('users', users);
  return { success: true, id };
});

ipcMain.handle('auth-delete-user', (_, { id }) => {
  let users = store.get('users', []);
  const target = users.find(u => u.id === id);
  if (!target) return { success: false, error: 'Nicht gefunden' };
  if (target.role === 'admin' && users.filter(u => u.role === 'admin').length <= 1)
    return { success: false, error: 'Letzter Admin kann nicht gelöscht werden' };
  users = users.filter(u => u.id !== id);
  store.set('users', users);
  return { success: true };
});

ipcMain.handle('auth-change-password', (_, { id, newPassword }) => {
  const users = store.get('users', []);
  const user = users.find(u => u.id === id);
  if (!user) return { success: false, error: 'Nicht gefunden' };
  user.salt = crypto.randomBytes(16).toString('hex');
  user.hash = hashPassword(newPassword, user.salt);
  store.set('users', users);
  return { success: true };
});

ipcMain.handle('auth-has-users', () => {
  return store.get('users', []).length > 0;
});

ipcMain.handle('auth-get-station', () => {
  return store.get('station', {});
});

// ── Log export ────────────────────────────────────────────────────────────────
ipcMain.handle('save-log', async (_, csv) => {
  const res = await dialog.showSaveDialog(mainWindow, {
    filters: [{ name: 'CSV', extensions: ['csv'] }],
    defaultPath: `radio-log-${new Date().toISOString().split('T')[0]}.csv`
  });
  if (!res.canceled) { fs.writeFileSync(res.filePath, csv, 'utf8'); return true; }
  return false;
});
