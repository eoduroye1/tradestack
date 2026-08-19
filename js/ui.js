// ui.js — shell, auth, onboarding, router, dashboard
import{DB,Session,ls,uid,esc,hashPass,makeKey,getSettings,saveSettings,audit,notify}from'./core.js';
import* as E from'./engines.js';import* as P from'./platforms.js';import* as V from'./views.js';
export const $=s=>document.querySelector(s);
export function toast(msg,kind){const t=document.createElement('div');t.className='toast '+(kind||'');t.textContent=msg;$('#toast-root').appendChild(t);setTimeout(()=>t.remove(),5000)}
export function openModal(title,html,onmount){$('#modal-root').innerHTML=`<div class="mwrap" role="dialog" aria-modal="true" aria-label="${esc(title)}"><div class="mbox"><h1>${esc(title)}</h1><div id="mbody">${html}</div><div style="margin-top:14px;text-align:right"><button class="ghost" data-m="close">Close</button></div></div></div>`;
 $('#modal-root [data-m=close]').onclick=closeModal;if(onmount)onmount($('#mbody'))}
export function closeModal(){$('#modal-root').innerHTML=''}
const NAV=[['dashboard','Dashboard'],['assistant','AI Marketing Agent'],['studio','Content Studio'],['calendar','Content Calendar'],['trends','Trends'],['campaigns','Campaigns'],['accounts','Social Accounts'],['analytics','Analytics'],['media','Media Library'],['brand','Brand Kit'],['products','Products & Services'],['audience','Audience'],['automation','Automation'],['settings','Settings'],['admin','Admin'],['help','Help']];
export async function shell(){const orgs=await DB.recs('org');const org=orgs.find(o=>o.id===Session.orgId);
 $('#app').innerHTML=`<nav class="side" aria-label="Main"><img src="assets/logo.png" alt="Tradestack logo" onerror="this.style.display='none'"><div class="bname">TRADESTACK</div>${NAV.map(n=>`<a href="#/${n[0]}" data-r="${n[0]}" aria-label="${n[1]}"><span>${n[1]}</span></a>`).join('')}</nav><main><div class="top"><span class="badge">Org: ${esc(org?org.data.name:'—')}</span><select id="orgsel" aria-label="Switch organisation" style="width:auto">${orgs.map(o=>`<option value="${o.id}" ${o.id===Session.orgId?'selected':''}>${esc(o.data.name)}</option>`).join('')}<option value="__new">+ New organisation</option></select><span class="sp"></span><button class="ghost small" id="bell" aria-label="Notifications">🔔 <span id="ncount"></span></button><button class="red small" id="lockbtn">Lock</button></div><div id="main"></div></main>`;
 $('#orgsel').onchange=async e=>{if(e.target.value==='__new'){Session.orgId=null;ls.set('org',null);return onboarding()}Session.orgId=e.target.value;ls.set('org',Session.orgId);route()};
 $('#lockbtn').onclick=()=>{Session.unlocked=false;Session.key=null;boot()};
 $('#bell').onclick=async()=>{const n=await DB.recs('notification',Session.orgId);
  openModal('Notifications',n.slice(-20).reverse().map(x=>`<div class="kv"><div><b>${esc(x.data.title)}</b><br><span class="muted">${esc(x.data.body)}</span></div><span class="tiny">${new Date(x.ts).toLocaleString()}</span></div>`).join('')||'<p class="muted">No notifications.</p>');
  n.forEach(x=>{if(!x.data.read){x.data.read=true;DB.put('records',x)}})};
 const un=await DB.recs('notification',Session.orgId);$('#ncount').textContent=un.filter(x=>!x.data.read).length;
 window.addEventListener('hashchange',route);route()}
export async function route(){if(!Session.unlocked)return boot();if(!Session.orgId)return onboarding();
 const r=(location.hash||'#/dashboard').slice(2);document.querySelectorAll('nav a').forEach(a=>a.classList.toggle('on',a.dataset.r===r));
 const M={dashboard,V:1};// dispatch
 const f=VIEWS[r]||VIEWS.dashboard;if(!$('#main')){await shell();}$('#main').innerHTML='<p class="muted">Loading…</p>';await f($('#main'))}
