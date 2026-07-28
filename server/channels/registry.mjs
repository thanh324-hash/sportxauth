import { telegramAdapter } from './telegram.mjs'
import { zaloAdapter } from './zalo.mjs'
import { metaAdapter } from './meta.mjs'

const scaffold=(provider,capabilities,requirements)=>({provider,capabilities,requirements,status:'scaffold'})
export const channelAdapters={
  telegram:telegramAdapter,
  facebook:{...metaAdapter,provider:'facebook'},
  instagram:{...metaAdapter,provider:'instagram'},
  zalo:zaloAdapter,
  tiktok:scaffold('tiktok',{receiveMessages:false,sendMessages:false,comments:false,oauth:true,webhook:false},['TIKTOK_CLIENT_KEY','TIKTOK_CLIENT_SECRET','TikTok messaging partner access'])
}
export function publicAdapterCatalog(){return Object.values(channelAdapters).map(({provider,capabilities,requirements=[],status='active'})=>({provider,capabilities,requirements,status}))}
