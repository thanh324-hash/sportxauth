import 'fake-indexeddb/auto'
import assert from 'node:assert/strict'
import { after, before, test } from 'node:test'
import { applySyncEvents, db, reconcileActiveConnections } from './db'

const incoming={id:'evt-shared',provider:'facebook' as const,type:'message',externalId:'message-shared',connectionId:'page-shared',createdAt:Date.now(),payload:{conversationId:'customer-shared',senderId:'customer-shared',senderName:'Khách chung',messageId:'message-shared',text:'Xin chào cả hai cửa hàng',timestamp:Date.now()}}

before(async()=>{await db.delete();await db.open()})
after(async()=>{db.close();await db.delete()})

test('same social event is stored independently for two local tenants',async()=>{
  await applySyncEvents([incoming],'tenant-a')
  await applySyncEvents([incoming],'tenant-b')
  await applySyncEvents([incoming],'tenant-a')
  const contactsA=await db.contacts.where('tenantId').equals('tenant-a').toArray(),contactsB=await db.contacts.where('tenantId').equals('tenant-b').toArray()
  assert.equal(contactsA.length,1);assert.equal(contactsB.length,1);assert.notEqual(contactsA[0].id,contactsB[0].id)
  const conversationsA=await db.conversations.where('tenantId').equals('tenant-a').toArray(),conversationsB=await db.conversations.where('tenantId').equals('tenant-b').toArray()
  assert.equal(conversationsA.length,1);assert.equal(conversationsB.length,1);assert.notEqual(conversationsA[0].id,conversationsB[0].id)
  assert.equal(conversationsA[0].unread,1)
  const messagesA=await db.messages.where('[tenantId+conversationId]').equals(['tenant-a',conversationsA[0].id]).toArray()
  const messagesB=await db.messages.where('[tenantId+conversationId]').equals(['tenant-b',conversationsB[0].id]).toArray()
  assert.equal(messagesA.length,1);assert.equal(messagesB.length,1);assert.notEqual(messagesA[0].id,messagesB[0].id)
})

test('disconnected channels remove only their local conversations and messages',async()=>{
  await reconcileActiveConnections([],'tenant-a')
  const conversationsA=await db.conversations.where('tenantId').equals('tenant-a').toArray()
  const conversationsB=await db.conversations.where('tenantId').equals('tenant-b').toArray()
  const messagesA=await db.messages.where('tenantId').equals('tenant-a').toArray()
  assert.equal(conversationsA.length,0);assert.equal(messagesA.length,0);assert.equal(conversationsB.length,1)
})