const VIEWS={dashboard,dash:dashboard,assistant:V.assistant,studio:V.studio,calendar:V.calendar,trends:V.trends,campaigns:V.campaigns,accounts:V.accounts,analytics:V.analytics,media:V.media,brand:V.brand,products:V.products,audience:V.audience,automation:V.automation,settings:V.settings,admin:V.admin,help:V.help};
async function dashboard(el){const posts=await DB.recs('schedule',Session.orgId);const due=posts.filter(p=>['due','failed'].includes(p.status));
 const review=posts.filter(p=>p.status==='needs_review');const conns=await DB.recs('connection',Session.orgId);
 const trends=(await DB.recs('trend',Session.orgId)).slice(0,3);const sc=E.marketingScore(org0(),posts);
 const today=new Date().toDateString();const todayPosts=posts.filter(p=>new Date(p.scheduledAt).toDateString()===today);
 el.innerHTML=`<h1>Dashboard</h1>
 <div class="card"><b>What would you like to market today?</b>
 <form id="qk" style="display:flex;gap:8px;margin-top:8px"><input id="qktxt" placeholder="e.g. Create this week's content / Find trends / Analyze performance" aria-label="Ask the agent"><button class="gold">Ask</button></form>
 <div class="chips" style="margin-top:8px">${['Create this week\u2019s content','Find trends in my industry','Promote my newest product','Analyze last month\u2019s performance','Suggest the best time to post tomorrow'].map(c=>`<span class="chip" data-q="${esc(c)}" style="cursor:pointer">${esc(c)}</span>`).join('')}</div></div>
 <div class="grid g4"><div class="card"><h3>Today</h3><div class="score">${todayPosts.length}</div><span class="muted">posts scheduled today</span></div>
 <div class="card"><h3>Needs review</h3><div class="score">${review.length}</div><a href="#/calendar">Open approval queue</a></div>
 <div class="card"><h3>Action needed</h3><div class="score">${due.length}</div><a href="#/automation">Publish queue</a></div>
 <div class="card"><h3>Marketing score</h3><div class="score">${sc.score}</div><div class="bar"><i style="width:${sc.score}%"></i></div></div></div>
 <div class="grid g2"><div class="card"><h3>Upcoming posts</h3>${posts.filter(p=>['approved','scheduled'].includes(p.status)).slice(0,5).map(p=>`<div class="kv"><span>${esc(P.PLATFORMS[p.platform].name)} — ${esc((p.hook||p.topic||'').slice(0,50))}</span><span class="tiny">${new Date(p.scheduledAt).toLocaleString()}</span></div>`).join('')||'<p class="muted">Nothing scheduled. Use Content Studio or ask the agent.</p>'}</div>
 <div class="card"><h3>Connected accounts</h3>${conns.map(c=>`<div class="kv"><span>${P.PLATFORMS[c.platform].name}: ${esc(c.name)}</span><span class="ok">${c.status}</span></div>`).join('')||'<p class="muted">No accounts connected. <a href="#/accounts">Connect</a></p>'}</div>
 <div class="card"><h3>Trend alerts</h3>${trends.map(t=>`<div class="kv"><span>${esc(t.data.title.slice(0,70))}</span><span class="badge">${t.data.score}</span></div>`).join('')||'<p class="muted"><a href="#/trends">Run a trend scan</a></p>'}</div>
 <div class="card"><h3>AI recommendations</h3><div id="recs"><button id="recbtn">Generate recommendations</button></div></div></div>`;
 $('#qk').onsubmit=e=>{e.preventDefault();location.hash='#/assistant';setTimeout(()=>V.assistantAsk($('#qktxt').value),150)};
 el.querySelectorAll('[data-q]').forEach(c=>c.onclick=()=>{location.hash='#/assistant';setTimeout(()=>V.assistantAsk(c.dataset.q),150)});
 $('#recbtn').onclick=async e=>{e.target.disabled=true;const a=E.analyzePerformance(org0(),posts);
  e.target.outerHTML=a.notes.map(n=>`<p>• ${esc(n)}</p>`).join('')+(a.general?'<p class="muted">General guidance (labelled) — not enough measured data yet.</p>':'')}}
