import { telegramAdapter } from './telegram.mjs'

const scaffold=(provider,capabilities,requirements)=>({provider,capabilities,requirements,status:'scaffold'})
export const channelAdapters={
  telegram:telegramAdapter,
  facebook:scaffold('facebook',{receiveMessages:true,sendMessages:true,comments:true,oauth:true,webhook:true},['META_APP_ID','META_APP_SECRET']),
  instagram:scaffold('instagram',{receiveMessages:true,sendMessages:true,comments:true,oauth:true,webhook:true},['META_APP_ID','META_APP_SECRET']),
  zalo:scaffold('zalo',{receiveMessages:true,sendMessages:true,comments:false,oauth:true,webhook:true},['ZALO_APP_ID','ZALO_APP_SECRET','ZALO_OA_ID']),
  tiktok:scaffold('tiktok',{receiveMessages:false,sendMessages:false,comments:false,oauth:true,webhook:false},['TIKTOK_CLIENT_KEY','TIKTOK_CLIENT_SECRET','TikTok messaging partner access'])
}
export function publicAdapterCatalog(){return Object.values(channelAdapters).map(({provider,capabilities,requirements=[],status='active'})=>({provider,capabilities,requirements,status}))}
