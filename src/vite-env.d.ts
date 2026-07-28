/// <reference types="vite/client" />
interface Window { bot68?: { openExternal(url: string): Promise<void>; appInfo(): Promise<{version:string; dataPath:string}>; saveSession(value:unknown):Promise<boolean>; loadSession():Promise<unknown>; clearSession():Promise<boolean> } }
