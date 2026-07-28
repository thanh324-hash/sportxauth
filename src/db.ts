import Dexie, { type EntityTable } from 'dexie'

export type Channel = 'facebook' | 'instagram' | 'zalo' | 'telegram' | 'tiktok'
export interface Contact { id: string; name: string; phone?: string; channel: Channel; avatar: string; tags: string[]; note?: string; externalId?:string }
export interface Conversation { id: string; contactId: string; channel: Channel; preview: string; unread: number; updatedAt: number; assignee: string; status: 'new'|'open'|'waiting'|'closed'; connectionId?:string; externalConversationId?:string }
export interface Message { id: string; conversationId: string; from: 'customer'|'agent'|'ai'; text: string; createdAt: number }
export interface Order { id: string; contactId: string; total: number; status: 'draft'|'confirmed'|'shipping'|'completed'; createdAt: number }
export interface SyncEvent { id:string; provider:Channel; type:string; externalId?:string; connectionId?:string; payload:any; createdAt:number }

export const db = new Dexie('bot68-local') as Dexie & {
  contacts: EntityTable<Contact, 'id'>; conversations: EntityTable<Conversation, 'id'>;
  messages: EntityTable<Message, 'id'>; orders: EntityTable<Order, 'id'>; syncEvents:EntityTable<SyncEvent,'id'>
}
db.version(1).stores({ contacts: 'id,name,channel', conversations: 'id,contactId,channel,updatedAt,status', messages: 'id,conversationId,createdAt', orders: 'id,contactId,status,createdAt' })
db.version(2).stores({ contacts: 'id,name,channel', conversations: 'id,contactId,channel,updatedAt,status', messages: 'id,conversationId,createdAt', orders: 'id,contactId,status,createdAt', syncEvents:'id,provider,createdAt' })

export async function seedDatabase() {
  if (await db.contacts.count()) return
  const now = Date.now()
  await db.contacts.bulkAdd([
    { id:'c1', name:'Nguyễn Minh Anh', phone:'090 123 6868', channel:'facebook', avatar:'MA', tags:['Khách mới','Quan tâm áo'] },
    { id:'c2', name:'Trần Quốc Huy', channel:'instagram', avatar:'QH', tags:['Đã mua'] },
    { id:'c3', name:'Lê Phương', phone:'098 222 1068', channel:'zalo', avatar:'LP', tags:['Cần gọi lại'] },
    { id:'c4', name:'Hoàng Lan', channel:'telegram', avatar:'HL', tags:['VIP'] }
  ])
  await db.conversations.bulkAdd([
    { id:'v1', contactId:'c1', channel:'facebook', preview:'Shop còn mẫu màu đen size M không?', unread:2, updatedAt:now, assignee:'Bạn', status:'new' },
    { id:'v2', contactId:'c2', channel:'instagram', preview:'Mình nhận được hàng rồi nhé', unread:0, updatedAt:now-420000, assignee:'Thu Hà', status:'open' },
    { id:'v3', contactId:'c3', channel:'zalo', preview:'Gọi lại giúp mình sau 5 giờ', unread:1, updatedAt:now-1900000, assignee:'Chưa giao', status:'waiting' },
    { id:'v4', contactId:'c4', channel:'telegram', preview:'Có giao hàng về Đà Nẵng không?', unread:0, updatedAt:now-9200000, assignee:'Bạn', status:'open' }
  ])
  await db.messages.bulkAdd([
    { id:'m1', conversationId:'v1', from:'customer', text:'Xin chào shop, mình xem sản phẩm trên bài đăng hôm qua.', createdAt:now-240000 },
    { id:'m2', conversationId:'v1', from:'agent', text:'BOT 68 xin chào Minh Anh! Bạn đang quan tâm mẫu nào ạ?', createdAt:now-180000 },
    { id:'m3', conversationId:'v1', from:'customer', text:'Shop còn mẫu màu đen size M không?', createdAt:now-60000 }
  ])
}

export async function applySyncEvents(events:SyncEvent[]){
  await db.transaction('rw',db.contacts,db.conversations,db.messages,db.syncEvents,async()=>{
    for(const event of events){
      await db.syncEvents.put(event)
      const payload=event.payload;if(event.type!=='message'||!payload?.conversationId||!payload?.senderId)continue
      const contactId=`${event.provider}:${payload.senderId}`,conversationId=`${event.provider}:${event.connectionId||'channel'}:${payload.conversationId}`,timestamp=Number(payload.timestamp||event.createdAt),name=String(payload.senderName||`${event.provider} ${payload.senderId}`),initials=name.split(/\s+/).slice(-2).map((x:string)=>x[0]).join('').toUpperCase()
      const existingContact=await db.contacts.get(contactId);if(!existingContact)await db.contacts.add({id:contactId,name,channel:event.provider,avatar:initials||'KH',tags:['Khách mới'],externalId:String(payload.senderId)})
      const existingConversation=await db.conversations.get(conversationId)
      await db.conversations.put({id:conversationId,contactId,channel:event.provider,preview:String(payload.text||'[Tệp đính kèm]'),unread:(existingConversation?.unread||0)+1,updatedAt:timestamp,assignee:existingConversation?.assignee||'Chưa giao',status:existingConversation?.status||'new',connectionId:event.connectionId,externalConversationId:String(payload.conversationId)})
      await db.messages.put({id:`${event.provider}:${payload.messageId||event.externalId||event.id}`,conversationId,from:'customer',text:String(payload.text||'[Tệp đính kèm]'),createdAt:timestamp})
    }
  })
}
