import assert from 'node:assert/strict'
import { test } from 'node:test'
import { loadConfig, validateProductionConfig } from './config.mjs'
import { createApp } from './app.mjs'

const secure={production:true,publicUrl:'https://api.bot68.vn',authSecret:'a'.repeat(48),encryptionSecret:'b'.repeat(48),metaAppId:'',metaAppSecret:'',metaVerifyToken:'c'.repeat(48)}

test('production config accepts separate strong keys and real HTTPS domain',()=>{assert.doesNotThrow(()=>validateProductionConfig(loadConfig(secure)))})
test('production config rejects placeholders, sample domain and reused keys',()=>{assert.throws(()=>validateProductionConfig(loadConfig({...secure,publicUrl:'https://bot68.example.com',authSecret:'replace-with-at-least-48-random-bytes',encryptionSecret:'replace-with-at-least-48-random-bytes'})),/BOT68_AUTH_SECRET/)})
test('production Meta config requires complete credentials and strong verify token',()=>{assert.throws(()=>validateProductionConfig(loadConfig({...secure,metaAppId:'meta-id',metaAppSecret:'',metaVerifyToken:'short'})),/META_APP_ID/);assert.throws(()=>validateProductionConfig(loadConfig({...secure,metaAppId:'meta-id',metaAppSecret:'meta-secret',metaVerifyToken:'short'})),/META_VERIFY_TOKEN/)})
test('secure production app starts and serves health',async()=>{const config=loadConfig({...secure,databasePath:':memory:'});validateProductionConfig(config);const app=createApp(config),server=await new Promise(resolve=>{const value=app.listen(0,'127.0.0.1',()=>resolve(value))});try{const address=server.address(),response=await fetch(`http://127.0.0.1:${address.port}/health`);assert.equal(response.status,200);assert.equal((await response.json()).ok,true)}finally{await new Promise(resolve=>server.close(resolve));app.locals.db.close()}})
