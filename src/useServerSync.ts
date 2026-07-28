import { useEffect, useState } from 'react'
import { apiRequest, type ServerSession } from './api'
import { applySyncEvents, type SyncEvent } from './db'
export type SyncState='offline'|'connecting'|'online'|'error'
export function useServerSync(session:ServerSession){const [state,setState]=useState<SyncState>(session.offline?'offline':'connecting');useEffect(()=>{if(session.offline)return;let stopped=false,timer=0;async function sync(){try{const events=await apiRequest<Omit<SyncEvent,'tenantId'>[]>(session.serverUrl,'/api/sync/events?limit=100',{},session.token);if(events.length){await applySyncEvents(events,session.tenant.id);await apiRequest(session.serverUrl,'/api/sync/ack',{method:'POST',body:JSON.stringify({ids:events.map(e=>e.id)})},session.token)}if(!stopped)setState('online')}catch{if(!stopped)setState('error')}finally{if(!stopped)timer=window.setTimeout(sync,15000)}}sync();return()=>{stopped=true;clearTimeout(timer)}},[session]);return state}
