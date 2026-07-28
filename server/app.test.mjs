import assert from 'node:assert/strict'
import crypto from 'node:crypto'
import { after, before, test } from 'node:test'
import { createApp } from './app.mjs'
import { loadConfig } from './config.mjs'

let server, base, app
before(async()=>{
  const metaFetch=async url=>{
    const parsed=new URL(url)
    if(parsed.pathname.endsWith('/oauth/access_token'))return new Response(JSON.stringify({access_token:parsed.searchParams.has('fb_exchange_token')?'long-user-token':'short-user-token'}),{status:200,headers:{'content-type':'application/json'}})
    if(parsed.pathname.endsWith('/me/accounts'))return new Response(JSON.stringify({data:[{id:'page-68',name:'BOT 68 Page',access_token:'page-token-68',instagram_business_account:{id:'ig-68',username:'bot68.official'}}]}),{status:200,headers:{'content-type':'application/json'}})
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
test('tenant data is isolated and channel token is never returned',async()=>{
  const a=await register(2),b=await register(3)
  const channel=await request('/api/channels',{method:'POST',headers:{authorization:`Bearer ${a.body.token}`},body:JSON.stringify({provider:'facebook',externalId:'page-68',displayName:'Page A',accessToken:'top-secret-token'})})
  assert.equal(channel.status,201);assert.equal(JSON.stringify(channel.body).includes('top-secret-token'),false)
  const own=await request('/api/channels',{headers:{authorization:`Bearer ${a.body.token}`}}),other=await request('/api/channels',{headers:{authorization:`Bearer ${b.body.token}`}})
  assert.equal(own.body.length,1);assert.equal(other.body.length,0)
  const hidden=await request(`/api/channels/${channel.body.id}/verify-secret`,{headers:{authorization:`Bearer ${b.body.token}`}});assert.equal(hidden.status,404)
})
test('invalid session and weak passwords are rejected',async()=>{const unauthorized=await request('/api/me',{headers:{authorization:'Bearer invalid'}});assert.equal(unauthorized.status,401);const weak=await request('/api/auth/register',{method:'POST',body:JSON.stringify({businessName:'Weak',name:'A',email:'weak@example.com',password:'123'})});assert.equal(weak.status,400)})
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
})
