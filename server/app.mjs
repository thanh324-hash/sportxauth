import crypto from 'node:crypto'
import express from 'express'
import { openDatabase, publicTenant, publicUser } from './database.mjs'
import { createSession, decryptSecret, encryptSecret, hashPassword, readSession, verifyPassword } from './crypto.mjs'

const id = prefix => `${prefix}_${crypto.randomUUID()}`
const slugify = value => String(value).normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '').slice(0, 48)

export function createApp(config) {
  const app = express()
  const db = openDatabase(config.databasePath)
  app.locals.db = db
  app.disable('x-powered-by')
  app.use(express.json({ limit: '2mb' }))
  app.use((_, res, next) => {
    res.setHeader('Access-Control-Allow-Origin', '*')
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization')
    res.setHeader('Access-Control-Allow-Methods', 'GET,POST,PATCH,OPTIONS')
    next()
  })
  app.options('*path', (_, res) => res.sendStatus(204))

  const authenticate = (req, res, next) => {
    try {
      const token = req.headers.authorization?.replace(/^Bearer\s+/i, '')
      req.session = readSession(token, config.authSecret)
      next()
    } catch (error) { res.status(401).json({ error: error.message }) }
  }
  const ownerOnly = (req, res, next) => req.session.role === 'owner' ? next() : res.status(403).json({ error: 'Chỉ chủ cửa hàng được thực hiện thao tác này' })

  app.get('/health', (_, res) => res.json({ ok: true, service: 'BOT 68 Server', version: '0.2.0', database: 'sqlite' }))
  app.post('/api/auth/register', (req, res) => {
    try {
      const { businessName, name, email, password } = req.body || {}
      if (!businessName || !name || !email) return res.status(400).json({ error: 'Thiếu thông tin đăng ký' })
      const normalizedEmail = String(email).trim().toLowerCase()
      if (db.prepare('SELECT 1 FROM users WHERE email = ?').get(normalizedEmail)) return res.status(409).json({ error: 'Email đã được sử dụng' })
      const tenantId = id('ten'); const userId = id('usr'); const now = Date.now()
      let slug = slugify(businessName) || 'cua-hang'; let suffix = 1
      while (db.prepare('SELECT 1 FROM tenants WHERE slug = ?').get(slug)) slug = `${slugify(businessName)}-${suffix++}`
      db.exec('BEGIN')
      try {
        db.prepare('INSERT INTO tenants(id,name,slug,created_at) VALUES(?,?,?,?)').run(tenantId, businessName, slug, now)
        db.prepare("INSERT INTO users(id,tenant_id,name,email,password_hash,role,created_at) VALUES(?,?,?,?,?,'owner',?)").run(userId, tenantId, name, normalizedEmail, hashPassword(password), now)
        db.prepare('INSERT INTO ai_profiles(tenant_id,business_name,updated_at) VALUES(?,?,?)').run(tenantId, businessName, now)
        db.exec('COMMIT')
      } catch (error) { db.exec('ROLLBACK'); throw error }
      const user = publicUser(db.prepare('SELECT * FROM users WHERE id = ?').get(userId))
      const tenant = publicTenant(db.prepare('SELECT * FROM tenants WHERE id = ?').get(tenantId))
      res.status(201).json({ token: createSession({ userId, tenantId, role:'owner' }, config.authSecret), user, tenant })
    } catch (error) { res.status(400).json({ error: error.message }) }
  })
  app.post('/api/auth/login', (req, res) => {
    const email = String(req.body?.email || '').trim().toLowerCase()
    const userRow = db.prepare('SELECT * FROM users WHERE email = ?').get(email)
    if (!userRow || !verifyPassword(String(req.body?.password || ''), userRow.password_hash)) return res.status(401).json({ error: 'Email hoặc mật khẩu không đúng' })
    const user = publicUser(userRow); const tenant = publicTenant(db.prepare('SELECT * FROM tenants WHERE id = ?').get(user.tenantId))
    res.json({ token: createSession({ userId:user.id, tenantId:user.tenantId, role:user.role }, config.authSecret), user, tenant })
  })
  app.get('/api/me', authenticate, (req, res) => {
    const user = publicUser(db.prepare('SELECT * FROM users WHERE id = ? AND tenant_id = ?').get(req.session.userId, req.session.tenantId))
    const tenant = publicTenant(db.prepare('SELECT * FROM tenants WHERE id = ?').get(req.session.tenantId))
    res.json({ user, tenant })
  })
  app.get('/api/ai-profile', authenticate, (req, res) => {
    const row = db.prepare('SELECT * FROM ai_profiles WHERE tenant_id = ?').get(req.session.tenantId)
    res.json({ businessName:row.business_name, tone:row.tone, instructions:row.instructions, safetyMode:row.safety_mode, updatedAt:row.updated_at })
  })
  app.patch('/api/ai-profile', authenticate, (req, res) => {
    const current = db.prepare('SELECT * FROM ai_profiles WHERE tenant_id = ?').get(req.session.tenantId)
    const value = { businessName:req.body.businessName ?? current.business_name, tone:req.body.tone ?? current.tone, instructions:req.body.instructions ?? current.instructions, safetyMode:req.body.safetyMode ?? current.safety_mode }
    if (!['suggest','supervised','automatic'].includes(value.safetyMode)) return res.status(400).json({ error:'Chế độ AI không hợp lệ' })
    db.prepare('UPDATE ai_profiles SET business_name=?,tone=?,instructions=?,safety_mode=?,updated_at=? WHERE tenant_id=?').run(value.businessName,value.tone,value.instructions,value.safetyMode,Date.now(),req.session.tenantId)
    res.json({ ok:true, ...value })
  })
  app.get('/api/channels', authenticate, (req, res) => {
    const rows = db.prepare('SELECT id,provider,external_id,display_name,status,created_at FROM channel_connections WHERE tenant_id=? ORDER BY created_at DESC').all(req.session.tenantId)
    res.json(rows.map(r=>({id:r.id,provider:r.provider,externalId:r.external_id,displayName:r.display_name,status:r.status,createdAt:r.created_at})))
  })
  app.post('/api/channels', authenticate, ownerOnly, (req, res) => {
    const { provider, externalId, displayName, accessToken } = req.body || {}
    if (!['facebook','instagram','zalo','telegram','tiktok'].includes(provider) || !externalId || !displayName || !accessToken) return res.status(400).json({ error:'Thông tin kết nối không hợp lệ' })
    const connectionId=id('chn')
    db.prepare('INSERT INTO channel_connections(id,tenant_id,provider,external_id,display_name,encrypted_token,created_at) VALUES(?,?,?,?,?,?,?)').run(connectionId,req.session.tenantId,provider,externalId,displayName,encryptSecret(accessToken,config.encryptionSecret),Date.now())
    res.status(201).json({ id:connectionId, provider, externalId, displayName, status:'active' })
  })
  app.get('/api/channels/:connectionId/verify-secret', authenticate, ownerOnly, (req, res) => {
    const row=db.prepare('SELECT encrypted_token FROM channel_connections WHERE id=? AND tenant_id=?').get(req.params.connectionId,req.session.tenantId)
    if(!row)return res.sendStatus(404)
    const secret=decryptSecret(row.encrypted_token,config.encryptionSecret)
    res.json({ stored:true, fingerprint:crypto.createHash('sha256').update(secret).digest('hex').slice(0,12) })
  })
  app.get('/api/sync/events', authenticate, (req, res) => {
    const limit=Math.min(Number(req.query.limit)||100,500)
    const rows=db.prepare('SELECT id,provider,event_type,external_id,payload,created_at FROM sync_events WHERE tenant_id=? AND delivered_at IS NULL ORDER BY created_at LIMIT ?').all(req.session.tenantId,limit)
    res.json(rows.map(r=>({id:r.id,provider:r.provider,type:r.event_type,externalId:r.external_id,payload:JSON.parse(r.payload),createdAt:r.created_at})))
  })
  app.post('/api/sync/ack', authenticate, (req, res) => {
    const ids=Array.isArray(req.body?.ids)?req.body.ids.slice(0,500):[]
    const update=db.prepare('UPDATE sync_events SET delivered_at=? WHERE id=? AND tenant_id=?')
    db.exec('BEGIN'); try { for(const eventId of ids)update.run(Date.now(),eventId,req.session.tenantId);db.exec('COMMIT') }catch(e){db.exec('ROLLBACK');throw e}
    res.json({ ok:true, acknowledged:ids.length })
  })
  app.get('/webhooks/meta', (req, res) => {
    if (req.query['hub.mode']==='subscribe' && req.query['hub.verify_token']===config.metaVerifyToken) return res.status(200).send(req.query['hub.challenge'])
    res.sendStatus(403)
  })
  app.post('/webhooks/meta', (req, res) => {
    const entries=Array.isArray(req.body?.entry)?req.body.entry:[]
    const insert=db.prepare('INSERT INTO sync_events(id,tenant_id,provider,event_type,external_id,payload,created_at) VALUES(?,?,?,?,?,?,?)')
    for(const entry of entries){
      const connections=db.prepare("SELECT tenant_id FROM channel_connections WHERE provider IN ('facebook','instagram') AND external_id=?").all(String(entry.id))
      for(const connection of connections) insert.run(id('evt'),connection.tenant_id,req.body.object==='instagram'?'instagram':'facebook','webhook',String(entry.id),JSON.stringify(entry),Date.now())
    }
    res.sendStatus(200)
  })
  app.get('/oauth/meta/start', authenticate, (_, res) => {
    if(!config.metaAppId)return res.status(503).json({error:'META_APP_ID chưa được cấu hình'})
    res.status(501).json({error:'OAuth callback will be enabled after a public HTTPS URL is configured'})
  })
  app.use((error,_,res,next)=>{ if(res.headersSent)return next(error);res.status(500).json({error:config.production?'Lỗi máy chủ':error.message}) })
  return app
}