function org0(){return window.__org||{}}
export async function setOrgCache(){const o=await DB.rec('org',Session.orgId);window.__org=o?o.data:{business:{},brand:{},marketing:{}};
 window.__org.products=(await DB.recs('product',Session.orgId)).map(p=>p.data);
 window.__org.pillars=(await DB.recs('pillar',Session.orgId)).map(p=>p.data);
 window.__org.ctas=(await DB.recs('cta',Session.orgId)).map(p=>p.data);}
// ---------- AUTH ----------
export async function boot(){closeModal();const sec=await DB.get('records','auth');
 if(!sec){$('#app').innerHTML=`<div class="lock card"><img src="assets/logo.png" alt="" onerror="this.style.display='none'"><h1>Create your workspace</h1><p class="muted">A passcode protects this device's marketing data (PBKDF2 + AES-GCM).</p><form id="f"><label for="p1">Passcode (min 8 chars)</label><input id="p1" type="password" minlength="8" required><label for="p2">Confirm</label><input id="p2" type="password" minlength="8" required><p class="err" id="e"></p><button class="gold">Create workspace</button></form></div>`;
  $('#f').onsubmit=async e=>{e.preventDefault();const a=$('#p1').value,b=$('#p2').value;if(a!==b)return $('#e').textContent='Passcodes do not match';
   const salt=uid();await DB.put('records',{id:'auth',type:'auth',orgId:null,data:{salt,hash:await hashPass(a,salt)},ts:new Date().toISOString()});
   Session.key=await makeKey(a,salt);Session.unlocked=true;onboarding()};return}
 if(Session.unlocked)return shell();
 $('#app').innerHTML=`<div class="lock card"><img src="assets/logo.png" alt="" onerror="this.style.display='none'"><h1>Tradestack Marketing Agent</h1><form id="f"><label for="p">Passcode</label><input id="p" type="password" required><p class="err" id="e"></p><button class="gold">Unlock</button></form></div>`;
 $('#f').onsubmit=async e=>{e.preventDefault();const d=sec.data;const h=await hashPass($('#p').value,d.salt);
  if(h!==d.hash)return $('#e').textContent='Wrong passcode';Session.key=await makeKey($('#p').value,d.salt);Session.unlocked=true;
  Session.orgId=ls.get('org',null);if(Session.orgId)await setOrgCache();shell();if(Session.orgId)route()};}
