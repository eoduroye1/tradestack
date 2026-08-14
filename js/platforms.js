// platforms.js — official-API publishing where permitted, honest manual workflows elsewhere, scheduler, analytics sync
import{DB,Session,encJSON,decJSON,audit,notify,joblog,getSettings,nowISO,uid}from'./core.js';
export const PLATFORMS={
 facebook:{name:'Facebook',auto:true,note:'Official Meta SDK. Text/link posts to Pages auto-publish; images need a public URL (manual otherwise).'},
 instagram:{name:'Instagram',auto:false,note:'Meta API requires hosted media + IG Business account. We prepare, you paste — one tap.'},
 linkedin:{name:'LinkedIn',auto:false,note:'LinkedIn API blocks browser calls. Copy/export workflow provided.'},
 x:{name:'X',auto:false,note:'OAuth1 secrets are unsafe in a browser app. Manual assistant provided.'},
 tiktok:{name:'TikTok',auto:false,note:'No browser-safe official publish API. Manual assistant.'},
 youtube:{name:'YouTube',auto:false,note:'Requires hosted upload flow. Manual assistant + optimized title/description.'},
 pinterest:{name:'Pinterest',auto:false,note:'Manual assistant with SEO-rich descriptions.'},
 whatsapp:{name:'WhatsApp',auto:false,note:'Anti-spam by design. Click-to-WhatsApp CTA builder only.'}};
export const OPENURL={facebook:'https://www.facebook.com/',instagram:'https://www.instagram.com/',linkedin:'https://www.linkedin.com/feed/',x:'https://x.com/compose/post',tiktok:'https://www.tiktok.com/tiktokstudio/upload',youtube:'https://studio.youtube.com/',pinterest:'https://www.pinterest.com/pin-creation-tool/',whatsapp:'https://wa.me/'};
// ---- Meta (official) ----
let fbP=null;
export function loadFB(appId){if(fbP)return fbP;fbP=new Promise(res=>{if(window.FB)return res();
 window.fbAsyncInit=()=>FB.init({appId,version:'v19.0',xfbml:false,cookie:false});window.FB&&res();
 const s=document.createElement('script');s.src='https://connect.facebook.net/en_US/sdk.js';s.async=true;
 s.onload=()=>window.FB&&res();document.head.appendChild(s);setTimeout(()=>res(),6000)});return fbP}
const fbApi=(path,method,params)=>new Promise((res,rej)=>FB.api(path,method||'get',params||{},r=>(r&&!r.error)?res(r):rej(new Error(r&&r.error?r.error.message:'Facebook error'))));
export async function metaConnect(){const s=await getSettings();if(!s.metaAppId)throw new Error('Add your Meta App ID in Settings → Integrations first.');
 await loadFB(s.metaAppId);
 const auth=await new Promise((res,rej)=>FB.login(r=>r.authResponse?res(r.authResponse):rej(new Error('Login cancelled')),{scope:'pages_show_list,pages_manage_posts,pages_read_engagement',auth_type:'rere'}));
 const acc=await fbApi('/me/accounts');const conns=[];
 for(const pg of acc.data||[]){const id=uid();await DB.putRec('secret',Session.orgId,await encJSON(Session.key,{token:pg.access_token}),id);
  const c=await DB.putRec('connection',Session.orgId,{platform:'facebook',name:pg.name,accountId:pg.id,secretId:id,scope:'pages_manage_posts,pages_read_engagement',capability:'auto text/link posts',status:'connected',lastSync:null});
  conns.push(c)}
 await audit(Session.orgId,'meta_connect','Connected '+conns.length+' Page(s)');return conns}
export async function metaPublish(conn,message){const sec=await DB.get('records',conn.secretId);const{token}=await decJSON(Session.key,sec.data);
 const r=await fbApi('/'+conn.accountId+'/feed','post',{message,access_token:token});
 await DB.putRec('connection',Session.orgId,Object.assign(conn.data,{lastSync:nowISO()}),conn.id);
 if(!r.id)throw new Error('No post id returned');return r.id}
