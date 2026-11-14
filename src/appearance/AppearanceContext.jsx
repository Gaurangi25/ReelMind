import React,{createContext,useContext,useEffect,useLayoutEffect,useRef,useState} from 'react';
import {supabase} from '../supabase';
import {themes,tokens} from './themes';
import {wallpapers} from './wallpaper';
const Context=createContext(null), key='reelmind.appearance.effects.v1', themeKey='reelmind.appearance.theme.v1';
const defaults={wall:'none',image:'',blur:0,dim:30,opacity:95,accent:'',layout:'grid',sidebarCollapsed:false};
const bounded=(v,d,min,max)=>Number.isFinite(v)?Math.min(max,Math.max(min,v)):d;
const validTheme=id=>themes.some(t=>t.id===id)?id:'ivory';
function clean(p={}){return {layout:p.layout==='list'?'list':'grid',sidebarCollapsed:p.sidebarCollapsed===true,wall:[...wallpapers.map(w=>w.id),'custom'].includes(p.wall)?p.wall:'none',image:typeof p.image==='string'&&p.image.startsWith('data:image/jpeg;base64,')?p.image:'',blur:bounded(p.blur,0,0,20),dim:bounded(p.dim,30,0,80),opacity:bounded(p.opacity,95,85,100),accent:/^#[0-9a-f]{6}$/i.test(p.accent||'')?p.accent:''};}
function read(k){try{return JSON.parse(localStorage.getItem(k)||'null');}catch{return null;}}
function cache(id){return id?`reelmind.appearance.user.${id}`:'reelmind.appearance.guest';}
function legacy(){try{return {themeId:validTheme(localStorage.getItem(themeKey)),prefs:clean(read(key)||{})};}catch{return {themeId:'ivory',prefs:defaults};}}
async function download(path,id){if(!path)return '';if(!path.startsWith(`${id}/`))throw Error('Invalid wallpaper path.');const {data,error}=await supabase.storage.from('user-wallpapers').download(path);if(error)throw error;return new Promise((resolve,reject)=>{const r=new FileReader();r.onload=()=>resolve('data:image/jpeg;base64,'+String(r.result).split(',')[1]);r.onerror=reject;r.readAsDataURL(data);});}
export function AppearanceProvider({children}){
 const [account,setAccount]=useState(undefined);
 useEffect(()=>{if(!supabase){setAccount(null);return;}const {data:{subscription}}=supabase.auth.onAuthStateChange((_event,session)=>setAccount(session?.user?.id||null));return ()=>subscription.unsubscribe();},[]);
 return <AccountAppearance key={account===undefined?'loading':account||'guest'} account={account} >{children}</AccountAppearance>;
}
function AccountAppearance({account,children}){
 const initial=useRef(read(cache(account))||{themeId:'ivory',prefs:defaults});
 const [themeId,setThemeId]=useState(()=>validTheme(initial.current.themeId));
 const [prefs,setPrefs]=useState(()=>clean(initial.current.prefs||{}));
 const [storageError,setStorageError]=useState(''),[status,setStatus]=useState(account?'Loading preferences…':'Saved on this device'),[ready,setReady]=useState(!account),[revision,setRevision]=useState(0);
 const remote=useRef({path:null,image:''}), alive=useRef(true), queue=useRef(Promise.resolve());
 const theme=themes.find(t=>t.id===themeId)||themes[0];
 useEffect(()=>{alive.current=true;return ()=>{alive.current=false;};},[]);
 useEffect(()=>{if(!account)return;let cancelled=false;(async()=>{try{const {data,error}=await supabase.from('user_appearance').select('preferences,wallpaper_path').eq('user_id',account).maybeSingle();if(error)throw error;if(cancelled)return;if(data){const image=await download(data.wallpaper_path,account);if(cancelled)return;remote.current={path:data.wallpaper_path,image};setThemeId(validTheme(data.preferences?.themeId));setPrefs(clean({...data.preferences,image}));setStatus('Synced to your account');}else{setStatus('Ready to sync');}setReady(true);}catch(e){if(!cancelled){setStatus('Could not load preferences. Reopen the app to retry.');setStorageError(e.message||'Unable to load appearance.');}}})();return ()=>{cancelled=true;};},[account]);
 const change=()=>setRevision(n=>n+1);
 const update=patch=>{if(!ready)return;setPrefs(old=>clean({...old,...patch}));change();};
 const selectTheme=id=>{if(!ready)return;setThemeId(validTheme(id));change();};
 const reset=()=>{if(!ready)return;setThemeId('ivory');setPrefs(defaults);change();};
 const importLocal=()=>{if(!ready)return;const old=legacy();setThemeId(old.themeId);setPrefs(old.prefs);change();};
 useLayoutEffect(()=>{const root=document.documentElement;root.dataset.reelmindTheme=theme.id;root.style.colorScheme=theme.dark?'dark':'light';tokens.forEach((token,i)=>root.style.setProperty('--rm-'+token,theme.colors[i]));const custom=prefs.wall==='custom'&&prefs.image;const wall=custom?`url("${prefs.image}")`:wallpapers.find(w=>w.id===prefs.wall)?.css||'none';root.dataset.rmWallpaper=wall==='none'?'off':'on';root.dataset.rmAccent=prefs.accent?'on':'off';root.style.setProperty('--rm-wall',wall);root.style.setProperty('--rm-blur',prefs.blur+'px');root.style.setProperty('--rm-dim',prefs.dim/100);root.style.setProperty('--rm-opacity',prefs.opacity+'%');if(prefs.accent){root.style.setProperty('--rm-accent',prefs.accent);const rgb=prefs.accent.slice(1).match(/../g).map(x=>parseInt(x,16)/255).map(x=>x<=.04045?x/12.92:((x+.055)/1.055)**2.4);root.style.setProperty('--rm-on-accent',.2126*rgb[0]+.7152*rgb[1]+.0722*rgb[2]>.179?'#000000':'#ffffff');}},[theme,prefs]);
 useEffect(()=>{if(!ready||account===undefined)return;try{localStorage.setItem(cache(account),JSON.stringify({themeId,prefs}));}catch{setStorageError('Browser storage is full or unavailable.');}},[themeId,prefs,ready,account]);
 useEffect(()=>{if(!account||!ready||!revision)return;setStatus('Changes pending…');const timer=setTimeout(()=>{queue.current=queue.current.catch(()=>{}).then(async()=>{if(!alive.current)return;setStatus('Syncing…');let uploaded=null;try{const {data:{session}}=await supabase.auth.getSession();if(session?.user?.id!==account)return;let path=remote.current.path;if(prefs.image!==remote.current.image){path=null;if(prefs.image){const blob=await (await fetch(prefs.image)).blob();if(blob.size>5*1024*1024)throw Error('Wallpaper exceeds 5 MB.');path=`${account}/${crypto.randomUUID()}.jpg`;const {error}=await supabase.storage.from('user-wallpapers').upload(path,blob,{contentType:'image/jpeg'});if(error)throw error;uploaded=path;}}const {image,...settings}=prefs;const {error}=await supabase.from('user_appearance').upsert({user_id:account,preferences:{...settings,themeId},wallpaper_path:path,updated_at:new Date().toISOString()},{onConflict:'user_id'});if(error)throw error;const previous=remote.current.path;remote.current={path,image};if(previous&&previous!==path)await supabase.storage.from('user-wallpapers').remove([previous]);if(alive.current){setStatus('Synced to your account');setStorageError('');}}catch(e){if(uploaded)await supabase.storage.from('user-wallpapers').remove([uploaded]);if(alive.current){setStatus('Sync failed — retry');setStorageError(e.message||'Could not sync appearance.');}}});},650);return ()=>clearTimeout(timer);},[account,ready,revision,themeId,prefs]);
 return <Context.Provider value={{theme,setThemeId:selectTheme,prefs,update,storageError,reset,status,ready,retry:change,importLocal,account}}>{children}</Context.Provider>;
}
export function useAppearance(){return useContext(Context);}
