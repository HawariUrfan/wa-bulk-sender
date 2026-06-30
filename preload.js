const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('wa', {
  init: () => ipcRenderer.invoke('wa:init'),
  logout: () => ipcRenderer.invoke('wa:logout'),
  state: () => ipcRenderer.invoke('wa:state'),
  importFile: () => ipcRenderer.invoke('file:import'),
  pickMedia: () => ipcRenderer.invoke('media:pick'),
  send: (opts) => ipcRenderer.invoke('wa:send', opts),
  cancel: () => ipcRenderer.invoke('wa:cancel'),
  listGroups: () => ipcRenderer.invoke('wa:groups'),
  addToGroup: (opts) => ipcRenderer.invoke('wa:addToGroup', opts),

  onStatus: (cb) => ipcRenderer.on('wa:status', (_e, p) => cb(p)),
  onQr: (cb) => ipcRenderer.on('wa:qr', (_e, p) => cb(p)),
  onReady: (cb) => ipcRenderer.on('wa:ready', (_e, p) => cb(p)),
  onProgress: (cb) => ipcRenderer.on('wa:progress', (_e, p) => cb(p)),
  onGroupProgress: (cb) => ipcRenderer.on('wa:groupProgress', (_e, p) => cb(p)),
});