export async function metaInsights(conn,postId){const sec=await DB.get('records',conn.secretId);const{token}=await decJSON(Session.key,sec.data);
 const r=await fbApi('/'+postId+'/insights','get',{metric:'post_impressions,post_engaged_users',access_token:token}).catch(()=>fbApi('/'+postId+'?fields=shares',{access_token:token}));
 let reach=0,eng=0;for(const m of (r.data||[])){if(m.name==='post_impressions')reach+=m.values.reduce((s,v)=>s+v.value,0);if(m.name==='post_engaged_users')eng+=m.values.reduce((s,v)=>s+v.value,0)}
 return{reach,engagement:eng}}
// ---- scheduler ----
export async function postsDue(orgId){const posts=await DB.recs('schedule',orgId);const now=Date.now();
 return posts.filter(p=>['approved','scheduled'].includes(p.status)&&new Date(p.scheduledAt).getTime()<=now)}
export async function schedulerTick(){if(!Session.unlocked||!Session.orgId)return;const s=await getSettings();
 try{const due=await postsDue(Session.orgId);
 for(const p of due){const canAuto=p.platform==='facebook'&&s.automationLevel>=4;
  if(canAuto){const conns=await DB.recs('connection',Session.orgId);const conn=conns.find(c=>c.platform==='facebook'&&c.status==='connected');
   if(conn){if(p.externalId)continue; // idempotency: never duplicate
    try{const id=await metaPublish(conn,p.caption+'\n\n'+(p.hashtags||[]).map(h=>'#'+h).join(' '));
     await DB.putRec('schedule',Session.orgId,Object.assign(p.data,{status:'published',externalId:id,publishedAt:nowISO()}),p.id);
     await notify(Session.orgId,'Published','Facebook post published automatically.','ok');await audit(Session.orgId,'publish_auto',p.id);continue}
    catch(e){await DB.putRec('schedule',Session.orgId,Object.assign(p.data,{status:'failed',lastError:String(e.message)}),p.id);
     await notify(Session.orgId,'Publishing failed','Facebook publishing failed. Your content remains saved. Reconnect or retry.','err');continue}}}
  if(p.status!=='due'){await DB.putRec('schedule',Session.orgId,Object.assign(p.data,{status:'due'}),p.id);
   await notify(Session.orgId,'Post due',`"${(p.hook||p.topic||'post').slice(0,40)}" is due — open Automation to publish.`)}}
 // analytics sync (idempotent: refresh >6h old)
 const conns=await DB.recs('connection',Session.orgId);const fb=conns.find(c=>c.platform==='facebook'&&c.status==='connected');
 if(fb){const pub=(await DB.recs('schedule',Session.orgId)).filter(p=>p.status==='published'&&p.externalId&&(!p.metrics||Date.now()-new Date(p.metrics.ts).getTime()>6*3600e3));
  for(const p of pub.slice(0,5)){try{const m=await metaInsights(fb,p.externalId);
   await DB.putRec('schedule',Session.orgId,Object.assign(p.data,{metrics:Object.assign({},m,{ts:nowISO()})}),p.id);await joblog(Session.orgId,'analytics_sync','ok',p.id)}catch(e){await joblog(Session.orgId,'analytics_sync','fail',String(e.message))}}}
 await joblog(Session.orgId,'scheduler','ok',due.length+' due')}catch(e){await joblog(Session.orgId,'scheduler','fail',String(e.message))}}
export function startScheduler(){setInterval(schedulerTick,30000)}
// ---- manual workflow record ----
export async function markPublished(orgId,post,url){await DB.putRec('schedule',orgId,Object.assign(post.data,{status:'published',publishedAt:nowISO(),manualUrl:url||null,publishMode:'manual'}),post.id);
 await audit(orgId,'publish_manual',post.id)}
