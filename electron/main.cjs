const { app, BrowserWindow, shell, ipcMain } = require('electron')
const path = require('path')
const fs = require('fs')

const createWindow = () => {
  const win = new BrowserWindow({
    width: 1480, height: 920, minWidth: 1080, minHeight: 680,
    backgroundColor: '#0b1220', title: 'BOT 68',
    webPreferences: { preload: path.join(__dirname, 'preload.cjs'), contextIsolation: true, nodeIntegration: false }
  })
  if (process.env.BOT68_DEV_URL) win.loadURL(process.env.BOT68_DEV_URL)
  else win.loadFile(path.join(__dirname, '..', 'dist', 'index.html'))
  win.webContents.setWindowOpenHandler(({ url }) => { shell.openExternal(url); return { action: 'deny' } })
  if (process.env.BOT68_SMOKE_PATH) win.webContents.once('did-finish-load', async () => {
    await new Promise(resolve => setTimeout(resolve, 1200))
    const image = await win.webContents.capturePage()
    fs.writeFileSync(process.env.BOT68_SMOKE_PATH, image.toPNG())
    app.quit()
  })
}

app.whenReady().then(() => {
  ipcMain.handle('open-external', (_, url) => shell.openExternal(url))
  ipcMain.handle('app-info', () => ({ version: app.getVersion(), dataPath: app.getPath('userData') }))
  createWindow()
  app.on('activate', () => { if (BrowserWindow.getAllWindows().length === 0) createWindow() })
})
app.on('window-all-closed', () => { if (process.platform !== 'darwin') app.quit() })
