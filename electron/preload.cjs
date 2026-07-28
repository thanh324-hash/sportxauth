const { contextBridge, ipcRenderer } = require('electron')
contextBridge.exposeInMainWorld('bot68', {
  openExternal: (url) => ipcRenderer.invoke('open-external', url),
  appInfo: () => ipcRenderer.invoke('app-info'),
  saveSession: value => ipcRenderer.invoke('session-save', value),
  loadSession: () => ipcRenderer.invoke('session-load'),
  clearSession: () => ipcRenderer.invoke('session-clear')
  ,saveBackup: (value, passphrase) => ipcRenderer.invoke('backup-save', value, passphrase)
  ,openBackup: passphrase => ipcRenderer.invoke('backup-open', passphrase)
})
