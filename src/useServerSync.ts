import { useCallback, useEffect, useRef, useState } from 'react'
import { apiRequest, type ServerSession } from './api'
import { applySyncEvents, reconcileActiveConnections, type SyncEvent } from './db'
export type SyncState='offline'|'connecting'|'online'|'error'
type RemoteChannel={id:string}
export function useServerSync(session:ServerSession){
  const [state,setState]=useState<SyncState>(session.offline?'offline':'connecting')
  const [refreshing,setRefreshing]=useState(false)
  const running=useRef(false),triggerRef=useRef<()=>void>(()=>{})
  const refresh=useCallback(()=>triggerRef.current(),[])
  useEffect(()=>{
    if(session.offline){setState('offline');return}
    let stopped=false,timer=0
    async function sync(){
      if(running.current||stopped)return
      running.current=true;setRefreshing(true)
      try{
        const channels=await apiRequest<RemoteChannel[]>(session.serverUrl,'/api/channels',{},session.token)
        const activeIds=new Set(channels.map(channel=>channel.id))
        await reconcileActiveConnections([...activeIds],session.tenant.id)
        const received=await apiRequest<Omit<SyncEvent,'tenantId'>[]>(session.serverUrl,'/api/sync/events?limit=100',{},session.token)
        const events=received.filter(event=>!event.connectionId||activeIds.has(event.connectionId))
        if(events.length)await applySyncEvents(events,session.tenant.id)
        if(received.length)await apiRequest(session.serverUrl,'/api/sync/ack',{method:'POST',body:JSON.stringify({ids:received.map(event=>event.id)})},session.token)
        if(!stopped)setState('online')
      }catch{if(!stopped)setState('error')}
      finally{running.current=false;if(!stopped){setRefreshing(false);timer=window.setTimeout(sync,3000)}}
    }
    triggerRef.current=()=>{clearTimeout(timer);void sync()}
    void sync()
    return()=>{stopped=true;clearTimeout(timer);triggerRef.current=()=>{}}
  },[session])
  return {state,refresh,refreshing}
}
