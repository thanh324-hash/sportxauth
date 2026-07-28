/// <reference types="vite/client" />
interface Window { bot68?: { openExternal(url: string): Promise<void>; appInfo(): Promise<{version:string; dataPath:string; localServerUrl:string; localServerStatus:'ready'|'error'; localServerError:string}>; saveSession(value:unknown):Promise<boolean>; loadSession():Promise<unknown>; clearSession():Promise<boolean> } }
