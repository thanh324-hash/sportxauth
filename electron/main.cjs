const { app, BrowserWindow, shell, ipcMain, safeStorage } = require('electron')
const path = require('path')
const fs = require('fs')
const crypto = require('crypto')
const net = require('net')
const { pathToFileURL } = require('url')

if (process.env.BOT68_USER_DATA) app.setPath('userData', path.resolve(process.env.BOT68_USER_DATA))

let embeddedServer = null
let embeddedDatabase = null
let localServerUrl = ''
let localServerError = ''
let smokeEmbeddedSession = null

const findAvailablePort = async (host = '127.0.0.1', start = 6868, end = 6878) => {
  for (let port = start; port <= end; port += 1) {
    const available = await new Promise(resolve => {
      const probe = net.createServer()
      probe.once('error', () => resolve(false))
      probe.once('listening', () => probe.close(() => resolve(true)))
      probe.listen(port, host)
    })
    if (available) return port
  }
  throw new Error(`Không tìm thấy cổng trống từ ${start} đến ${end}`)
}

const loadOrCreateServerSecrets = userDataPath => {
  if (!safeStorage.isEncryptionAvailable()) throw new Error('Windows Safe Storage chưa sẵn sàng')
  const secretsPath = path.join(userDataPath, 'server-secrets.bin')
  if (fs.existsSync(secretsPath)) return JSON.parse(safeStorage.decryptString(fs.readFileSync(secretsPath)))
  const secrets = { authSecret: crypto.randomBytes(48).toString('base64url'), encryptionSecret: crypto.randomBytes(48).toString('base64url') }
  fs.mkdirSync(userDataPath, { recursive: true })
  fs.writeFileSync(secretsPath, safeStorage.encryptString(JSON.stringify(secrets)))
  return secrets
}

const startEmbeddedServer = async () => {
  const host = '127.0.0.1'
  const port = await findAvailablePort(host)
  const userDataPath = app.getPath('userData')
  const secrets = loadOrCreateServerSecrets(userDataPath)
  const databasePath = path.join(userDataPath, 'server', 'bot68.sqlite')
  const serverRoot = path.join(__dirname, '..', 'server')
  const [{ createApp }, { loadConfig }] = await Promise.all([
    import(pathToFileURL(path.join(serverRoot, 'app.mjs')).href),
    import(pathToFileURL(path.join(serverRoot, 'config.mjs')).href)
  ])
  localServerUrl = `http://${host}:${port}`
  const serverApp = createApp(loadConfig({ host, port, databasePath, authSecret: secrets.authSecret, encryptionSecret: secrets.encryptionSecret, publicUrl: localServerUrl, production: false }))
  embeddedDatabase = serverApp.locals.db
  embeddedServer = await new Promise((resolve, reject) => {
    const server = serverApp.listen(port, host, () => resolve(server))
    server.once('error', reject)
  })
  if (process.env.BOT68_SMOKE_EMBEDDED === '1') {
    const email = `smoke-${Date.now()}@bot68.local`
    const registered = await fetch(`${localServerUrl}/api/auth/register`, { method:'POST', headers:{'content-type':'application/json'}, body:JSON.stringify({businessName:'BOT 68 Fashion',name:'Chủ cửa hàng',email,password:'Bot68-Smoke-2026'}) }).then(response=>response.json())
    const headers = {'content-type':'application/json',authorization:`Bearer ${registered.token}`}
    const customer = await fetch(`${localServerUrl}/api/customers`, { method:'POST', headers, body:JSON.stringify({name:'Nguyễn Minh Anh',phone:'090 123 6868',email:'minhanh@example.com',channel:'facebook',tags:['VIP','Đã mua'],note:'Quan tâm áo khoác màu đen'}) }).then(response=>response.json())
    const product = await fetch(`${localServerUrl}/api/products`, { method:'POST', headers, body:JSON.stringify({sku:'AK-68-DEN',name:'Áo khoác BOT 68 màu đen',price:690000,stock:18}) }).then(response=>response.json())
    await fetch(`${localServerUrl}/api/orders`, { method:'POST', headers, body:JSON.stringify({customerId:customer.id,status:'confirmed',items:[{productId:product.id,name:product.name,quantity:1,unitPrice:product.price}]}) })
    smokeEmbeddedSession = {...registered,serverUrl:localServerUrl}
  }
}

const stopEmbeddedServer = () => {
  if (embeddedServer) embeddedServer.close()
  embeddedServer = null
  try { embeddedDatabase?.close() } catch {}
  embeddedDatabase = null
}

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

app.whenReady().then(async () => {
  try { await startEmbeddedServer() }
  catch (error) { localServerError = error instanceof Error ? error.message : String(error) }
  ipcMain.handle('open-external', (_, url) => shell.openExternal(url))
  ipcMain.handle('app-info', () => ({ version: app.getVersion(), dataPath: app.getPath('userData'), localServerUrl, localServerStatus: localServerUrl ? 'ready' : 'error', localServerError }))
  const sessionPath = path.join(app.getPath('userData'), 'session.bin')
  ipcMain.handle('session-save', (_, value) => {
    if (!safeStorage.isEncryptionAvailable()) throw new Error('Windows encryption is not available')
    fs.writeFileSync(sessionPath, safeStorage.encryptString(JSON.stringify(value)))
    return true
  })
  ipcMain.handle('session-load', () => {
    if (smokeEmbeddedSession) return smokeEmbeddedSession
    if (process.env.BOT68_SMOKE_OFFLINE === '1') return { serverUrl:'', token:'', offline:true, user:{id:'smoke',tenantId:'smoke',name:'Kiểm thử BOT 68',email:'',role:'owner'},tenant:{id:'smoke',name:'BOT 68 kiểm thử',slug:'smoke',plan:'local'} }
    try {
      if (!safeStorage.isEncryptionAvailable() || !fs.existsSync(sessionPath)) return null
      return JSON.parse(safeStorage.decryptString(fs.readFileSync(sessionPath)))
    } catch { return null }
  })
  ipcMain.handle('session-clear', () => { if (fs.existsSync(sessionPath)) fs.unlinkSync(sessionPath); return true })
  createWindow()
  app.on('activate', () => { if (BrowserWindow.getAllWindows().length === 0) createWindow() })
  if (process.env.BOT68_TEST_EXIT_MS) setTimeout(() => app.quit(), Number(process.env.BOT68_TEST_EXIT_MS))
})
app.on('before-quit', stopEmbeddedServer)
app.on('window-all-closed', () => { if (process.platform !== 'darwin') app.quit() })
