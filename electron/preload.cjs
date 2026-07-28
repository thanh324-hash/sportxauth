const { contextBridge, ipcRenderer } = require('electron')
contextBridge.exposeInMainWorld('bot68', {
  openExternal: (url) => ipcRenderer.invoke('open-external', url),
  appInfo: () => ipcRenderer.invoke('app-info')
})
