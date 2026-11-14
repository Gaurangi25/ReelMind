import {BASE,KEY} from './config.js';
export async function request(path, options={}, token=KEY, timeout=12000){
 if(KEY.startsWith('PASTE_')) throw Error('Configure the public Supabase key in config.js first.');
 const headers={apikey:KEY,'Content-Type':'application/json',...options.headers};
 if(token!==KEY || KEY.startsWith('eyJ')) headers.Authorization=`Bearer ${token}`;
 const controller=new AbortController(); const timer=setTimeout(()=>controller.abort(),timeout);
 try {
 const r=await fetch(BASE+path,{...options,headers,signal:controller.signal});
 const raw=await r.text(); let data; try{data=JSON.parse(raw)}catch{data=raw}
 if(!r.ok) throw Error(data?.message||data?.msg||data?.error_description||data?.error||`Request failed (${r.status})`);
 return data;
 } catch(e){if(controller.signal.aborted) throw Error('Request timed out: '+path.split('?')[0]);throw e;} finally{clearTimeout(timer);}
}
const save=async s=>{s.expires_at=s.expires_at||Math.floor(Date.now()/1000)+s.expires_in;await chrome.storage.local.set({session:s});return s};
export async function login(email,password){return save(await request('/auth/v1/token?grant_type=password',{method:'POST',body:JSON.stringify({email,password})}));}
export async function session(){const {session:s}=await chrome.storage.local.get('session');if(!s)return null;if(s.expires_at>Date.now()/1000+60)return s;try{return await save(await request('/auth/v1/token?grant_type=refresh_token',{method:'POST',body:JSON.stringify({refresh_token:s.refresh_token})}));}catch{await chrome.storage.local.remove('session');return null;}}
export async function logout(){await chrome.storage.local.remove('session');}
