import assert from 'node:assert/strict'
import { after, before, test } from 'node:test'
import { createApp } from './app.mjs'
import { loadConfig } from './config.mjs'

let server, base, app
before(async()=>{
  app=createApp(loadConfig({databasePath:':memory:',authSecret:'test-auth-secret',encryptionSecret:'test-encryption-secret'}))
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
