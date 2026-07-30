import assert from 'node:assert/strict'
import crypto from 'node:crypto'
import { after, before, test } from 'node:test'
import { createApp } from './app.mjs'
import { loadConfig } from './config.mjs'

let server, base, app, telegramWebhookSecret
before(async()=>{
  const metaFetch=async (url,request={})=>{
    const parsed=new URL(url)
    if(parsed.pathname.endsWith('/getMe'))return new Response(JSON.stringify({ok:true,result:{id:680068,username:'bot68_demo_bot',first_name:'BOT 68 Demo',can_join_groups:true}}),{status:200,headers:{'content-type':'application/json'}})
    if(parsed.pathname.endsWith('/setWebhook')){telegramWebhookSecret=JSON.parse(request?.body||'{}').secret_token;return new Response(JSON.stringify({ok:true,result:true}),{status:200,headers:{'content-type':'application/json'}})}
    if(parsed.pathname.endsWith('/sendMessage'))return new Response(JSON.stringify({ok:true,result:{message_id:868,date:Math.floor(Date.now()/1000),chat:{id:6800},text:'Tin nhắn thử'}}),{status:200,headers:{'content-type':'application/json'}})
    if(parsed.pathname==='/v3.0/oa/getoa')return new Response(JSON.stringify({error:0,message:'Success',data:{oa_id:'zalo-oa-68',name:'Zalo OA BOT 68',avatar:'https://example.com/oa.png'}}),{status:200,headers:{'content-type':'application/json'}})
    if(parsed.pathname==='/v3.0/oa/message/cs')return new Response(JSON.stringify({error:0,message:'Success',data:{message_id:'zalo-message-68'}}),{status:200,headers:{'content-type':'application/json'}})
    if(parsed.pathname.endsWith('/oauth/access_token'))return new Response(JSON.stringify({access_token:parsed.searchParams.has('fb_exchange_token')?'long-user-token':'short-user-token'}),{status:200,headers:{'content-type':'application/json'}})
    if(parsed.pathname.endsWith('/me/accounts'))return new Response(JSON.stringify({data:[{id:'page-68',name:'BOT 68 Page',access_token:'page-token-68',instagram_business_account:{id:'ig-68',username:'bot68.official'}}]}),{status:200,headers:{'content-type':'application/json'}})
    if(parsed.pathname.endsWith('/page-68/messages'))return new Response(JSON.stringify({recipient_id:'customer-1',message_id:'meta-out-68'}),{status:200,headers:{'content-type':'application/json'}})
    return new Response(JSON.stringify({error:{message:'unexpected mock URL'}}),{status:404,headers:{'content-type':'application/json'}})
  }
  app=createApp(loadConfig({databasePath:':memory:',authSecret:'test-auth-secret',encryptionSecret:'test-encryption-secret',metaAppId:'meta-app-68',metaAppSecret:'meta-secret-68',publicUrl:'http://127.0.0.1:6868',fetchImpl:metaFetch}))
  await new Promise(resolve=>{server=app.listen(0,'127.0.0.1',resolve)})
  base=`http://127.0.0.1:${server.address().port}`
})
after(async()=>{await new Promise(resolve=>server.close(resolve));app.locals.db.close()})
async function request(path,options={}){const response=await fetch(base+path,{...options,headers:{'content-type':'application/json',...options.headers}});const text=await response.text();const isJson=response.headers.get('content-type')?.includes('application/json');return {status:response.status,body:text?(isJson?JSON.parse(text):text):null}}
async function register(n){return request('/api/auth/register',{method:'POST',body:JSON.stringify({businessName:`Cửa hàng ${n}`,name:`Chủ ${n}`,email:`owner${n}@example.com`,password:'matkhau68'})})}

