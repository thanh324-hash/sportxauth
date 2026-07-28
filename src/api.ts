export interface ServerSession {
  serverUrl:string; token:string
  user:{id:string;tenantId:string;name:string;email:string;role:'owner'|'manager'|'agent'}
  tenant:{id:string;name:string;slug:string;plan:string}; offline?:boolean
}
export async function apiRequest<T>(serverUrl:string,path:string,options:RequestInit={},token?:string):Promise<T>{
  const response=await fetch(`${serverUrl.replace(/\/$/,'')}${path}`,{...options,headers:{'content-type':'application/json',...(token?{authorization:`Bearer ${token}`} : {}),...options.headers}})
  const text=await response.text();let body:any=null;try{body=text?JSON.parse(text):null}catch{body=text}
  if(!response.ok)throw new Error(body?.error||`Máy chủ trả lỗi ${response.status}`);return body as T
}
export async function saveSession(session:ServerSession){if(window.bot68)return window.bot68.saveSession(session);localStorage.setItem('bot68-dev-session',JSON.stringify(session));return true}
export async function loadSession():Promise<ServerSession|null>{if(window.bot68)return await window.bot68.loadSession() as ServerSession|null;const value=localStorage.getItem('bot68-dev-session');return value?JSON.parse(value):null}
export async function clearSession(){if(window.bot68)return window.bot68.clearSession();localStorage.removeItem('bot68-dev-session');return true}