// ---------- ONBOARDING ----------
const WSTEPS=['Business','Brand','Products','Audience','Marketing Goals','Social Accounts','Content Preferences','Review','Launch'];
export async function onboarding(){const st=window.__wiz=window.__wiz||{step:0,business:{},brand:{colours:{}},marketing:{},products:[]};
 const el=$('#main')||$('#app');const wrap=async html=>{if(!Session.orgId){$('#app').innerHTML=`<main style="max-width:760px;margin:auto;padding:20px"><img src="assets/logo.png" width="70" alt=""><div class="wiz">${WSTEPS.map((s,i)=>`<span class="${i===st.step?'on':i<st.step?'done':''}">${i+1} ${s}</span>`).join('')}</div><div class="card">${html}</div></main>`}else{$('#main').innerHTML=html}};
 const nav=(back)=>`<div style="margin-top:12px;display:flex;gap:8px">${back?'<button class="ghost" data-w="back">Back</button>':''}<button class="gold" data-w="next">${st.step>=8?'Launch Marketing Agent':'Continue →'}</button><button class="ghost" data-w="skip">Skip (optional)</button></div>`;
 if(st.step===0)await wrap(`<h1>Your business</h1>${V.fld([['name','Business name',1],['description','Description',1,'textarea'],['industry','Industry'],['niche','Niche'],['subniche','Sub-niche'],['location','Location'],['regions','Countries/regions served'],['website','Website'],['email','Business email'],['phone','Phone'],['whatsapp','WhatsApp number'],['address','Physical address',0,'textarea'],['hours','Business hours'],['delivery','Delivery areas'],['languages','Languages'],['target','Target market']],st.business)}${nav()}`);
 if(st.step===1)await wrap(`<h1>Brand</h1>${V.fld([['slogan','Slogan / tagline'],['voice','Brand voice'],['personality','Brand personality'],['tone','Preferred tone',0,'select',Object.keys({professional:1,friendly:1,bold:1,playful:1,empathetic:1})],['useWords','Words to use (comma separated)'],['avoidWords','Words to avoid (comma separated)']],st.brand)}<label>Primary colour</label><input type="color" name="c1" value="${st.brand.colours.primary||'#0e2a5c'}"><label>Secondary colour</label><input type="color" name="c2" value="${st.brand.colours.secondary||'#c9a227'}"><label>Logo upload</label><input type="file" id="logoUp" accept="image/*">${nav(true)}`);
 if(st.step===2)await wrap(`<h1>Products & services</h1><div id="plist">${st.products.map((p,i)=>`<div class="kv"><span>${esc(p.name||'Unnamed')}</span><button class="small ghost" data-del="${i}">Remove</button></div>`).join('')||'<p class="muted">None yet.</p>'}</div><details><summary><b>+ Add product/service</b></summary>${V.fld([['pname','Name',1],['pdesc','Description',0,'textarea'],['pcat','Category'],['pprice','Price',0,'number'],['pfeat','Features',0,'textarea'],['pben','Benefits',0,'textarea'],['ptarget','Target customer'],['pprob','Problems solved',0,'textarea'],['pusp','Unique selling proposition',0,'textarea'],['purl','Product / purchase URL'],['pclaims','Allowed claims',0,'textarea'],['pnoclaims','Claims that must NOT be made',0,'textarea']],{})}<button id="padd">Add</button></details>${nav(true)}`);
 if(st.step===3)await wrap(`<h1>Audience</h1>${V.fld([['targetAudience','Target audience',0,'textarea'],['personas','Customer personas (one per line)',0,'textarea'],['competitors','Competitors (one per line)',0,'textarea'],['cwebs','Competitor websites (one per line)',0,'textarea']],st.marketing)}${nav(true)}`);
 if(st.step===4)await wrap(`<h1>Marketing goals</h1>${V.fld([['goals','Primary goals (awareness, leads, sales…)',0,'textarea'],['salesGoal','Sales goal'],['leadGoal','Lead-gen goal'],['trafficGoal','Website traffic goal'],['keywords','Keywords (comma separated)'],['preferredHashtags','Preferred hashtags (comma separated)'],['seasonal','Seasonal campaigns / important dates',0,'textarea'],['promos','Current promotions',0,'textarea'],['budget','Marketing budget (if any)'],['faqs','Customer FAQs (one per line)',0,'textarea']],st.marketing)}${nav(true)}`);
 if(st.step===5)await wrap(`<h1>Social accounts</h1><p class="muted">You can connect now or later in <b>Social Accounts</b>. We never ask for passwords — official OAuth only.</p><button id="connNow">Connect Facebook (official OAuth)</button>${nav(true)}`);
 if(st.step===6)await wrap(`<h1>Content preferences</h1><label>Platforms</label><div class="chips">${Object.keys(P.PLATFORMS).map(k=>`<label style="font-weight:400"><input type="checkbox" name="pf" value="${k}" style="width:auto" ${(st.marketing.platforms||['facebook','instagram']).includes(k)?'checked':''}> ${P.PLATFORMS[k].name}</label>`).join('')}</div><label>Posts per week per platform</label><input type="number" name="frequency" min="1" max="14" value="${st.marketing.frequency||3}"><label>Automation level</label><select name="auto">${[1,2,3,4].map(l=>`<option value="${l}" ${(st.marketing.auto||3)==l?'selected':''}>L${l} — ${['AI suggestions only','AI drafts','AI schedules after approval','AI auto-publishes approved'][l-1]}</option>`).join('')}</select>${nav(true)}`);
 if(st.step===7)await wrap(`<h1>Review</h1><pre style="white-space:pre-wrap;background:#f2f4fa;border-radius:8px;padding:10px">${esc(JSON.stringify({business:st.business,brand:st.brand,marketing:st.marketing,products:st.products},null,1))}</pre>${nav(true)}`);
 if(st.step>=8){await launch();return}
 async function launch(){const org=await DB.putRec('org',null,{name:st.business.name||'My Business',business:st.business,brand:st.brand,marketing:st.marketing});
  for(const p of st.products)await DB.putRec('product',org.id,p);
  for(const pn of (st.marketing.personas||'').split('\n').filter(Boolean))await DB.putRec('persona',org.id,{name:pn});
  for(const cn of (st.marketing.competitors||'').split('\n').filter(Boolean))await DB.putRec('competitor',org.id,{name:cn});
  for(const d of ['Education','Product','Problem','Proof','Story','Community'])await DB.putRec('pillar',org.id,{name:d});
  if(st.business.whatsapp)await DB.putRec('cta',org.id,{text:'WhatsApp us',kind:'whatsapp',value:st.business.whatsapp});
  if(st.business.website)await DB.putRec('cta',org.id,{text:'Visit website',kind:'website',value:st.business.website});
  const s=await getSettings();s.automationLevel=st.marketing.auto||3;await saveSettings(s);
  Session.orgId=org.id;ls.set('org',org.id);await setOrgCache();await audit(org.id,'onboarding','completed');
  window.__wiz=null;shell();location.hash='#/dashboard'}
 document.querySelectorAll('[data-w]').forEach(b=>b.onclick=async e=>{
  if(b.dataset.w==='next'||b.dataset.w==='skip'){collect();st.step++;onboarding()}else{st.step--;onboarding()}});
 function collect(){const f=$('#app');const grab=n=>{const i=f.querySelector(`[name=${n}]`);return i?i.value:undefined};
  if(st.step===0)['name','description','industry','niche','subniche','location','regions','website','email','phone','whatsapp','address','hours','delivery','languages','target'].forEach(k=>{const v=grab(k);if(v!==undefined)st.business[k]=v});
  if(st.step===1){['slogan','voice','personality','tone','useWords','avoidWords'].forEach(k=>{const v=grab(k);if(v!==undefined)st.brand[k]=v});st.brand.colours={primary:f.querySelector('[name=c1]').value,secondary:f.querySelector('[name=c2]').value};
   const lu=f.querySelector('#logoUp');if(lu&&lu.files[0])V.saveMedia(lu.files[0]).then(m=>st.brand.logoMedia=m.id)}
  if(st.step===2){const add=f.querySelector('#padd');if(add)add.onclick=()=>{const p={};[['pname','name'],['pdesc','description'],['pcat','category'],['pprice','price'],['pfeat','features'],['pben','benefits'],['ptarget','target'],['pprob','problems'],['pusp','usp'],['purl','url'],['pclaims','allowedClaims'],['pnoclaims','forbiddenClaims']].forEach(([a,b2])=>{const v=grab(a);if(v)p[b2]=v});if(p.name){st.products.push(p);toast('Product added','ok');onboarding()}};
   f.querySelectorAll('[data-del]').forEach(d=>d.onclick=()=>{st.products.splice(+d.dataset.del,1);onboarding()})}
  if(st.step===3)['targetAudience','personas','competitors','cwebs'].forEach(k=>{const v=grab(k);if(v!==undefined)st.marketing[k]=v});
  if(st.step===4)['goals','salesGoal','leadGoal','trafficGoal','keywords','preferredHashtags','seasonal','promos','budget','faqs'].forEach(k=>{const v=grab(k);if(v!==undefined)st.marketing[k]=v});
  if(st.marketing.preferredHashtags)st.marketing.preferredHashtags=String(st.marketing.preferredHashtags).split(',').map(s=>s.trim());
  if(st.marketing.keywords)st.marketing.keywords=String(st.marketing.keywords).split(',').map(s=>s.trim());
  if(st.step===6){st.marketing.platforms=[...f.querySelectorAll('[name=pf]:checked')].map(i=>i.value);st.marketing.frequency=+grab('frequency')||3;st.marketing.auto=+grab('auto')}}
 const cn=$('#connNow');if(cn)cn.onclick=async()=>{try{await P.metaConnect();toast('Facebook connected','ok')}catch(e){toast(e.message,'err')}}}