test('health reports sqlite server',async()=>{const r=await request('/health');assert.equal(r.status,200);assert.equal(r.body.database,'sqlite')})
test('registration, login and current tenant work',async()=>{const created=await register(1);assert.equal(created.status,201);assert.equal(created.body.user.role,'owner');const login=await request('/api/auth/login',{method:'POST',body:JSON.stringify({email:'owner1@example.com',password:'matkhau68'})});assert.equal(login.status,200);const me=await request('/api/me',{headers:{authorization:`Bearer ${login.body.token}`}});assert.equal(me.body.tenant.name,'Cửa hàng 1')})
test('account owner can securely change password',async()=>{const owner=await register(101),auth={authorization:`Bearer ${owner.body.token}`};const wrong=await request('/api/me/password',{method:'PATCH',headers:auth,body:JSON.stringify({currentPassword:'sai-mat-khau',newPassword:'matkhau-moi-68'})});assert.equal(wrong.status,400);const changed=await request('/api/me/password',{method:'PATCH',headers:auth,body:JSON.stringify({currentPassword:'matkhau68',newPassword:'matkhau-moi-68'})});assert.equal(changed.status,200);const oldLogin=await request('/api/auth/login',{method:'POST',body:JSON.stringify({email:'owner101@example.com',password:'matkhau68'})});assert.equal(oldLogin.status,401);const newLogin=await request('/api/auth/login',{method:'POST',body:JSON.stringify({email:'owner101@example.com',password:'matkhau-moi-68'})});assert.equal(newLogin.status,200)})
test('tenant data is isolated and channel token is never returned',async()=>{
  const a=await register(2),b=await register(3)
  const channel=await request('/api/channels',{method:'POST',headers:{authorization:`Bearer ${a.body.token}`},body:JSON.stringify({provider:'facebook',externalId:'page-68',displayName:'Page A',accessToken:'top-secret-token'})})
  assert.equal(channel.status,201);assert.equal(JSON.stringify(channel.body).includes('top-secret-token'),false)
  const own=await request('/api/channels',{headers:{authorization:`Bearer ${a.body.token}`}}),other=await request('/api/channels',{headers:{authorization:`Bearer ${b.body.token}`}})
  assert.equal(own.body.length,1);assert.equal(other.body.length,0)
  const hidden=await request(`/api/channels/${channel.body.id}/verify-secret`,{headers:{authorization:`Bearer ${b.body.token}`}});assert.equal(hidden.status,404)
})
test('invalid session and weak passwords are rejected',async()=>{const unauthorized=await request('/api/me',{headers:{authorization:'Bearer invalid'}});assert.equal(unauthorized.status,401);const weak=await request('/api/auth/register',{method:'POST',body:JSON.stringify({businessName:'Weak',name:'A',email:'weak@example.com',password:'123'})});assert.equal(weak.status,400)})
test('web media library stores, lists and removes tenant images',async()=>{const owner=await register(68),auth={authorization:`Bearer ${owner.body.token}`},dataUrl='data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=';const uploaded=await request('/api/media/library',{method:'POST',headers:auth,body:JSON.stringify({name:'ao-mau.png',dataUrl})});assert.equal(uploaded.status,201);assert.ok(uploaded.body.url.includes('/media/library/'));const listed=await request('/api/media/library',{headers:auth});assert.equal(listed.body.length,1);assert.equal(listed.body[0].name,'ao-mau.png');const removed=await request(`/api/media/library/${uploaded.body.id}`,{method:'DELETE',headers:auth});assert.equal(removed.status,204);const empty=await request('/api/media/library',{headers:auth});assert.equal(empty.body.length,0)})
test('Meta OAuth discovers Facebook and Instagram assets then connects selected channels',async()=>{
  const owner=await register(4),auth={authorization:`Bearer ${owner.body.token}`}
  const start=await request('/api/oauth/meta/start',{method:'POST',headers:auth,body:'{}'});assert.equal(start.status,200)
  const authorizeUrl=new URL(start.body.authorizeUrl);assert.equal(authorizeUrl.hostname,'www.facebook.com');assert.ok(authorizeUrl.searchParams.get('scope').includes('instagram_manage_messages'))
  const callback=await fetch(`${base}/oauth/meta/callback?code=meta-code&state=${encodeURIComponent(authorizeUrl.searchParams.get('state'))}`);assert.equal(callback.status,200);assert.ok((await callback.text()).includes('Kết nối thành công'))
  const status=await request(`/api/oauth/meta/status/${start.body.flowId}`,{headers:auth});assert.equal(status.body.status,'ready');assert.deepEqual(status.body.assets.map(a=>a.provider).sort(),['facebook','instagram'])
  const complete=await request('/api/oauth/meta/complete',{method:'POST',headers:auth,body:JSON.stringify({flowId:start.body.flowId,assetIds:status.body.assets.map(a=>a.id)})});assert.equal(complete.body.connected,2)
  const channels=await request('/api/channels',{headers:auth});assert.equal(channels.body.length,2);assert.equal(JSON.stringify(channels.body).includes('page-token-68'),false)
  const webhookBody=JSON.stringify({object:'page',entry:[{id:'page-68',time:Date.now(),messaging:[{sender:{id:'customer-1'},message:{mid:'m-68',text:'Xin chào BOT 68'}}]}]})
  const invalid=await fetch(`${base}/webhooks/meta`,{method:'POST',headers:{'content-type':'application/json','x-hub-signature-256':'sha256=bad'},body:webhookBody});assert.equal(invalid.status,401)
  const signature=crypto.createHmac('sha256','meta-secret-68').update(webhookBody).digest('hex')
  const accepted=await fetch(`${base}/webhooks/meta`,{method:'POST',headers:{'content-type':'application/json','x-hub-signature-256':`sha256=${signature}`},body:webhookBody});assert.equal(accepted.status,200)
  const events=await request('/api/sync/events',{headers:auth});assert.equal(events.body.length,1);assert.equal(events.body[0].provider,'facebook')
  assert.equal(events.body[0].payload.text,'Xin chào BOT 68');assert.equal(events.body[0].payload.conversationId,'customer-1')
  const crm=await request('/api/customers',{headers:auth});assert.equal(crm.body.length,1);assert.equal(crm.body[0].externalId,'customer-1')
  const facebookChannel=channels.body.find(channel=>channel.provider==='facebook'),sent=await request('/api/messages/send',{method:'POST',headers:auth,body:JSON.stringify({connectionId:facebookChannel.id,recipientId:'customer-1',text:'BOT 68 trả lời Meta'})});assert.equal(sent.status,200);assert.equal(sent.body.externalMessageId,'meta-out-68')
  const performance=await request('/api/reports/staff-performance?period=day',{headers:auth});assert.equal(performance.status,200);assert.equal(performance.body.canViewTeam,true);assert.equal(performance.body.totals.messages,1);assert.equal(performance.body.totals.customers,1);assert.equal(performance.body.rows[0].messages,1)
})
test('Telegram adapter verifies bot, protects webhook, deduplicates updates and sends text',async()=>{
  const owner=await register(5),auth={authorization:`Bearer ${owner.body.token}`},token='680068:abcdefghijklmnopqrstuvwxyz_123456789'
  const connected=await request('/api/channels/telegram/connect',{method:'POST',headers:auth,body:JSON.stringify({token})});assert.equal(connected.status,201);assert.equal(connected.body.displayName,'@bot68_demo_bot');assert.ok(telegramWebhookSecret)
  const update=JSON.stringify({update_id:68001,message:{message_id:91,date:Math.floor(Date.now()/1000),chat:{id:12345},from:{id:12345,first_name:'Khách'},text:'Xin chào từ Telegram'}})
  const denied=await fetch(`${base}/webhooks/telegram/${connected.body.id}`,{method:'POST',headers:{'content-type':'application/json','x-telegram-bot-api-secret-token':'wrong'},body:update});assert.equal(denied.status,401)
  for(let i=0;i<2;i++){const accepted=await fetch(`${base}/webhooks/telegram/${connected.body.id}`,{method:'POST',headers:{'content-type':'application/json','x-telegram-bot-api-secret-token':telegramWebhookSecret},body:update});assert.equal(accepted.status,200)}
  const events=await request('/api/sync/events',{headers:auth});assert.equal(events.body.length,1);assert.equal(events.body[0].payload.text,'Xin chào từ Telegram');assert.equal(events.body[0].payload.conversationId,'12345')
  const crm=await request('/api/customers',{headers:auth});assert.equal(crm.body[0].name,'Khách');assert.equal(crm.body[0].channel,'telegram')
  const sent=await request('/api/messages/send',{method:'POST',headers:auth,body:JSON.stringify({connectionId:connected.body.id,recipientId:'12345',text:'BOT 68 xin chào'})});assert.equal(sent.status,200);assert.equal(sent.body.externalMessageId,'868')
})
test('Zalo OA adapter verifies OA, protects webhook, normalizes events and sends text',async()=>{
  const owner=await register(6),auth={authorization:`Bearer ${owner.body.token}`},token='zalo-access-token-abcdefghijklmnopqrstuvwxyz'
  const connected=await request('/api/channels/zalo/connect',{method:'POST',headers:auth,body:JSON.stringify({token})});assert.equal(connected.status,201);assert.equal(connected.body.displayName,'Zalo OA BOT 68');assert.equal(connected.body.requiresManualWebhookSetup,true)
  const event=JSON.stringify({event_name:'user_send_text',timestamp:Date.now(),sender:{id:'zalo-user-68',name:'Khách Zalo'},recipient:{id:'zalo-oa-68'},message:{msg_id:'zalo-in-68',text:'Xin chào từ Zalo'}})
  const validUrl=new URL(connected.body.webhookUrl),invalidPath=validUrl.pathname.replace(/[^/]+$/,'wrong-secret')
  const denied=await fetch(base+invalidPath,{method:'POST',headers:{'content-type':'application/json'},body:event});assert.equal(denied.status,401)
  for(let i=0;i<2;i++){const accepted=await fetch(base+validUrl.pathname,{method:'POST',headers:{'content-type':'application/json'},body:event});assert.equal(accepted.status,200)}
  const events=await request('/api/sync/events',{headers:auth});assert.equal(events.body.length,1);assert.equal(events.body[0].provider,'zalo');assert.equal(events.body[0].payload.senderName,'Khách Zalo')
  const crm=await request('/api/customers',{headers:auth});assert.equal(crm.body[0].externalId,'zalo-user-68')
  const sent=await request('/api/messages/send',{method:'POST',headers:auth,body:JSON.stringify({connectionId:connected.body.id,recipientId:'zalo-user-68',text:'BOT 68 trả lời Zalo'})});assert.equal(sent.status,200);assert.equal(sent.body.externalMessageId,'zalo-message-68')
})
test('tenant AI knowledge is isolated and produces grounded reviewable suggestions',async()=>{
  const a=await register(7),b=await register(8),authA={authorization:`Bearer ${a.body.token}`},authB={authorization:`Bearer ${b.body.token}`}
  const profile=await request('/api/ai-profile',{method:'PATCH',headers:authA,body:JSON.stringify({tone:'thân thiện',instructions:'Xưng shop và gọi tên khách.',safetyMode:'suggest'})});assert.equal(profile.status,200)
  const document=await request('/api/ai/knowledge',{method:'POST',headers:authA,body:JSON.stringify({title:'Chính sách đổi trả áo',content:'Sản phẩm áo được đổi size trong vòng 7 ngày nếu còn nguyên tem và chưa qua sử dụng.',tags:['đổi trả','áo']})});assert.equal(document.status,201)
  const own=await request('/api/ai/knowledge',{headers:authA}),other=await request('/api/ai/knowledge',{headers:authB});assert.equal(own.body.length,1);assert.equal(other.body.length,0)
  const suggestion=await request('/api/ai/suggest',{method:'POST',headers:authA,body:JSON.stringify({customerName:'Lan',question:'Áo có được đổi size không?',messages:[{from:'customer',text:'Mình mặc không vừa'}]})});assert.equal(suggestion.status,200);assert.equal(suggestion.body.provider,'local-fallback');assert.equal(suggestion.body.requiresReview,true);assert.deepEqual(suggestion.body.sourceIds,[document.body.id]);assert.ok(suggestion.body.draft.includes('7 ngày'))
  const noLeak=await request('/api/ai/suggest',{method:'POST',headers:authB,body:JSON.stringify({question:'Áo đổi size thế nào?'})});assert.equal(noLeak.body.sourceIds.length,0);assert.equal(noLeak.body.draft.includes('7 ngày'),false)
})
test('CRM, inventory, orders, team and reports are tenant isolated',async()=>{
  const a=await register(9),b=await register(10),authA={authorization:`Bearer ${a.body.token}`},authB={authorization:`Bearer ${b.body.token}`}
  const customer=await request('/api/customers',{method:'POST',headers:authA,body:JSON.stringify({name:'Khách hàng A',phone:'0901686868',channel:'facebook',tags:['VIP']})});assert.equal(customer.status,201)
  const product=await request('/api/products',{method:'POST',headers:authA,body:JSON.stringify({sku:'AO-68',name:'Áo BOT 68',price:250000,stock:12})});assert.equal(product.status,201)
  const order=await request('/api/orders',{method:'POST',headers:authA,body:JSON.stringify({customerId:customer.body.id,status:'confirmed',items:[{productId:product.body.id,name:product.body.name,quantity:2,unitPrice:product.body.price}]})});assert.equal(order.status,201);assert.equal(order.body.total,500000)
  const completed=await request(`/api/orders/${order.body.id}`,{method:'PATCH',headers:authA,body:JSON.stringify({status:'completed'})});assert.equal(completed.body.status,'completed')
  const member=await request('/api/team',{method:'POST',headers:authA,body:JSON.stringify({name:'Nhân viên A',email:'agent-a@example.com',password:'nhanvien68',role:'agent'})});assert.equal(member.status,201);assert.equal(member.body.role,'agent')
  const agentLogin=await request('/api/auth/login',{method:'POST',body:JSON.stringify({email:'agent-a@example.com',password:'nhanvien68'})}),agentAuth={authorization:`Bearer ${agentLogin.body.token}`};assert.equal(agentLogin.status,200);const hiddenTeam=await request('/api/team',{headers:agentAuth});assert.equal(hiddenTeam.status,403)
  const revoked=await request(`/api/team/${member.body.id}`,{method:'PATCH',headers:authA,body:JSON.stringify({active:false})});assert.equal(revoked.status,200);assert.equal(revoked.body.active,false);const revokedSession=await request('/api/me',{headers:agentAuth});assert.equal(revokedSession.status,401);const revokedLogin=await request('/api/auth/login',{method:'POST',body:JSON.stringify({email:'agent-a@example.com',password:'nhanvien68'})});assert.equal(revokedLogin.status,403)
  const restored=await request(`/api/team/${member.body.id}`,{method:'PATCH',headers:authA,body:JSON.stringify({active:true})});assert.equal(restored.body.active,true);const restoredLogin=await request('/api/auth/login',{method:'POST',body:JSON.stringify({email:'agent-a@example.com',password:'nhanvien68'})});assert.equal(restoredLogin.status,200)
  const summary=await request('/api/reports/summary',{headers:authA});assert.deepEqual({customers:summary.body.customers,products:summary.body.products,orders:summary.body.orders,team:summary.body.team,revenue:summary.body.revenue},{customers:1,products:1,orders:1,team:2,revenue:500000})
  for(const endpoint of ['/api/customers','/api/products','/api/orders']){const hidden=await request(endpoint,{headers:authB});assert.equal(hidden.body.length,0)}
  const crossOrder=await request('/api/orders',{method:'POST',headers:authB,body:JSON.stringify({customerId:customer.body.id,items:[{productId:product.body.id,name:'Không hợp lệ',quantity:1,unitPrice:1}]})});assert.equal(crossOrder.status,400)
  const crossEdit=await request(`/api/products/${product.body.id}`,{method:'PATCH',headers:authB,body:JSON.stringify({stock:999})});assert.equal(crossEdit.status,404)
})
test('tenant backup exports safe business data and restores into another tenant',async()=>{
  const source=await register(11),target=await register(12),authSource={authorization:`Bearer ${source.body.token}`},authTarget={authorization:`Bearer ${target.body.token}`}
  const customer=await request('/api/customers',{method:'POST',headers:authSource,body:JSON.stringify({name:'Khách sao lưu',phone:'0911686868',tags:['Sao lưu']})})
  const product=await request('/api/products',{method:'POST',headers:authSource,body:JSON.stringify({sku:'BK-68',name:'Sản phẩm sao lưu',price:68000,stock:6})})
  await request('/api/orders',{method:'POST',headers:authSource,body:JSON.stringify({customerId:customer.body.id,status:'completed',items:[{productId:product.body.id,name:product.body.name,quantity:2,unitPrice:product.body.price}]})})
  await request('/api/ai/knowledge',{method:'POST',headers:authSource,body:JSON.stringify({title:'Tài liệu sao lưu',content:'Nội dung dành riêng cho cửa hàng nguồn.',tags:['backup']})})
  const exported=await request('/api/backup/export',{headers:authSource});assert.equal(exported.status,200);assert.equal(exported.body.format,'bot68-server-backup');assert.equal(JSON.stringify(exported.body).includes('password_hash'),false);assert.equal(JSON.stringify(exported.body).includes('encrypted_token'),false)
  const restored=await request('/api/backup/import',{method:'POST',headers:authTarget,body:JSON.stringify({confirmation:'RESTORE',backup:exported.body})});assert.equal(restored.status,200);assert.deepEqual(restored.body.restored,{customers:1,products:1,orders:1,knowledge:1});assert.equal(restored.body.requiresChannelReconnect,true)
  const summary=await request('/api/reports/summary',{headers:authTarget});assert.equal(summary.body.revenue,136000);assert.equal(summary.body.customers,1);assert.equal(summary.body.products,1)
  const targetKnowledge=await request('/api/ai/knowledge',{headers:authTarget});assert.equal(targetKnowledge.body[0].title,'Tài liệu sao lưu')
  const sourceStillIntact=await request('/api/reports/summary',{headers:authSource});assert.equal(sourceStillIntact.body.revenue,136000)
})
