// core.js — storage, crypto, session, settings, audit, notifications
export const uid=()=>(crypto.randomUUID?crypto.randomUUID():'id-'+Date.now()+'-'+Math.random().toString(36).slice(2));
export const nowISO=()=>new Date().toISOString();
export const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const LS='ts_';
export const ls={get(k,d){try{const v=localStorage.getItem(LS+k);return v?JSON.parse(v):d}catch(e){return d}},set(k,v){localStorage.setItem(LS+k,JSON.stringify(v))},del(k){localStorage.removeItem(LS+k)}};
export const b64=a=>{let s='';const u=new Uint8Array(a);for(let i=0;i<u.length;i++)s+=String.fromCharCode(u[i]);return btoa(s)};
export const unb64=s=>{const u=atob(s);const a=new Uint8Array(u.length);for(let i=0;i<u.length;i++)a[i]=u.charCodeAt(i);return a};

let _db=null;
function openDB(){if(_db)return _db;_db=new Promise((res,rej)=>{const rq=indexedDB.open('tradestack',1);
rq.onupgradeneeded=e=>{const d=e.target.result;
 if(!d.objectStoreNames.contains('records'))d.createObjectStore('records',{keyPath:'id'});
 if(!d.objectStoreNames.contains('media'))d.createObjectStore('media',{keyPath:'id'});};
rq.onsuccess=e=>res(e.target.result);rq.onerror=()=>rej(rq.error);});return _db}
function reqp(r){return new Promise((res,rej)=>{r.onsuccess=()=>res(r.result);r.onerror=()=>rej(r.error)})}
export const DB={
 async put(store,rec){const d=await openDB();return reqp(d.transaction(store,'readwrite').objectStore(store).put(rec))},
 async get(store,id){const d=await openDB();return reqp(d.transaction(store).objectStore(store).get(id))},
 async del(store,id){const d=await openDB();return reqp(d.transaction(store,'readwrite').objectStore(store).delete(id))},
 async all(store){const d=await openDB();return reqp(d.transaction(store).readonly').objectStore(store).getAll())},
 async recs(type,orgId){const all=await DB.all('records');return all.filter(r=>r.type===type&&(orgId===undefined||r.orgId===orgId))},
 async rec(type,orgId){const l=await DB.recs(type,orgId);return l[0]||null},
 async putRec(type,orgId,data,id){const rec={id:id||uid(),type,orgId:orgId||null,data,ts:nowISO()};await DB.put('records',rec);return rec},
 async delOrg(orgId){const all=await DB.all('records');for(const r of all)if(r.orgId===orgId)await DB.del('records',r.id);}
};
// ---- crypto ----
export async function hashPass(p,salt){const e=new TextEncoder();const km=await crypto.subtle.importKey('raw',e.encode(p),'PBKDF2',false,['deriveBits']);
 const bits=await crypto.subtle.deriveBits({name:'PBKDF2',salt:e.encode(salt),iterations:120000,hash:'SHA-256'},km,256);return b64(bits)}
export async function makeKey(p,salt){const e=new TextEncoder();const km=await crypto.subtle.importKey('raw',e.encode(p),'PBKDF2',false,['deriveKey']);
 return crypto.subtle.deriveKey({name:'PBKDF2',salt:e.encode(salt),iterations:120000,hash:'SHA-256'},km,{name:'AES-GCM',length:256},false,['encrypt','decrypt'])}
export async function encJSON(key,obj){const iv=crypto.getRandomValues(new Uint8Array(12));const e=new TextEncoder();
 const ct=await crypto.subtle.encrypt({name:'AES-GCM',iv},key,e.encode(JSON.stringify(obj)));return{iv:b64(iv),ct:b64(ct)}}
export async function decJSON(key,enc){const pt=await crypto.subtle.decrypt({name:'AES-GCM',iv:unb64(enc.iv)},key,unb64(enc.ct));
 return JSON.parse(new TextDecoder().decode(pt))}
export const Session={key:null,orgId:null,unlocked:false};
// ---- settings ----
const DEF={ai:{provider:'offline',ollamaUrl:'http://localhost:11434',model:'llama3.1',compatUrl:'',compatKey:'',compatModel:''},
 metaAppId:'',tz:Intl.DateTimeFormat().resolvedOptions().timeZone,automationLevel:3,browserNotify:false,
 feeds:['https://hnrss.org/frontpage','https://www.reddit.com/r/marketing/top.rss','https://www.reddit.com/r/smallbusiness/top.rss']};
export async function getSettings(){const r=await DB.get('records','settings');return Object.assign({},DEF,r?r.data:{},r&&r.data.ai?{ai:Object.assign({},DEF.ai,r.data.ai)}:{ai:DEF.ai})}
export async function saveSettings(s){await DB.put('records',{id:'settings',type:'settings',orgId:null,data:s,ts:nowISO()})}
// ---- audit & notifications ----
export async function audit(orgId,action,detail){await DB.putRec('audit',orgId,{action,detail}); }
export async function notify(orgId,title,body,kind){await DB.putRec('notification',orgId,{title,body,kind:kind||'info',read:false});
 const s=await getSettings();if(s.browserNotify&&'Notification'in window&&Notification.permission==='granted')try{new Notification('Tradestack: '+title,{body})}catch(e){}}
export async function joblog(orgId,job,status,detail){await DB.putRec('joblog',orgId,{job,status,detail})}
