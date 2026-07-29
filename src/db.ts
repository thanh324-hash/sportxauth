import Dexie, { type EntityTable } from 'dexie'

export type Channel = 'facebook' | 'instagram' | 'zalo' | 'telegram' | 'tiktok'
export interface Contact { id: string; tenantId:string; name: string; phone?: string; address?:string; channel: Channel; avatar: string; tags: string[]; note?: string; externalId?:string }
export interface Conversation { id: string; tenantId:string; contactId: string; channel: Channel; preview: string; unread: number; updatedAt: number; assignee: string; status: 'new'|'open'|'waiting'|'closed'; connectionId?:string; externalConversationId?:string }
export interface Message { id: string; tenantId:string; conversationId: string; from: 'customer'|'agent'|'ai'; text: string; createdAt: number; imageUrl?:string; imageName?:string }
export interface MediaAsset { id:string; tenantId:string; name:string; mimeType:string; dataUrl:string; createdAt:number; lastUsedAt:number }
export interface Order { id: string; tenantId:string; contactId: string; total: number; status: 'draft'|'confirmed'|'shipping'|'completed'; createdAt: number }
export interface SyncEvent { id:string; tenantId:string; provider:Channel; type:string; externalId?:string; connectionId?:string; payload:any; createdAt:number }

export const db = new Dexie('bot68-local') as Dexie & {
  contacts: EntityTable<Contact, 'id'>; conversations: EntityTable<Conversation, 'id'>;
  messages: EntityTable<Message, 'id'>; orders: EntityTable<Order, 'id'>; syncEvents:EntityTable<SyncEvent,'id'>; mediaAssets:EntityTable<MediaAsset,'id'>
}
db.version(1).stores({ contacts: 'id,name,channel', conversations: 'id,contactId,channel,updatedAt,status', messages: 'id,conversationId,createdAt', orders: 'id,contactId,status,createdAt' })
db.version(2).stores({ contacts: 'id,name,channel', conversations: 'id,contactId,channel,updatedAt,status', messages: 'id,conversationId,createdAt', orders: 'id,contactId,status,createdAt', syncEvents:'id,provider,createdAt' })
db.version(3).stores({contacts:'id,tenantId,[tenantId+name],channel',conversations:'id,tenantId,[tenantId+updatedAt],contactId,channel,status',messages:'id,tenantId,[tenantId+conversationId],createdAt',orders:'id,tenantId,[tenantId+createdAt],contactId,status',syncEvents:'id,tenantId,[tenantId+createdAt],provider'}).upgrade(async transaction=>{for(const tableName of ['contacts','conversations','messages','orders','syncEvents'])await transaction.table(tableName).toCollection().modify(item=>{if(!item.tenantId)item.tenantId='legacy'})})
db.version(4).stores({contacts:'id,tenantId,[tenantId+name],channel',conversations:'id,tenantId,[tenantId+updatedAt],contactId,channel,status',messages:'id,tenantId,[tenantId+conversationId],createdAt',orders:'id,tenantId,[tenantId+createdAt],contactId,status',syncEvents:'id,tenantId,[tenantId+createdAt],provider',mediaAssets:'id,tenantId,[tenantId+createdAt],lastUsedAt'})

