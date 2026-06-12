const { contextBridge, ipcRenderer } = require('electron');
const path = require('path');

contextBridge.exposeInMainWorld('radioAPI', {
  // Window
  minimizeWindow: () => ipcRenderer.invoke('window-minimize'),
  maximizeWindow: () => ipcRenderer.invoke('window-maximize'),
  closeWindow:    () => ipcRenderer.invoke('window-close'),

  // Files
  openFileDialog:    ()       => ipcRenderer.invoke('open-file-dialog'),
  openFolderDialog:  ()       => ipcRenderer.invoke('open-folder-dialog'),
  readFileBuffer:    (p)      => ipcRenderer.invoke('read-file-buffer', p),
  scanFolder:        (p)      => ipcRenderer.invoke('scan-folder', p),
  getMetadata:       (p)      => ipcRenderer.invoke('get-metadata', p),
  getMetadataBatch:  (paths)  => ipcRenderer.invoke('get-metadata-batch', paths),

  // Settings
  getSettings:  ()        => ipcRenderer.invoke('get-settings'),
  saveSettings: (s)       => ipcRenderer.invoke('save-settings', s),
  getSetting:   (k)       => ipcRenderer.invoke('get-setting', k),
  setSetting:   (k, v)    => ipcRenderer.invoke('set-setting', k, v),

  // Streaming
  streamConnect:    (cfg) => ipcRenderer.invoke('stream-connect', cfg),
  streamDisconnect: ()    => ipcRenderer.invoke('stream-disconnect'),
  streamStatus:     ()    => ipcRenderer.invoke('stream-status'),
  sendAudioChunk:   (buf) => ipcRenderer.send('stream-audio-chunk', buf),
  onStreamStatus:   (cb)  => ipcRenderer.on('stream-status-push', (_, d) => cb(d)),

  // Auth / User Management
  authHasUsers:      ()     => ipcRenderer.invoke('auth-has-users'),
  authSetup:         (data) => ipcRenderer.invoke('auth-setup', data),
  authLogin:         (data) => ipcRenderer.invoke('auth-login', data),
  authGetUsers:      ()     => ipcRenderer.invoke('auth-get-users'),
  authCreateUser:    (data) => ipcRenderer.invoke('auth-create-user', data),
  authDeleteUser:    (data) => ipcRenderer.invoke('auth-delete-user', data),
  authChangePassword:(data) => ipcRenderer.invoke('auth-change-password', data),
  authGetStation:    ()     => ipcRenderer.invoke('auth-get-station'),

  // Log
  saveLog: (csv) => ipcRenderer.invoke('save-log', csv),

  // Path utils
  basename: (p, ext) => path.basename(p, ext),
  extname:  (p)      => path.extname(p),
  dirname:  (p)      => path.dirname(p)
});
