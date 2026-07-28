const { app, BrowserWindow, shell, ipcMain, safeStorage } = require('electron')
const path = require('path')
const fs = require('fs')

const createWindow = () => {
  const win = new BrowserWindow({
    width: 1480, height: 920, minWidth: 1080, minHeight: 680,
    backgroundColor: '#0b1220', title: 'BOT 68',
    webPreferences: { preload: path.join(__dirname, 'preload.cjs'), contextIsolation: true, nodeIntegration: false }
  })
  if (process.env.BOT68_DEV_URL) win.loadURL(process.env.BOT68_DEV_URL)
  else win.loadFile(path.join(__dirname, '..', 'dist', 'index.html'), { hash: process.env.BOT68_SMOKE_PAGE || '' })
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
  const sessionPath = path.join(app.getPath('userData'), 'session.bin')
  ipcMain.handle('session-save', (_, value) => {
    if (!safeStorage.isEncryptionAvailable()) throw new Error('Windows encryption is not available')
    fs.writeFileSync(sessionPath, safeStorage.encryptString(JSON.stringify(value)))
    return true
  })
  ipcMain.handle('session-load', () => {
    if (process.env.BOT68_SMOKE_OFFLINE === '1') return { serverUrl:'', token:'', offline:true, user:{id:'smoke',tenantId:'smoke',name:'Kiểm thử BOT 68',email:'',role:'owner'},tenant:{id:'smoke',name:'BOT 68 kiểm thử',slug:'smoke',plan:'local'} }
    try {
      if (!safeStorage.isEncryptionAvailable() || !fs.existsSync(sessionPath)) return null
      return JSON.parse(safeStorage.decryptString(fs.readFileSync(sessionPath)))
    } catch { return null }
  })
  ipcMain.handle('session-clear', () => { if (fs.existsSync(sessionPath)) fs.unlinkSync(sessionPath); return true })
  createWindow()
  app.on('activate', () => { if (BrowserWindow.getAllWindows().length === 0) createWindow() })
})
app.on('window-all-closed', () => { if (process.platform !== 'darwin') app.quit() })