export async function seedDatabase(tenantId:string) {
  if (await db.contacts.where('tenantId').equals(tenantId).count()) return
  const now = Date.now()
  await db.contacts.bulkAdd([
    { id:`${tenantId}:c1`, tenantId,name:'Nguyễn Minh Anh', phone:'090 123 6868', channel:'facebook', avatar:'MA', tags:['Khách mới','Quan tâm áo'] },
    { id:`${tenantId}:c2`, tenantId,name:'Trần Quốc Huy', channel:'instagram', avatar:'QH', tags:['Đã mua'] },
    { id:`${tenantId}:c3`, tenantId,name:'Lê Phương', phone:'098 222 1068', channel:'zalo', avatar:'LP', tags:['Cần gọi lại'] },
    { id:`${tenantId}:c4`, tenantId,name:'Hoàng Lan', channel:'telegram', avatar:'HL', tags:['VIP'] }
  ])
  await db.conversations.bulkAdd([
    { id:`${tenantId}:v1`,tenantId,contactId:`${tenantId}:c1`, channel:'facebook', preview:'Shop còn mẫu màu đen size M không?', unread:2, updatedAt:now, assignee:'Bạn', status:'new' },
    { id:`${tenantId}:v2`,tenantId,contactId:`${tenantId}:c2`, channel:'instagram', preview:'Mình nhận được hàng rồi nhé', unread:0, updatedAt:now-420000, assignee:'Thu Hà', status:'open' },
    { id:`${tenantId}:v3`,tenantId,contactId:`${tenantId}:c3`, channel:'zalo', preview:'Gọi lại giúp mình sau 5 giờ', unread:1, updatedAt:now-1900000, assignee:'Chưa giao', status:'waiting' },
    { id:`${tenantId}:v4`,tenantId,contactId:`${tenantId}:c4`, channel:'telegram', preview:'Có giao hàng về Đà Nẵng không?', unread:0, updatedAt:now-9200000, assignee:'Bạn', status:'open' }
  ])
  await db.messages.bulkAdd([
    { id:`${tenantId}:m1`,tenantId,conversationId:`${tenantId}:v1`, from:'customer', text:'Xin chào shop, mình xem sản phẩm trên bài đăng hôm qua.', createdAt:now-240000 },
    { id:`${tenantId}:m2`,tenantId,conversationId:`${tenantId}:v1`, from:'agent', text:'BOT 68 xin chào Minh Anh! Bạn đang quan tâm mẫu nào ạ?', createdAt:now-180000 },
    { id:`${tenantId}:m3`,tenantId,conversationId:`${tenantId}:v1`, from:'customer', text:'Shop còn mẫu màu đen size M không?', createdAt:now-60000 }
  ])
}

export async function applySyncEvents(events:Omit<SyncEvent,'tenantId'>[],tenantId:string){
  await db.transaction('rw',db.contacts,db.conversations,db.messages,db.syncEvents,async()=>{
    for(const event of events){
      const localEventId=`${tenantId}:${event.id}`,alreadySeen=Boolean(await db.syncEvents.get(localEventId))
      if(!alreadySeen)await db.syncEvents.put({...event,id:localEventId,tenantId})
      const payload=event.payload;if(event.type==='contact_update'&&payload?.senderId){const contactId=`${tenantId}:${event.provider}:${payload.senderId}`,changes:Partial<Contact>={};if(payload.phone)changes.phone=payload.phone;if(payload.address)changes.address=payload.address;if(Object.keys(changes).length)await db.contacts.update(contactId,changes);continue}if(event.type!=='message'||!payload?.conversationId||!payload?.senderId)continue
      const contactId=`${tenantId}:${event.provider}:${payload.senderId}`,conversationId=`${tenantId}:${event.provider}:${event.connectionId||'channel'}:${payload.conversationId}`,timestamp=Number(payload.timestamp||event.createdAt),name=String(payload.senderName||`${event.provider} ${payload.senderId}`),initials=name.split(/\s+/).slice(-2).map((x:string)=>x[0]).join('').toUpperCase()
      const existingContact=await db.contacts.get(contactId);if(!existingContact)await db.contacts.add({id:contactId,tenantId,name,phone:payload.detectedPhone||undefined,address:payload.detectedAddress||undefined,channel:event.provider,avatar:initials||'KH',tags:['Khách mới'],externalId:String(payload.senderId)});else {const changes:Partial<Contact>={};if(payload.senderName&&existingContact.name!==name){changes.name=name;changes.avatar=initials||existingContact.avatar}if(payload.detectedPhone)changes.phone=payload.detectedPhone;if(payload.detectedAddress)changes.address=payload.detectedAddress;if(Object.keys(changes).length)await db.contacts.update(contactId,changes)}
      const existingConversation=await db.conversations.get(conversationId)
      const outgoing=payload.direction==='outgoing';await db.conversations.put({id:conversationId,tenantId,contactId,channel:event.provider,preview:String(payload.text||'[Tệp đính kèm]'),unread:outgoing?(existingConversation?.unread||0):(existingConversation?.unread||0)+(alreadySeen?0:1),updatedAt:timestamp,assignee:existingConversation?.assignee||'Chưa giao',status:existingConversation?.status||'new',connectionId:event.connectionId,externalConversationId:String(payload.conversationId)})
      const image=Array.isArray(payload.attachments)?payload.attachments.find((item:any)=>item?.type==='image'||item?.payload?.url):null
      await db.messages.put({id:`${tenantId}:${event.provider}:${payload.messageId||event.externalId||event.id}`,tenantId,conversationId,from:outgoing?'agent':'customer',text:String(payload.text||''),createdAt:timestamp,imageUrl:image?.payload?.url||payload.imageUrl||undefined,imageName:payload.imageName||undefined})
    }
  })
}
