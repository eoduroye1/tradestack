// engines.js — pure business engines (testable, no I/O)
export const STOP=new Set('the a an and or of to in for on with from at by is are be this that it as its you your we our us i'.split(' '));
export const tok=t=>String(t||'').toLowerCase().split(/[^a-z0-9#+]+/).filter(w=>w.length>2&&!STOP.has(w));
export const jaccard=(a,b)=>{const A=new Set(a),B=new Set(b);if(!A.size||!B.size)return 0;let i=0;A.forEach(w=>{if(B.has(w))i++});let u=0;A.forEach(w=>{u++});B.forEach(w=>{if(!A.has(w))u++});return i/u};
export const DIMS={instagram_square:[1080,1080],instagram_portrait:[1080,1350],story:[1080,1920],facebook:[1200,630],linkedin:[1200,627],x:[1600,900],pinterest:[1000,1500],youtube:[1280,720]};
export const dimsFor=p=>({facebook:DIMS.facebook,instagram:DIMS.instagram_portrait,linkedin:DIMS.linkedin,x:DIMS.x,pinterest:DIMS.pinterest,youtube:DIMS.youtube,tiktok:DIMS.story,whatsapp:DIMS.facebook}[p]||DIMS.facebook);

// ---------- COMPLIANCE ----------
const PAT=[
 {re:/\bguaranteed\b/gi,l:'review',m:'Absolute guarantee claim needs substantiation',r:'designed to deliver'},
 {re:/\b100%\s*(effective|safe|pure|natural)\b/gi,l:'review',m:'Unverified absolute claim',r:'carefully formulated'},
 {re:/\b(cure|cures|cured|heals|treats|prevents|reverses)\b/gi,l:'high',m:'Health/medical claim — verify & approve before publishing',r:'may support'},
 {re:/\b(lose\s+\d+\s*(kg|lbs|pounds)|weight\s+loss\s+in\s+\d+)\b/gi,l:'high',m:'Weight-loss outcome claim',r:'supports healthy habits'},
 {re:/\b(guaranteed\s+(returns|profits|income)|double\s+your\s+money|get\s+rich)\b/gi,l:'high',m:'Financial outcome claim',r:'potential results vary'},
 {re:/\b(no\s+risk|risk[-\s]?free)\b/gi,l:'review',m:'Risk claim',r:'low commitment'},
 {re:/\b(you\s+won'?t\s+believe|shocking|they\s+don'?t\s+want\s+you\s+to\s+know|go\s+viral|exploded)\b/gi,l:'review',m:'Clickbait signal',r:'worth knowing'},
 {re:/\b(best|number\s+one|#1|leading|world'?s\s+finest)\b/gi,l:'review',m:'Superlative needs evidence',r:'a trusted'},
 {re:/\b(kill|destroy|annihilate)\b(?!er)/gi,l:'review',m:'Aggressive language',r:'outperform'},
 {re:/\b(idiot|stupid|moron|loser|hate\s+(group|people))\b/gi,l:'blocked',m:'Abusive/hate content',r:''}];
const HCAP={instagram:12,facebook:5,linkedin:3,x:2,tiktok:5,pinterest:5,youtube:3};
export function complianceCheck(text,platform,hashtags){
 const issues=[];let score=100;let out=String(text||'');
 for(const p of PAT){if(p.re.test(text)){issues.push({level:p.l,msg:p.m});score-=p.l==='blocked'?100:p.l==='high'?35:15;if(p.r)out=out.replace(p.re,p.r)}p.re.lastIndex=0}
 const n=(hashtags||[]).length,cap=HCAP[platform]??8;
 if(n>cap){issues.push({level:'review',msg:`${n} hashtags exceeds recommended ${cap} for ${platform}`});score-=10}
 const letters=(text.match(/[a-z]/gi)||[]).length,caps=(text.match(/[A-Z]/g)||[]).length;
 if(letters>30&&caps/letters>0.5){issues.push({level:'review',msg:'Excessive capitalisation reads as shouting'});score-=10}
 let level='safe';if(issues.some(i=>i.level==='blocked'))level='blocked';else if(issues.some(i=>i.level==='high'))level='high';else if(issues.length)level='review';
 return{level,score:Math.max(0,score),issues,rewrite:out!==String(text)?out:null}}

// ---------- HASHTAGS ----------
export function hashtagSets(org,ctx,platform){
 const b=org.business||{},br=org.brand||{},mk=org.marketing||{};
 const banned=new Set((mk.bannedHashtags||[]).map(h=>h.toLowerCase().replace(/^#/,'')));
 const cap=HCAP[platform]??8;const clean=l=>[...new Set(l.map(h=>h.toLowerCase().replace(/[^a-z0-9_]/g,'')).filter(h=>h&&!banned.has(h)))];
 const brand=clean([(b.name||'tradestack').replace(/\s+/g,'')]);
 const niche=clean(tok(b.industry+' '+b.niche+' '+(b.subniche||'')).slice(0,4));
 const loc=clean(tok(b.location||'').slice(0,2));
 const prod=clean(tok((ctx.product&&ctx.product.name)||'').slice(0,2));
 const trend=clean(tok(ctx.topic||'').slice(0,3));
 const pref=clean(mk.preferredHashtags||[]);
 let all=[...brand,...pref,...prod,...niche,...trend,...loc].slice(0,cap);
 return{brand,niche,location:loc,product:prod,trending:trend,flat:all}}

// ---------- BEST TIMES ----------
function baseScore(p,d,h){const P={facebook:[12,-6,[9,10,11,13,15]],instagram:[6,6,[11,12,13,18,19,20]],linkedin:[14,-12,[8,9,10,12,17]],x:[8,-2,[9,12,13,17]],tiktok:[4,10,[18,19,20,21]],youtube:[2,12,[15,16,17,20]],pinterest:[2,8,[20,21,22]],whatsapp:[6,2,[10,12,17]]}[p]||[5,0,[12]];
 let s=50+(d<5?P[0]:P[1]);if(P[2].includes(h))s+=18;else if(h>=8&&h<=20)s+=6;else s-=15;return s}
export function bestTimes(platform,posts,n=5){
 const hist={};let cnt=0;
 for(const p of posts||[]){if(p.status==='published'&&p.metrics&&p.metrics.engagement!=null&&p.metrics.reach>0){const d=(new Date(p.scheduledAt).getDay()+6)%7,h=new Date(p.scheduledAt).getHours(),k=d+'_'+(h-h%2);
  hist[k]=hist[k]||{s:0,c:0};hist[k].s+=(p.metrics.engagement/p.metrics.reach)*1000;hist[k].c++;cnt++}}
 const w=cnt>=3?Math.min(0.6,(cnt/20)*0.6):0;const slots=[];
 for(let d=0;d<7;d++)for(let h=7;h<=21;h++){let s=baseScore(platform,d,h);const hk=hist[d+'_'+(h-h%2)];
  if(w&&hk)s=s*(1-w)+Math.min(100,hk.s/hk.c)*w;slots.push({d,h,score:Math.round(s)})}
 slots.sort((a,b)=>b.score-a.score);
 const conf=cnt<5?'Low — general platform guidance':cnt<20?'Medium — blending your early data':'High — based on your performance data';
 const days=['Mon','Tue','Wed','Thu','Fri','Sat','Sun'];
 return{top:slots.slice(0,n).map(s=>({day:days[s.d],hour:s.h,score:s.score,confidence:conf,reason:w?`Blend of platform guidance + ${cnt} of your measured posts`:'Industry-general activity patterns for '+platform})),sample:cnt}}

// ---------- OFFLINE GENERATION (rules engine fallback) ----------
const HOOKS={educational:['Quick guide: {topic}','3 things most people get wrong about {topic}','How {topic} actually works — in plain language','Save this checklist for {topic}'],
 problem:['Still struggling with {topic}?','The real reason {topic} isn\u2019t working for you','If {topic} keeps letting you down, read this','Most {topic} mistakes are avoidable'],
 promotional:['New from {biz}: {product}','This week\u2019s pick: {product}','{product} \u2014 built for {aud}','Want {product}? Here\u2019s the easy way'],
 story:['Behind the scenes at {biz}','Why we started {biz}','A customer moment we won\u2019t forget','From idea to {product}: the honest version'],
 proof:['What customers tell us about {product}','A real result from {biz}','FAQ: \u201c{q}\u201d','You asked, we answered: {topic}']};
const TONEADJ={professional:'Clear, practical, no hype.',friendly:'Warm and conversational.',bold:'Direct and confident.',playful:'Light-hearted and fun.',empathetic:'Understanding and supportive.'};
function fill(t,c){return t.replace(/\{(\w+)\}/g,(m,k)=>c[k]||k)}
export function offlineGenerate(org,p){
 const b=org.business||{},pr=p.product||{},aud=p.audience||(org.marketing&&org.marketing.targetAudience)||'our customers';
 const ctx={topic:p.topic||b.niche||'your industry',biz:b.name||'our business',product:pr.name||'our service',aud,q:(org.marketing&&org.marketing.faqs&&org.marketing.faqs[0])||p.topic||'How do I order?'};
 const pool=HOOKS[p.pillar]||HOOKS.educational;const hook=fill(pool[Math.floor(Math.random()*pool.length)],ctx);
 const bits=[];
 if(pr.benefits)bits.push('Why it helps: '+pr.benefits);if(pr.features)bits.push('What you get: '+pr.features);
 if(pr.problems)bits.push('It solves: '+pr.problems);if(pr.usp)bits.push('What makes it different: '+pr.usp);
 if(!bits.length&&b.description)bits.push(b.description);
 const tone=TONEADJ[p.tone]||TONEADJ.professional;
 let body=bits.slice(0,3).join(' ')+(p.tone?(' Tone: '+tone):'');
 const cta=p.cta?`${p.cta.text||'Contact us'}: ${p.cta.value||''}`.trim():(b.website||'');
 const hs=hashtagSets(org,{product:pr,topic:p.topic},p.platform).flat;
 const cap={x:280,linkedin:3000,instagram:2200,facebook:5000,tiktok:2200,pinterest:500,youtube:5000}[p.platform]||2200;
 let caption;
 if(p.platform==='x'){caption=(hook+' '+(pr.benefits||b.description||'').split('. ')[0]+'. '+(cta?'👉 '+cta:'')).slice(0,277)}
 else if(p.platform==='linkedin'){caption=hook+'\n\n'+body+'\n\n'+(cta?cta:'')+(hs.length?'\n\n'+hs.slice(0,3).map(h=>'#'+h).join(' '):'')}
 else if(p.platform==='pinterest'){caption=(hook+' — '+(pr.description||b.description||body)).slice(0,497)+' '+(cta||'')}
 else if(p.platform==='youtube'){caption='TITLE: '+hook.slice(0,97)+'\n\n'+body+'\n\n'+(cta?cta:'')+'\n\n'+hs.slice(0,3).map(h=>'#'+h).join(' ')}
 else{caption=hook+'\n\n'+body+'\n\n'+(cta?'👉 '+cta:'')+(hs.length?'\n\n'+hs.map(h=>'#'+h).join(' '):'')}
 if(caption.length>cap)caption=caption.slice(0,cap-1)+'…';
 return{hook,caption,hashtags:hs,cta,imageBrief:visualBrief(org,p,pr,hook)}}
export function visualBrief(org,p,pr,hook){const br=org.brand||{},d=dimsFor(p.platform);
 return{concept:`Branded ${p.format||'post'} visual for "${(p.topic||pr.name||'').slice(0,60)}"`,dims:d,
 textOnVisual:(hook||'').slice(0,80),colors:`Background ${br.colours&&br.colours.primary||'#0e2a5c'}, accent ${br.colours&&br.colours.secondary||'#c9a227'}`,
 logo:'Top-left, unmodified, on clear space',product:pr.name?('Feature '+pr.name+' imagery (use uploaded photo)'):'Use brand pattern',
 ctaOnVisual:p.cta?p.cta.text||'':'',format:'PNG',style:br.personality||'Professional, clean'}}

// ---------- REPETITION ----------
export function repetitionCheck(caption,posts){const t=tok(caption);let worst=null;
 for(const p of (posts||[]).slice(0,40)){const s=jaccard(t,tok(p.caption));if(!worst||s>worst.sim)worst={sim:s,topic:p.topic}}
 return worst&&worst.sim>0.6?{warn:true,sim:Math.round(worst.sim*100),msg:`Very similar to a recent post (${worst.sim*100|0}% overlap). Consider a fresh angle.`}:{warn:false}}

// ---------- TREND SCORING ----------
export function scoreTrends(org,items){const b=org.business||{},mk=org.marketing||{};
 const bizT=tok([b.industry,b.niche,b.subniche,(mk.keywords||[]).join(' ')].join(' '));
 const prodT=tok(((org.products||[]).map(x=>x.name+' '+x.category).join(' ')));
 const seen=[];const out=items.map(it=>{const t=tok(it.title);
  const rel=t.length?jaccardish(t,bizT):0;const bizP=jaccardish(t,prodT);
  const age=(Date.now()-new Date(it.date||Date.now()).getTime())/86400000;const fresh=Math.exp(-Math.max(0,age)/7);
  const growth=seen.filter(s=>jaccard(t,s)>0.4).length;seen.push(t);
  const score=Math.round(100*(0.4*rel+0.25*bizP+0.2*fresh+0.15*Math.min(1,growth/2)));
  const angle=rel>bizP?'Educational explainer tied to your niche':'Product tie-in angle';
  return Object.assign({},it,{score,angle,growth:growth>0?'rising':'new',platform:score>50?'instagram':'facebook'})});
 out.sort((a,b)=>b.score-a.score);return out}
function jaccardish(a,b){if(!a.length||!b.length)return 0;let i=0;const B=new Set(b);a.forEach(w=>{if(B.has(w))i++});return i/Math.max(a.length,1)}

// ---------- 30-DAY PLAN ----------
export function buildPlan(org,posts,days){
 const mk=org.marketing||{};const perWeek=mk.frequency||3;const platforms=(mk.platforms&&mk.platforms.length)?mk.platforms:['facebook','instagram'];
 const pillars=(org.pillars&&org.pillars.length?org.pillars.map(p=>p.name):['Education','Product','Problem','Proof','Story']);
 const bt={};platforms.forEach(pf=>bt[pf]=bestTimes(pf,posts).top);
 const prods=org.products||[];const topics=[...prods.map(p=>p.name),...(mk.keywords||[])];
 const out=[];const start=new Date();let pi=0,ti=0;
 const total=Math.round(days/7*perWeek*platforms.length);
 for(let i=0;i<total;i++){const pf=platforms[i%platforms.length];const slot=bt[pf][i%bt[pf].length];
  const d=new Date(start);d.setDate(d.getDate()+1+Math.floor(i/platforms.length)*Math.floor(7/Math.max(1,perWeek)));
  d.setHours(slot.hour,0,0,0);
  const pillar=pillars[pi++%pillars.length];const topic=topics.length?topics[ti++%topics.length]:null;
  out.push({platform:pf,pillar,topic,scheduledAt:d.toISOString(),slot})}
 return out}

// ---------- MARKETING SCORE & ANALYSIS ----------
export function marketingScore(org,posts){const parts=[];const pub=posts.filter(p=>p.status==='published');
 const weeks=Math.max(1,(Date.now()-new Date(posts.length?posts[posts.length-1].createdAt:Date.now()).getTime())/604800000);
 const rate=pub.length/weeks;const target=(org.marketing&&org.marketing.frequency)||3;
 parts.push({k:'Posting consistency',v:Math.min(100,rate/target*100),avail:pub.length>0,why:`${pub.length} published vs target ${target}/wk`});
 const pil=new Set(posts.map(p=>p.pillar));parts.push({k:'Content variety',v:Math.min(100,pil.size/5*100),avail:posts.length>0,why:`${pil.size} pillars used`});
 const withM=pub.filter(p=>p.metrics&&p.metrics.reach>0);
 if(withM.length){const er=withM.reduce((s,p)=>s+p.metrics.engagement/p.metrics.reach,0)/withM.length;
  parts.push({k:'Engagement rate',v:Math.min(100,er*1000),avail:true,why:`avg ${(er*100).toFixed(2)}%`})}
 else parts.push({k:'Engagement rate',v:0,avail:false,why:'Data unavailable — connect accounts or log metrics'});
 const ctas=posts.filter(p=>p.cta).length;parts.push({k:'CTA usage',v:posts.length?ctas/posts.length*100:0,avail:posts.length>0,why:`${ctas} of ${posts.length} posts`});
 const avail=parts.filter(p=>p.avail);const score=avail.length?Math.round(avail.reduce((s,p)=>s+p.v,0)/avail.length):0;
 return{score,parts}}
export function analyzePerformance(org,posts){const pub=posts.filter(p=>p.metrics&&p.metrics.reach>0);
 if(pub.length<3)return{general:true,notes:['Not enough measured posts yet (need 3+). Recommendations below are general best practice, labeled as such.','(General) Mix education + proof content; keep promotion under ~30%.','(General) Post consistently; use your top 3 hashtags only where relevant.']};
 const grp={};pub.forEach(p=>{const k=p.pillar||'Other';grp[k]=grp[k]||[];grp[k].push(p.metrics.engagement/p.metrics.reach)});
 const rows=Object.entries(grp).map(([k,v])=>[k,v.reduce((a,b)=>a+b,0)/v.length]).sort((a,b)=>b[1]-a[1]);
 const notes=[`Your "${rows[0][0]}" content averages ${(rows[0][1]*100).toFixed(2)}% engagement vs ${(rows[rows.length-1][1]*100).toFixed(2)}% for "${rows[rows.length-1][0]}".`,
 `Post more ${rows[0][0]}; reduce or rework ${rows[rows.length-1][0]}.`];
 const bt=bestTimes(rows.length?pub[0].platform:'facebook',posts);notes.push(`Your strongest measured window: ${bt.top[0].day} ${bt.top[0].hour}:00.`);
 return{general:false,notes,rows}}
