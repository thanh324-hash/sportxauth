import crypto from 'node:crypto'
import express from 'express'
import { openDatabase, publicTenant, publicUser } from './database.mjs'
import { createSession, decryptSecret, encryptSecret, hashPassword, readSession, verifyPassword } from './crypto.mjs'
import { channelAdapters, publicAdapterCatalog } from './channels/registry.mjs'
import { createSuggestion } from './ai.mjs'

const id = prefix => `${prefix}_${crypto.randomUUID()}`
const slugify = value => String(value).normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '').slice(0, 48)

export function createApp(config) {
  const app = express()
  const db = openDatabase(config.databasePath)
  app.locals.db = db
  app.disable('x-powered-by')
  app.use(express.json({ limit: '12mb', verify:(req,_,buffer)=>{req.rawBody=buffer} }))
  app.use((_, res, next) => {
    res.setHeader('Access-Control-Allow-Origin', '*')
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization')
    res.setHeader('Access-Control-Allow-Methods', 'GET,POST,PATCH,DELETE,OPTIONS')
    next()
  })
  app.options('*path', (_, res) => res.sendStatus(204))

  const authenticate = (req, res, next) => {
    try {
      const token = req.headers.authorization?.replace(/^Bearer\s+/i, '')
      req.session = readSession(token, config.authSecret)
      const account=db.prepare('SELECT active,session_version,role FROM users WHERE id=? AND tenant_id=?').get(req.session.userId,req.session.tenantId)
      if(!account||account.active===0||Number(req.session.sessionVersion)!==Number(account.session_version))throw new Error('Phiên đăng nhập đã bị thu hồi')
      req.session.role=account.role
      next()
    } catch (error) { res.status(401).json({ error: error.message }) }
  }
  const ownerOnly = (req, res, next) => req.session.role === 'owner' ? next() : res.status(403).json({ error: 'Chỉ chủ cửa hàng được thực hiện thao tác này' })
  const managerOrOwner=(req,res,next)=>['owner','manager'].includes(req.session.role)?next():res.status(403).json({error:'Bạn không có quyền chỉnh sửa cấu hình AI'})

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
      res.status(201).json({ token: createSession({ userId, tenantId, role:'owner', sessionVersion:1 }, config.authSecret), user, tenant })
    } catch (error) { res.status(400).json({ error: error.message }) }
  })
  app.post('/api/auth/login', (req, res) => {
    const email = String(req.body?.email || '').trim().toLowerCase()
    const userRow = db.prepare('SELECT * FROM users WHERE email = ?').get(email)
    if (!userRow || !verifyPassword(String(req.body?.password || ''), userRow.password_hash)) return res.status(401).json({ error: 'Email hoặc mật khẩu không đúng' })
    if(userRow.active===0)return res.status(403).json({error:'Tài khoản đã bị chủ cửa hàng khóa'})
    const user = publicUser(userRow); const tenant = publicTenant(db.prepare('SELECT * FROM tenants WHERE id = ?').get(user.tenantId))
    res.json({ token: createSession({ userId:user.id, tenantId:user.tenantId, role:user.role, sessionVersion:userRow.session_version }, config.authSecret), user, tenant })
  })
  app.get('/api/me', authenticate, (req, res) => {
    const user = publicUser(db.prepare('SELECT * FROM users WHERE id = ? AND tenant_id = ?').get(req.session.userId, req.session.tenantId))
    const tenant = publicTenant(db.prepare('SELECT * FROM tenants WHERE id = ?').get(req.session.tenantId))
    res.json({ user, tenant })
  })
  app.patch('/api/me/password', authenticate, (req, res) => {
    const currentPassword=String(req.body?.currentPassword||''),newPassword=String(req.body?.newPassword||'')
    const user=db.prepare('SELECT * FROM users WHERE id=? AND tenant_id=?').get(req.session.userId,req.session.tenantId)
    if(!user||!verifyPassword(currentPassword,user.password_hash))return res.status(400).json({error:'Mật khẩu hiện tại không đúng'})
    if(newPassword.length<8)return res.status(400).json({error:'Mật khẩu mới phải có ít nhất 8 ký tự'})
    if(currentPassword===newPassword)return res.status(400).json({error:'Mật khẩu mới phải khác mật khẩu hiện tại'})
    db.prepare('UPDATE users SET password_hash=? WHERE id=? AND tenant_id=?').run(hashPassword(newPassword),user.id,user.tenant_id)
    res.json({ok:true})
  })
  app.get('/api/customers',authenticate,(req,res)=>{const rows=db.prepare('SELECT * FROM customers WHERE tenant_id=? ORDER BY updated_at DESC').all(req.session.tenantId);res.json(rows.map(publicCustomer))})
  app.post('/api/customers',authenticate,(req,res)=>{try{const name=String(req.body?.name||'').trim();if(!name)return res.status(400).json({error:'Tên khách hàng là bắt buộc'});const now=Date.now(),customerId=id('cus');db.prepare('INSERT INTO customers(id,tenant_id,name,phone,email,channel,external_id,tags,note,created_at,updated_at) VALUES(?,?,?,?,?,?,?,?,?,?,?)').run(customerId,req.session.tenantId,name,String(req.body?.phone||'').trim(),String(req.body?.email||'').trim(),String(req.body?.channel||'manual'),req.body?.externalId||null,JSON.stringify(Array.isArray(req.body?.tags)?req.body.tags:[]),String(req.body?.note||''),now,now);res.status(201).json(publicCustomer(db.prepare('SELECT * FROM customers WHERE id=?').get(customerId)))}catch(error){res.status(400).json({error:error.message})}})
  app.patch('/api/customers/:customerId',authenticate,(req,res)=>{const current=db.prepare('SELECT * FROM customers WHERE id=? AND tenant_id=?').get(req.params.customerId,req.session.tenantId);if(!current)return res.sendStatus(404);const value={name:String(req.body.name??current.name).trim(),phone:String(req.body.phone??current.phone),email:String(req.body.email??current.email),channel:String(req.body.channel??current.channel),tags:Array.isArray(req.body.tags)?req.body.tags:JSON.parse(current.tags),note:String(req.body.note??current.note)};if(!value.name)return res.status(400).json({error:'Tên khách hàng là bắt buộc'});db.prepare('UPDATE customers SET name=?,phone=?,email=?,channel=?,tags=?,note=?,updated_at=? WHERE id=? AND tenant_id=?').run(value.name,value.phone,value.email,value.channel,JSON.stringify(value.tags),value.note,Date.now(),current.id,req.session.tenantId);res.json(publicCustomer(db.prepare('SELECT * FROM customers WHERE id=?').get(current.id)))})
  app.delete('/api/customers/:customerId',authenticate,managerOrOwner,(req,res)=>{const result=db.prepare('DELETE FROM customers WHERE id=? AND tenant_id=?').run(req.params.customerId,req.session.tenantId);res.status(result.changes?200:404).json({ok:Boolean(result.changes)})})

  app.get('/api/products',authenticate,(req,res)=>{res.json(db.prepare('SELECT * FROM products WHERE tenant_id=? ORDER BY updated_at DESC').all(req.session.tenantId).map(publicProduct))})
  app.post('/api/products',authenticate,managerOrOwner,(req,res)=>{try{const name=String(req.body?.name||'').trim(),sku=String(req.body?.sku||'').trim();if(!name||!sku)return res.status(400).json({error:'Tên và SKU là bắt buộc'});const now=Date.now(),productId=id('prd');db.prepare('INSERT INTO products(id,tenant_id,sku,name,price,stock,status,created_at,updated_at) VALUES(?,?,?,?,?,?,?,?,?)').run(productId,req.session.tenantId,sku,name,nonNegative(req.body?.price),nonNegative(req.body?.stock),String(req.body?.status||'active'),now,now);res.status(201).json(publicProduct(db.prepare('SELECT * FROM products WHERE id=?').get(productId)))}catch(error){res.status(400).json({error:error.message})}})
  app.patch('/api/products/:productId',authenticate,managerOrOwner,(req,res)=>{try{const current=db.prepare('SELECT * FROM products WHERE id=? AND tenant_id=?').get(req.params.productId,req.session.tenantId);if(!current)return res.sendStatus(404);db.prepare('UPDATE products SET sku=?,name=?,price=?,stock=?,status=?,updated_at=? WHERE id=? AND tenant_id=?').run(String(req.body.sku??current.sku).trim(),String(req.body.name??current.name).trim(),req.body.price===undefined?current.price:nonNegative(req.body.price),req.body.stock===undefined?current.stock:nonNegative(req.body.stock),String(req.body.status??current.status),Date.now(),current.id,req.session.tenantId);res.json(publicProduct(db.prepare('SELECT * FROM products WHERE id=?').get(current.id)))}catch(error){res.status(400).json({error:error.message})}})
  app.delete('/api/products/:productId',authenticate,managerOrOwner,(req,res)=>{const result=db.prepare('DELETE FROM products WHERE id=? AND tenant_id=?').run(req.params.productId,req.session.tenantId);res.status(result.changes?200:404).json({ok:Boolean(result.changes)})})

  app.get('/api/orders',authenticate,(req,res)=>{const rows=db.prepare('SELECT o.*,c.name customer_name FROM orders o LEFT JOIN customers c ON c.id=o.customer_id WHERE o.tenant_id=? ORDER BY o.updated_at DESC').all(req.session.tenantId);const items=db.prepare('SELECT * FROM order_items WHERE order_id=?');res.json(rows.map(row=>publicOrder(row,items.all(row.id))))})
  app.post('/api/orders',authenticate,(req,res)=>{try{const items=normalizeOrderItems(req.body?.items),customerId=req.body?.customerId||null;if(customerId&&!db.prepare('SELECT 1 FROM customers WHERE id=? AND tenant_id=?').get(customerId,req.session.tenantId))return res.status(400).json({error:'Khách hàng không thuộc cửa hàng này'});for(const item of items)if(item.productId&&!db.prepare('SELECT 1 FROM products WHERE id=? AND tenant_id=?').get(item.productId,req.session.tenantId))return res.status(400).json({error:'Sản phẩm không thuộc cửa hàng này'});const now=Date.now(),orderId=id('ord'),code=`DH${String(now).slice(-6)}${crypto.randomBytes(2).toString('hex').toUpperCase()}`,total=items.reduce((sum,item)=>sum+item.quantity*item.unitPrice,0);db.exec('BEGIN');try{db.prepare('INSERT INTO orders(id,tenant_id,customer_id,code,total,status,note,created_at,updated_at) VALUES(?,?,?,?,?,?,?,?,?)').run(orderId,req.session.tenantId,customerId,code,total,String(req.body?.status||'draft'),String(req.body?.note||''),now,now);const insert=db.prepare('INSERT INTO order_items(id,order_id,product_id,name,quantity,unit_price) VALUES(?,?,?,?,?,?)');for(const item of items)insert.run(id('itm'),orderId,item.productId,item.name,item.quantity,item.unitPrice);db.exec('COMMIT')}catch(error){db.exec('ROLLBACK');throw error}const row=db.prepare('SELECT o.*,c.name customer_name FROM orders o LEFT JOIN customers c ON c.id=o.customer_id WHERE o.id=?').get(orderId);res.status(201).json(publicOrder(row,db.prepare('SELECT * FROM order_items WHERE order_id=?').all(orderId)))}catch(error){res.status(400).json({error:error.message})}})
  app.patch('/api/orders/:orderId',authenticate,(req,res)=>{const current=db.prepare('SELECT * FROM orders WHERE id=? AND tenant_id=?').get(req.params.orderId,req.session.tenantId);if(!current)return res.sendStatus(404);const allowed=['draft','confirmed','shipping','completed','cancelled'],status=String(req.body?.status??current.status);if(!allowed.includes(status))return res.status(400).json({error:'Trạng thái đơn không hợp lệ'});db.prepare('UPDATE orders SET status=?,note=?,updated_at=? WHERE id=? AND tenant_id=?').run(status,String(req.body?.note??current.note),Date.now(),current.id,req.session.tenantId);const row=db.prepare('SELECT o.*,c.name customer_name FROM orders o LEFT JOIN customers c ON c.id=o.customer_id WHERE o.id=?').get(current.id);res.json(publicOrder(row,db.prepare('SELECT * FROM order_items WHERE order_id=?').all(current.id)))})

  app.get('/api/team',authenticate,ownerOnly,(req,res)=>{res.json(db.prepare('SELECT * FROM users WHERE tenant_id=? ORDER BY created_at').all(req.session.tenantId).map(publicUser))})
  app.post('/api/team',authenticate,ownerOnly,(req,res)=>{try{const name=String(req.body?.name||'').trim(),email=String(req.body?.email||'').trim().toLowerCase(),role=String(req.body?.role||'agent');if(!name||!email||!['manager','agent'].includes(role))return res.status(400).json({error:'Thông tin nhân viên không hợp lệ'});const userId=id('usr');db.prepare('INSERT INTO users(id,tenant_id,name,email,password_hash,role,created_at) VALUES(?,?,?,?,?,?,?)').run(userId,req.session.tenantId,name,email,hashPassword(String(req.body?.password||'')),role,Date.now());res.status(201).json(publicUser(db.prepare('SELECT * FROM users WHERE id=?').get(userId)))}catch(error){res.status(400).json({error:error.message})}})
  app.patch('/api/team/:userId',authenticate,ownerOnly,(req,res)=>{const current=db.prepare('SELECT * FROM users WHERE id=? AND tenant_id=?').get(req.params.userId,req.session.tenantId);if(!current)return res.sendStatus(404);const role=String(req.body?.role??current.role),active=req.body?.active===undefined?current.active:(req.body.active?1:0);if(current.id===req.session.userId||!['manager','agent'].includes(role))return res.status(400).json({error:'Không thể thay đổi tài khoản này'});const revoke=active!==current.active?1:0;db.prepare('UPDATE users SET role=?,active=?,session_version=session_version+? WHERE id=? AND tenant_id=?').run(role,active,revoke,current.id,req.session.tenantId);res.json(publicUser(db.prepare('SELECT * FROM users WHERE id=?').get(current.id)))})
  app.get('/api/reports/summary',authenticate,(req,res)=>{const tenant=req.session.tenantId,count=table=>db.prepare(`SELECT COUNT(*) value FROM ${table} WHERE tenant_id=?`).get(tenant).value;const revenue=db.prepare("SELECT COALESCE(SUM(total),0) value FROM orders WHERE tenant_id=? AND status='completed'").get(tenant).value;const orderStatus=db.prepare('SELECT status,COUNT(*) count,COALESCE(SUM(total),0) total FROM orders WHERE tenant_id=? GROUP BY status').all(tenant);const channels=db.prepare('SELECT channel,COUNT(*) count FROM customers WHERE tenant_id=? GROUP BY channel').all(tenant);res.json({customers:count('customers'),products:count('products'),orders:count('orders'),team:count('users'),revenue,orderStatus,channels})})
  app.get('/api/reports/staff-performance',authenticate,(req,res)=>{const period=['day','week','month'].includes(req.query.period)?req.query.period:'day',range=reportRange(period),tenantId=req.session.tenantId,canViewTeam=req.session.role==='owner',users=canViewTeam?db.prepare('SELECT * FROM users WHERE tenant_id=? ORDER BY role DESC, name').all(tenantId):[db.prepare('SELECT * FROM users WHERE id=? AND tenant_id=?').get(req.session.userId,tenantId)],read=db.prepare('SELECT COUNT(*) messages,COUNT(DISTINCT customer_key) customers FROM staff_activity WHERE tenant_id=? AND user_id=? AND created_at>=? AND created_at<?'),rows=users.filter(Boolean).map(user=>{const current=read.get(tenantId,user.id,range.start,range.end),previous=read.get(tenantId,user.id,range.previousStart,range.start);return {user:publicUser(user),messages:Number(current.messages),customers:Number(current.customers),previousMessages:Number(previous.messages),previousCustomers:Number(previous.customers),messageChangePercent:changePercent(current.messages,previous.messages),customerChangePercent:changePercent(current.customers,previous.customers)}}),totals={messages:rows.reduce((sum,row)=>sum+row.messages,0),customers:db.prepare('SELECT COUNT(DISTINCT customer_key) value FROM staff_activity WHERE tenant_id=? AND created_at>=? AND created_at<?'+(canViewTeam?'':' AND user_id=?')).get(...(canViewTeam?[tenantId,range.start,range.end]:[tenantId,range.start,range.end,req.session.userId])).value};res.json({period,start:range.start,end:range.end,canViewTeam,totals,rows})})
  app.get('/api/backup/export',authenticate,ownerOnly,(req,res)=>{const tenantId=req.session.tenantId,customers=db.prepare('SELECT * FROM customers WHERE tenant_id=? ORDER BY created_at').all(tenantId).map(publicCustomer),products=db.prepare('SELECT * FROM products WHERE tenant_id=? ORDER BY created_at').all(tenantId).map(publicProduct),orderRows=db.prepare('SELECT o.*,c.name customer_name FROM orders o LEFT JOIN customers c ON c.id=o.customer_id WHERE o.tenant_id=? ORDER BY o.created_at').all(tenantId),getItems=db.prepare('SELECT * FROM order_items WHERE order_id=?'),orders=orderRows.map(row=>publicOrder(row,getItems.all(row.id))),profile=db.prepare('SELECT * FROM ai_profiles WHERE tenant_id=?').get(tenantId),knowledge=db.prepare('SELECT * FROM ai_knowledge WHERE tenant_id=? ORDER BY created_at').all(tenantId).map(publicKnowledge);res.json({format:'bot68-server-backup',version:1,exportedAt:Date.now(),tenant:{name:db.prepare('SELECT name FROM tenants WHERE id=?').get(tenantId).name},customers,products,orders,ai:{profile:{businessName:profile.business_name,tone:profile.tone,instructions:profile.instructions,safetyMode:profile.safety_mode},knowledge}})})
  app.post('/api/backup/import',authenticate,ownerOnly,(req,res)=>{try{if(req.body?.confirmation!=='RESTORE'||req.body?.backup?.format!=='bot68-server-backup'||req.body?.backup?.version!==1)return res.status(400).json({error:'Gói sao lưu hoặc xác nhận không hợp lệ'});const backup=req.body.backup,customers=limitedArray(backup.customers,50000),products=limitedArray(backup.products,50000),orders=limitedArray(backup.orders,100000),knowledge=limitedArray(backup.ai?.knowledge,10000),tenantId=req.session.tenantId,now=Date.now(),customerMap=new Map(),productMap=new Map();db.exec('BEGIN');try{db.prepare('DELETE FROM orders WHERE tenant_id=?').run(tenantId);db.prepare('DELETE FROM customers WHERE tenant_id=?').run(tenantId);db.prepare('DELETE FROM products WHERE tenant_id=?').run(tenantId);db.prepare('DELETE FROM ai_knowledge WHERE tenant_id=?').run(tenantId);const addCustomer=db.prepare('INSERT INTO customers(id,tenant_id,name,phone,email,channel,external_id,tags,note,created_at,updated_at) VALUES(?,?,?,?,?,?,?,?,?,?,?)');for(const item of customers){const newId=id('cus');customerMap.set(item.id,newId);addCustomer.run(newId,tenantId,String(item.name||'Khách hàng'),String(item.phone||''),String(item.email||''),String(item.channel||'manual'),item.externalId||null,JSON.stringify(Array.isArray(item.tags)?item.tags:[]),String(item.note||''),Number(item.createdAt)||now,now)}const addProduct=db.prepare('INSERT INTO products(id,tenant_id,sku,name,price,stock,status,created_at,updated_at) VALUES(?,?,?,?,?,?,?,?,?)');for(const item of products){const newId=id('prd');productMap.set(item.id,newId);addProduct.run(newId,tenantId,String(item.sku||newId),String(item.name||'Sản phẩm'),nonNegative(item.price),nonNegative(item.stock),String(item.status||'active'),Number(item.createdAt)||now,now)}const addOrder=db.prepare('INSERT INTO orders(id,tenant_id,customer_id,code,total,status,note,created_at,updated_at) VALUES(?,?,?,?,?,?,?,?,?)'),addItem=db.prepare('INSERT INTO order_items(id,order_id,product_id,name,quantity,unit_price) VALUES(?,?,?,?,?,?)');for(const order of orders){const orderId=id('ord'),items=normalizeOrderItems(order.items),total=items.reduce((sum,item)=>sum+item.quantity*item.unitPrice,0);addOrder.run(orderId,tenantId,customerMap.get(order.customerId)||null,String(order.code||`DH${crypto.randomBytes(5).toString('hex').toUpperCase()}`),total,String(order.status||'draft'),String(order.note||''),Number(order.createdAt)||now,now);for(const item of items)addItem.run(id('itm'),orderId,productMap.get(item.productId)||null,item.name,item.quantity,item.unitPrice)}for(const item of knowledge){db.prepare('INSERT INTO ai_knowledge(id,tenant_id,title,content,tags,enabled,created_at,updated_at) VALUES(?,?,?,?,?,?,?,?)').run(id('knw'),tenantId,String(item.title||'Tài liệu'),String(item.content||''),JSON.stringify(Array.isArray(item.tags)?item.tags:[]),item.enabled===false?0:1,Number(item.createdAt)||now,now)}const profile=backup.ai?.profile;if(profile)db.prepare('UPDATE ai_profiles SET business_name=?,tone=?,instructions=?,safety_mode=?,updated_at=? WHERE tenant_id=?').run(String(profile.businessName||backup.tenant?.name||'BOT 68'),String(profile.tone||'thân thiện'),String(profile.instructions||''),['suggest','supervised','automatic'].includes(profile.safetyMode)?profile.safetyMode:'suggest',now,tenantId);db.exec('COMMIT')}catch(error){db.exec('ROLLBACK');throw error}res.json({ok:true,restored:{customers:customers.length,products:products.length,orders:orders.length,knowledge:knowledge.length},requiresChannelReconnect:true})}catch(error){res.status(400).json({error:error.message})}})
  app.get('/api/ai-profile', authenticate, (req, res) => {
    const row = db.prepare('SELECT * FROM ai_profiles WHERE tenant_id = ?').get(req.session.tenantId)
    res.json({ businessName:row.business_name, tone:row.tone, instructions:row.instructions, safetyMode:row.safety_mode, updatedAt:row.updated_at })
  })
  app.patch('/api/ai-profile', authenticate, managerOrOwner, (req, res) => {
    const current = db.prepare('SELECT * FROM ai_profiles WHERE tenant_id = ?').get(req.session.tenantId)
    const value = { businessName:req.body.businessName ?? current.business_name, tone:req.body.tone ?? current.tone, instructions:req.body.instructions ?? current.instructions, safetyMode:req.body.safetyMode ?? current.safety_mode }
    if (!['suggest','supervised','automatic'].includes(value.safetyMode)) return res.status(400).json({ error:'Chế độ AI không hợp lệ' })
    db.prepare('UPDATE ai_profiles SET business_name=?,tone=?,instructions=?,safety_mode=?,updated_at=? WHERE tenant_id=?').run(value.businessName,value.tone,value.instructions,value.safetyMode,Date.now(),req.session.tenantId)
    res.json({ ok:true, ...value })
  })
  app.get('/api/ai/knowledge',authenticate,(req,res)=>{const rows=db.prepare('SELECT * FROM ai_knowledge WHERE tenant_id=? ORDER BY updated_at DESC').all(req.session.tenantId);res.json(rows.map(publicKnowledge))})
  app.post('/api/ai/knowledge',authenticate,managerOrOwner,(req,res)=>{const title=String(req.body?.title||'').trim(),content=String(req.body?.content||'').trim(),tags=Array.isArray(req.body?.tags)?req.body.tags.map(String).slice(0,20):[];if(!title||!content||content.length>50000)return res.status(400).json({error:'Tiêu đề hoặc nội dung tài liệu không hợp lệ'});const knowledgeId=id('know'),now=Date.now();db.prepare('INSERT INTO ai_knowledge(id,tenant_id,title,content,tags,created_at,updated_at) VALUES(?,?,?,?,?,?,?)').run(knowledgeId,req.session.tenantId,title,content,JSON.stringify(tags),now,now);res.status(201).json(publicKnowledge(db.prepare('SELECT * FROM ai_knowledge WHERE id=?').get(knowledgeId)))})
  app.patch('/api/ai/knowledge/:knowledgeId',authenticate,managerOrOwner,(req,res)=>{const row=db.prepare('SELECT * FROM ai_knowledge WHERE id=? AND tenant_id=?').get(req.params.knowledgeId,req.session.tenantId);if(!row)return res.sendStatus(404);const title=String(req.body.title??row.title).trim(),content=String(req.body.content??row.content).trim(),tags=Array.isArray(req.body.tags)?req.body.tags.map(String).slice(0,20):JSON.parse(row.tags),enabled=req.body.enabled===undefined?row.enabled:(req.body.enabled?1:0);db.prepare('UPDATE ai_knowledge SET title=?,content=?,tags=?,enabled=?,updated_at=? WHERE id=? AND tenant_id=?').run(title,content,JSON.stringify(tags),enabled,Date.now(),row.id,req.session.tenantId);res.json(publicKnowledge(db.prepare('SELECT * FROM ai_knowledge WHERE id=?').get(row.id)))})
  app.delete('/api/ai/knowledge/:knowledgeId',authenticate,managerOrOwner,(req,res)=>{const result=db.prepare('DELETE FROM ai_knowledge WHERE id=? AND tenant_id=?').run(req.params.knowledgeId,req.session.tenantId);res.status(result.changes?204:404).end()})
  app.post('/api/ai/suggest',authenticate,async(req,res,next)=>{try{const question=String(req.body?.question||'').trim();if(!question||question.length>8000)return res.status(400).json({error:'Câu hỏi không hợp lệ'});const profileRow=db.prepare('SELECT * FROM ai_profiles WHERE tenant_id=?').get(req.session.tenantId),profile={businessName:profileRow.business_name,tone:profileRow.tone,instructions:profileRow.instructions,safetyMode:profileRow.safety_mode},documents=db.prepare('SELECT * FROM ai_knowledge WHERE tenant_id=? AND enabled=1').all(req.session.tenantId).map(publicKnowledge),result=await createSuggestion({profile,documents,question,customerName:String(req.body?.customerName||''),messages:Array.isArray(req.body?.messages)?req.body.messages.slice(-20):[],config});res.json(result)}catch(error){next(error)}})
  app.get('/api/channels', authenticate, (req, res) => {
    const rows = db.prepare('SELECT id,provider,external_id,display_name,status,created_at FROM channel_connections WHERE tenant_id=? ORDER BY created_at DESC').all(req.session.tenantId)
    res.json(rows.map(r=>({id:r.id,provider:r.provider,externalId:r.external_id,displayName:r.display_name,status:r.status,createdAt:r.created_at})))
  })
  app.get('/api/channel-adapters',authenticate,(_,res)=>res.json(publicAdapterCatalog()))
  app.get('/media/library/:assetId',(req,res)=>{const row=db.prepare('SELECT mime_type,data FROM media_assets WHERE id=?').get(req.params.assetId);if(!row)return res.sendStatus(404);res.setHeader('Content-Type',row.mime_type);res.setHeader('Cache-Control','public,max-age=31536000,immutable');res.send(Buffer.from(row.data))})
  app.get('/api/media/library',authenticate,(req,res)=>{const rows=db.prepare('SELECT id,name,mime_type,created_at,last_used_at FROM media_assets WHERE tenant_id=? ORDER BY created_at DESC LIMIT 50').all(req.session.tenantId);res.json(rows.map(row=>({id:row.id,name:row.name,mimeType:row.mime_type,createdAt:row.created_at,lastUsedAt:row.last_used_at,url:`${config.publicUrl}/media/library/${row.id}`})))})
  app.post('/api/media/library',authenticate,(req,res)=>{try{const name=String(req.body?.name||'Ảnh sản phẩm').slice(0,160),parsed=parseDataImage(req.body?.dataUrl);const count=db.prepare('SELECT COUNT(*) count FROM media_assets WHERE tenant_id=?').get(req.session.tenantId).count;if(count>=50)return res.status(409).json({error:'Kho ảnh web đã đủ 50 ảnh. Hãy xóa ảnh cũ trước khi tải thêm.'});const assetId=id('img'),now=Date.now();db.prepare('INSERT INTO media_assets(id,tenant_id,name,mime_type,data,created_at,last_used_at) VALUES(?,?,?,?,?,?,?)').run(assetId,req.session.tenantId,name,parsed.mimeType,parsed.data,now,now);res.status(201).json({id:assetId,name,mimeType:parsed.mimeType,createdAt:now,lastUsedAt:now,url:`${config.publicUrl}/media/library/${assetId}`})}catch(error){res.status(400).json({error:error.message})}})
  app.delete('/api/media/library/:assetId',authenticate,(req,res)=>{const result=db.prepare('DELETE FROM media_assets WHERE id=? AND tenant_id=?').run(req.params.assetId,req.session.tenantId);res.status(result.changes?204:404).end()})
  app.post('/api/channels/telegram/connect',authenticate,ownerOnly,async(req,res,next)=>{
    try{
      const token=String(req.body?.token||'').trim();if(!token||!/^\d+:[A-Za-z0-9_-]{20,}$/.test(token))return res.status(400).json({error:'Telegram Bot Token không hợp lệ'})
      const adapter=channelAdapters.telegram,profile=await adapter.verify({token,fetchImpl:config.fetchImpl}),existing=db.prepare("SELECT id FROM channel_connections WHERE tenant_id=? AND provider='telegram' AND external_id=?").get(req.session.tenantId,profile.externalId),connectionId=existing?.id||id('chn'),webhookSecret=crypto.randomBytes(32).toString('base64url'),now=Date.now()
      const webhookUrl=`${config.publicUrl}/webhooks/telegram/${connectionId}`
      await adapter.setWebhook({token,url:webhookUrl,secret:webhookSecret,fetchImpl:config.fetchImpl})
      db.prepare("INSERT INTO channel_connections(id,tenant_id,provider,external_id,display_name,encrypted_token,status,created_at,webhook_secret_hash,metadata) VALUES(?,?,?,?,?,?,'active',?,?,?) ON CONFLICT(tenant_id,provider,external_id) DO UPDATE SET display_name=excluded.display_name,encrypted_token=excluded.encrypted_token,status='active',webhook_secret_hash=excluded.webhook_secret_hash,metadata=excluded.metadata").run(connectionId,req.session.tenantId,'telegram',profile.externalId,profile.displayName,encryptSecret(token,config.encryptionSecret),now,crypto.createHash('sha256').update(webhookSecret).digest('hex'),JSON.stringify(profile.metadata))
      res.status(201).json({id:connectionId,provider:'telegram',externalId:profile.externalId,displayName:profile.displayName,status:'active',webhookUrl})
    }catch(error){next(error)}
  })
  app.post('/api/channels/zalo/connect',authenticate,ownerOnly,async(req,res,next)=>{
    try{
      const token=String(req.body?.token||'').trim();if(token.length<20)return res.status(400).json({error:'Zalo OA Access Token không hợp lệ'})
      const adapter=channelAdapters.zalo,profile=await adapter.verify({token,fetchImpl:config.fetchImpl}),existing=db.prepare("SELECT id FROM channel_connections WHERE tenant_id=? AND provider='zalo' AND external_id=?").get(req.session.tenantId,profile.externalId),connectionId=existing?.id||id('chn'),webhookSecret=crypto.randomBytes(32).toString('base64url'),now=Date.now(),webhookUrl=`${config.publicUrl}/webhooks/zalo/${connectionId}/${webhookSecret}`
      db.prepare("INSERT INTO channel_connections(id,tenant_id,provider,external_id,display_name,encrypted_token,status,created_at,webhook_secret_hash,metadata) VALUES(?,?,?,?,?,?,'active',?,?,?) ON CONFLICT(tenant_id,provider,external_id) DO UPDATE SET display_name=excluded.display_name,encrypted_token=excluded.encrypted_token,status='active',webhook_secret_hash=excluded.webhook_secret_hash,metadata=excluded.metadata").run(connectionId,req.session.tenantId,'zalo',profile.externalId,profile.displayName,encryptSecret(token,config.encryptionSecret),now,crypto.createHash('sha256').update(webhookSecret).digest('hex'),JSON.stringify({...profile.metadata,webhookConfigured:false}))
      res.status(201).json({id:connectionId,provider:'zalo',externalId:profile.externalId,displayName:profile.displayName,status:'active',webhookUrl,requiresManualWebhookSetup:true})
    }catch(error){next(error)}
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
    const rows=db.prepare('SELECT * FROM (SELECT id,provider,event_type,external_id,payload,created_at,source_connection_id FROM sync_events WHERE tenant_id=? ORDER BY created_at DESC LIMIT ?) ORDER BY created_at').all(req.session.tenantId,limit)
    res.json(rows.map(r=>({id:r.id,provider:r.provider,type:r.event_type,externalId:r.external_id,connectionId:r.source_connection_id,payload:JSON.parse(r.payload),createdAt:r.created_at})))
  })
  app.post('/api/sync/ack', authenticate, (req, res) => {
    const ids=Array.isArray(req.body?.ids)?req.body.ids.slice(0,500):[]
    res.json({ ok:true, acknowledged:ids.length, delivery:'per-device-local' })
  })
  app.get('/webhooks/meta', (req, res) => {
    if (req.query['hub.mode']==='subscribe' && req.query['hub.verify_token']===config.metaVerifyToken) return res.status(200).send(req.query['hub.challenge'])
    res.sendStatus(403)
  })
  app.post('/webhooks/telegram/:connectionId',(req,res)=>{
    const connection=db.prepare("SELECT * FROM channel_connections WHERE id=? AND provider='telegram' AND status='active'").get(req.params.connectionId)
    if(!connection)return res.sendStatus(404)
    const received=String(req.headers['x-telegram-bot-api-secret-token']||''),expected=String(connection.webhook_secret_hash||''),actual=crypto.createHash('sha256').update(received).digest('hex')
    const a=Buffer.from(actual),b=Buffer.from(expected);if(!received||a.length!==b.length||!crypto.timingSafeEqual(a,b))return res.status(401).json({error:'Telegram webhook secret không hợp lệ'})
    const normalized=channelAdapters.telegram.normalize(req.body);if(normalized){db.prepare('INSERT OR IGNORE INTO sync_events(id,tenant_id,provider,event_type,external_id,payload,created_at,source_connection_id) VALUES(?,?,?,?,?,?,?,?)').run(id('evt'),connection.tenant_id,'telegram',normalized.type,normalized.externalEventId,JSON.stringify(normalized),Date.now(),connection.id);upsertSocialCustomer(db,connection.tenant_id,'telegram',normalized)}
    res.sendStatus(200)
  })
  app.post('/webhooks/zalo/:connectionId/:secret',(req,res)=>{
    const connection=db.prepare("SELECT * FROM channel_connections WHERE id=? AND provider='zalo' AND status='active'").get(req.params.connectionId);if(!connection)return res.sendStatus(404)
    const actual=crypto.createHash('sha256').update(String(req.params.secret||'')).digest('hex'),expected=String(connection.webhook_secret_hash||''),a=Buffer.from(actual),b=Buffer.from(expected);if(a.length!==b.length||!crypto.timingSafeEqual(a,b))return res.status(401).json({error:'Zalo webhook secret không hợp lệ'})
    const normalized=channelAdapters.zalo.normalize(req.body);if(normalized){db.prepare('INSERT OR IGNORE INTO sync_events(id,tenant_id,provider,event_type,external_id,payload,created_at,source_connection_id) VALUES(?,?,?,?,?,?,?,?)').run(id('evt'),connection.tenant_id,'zalo',normalized.type,normalized.externalEventId,JSON.stringify(normalized),Date.now(),connection.id);upsertSocialCustomer(db,connection.tenant_id,'zalo',normalized)}
    res.sendStatus(200)
  })
  app.post('/webhooks/meta', async(req, res) => {
    if(config.metaAppSecret){
      const received=String(req.headers['x-hub-signature-256']||'').replace(/^sha256=/,'')
      const expected=crypto.createHmac('sha256',config.metaAppSecret).update(req.rawBody||Buffer.alloc(0)).digest('hex')
      const a=Buffer.from(received,'hex'),b=Buffer.from(expected,'hex')
      if(!received||a.length!==b.length||!crypto.timingSafeEqual(a,b))return res.status(401).json({error:'Chữ ký webhook Meta không hợp lệ'})
    }
    const entries=Array.isArray(req.body?.entry)?req.body.entry:[]
    const insert=db.prepare('INSERT OR IGNORE INTO sync_events(id,tenant_id,provider,event_type,external_id,payload,created_at,source_connection_id) VALUES(?,?,?,?,?,?,?,?)')
    for(const entry of entries){
      const connections=db.prepare("SELECT id,tenant_id,provider,encrypted_token FROM channel_connections WHERE provider IN ('facebook','instagram') AND external_id=?").all(String(entry.id))
      for(const connection of connections)for(const normalized of channelAdapters[connection.provider].normalizeEntry(entry)){try{const token=decryptSecret(connection.encrypted_token,config.encryptionSecret),profileUrl=new URL(`https://graph.facebook.com/${config.metaGraphVersion}/${normalized.senderId}`);profileUrl.search=new URLSearchParams({fields:'name,first_name,last_name,profile_pic',access_token:token}).toString();const profileResponse=await config.fetchImpl(profileUrl);const profile=await profileResponse.json();if(profileResponse.ok&&profile.name){normalized.senderName=String(profile.name);normalized.profilePic=String(profile.profile_pic||'')}}catch{}upsertSocialCustomer(db,connection.tenant_id,connection.provider,normalized);insert.run(id('evt'),connection.tenant_id,connection.provider,normalized.type,normalized.externalEventId,JSON.stringify(normalized),Date.now(),connection.id)}
    }
    res.sendStatus(200)
  })
  app.post('/api/oauth/meta/start', authenticate, ownerOnly, (req, res) => {
    if(!config.metaAppId || !config.metaAppSecret)return res.status(503).json({error:'META_APP_ID và META_APP_SECRET chưa được cấu hình'})
    if(config.production && !config.publicUrl.startsWith('https://'))return res.status(503).json({error:'OAuth Meta yêu cầu BOT68_PUBLIC_URL dùng HTTPS'})
    const flowId=id('oauth'),state=crypto.randomBytes(32).toString('base64url'),now=Date.now()
    const stateHash=crypto.createHash('sha256').update(state).digest('hex')
    db.prepare('INSERT INTO oauth_flows(id,tenant_id,user_id,provider,state_hash,created_at,expires_at) VALUES(?,?,?,?,?,?,?)').run(flowId,req.session.tenantId,req.session.userId,'meta',stateHash,now,now+10*60*1000)
    const redirectUri=config.metaRedirectUri||`${config.publicUrl}/oauth/meta/callback`
    const params=new URLSearchParams({client_id:config.metaAppId,redirect_uri:redirectUri,state,response_type:'code',scope:'pages_show_list,pages_manage_metadata,pages_messaging,pages_read_engagement,business_management,instagram_basic,instagram_manage_messages'})
    res.json({flowId,authorizeUrl:`https://www.facebook.com/${config.metaGraphVersion}/dialog/oauth?${params}`})
  })
  app.get('/oauth/meta/callback', async(req,res)=>{
    const stateHash=crypto.createHash('sha256').update(String(req.query.state||'')).digest('hex')
    const flow=db.prepare("SELECT * FROM oauth_flows WHERE state_hash=? AND status='pending'").get(stateHash)
    if(!flow || flow.expires_at<Date.now())return res.status(400).type('html').send(oauthHtml(false,'Phiên kết nối đã hết hạn. Hãy quay lại BOT 68 và thử lại.'))
    if(req.query.error){db.prepare("UPDATE oauth_flows SET status='failed',error=? WHERE id=?").run(String(req.query.error_description||req.query.error),flow.id);return res.status(400).type('html').send(oauthHtml(false,'Facebook không cấp quyền cho BOT 68.'))}
    try{
      const redirectUri=config.metaRedirectUri||`${config.publicUrl}/oauth/meta/callback`
      const tokenUrl=new URL(`https://graph.facebook.com/${config.metaGraphVersion}/oauth/access_token`)
      tokenUrl.search=new URLSearchParams({client_id:config.metaAppId,client_secret:config.metaAppSecret,redirect_uri:redirectUri,code:String(req.query.code||'')}).toString()
      const tokenResponse=await config.fetchImpl(tokenUrl);const tokenBody=await tokenResponse.json()
      if(!tokenResponse.ok||!tokenBody.access_token)throw new Error(tokenBody.error?.message||'Không đổi được mã đăng nhập Meta')
      const longUrl=new URL(`https://graph.facebook.com/${config.metaGraphVersion}/oauth/access_token`)
      longUrl.search=new URLSearchParams({grant_type:'fb_exchange_token',client_id:config.metaAppId,client_secret:config.metaAppSecret,fb_exchange_token:tokenBody.access_token}).toString()
      const longResponse=await config.fetchImpl(longUrl);const longBody=await longResponse.json();const userToken=longResponse.ok&&longBody.access_token?longBody.access_token:tokenBody.access_token
      const accountsUrl=new URL(`https://graph.facebook.com/${config.metaGraphVersion}/me/accounts`)
      accountsUrl.search=new URLSearchParams({fields:'id,name,access_token,instagram_business_account{id,username,name}',limit:'100',access_token:userToken}).toString()
      const accountsResponse=await config.fetchImpl(accountsUrl);const accountsBody=await accountsResponse.json()
      if(!accountsResponse.ok)throw new Error(accountsBody.error?.message||'Không lấy được danh sách Fanpage')
      const insert=db.prepare('INSERT INTO oauth_assets(id,flow_id,tenant_id,provider,external_id,display_name,encrypted_token,parent_external_id,metadata) VALUES(?,?,?,?,?,?,?,?,?)')
      db.exec('BEGIN');try{for(const page of accountsBody.data||[]){const pageToken=page.access_token||userToken;insert.run(id('asset'),flow.id,flow.tenant_id,'facebook',String(page.id),String(page.name||page.id),encryptSecret(pageToken,config.encryptionSecret),null,'{}');if(page.instagram_business_account){const ig=page.instagram_business_account;insert.run(id('asset'),flow.id,flow.tenant_id,'instagram',String(ig.id),String(ig.username||ig.name||ig.id),encryptSecret(pageToken,config.encryptionSecret),String(page.id),JSON.stringify({pageId:String(page.id),pageName:String(page.name||'')}))}}db.prepare("UPDATE oauth_flows SET status='ready' WHERE id=?").run(flow.id);db.exec('COMMIT')}catch(error){db.exec('ROLLBACK');throw error}
      res.type('html').send(oauthHtml(true,'Đã xác thực thành công. Hãy quay lại ứng dụng BOT 68 để chọn Fanpage và Instagram.'))
    }catch(error){db.prepare("UPDATE oauth_flows SET status='failed',error=? WHERE id=?").run(error.message,flow.id);res.status(502).type('html').send(oauthHtml(false,`Không thể hoàn tất kết nối: ${escapeHtml(error.message)}`))}
  })
  app.get('/api/oauth/meta/status/:flowId',authenticate,ownerOnly,(req,res)=>{
    const flow=db.prepare('SELECT id,status,error,expires_at FROM oauth_flows WHERE id=? AND tenant_id=? AND user_id=?').get(req.params.flowId,req.session.tenantId,req.session.userId)
    if(!flow)return res.sendStatus(404)
    const assets=flow.status==='ready'?db.prepare('SELECT id,provider,external_id,display_name,parent_external_id,metadata FROM oauth_assets WHERE flow_id=? AND tenant_id=?').all(flow.id,req.session.tenantId).map(row=>({id:row.id,provider:row.provider,externalId:row.external_id,displayName:row.display_name,parentExternalId:row.parent_external_id,metadata:JSON.parse(row.metadata)})):[]
    res.json({status:flow.expires_at<Date.now()&&flow.status==='pending'?'expired':flow.status,error:flow.error,assets})
  })
  app.post('/api/oauth/meta/complete',authenticate,ownerOnly,async(req,res)=>{
    const selected=Array.isArray(req.body?.assetIds)?req.body.assetIds.slice(0,200):[]
    const flow=db.prepare("SELECT * FROM oauth_flows WHERE id=? AND tenant_id=? AND user_id=? AND status='ready'").get(req.body?.flowId,req.session.tenantId,req.session.userId)
    if(!flow)return res.status(404).json({error:'Không tìm thấy phiên kết nối sẵn sàng'})
    const getAsset=db.prepare('SELECT * FROM oauth_assets WHERE id=? AND flow_id=? AND tenant_id=?'),upsert=db.prepare("INSERT INTO channel_connections(id,tenant_id,provider,external_id,display_name,encrypted_token,status,created_at) VALUES(?,?,?,?,?,?,'active',?) ON CONFLICT(tenant_id,provider,external_id) DO UPDATE SET display_name=excluded.display_name,encrypted_token=excluded.encrypted_token,status='active'")
    let connected=0;const facebookAssets=[];db.exec('BEGIN');try{for(const assetId of selected){const asset=getAsset.get(assetId,flow.id,req.session.tenantId);if(asset){upsert.run(id('chn'),req.session.tenantId,asset.provider,asset.external_id,asset.display_name,asset.encrypted_token,Date.now());if(asset.provider==='facebook')facebookAssets.push(asset);connected++}}db.prepare("UPDATE oauth_flows SET status='completed' WHERE id=?").run(flow.id);db.exec('COMMIT')}catch(error){db.exec('ROLLBACK');throw error}
    let subscribed=0;const subscriptionErrors=[]
    for(const asset of facebookAssets){try{const url=new URL(`https://graph.facebook.com/${config.metaGraphVersion}/${asset.external_id}/subscribed_apps`);url.search=new URLSearchParams({subscribed_fields:'messages,message_deliveries,message_reads,message_echoes,messaging_postbacks,messaging_optins,messaging_referrals,feed',access_token:decryptSecret(asset.encrypted_token,config.encryptionSecret)}).toString();const response=await config.fetchImpl(url,{method:'POST'});const body=await response.json();if(!response.ok||body.success!==true)throw new Error(body.error?.message||'Meta khong chap nhan dang ky webhook');subscribed++}catch(error){subscriptionErrors.push({page:asset.display_name,error:error.message})}}
    res.json({ok:true,connected,subscribed,subscriptionErrors})
  })
  app.post('/api/messages/send',authenticate,async(req,res,next)=>{
    try{
      const connection=db.prepare("SELECT * FROM channel_connections WHERE id=? AND tenant_id=? AND status='active'").get(req.body?.connectionId,req.session.tenantId)
      if(!connection)return res.status(404).json({error:'Không tìm thấy kênh gửi'})
      const text=String(req.body?.text||'').trim(),recipientId=String(req.body?.recipientId||'').trim();if(!text||text.length>4000||!recipientId)return res.status(400).json({error:'Nội dung hoặc người nhận không hợp lệ'})
      const adapter=channelAdapters[connection.provider];if(!adapter?.sendText)return res.status(501).json({error:`Kênh ${connection.provider} chưa hỗ trợ gửi tin`})
      const token=decryptSecret(connection.encrypted_token,config.encryptionSecret),result=await adapter.sendText({token,recipientId,text,accountId:connection.external_id,graphVersion:config.metaGraphVersion,fetchImpl:config.fetchImpl})
      recordStaffActivity(db,req.session,connection,recipientId,'message')
      res.json({ok:true,provider:connection.provider,...result})
    }catch(error){next(error)}
  })
  app.post('/api/messages/send-image',authenticate,async(req,res,next)=>{try{const connection=db.prepare("SELECT * FROM channel_connections WHERE id=? AND tenant_id=? AND status='active'").get(req.body?.connectionId,req.session.tenantId);if(!connection)return res.status(404).json({error:'Không tìm thấy kênh gửi'});const recipientId=String(req.body?.recipientId||'').trim();if(!recipientId)return res.status(400).json({error:'Thiếu người nhận'});const adapter=channelAdapters[connection.provider];if(!adapter?.sendImage)return res.status(501).json({error:`Kênh ${connection.provider} chưa hỗ trợ gửi ảnh`});let imageUrl=String(req.body?.imageUrl||''),data,mimeType=String(req.body?.mimeType||'image/jpeg'),filename=String(req.body?.name||'image.jpg');if(req.body?.dataUrl){const parsed=parseDataImage(req.body.dataUrl);data=parsed.data;mimeType=parsed.mimeType}if(!data&&!/^https:\/\//.test(imageUrl))return res.status(400).json({error:'Ảnh gửi không hợp lệ'});const token=decryptSecret(connection.encrypted_token,config.encryptionSecret),result=await adapter.sendImage({token,recipientId,imageUrl,data,mimeType,filename,accountId:connection.external_id,graphVersion:config.metaGraphVersion,fetchImpl:config.fetchImpl});recordStaffActivity(db,req.session,connection,recipientId,'image');res.json({ok:true,provider:connection.provider,...result})}catch(error){next(error)}})
  app.use((error,_,res,next)=>{ if(res.headersSent)return next(error);res.status(500).json({error:config.production&&!error?.expose?'Lỗi máy chủ':error.message}) })
  return app
}

function escapeHtml(value){return String(value).replace(/[&<>"']/g,char=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]))}
function oauthHtml(ok,message){return `<!doctype html><html lang="vi"><meta charset="utf-8"><meta name="viewport" content="width=device-width"><title>BOT 68</title><body style="margin:0;background:#08111f;color:#e9eef6;font:16px system-ui;display:grid;place-items:center;height:100vh"><main style="max-width:520px;text-align:center;padding:40px;border:1px solid #24344a;border-radius:18px;background:#0e1a2a"><div style="font-size:48px">${ok?'✓':'!'}</div><h1 style="color:${ok?'#48d795':'#ff7650'}">${ok?'Kết nối thành công':'Kết nối chưa hoàn tất'}</h1><p style="color:#9aa8ba;line-height:1.6">${message}</p><b>Bạn có thể đóng cửa sổ này.</b></main></body></html>`}
function publicKnowledge(row){return {id:row.id,title:row.title,content:row.content,tags:JSON.parse(row.tags||'[]'),enabled:Boolean(row.enabled),createdAt:row.created_at,updatedAt:row.updated_at}}
function publicCustomer(row){return {id:row.id,name:row.name,phone:row.phone,address:row.address||'',email:row.email,channel:row.channel,externalId:row.external_id,tags:JSON.parse(row.tags||'[]'),note:row.note,createdAt:row.created_at,updatedAt:row.updated_at}}
function publicProduct(row){return {id:row.id,sku:row.sku,name:row.name,price:row.price,stock:row.stock,status:row.status,createdAt:row.created_at,updatedAt:row.updated_at}}
function publicOrder(row,items=[]){return {id:row.id,customerId:row.customer_id,customerName:row.customer_name||'',code:row.code,total:row.total,status:row.status,note:row.note,createdAt:row.created_at,updatedAt:row.updated_at,items:items.map(item=>({id:item.id,productId:item.product_id,name:item.name,quantity:item.quantity,unitPrice:item.unit_price}))}}
function nonNegative(value){const number=Number(value);if(!Number.isFinite(number)||number<0)throw new Error('Giá trị số không hợp lệ');return Math.round(number)}
function parseDataImage(value){const match=String(value||'').match(/^data:(image\/(?:jpeg|png|webp|gif));base64,([A-Za-z0-9+/=]+)$/);if(!match)throw new Error('Chỉ hỗ trợ ảnh JPG, PNG, WEBP hoặc GIF');const data=Buffer.from(match[2],'base64');if(!data.length||data.length>8*1024*1024)throw new Error('Ảnh phải nhỏ hơn 8 MB');return {mimeType:match[1],data}}
function recordStaffActivity(db,session,connection,recipientId,activityType){db.prepare('INSERT INTO staff_activity(id,tenant_id,user_id,connection_id,provider,activity_type,customer_key,created_at) VALUES(?,?,?,?,?,?,?,?)').run(id('act'),session.tenantId,session.userId,connection.id,connection.provider,String(activityType),`${connection.provider}:${recipientId}`,Date.now())}
function reportRange(period){const now=new Date(),end=Date.now(),start=new Date(now),previous=new Date(now);if(period==='week'){const day=(now.getDay()+6)%7;start.setDate(now.getDate()-day);start.setHours(0,0,0,0);previous.setTime(start.getTime());previous.setDate(previous.getDate()-7)}else if(period==='month'){start.setDate(1);start.setHours(0,0,0,0);previous.setTime(start.getTime());previous.setMonth(previous.getMonth()-1)}else{start.setHours(0,0,0,0);previous.setTime(start.getTime());previous.setDate(previous.getDate()-1)}return {start:start.getTime(),end,previousStart:previous.getTime()}}
function changePercent(current,previous){current=Number(current);previous=Number(previous);if(!previous)return current?100:0;return Math.round((current-previous)*1000/previous)/10}
function normalizeOrderItems(value){if(!Array.isArray(value)||!value.length)throw new Error('Đơn hàng phải có ít nhất một sản phẩm');return value.slice(0,100).map(item=>{const name=String(item?.name||'').trim(),quantity=nonNegative(item?.quantity),unitPrice=nonNegative(item?.unitPrice);if(!name||quantity<1)throw new Error('Dòng sản phẩm không hợp lệ');return {productId:item.productId||null,name,quantity,unitPrice}})}
function upsertSocialCustomer(db,tenantId,channel,event){if(event?.type!=='message'||!event.senderId)return;const now=Date.now(),externalId=String(event.senderId),name=String(event.senderName||`${channel} ${externalId}`),info=extractContactInfo(event.text);event.detectedPhone=info.phone;event.detectedAddress=info.address;db.prepare("INSERT INTO customers(id,tenant_id,name,phone,address,channel,external_id,tags,created_at,updated_at) VALUES(?,?,?,?,?,?,?,'[\"Khách mạng xã hội\"]',?,?) ON CONFLICT(tenant_id,channel,external_id) WHERE external_id IS NOT NULL AND external_id <> '' DO UPDATE SET name=excluded.name,phone=CASE WHEN excluded.phone<>'' THEN excluded.phone ELSE customers.phone END,address=CASE WHEN excluded.address<>'' THEN excluded.address ELSE customers.address END,updated_at=excluded.updated_at").run(id('cus'),tenantId,name,info.phone,info.address,channel,externalId,now,now)}
function extractContactInfo(text){const value=String(text||'').trim();let phone='';for(const match of value.matchAll(/(?:\+?84|0)(?:[\s.\-]*\d){8,10}/g)){const raw=match[0].replace(/[^\d+]/g,''),normalized=raw.startsWith('+84')?'0'+raw.slice(3):raw.startsWith('84')?'0'+raw.slice(2):raw;if(/^0\d{9,10}$/.test(normalized)){phone=normalized;break}}const addressMatch=value.match(/(?:địa chỉ|dia chi|đ\/c|\bdc\b|giao\s+(?:tới|đến)|ship\s+(?:tới|đến|về))\s*[:\-]?\s*(.{8,200})/iu),address=addressMatch?addressMatch[1].trim().replace(/\s+/g,' '):'';return {phone,address}}
function limitedArray(value,max){if(!Array.isArray(value))return [];if(value.length>max)throw new Error(`Gói sao lưu vượt giới hạn ${max} bản ghi`);return value}
