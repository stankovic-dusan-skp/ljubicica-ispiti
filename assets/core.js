/* ============================================================
   Moji ispiti · zajedničke funkcije za sve stranice
   - trajno čuvanje rezultata (bez brisanja posle 24 h)
   - „Moje greške” sa ponavljanjem u razmacima (odmah, sutra, za 3 dana)
   - stanje lekcija i preporuka sledećeg koraka
   - datumi ispita, položeni predmeti, aktivnost po danima
   - prenos napretka na drugi uređaj (link ili fajl)
   ============================================================ */
(function(){
'use strict';
const DAY=864e5,PASS=51,MASTER=81,KEEP=25;
const K={dates:'ispiti-datumi-v1',passed:'ispiti-polozeno-v2',act:'ispiti-aktivnost-v1',read:'ispiti-procitano-v1',theme:'ispiti-tema'};
/* Registar predmeta: ključevi pod kojima stranica predmeta čuva rezultate i greške */
const REG=[
  {slug:'javno-zdravlje',s:'jz',key:'testovi-javno-zdravlje-v1',wkey:'testovi-javno-zdravlje-greske-v1'},
  {slug:'poslovna-komunikacija',s:'vpk',key:'testovi-poslovna-komunikacija-v1',wkey:'testovi-poslovna-komunikacija-greske-v1'},
  {slug:'metodologija-zo',s:'mzo',key:'testovi-metodologija-zo-v1',wkey:'testovi-metodologija-zo-greske-v1'},
  {slug:'organizacija-zdravstva',s:'oz',key:'testovi-zdravstvo-v1',wkey:'testovi-zdravstvo-greske-v1'}
];
/* Unapred upisani položeni predmeti (važe na svakom uređaju) */
const PRESET={'organizacija-zdravstva':{d:'2026-10-10',o:10}};

let LS=null;try{const t='__ispiti';localStorage.setItem(t,t);localStorage.removeItem(t);LS=localStorage}catch(e){}
const get=k=>{try{return LS?JSON.parse(LS.getItem(k)):null}catch(e){return null}};
const set=(k,v)=>{try{if(!LS)return false;LS.setItem(k,JSON.stringify(v));return true}catch(e){return false}};
const del=k=>{try{LS&&LS.removeItem(k)}catch(e){}};

/* ---------- tema ---------- */
function applyTheme(){const t=LS?LS.getItem(K.theme):null;if(t==='light'||t==='dark')document.documentElement.dataset.theme=t;else delete document.documentElement.dataset.theme}
function setTheme(t){try{if(t==='light'||t==='dark')LS.setItem(K.theme,t);else LS.removeItem(K.theme)}catch(e){}applyTheme()}
const theme=()=>{const t=LS?LS.getItem(K.theme):null;return t==='light'||t==='dark'?t:'auto'};
applyTheme();

/* ---------- pomoćne ---------- */
const esc=s=>String(s==null?'':s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'})[c]);
const fmt=n=>{n=Math.round(n*10)/10;return Number.isInteger(n)?String(n):n.toFixed(1).replace('.',',')};
const pl=(n,a,b,c)=>{n=Math.abs(n);const m=n%10,h=n%100;return m===1&&h!==11?a:m>=2&&m<=4&&(h<12||h>14)?b:c};
const dayStart=t=>{const d=new Date(t);d.setHours(0,0,0,0);return d.getTime()};
const iso=t=>{const d=new Date(t);return d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0')+'-'+String(d.getDate()).padStart(2,'0')};
const today=()=>iso(Date.now());
const parseIso=s=>{const [y,m,d]=String(s).split('-').map(Number);return new Date(y,m-1,d).getTime()};
function daysTo(s){if(!s)return null;return Math.round((parseIso(s)-dayStart(Date.now()))/DAY)}
const MON=['januara','februara','marta','aprila','maja','juna','jula','avgusta','septembra','oktobra','novembra','decembra'];
const WD=['nedelja','ponedeljak','utorak','sreda','četvrtak','petak','subota'],WDS=['ned','pon','uto','sre','čet','pet','sub'];
const dateLong=s=>{const d=new Date(parseIso(s));return WD[d.getDay()]+', '+d.getDate()+'. '+MON[d.getMonth()]};
const dateShort=s=>{const d=new Date(parseIso(s));return WDS[d.getDay()]+', '+d.getDate()+'. '+(d.getMonth()+1)+'.'};
const dateNum=s=>{const [y,m,d]=String(s).split('-');return `${+d}. ${+m}. ${y}.`};
const dani=n=>pl(n,'dan','dana','dana');
function dueText(n){return n===0?'danas':n===1?'sutra':n<0?'prošao':'za '+n+' '+dani(n)}

/* ---------- rezultati (trajno) ---------- */
function results(key){const h=get(key);return h&&typeof h==='object'?h:{}}
function addResult(key,id,rec){const h=results(key),a=(h[id]=Array.isArray(h[id])?h[id]:[]);a.push(rec);
  if(a.length>KEEP){const b=bestRec(a),keep=a.slice(-KEEP+1);if(!keep.includes(b))keep.unshift(b);h[id]=keep}
  set(key,h)}
const pct=r=>r&&r.max?r.pts/r.max*100:0;
const bestRec=a=>a&&a.length?a.reduce((m,x)=>pct(x)>pct(m)?x:m):null;
function bestPct(h,id){const b=bestRec(h[id]);return b?Math.round(pct(b)):null}

/* ---------- moje greške: ponavljanje u razmacima ----------
   pogrešan odgovor → kutija 1 (za ponavljanje odmah)
   tačan kad je na redu → kutija 2 (sutra) → kutija 3 (za 3 dana) → savladano (briše se) */
const GAP=[0,1,3];
function wrong(wkey){const w=get(wkey);if(!w||typeof w!=='object')return{};let fix=false;
  for(const k of Object.keys(w)){const v=w[k];if(typeof v==='number'){w[k]={b:1,due:0};fix=true}else if(!v||typeof v!=='object'){delete w[k];fix=true}}
  if(fix)set(wkey,w);return w}
function markWrong(w,q){w[q]={b:1,due:0}}
function markRight(w,q,now){const v=w[q];if(!v)return false;now=now||Date.now();if(v.due>now)return false;
  const b=v.b+1;if(b>GAP.length){delete w[q];return true}w[q]={b,due:dayStart(now)+GAP[b-1]*DAY};return true}
const isDue=(v,now)=>v&&v.due<=(now||Date.now());
function wrongStats(w){const now=Date.now(),v=Object.values(w);const due=v.filter(x=>isDue(x,now)).length;
  const next=v.filter(x=>!isDue(x,now)).reduce((m,x)=>Math.min(m,x.due),Infinity);return{total:v.length,due,next:next===Infinity?null:next}}

/* ---------- aktivnost po danima ---------- */
function logActivity(n){if(!n)return;const a=get(K.act)||{},d=today();a[d]=(a[d]||0)+n;
  const ks=Object.keys(a).sort();if(ks.length>400)ks.slice(0,ks.length-400).forEach(k=>delete a[k]);set(K.act,a)}
const activity=()=>get(K.act)||{};
function streak(a){a=a||activity();let n=0,t=dayStart(Date.now());if(!a[iso(t)])t-=DAY;while(a[iso(t)]){n++;t-=DAY}return n}

/* ---------- pročitane lekcije u skripti ---------- */
const readAll=()=>get(K.read)||{};
function setRead(slug,li,on){const r=readAll(),o=r[slug]=r[slug]||{};if(on)o[li]=Date.now();else delete o[li];set(K.read,r)}
const isRead=(slug,li)=>!!((readAll()[slug]||{})[li]);

/* ---------- datumi i položeni predmeti ---------- */
const dates=()=>get(K.dates)||{};
function setDate(slug,v){const d=dates();if(v)d[slug]=v;else delete d[slug];set(K.dates,d)}
const passedRaw=()=>get(K.passed)||{};
function passedMap(){const r=passedRaw(),o={};for(const k in r)if(r[k])o[k]=r[k];for(const k in PRESET)o[k]=PRESET[k];return o}
function setPassed(slug,val){const p=passedRaw();p[slug]=val||false;set(K.passed,p)}
del('ispiti-polozeno-v1');

/* ---------- stanje lekcija i preporuka ----------
   tests: [[id, indeksLekcije, naslov, brojPitanja], ...]
   nije rađeno · u toku (l1 manje od pola testova, l2 pola i više)
   savladano (l3): svi testovi lekcije urađeni sa najmanje 81%
   za ponavljanje (weak): prosek najboljih rezultata ispod 51% */
function lessonStates(h,tests,n){
  return Array.from({length:n},(_,li)=>{const ts=tests.filter(t=>t[1]===li),bs=ts.map(t=>bestPct(h,t[0])),done=bs.filter(b=>b!==null);
    const avg=done.length?Math.round(done.reduce((a,b)=>a+b,0)/done.length):null;
    let st='none';if(done.length){if(avg<PASS)st='weak';else if(done.length===ts.length&&bs.every(b=>b>=MASTER))st='l3';else st=done.length*2>=ts.length?'l2':'l1'}
    return{li,st,avg,done:done.length,total:ts.length,tests:ts.map((t,i)=>({id:t[0],title:t[2],n:t[3],best:bs[i]}))}});
}
const ST_LABEL={none:'nije rađeno',l1:'u toku',l2:'u toku',l3:'savladano',weak:'za ponavljanje'};
function nextStep(sub,h,w){
  const L=lessonStates(h,sub.tests,sub.lessons.length),ws=wrongStats(w),lt=li=>'Lekcija '+(li+1)+': '+sub.lessons[li];
  const read=li=>({label:'Otvori skriptu na lekciji '+(li+1),href:'skripta.html#l'+(li+1)});
  const sim=bestPct(h,'ispit');
  const weak=L.filter(x=>x.st==='weak').sort((a,b)=>a.avg-b.avg)[0];
  if(weak){const t=weak.tests.filter(t=>t.best!==null).sort((a,b)=>a.best-b.best)[0];
    return{kind:'weak',li:weak.li,id:t.id,title:lt(weak.li),why:`Ova lekcija ti ide najslabije (${weak.avg}%). Pročitaj je ponovo u skripti, pa ponovi ${t.title} (najbolje ${t.best}%).`,
      primary:{label:'Ponovi '+t.title,href:'#test='+t.id},secondary:read(weak.li),L,ws,sim}}
  if(ws.due>=10)return{kind:'greske',li:null,title:'Ponavljanje grešaka',why:`${ws.due} ${pl(ws.due,'pitanje čeka','pitanja čekaju','pitanja čeka')} ponavljanje danas. Kratko je, a najviše utvrđuje gradivo.`,
    primary:{label:'Ponovi greške ('+ws.due+')',href:'#greske'},secondary:{label:'Otvori skriptu',href:'skripta.html'},L,ws,sim};
  const open=L.find(x=>x.st!=='l3');
  if(open){const un=open.tests.find(t=>t.best===null);
    if(open.st==='none'){const t=open.tests[0];return{kind:'lesson',li:open.li,id:t.id,title:lt(open.li),
      why:open.li===0?'Prva lekcija. Pročitaj je u skripti, pa uradi njen prvi test.':'Sledeća lekcija po redu koju još nisi radio. Pročitaj je u skripti, pa uradi njen prvi test.',
      primary:{label:'Počni '+t.title,href:'#test='+t.id},secondary:read(open.li),L,ws,sim}}
    if(un)return{kind:'lesson',li:open.li,id:un.id,title:lt(open.li),why:`Lekcija je u toku: urađeno ${open.done} od ${open.total} ${pl(open.total,'testa','testa','testova')}. Sledeći je ${un.title}.`,
      primary:{label:'Počni '+un.title,href:'#test='+un.id},secondary:read(open.li),L,ws,sim};
    const lo=open.tests.filter(t=>t.best<MASTER).sort((a,b)=>a.best-b.best)[0];
    return{kind:'lesson',li:open.li,id:lo.id,title:lt(open.li),why:`Svi testovi su urađeni. Popravi ${lo.title} (najbolje ${lo.best}%) na 81% i lekcija je savladana.`,
      primary:{label:'Ponovi '+lo.title,href:'#test='+lo.id},secondary:read(open.li),L,ws,sim}}
  if(ws.due)return{kind:'greske',li:null,title:'Ponavljanje grešaka',why:`Sve lekcije su savladane. ${ws.due} ${pl(ws.due,'pitanje čeka','pitanja čekaju','pitanja čeka')} ponavljanje danas.`,
    primary:{label:'Ponovi greške ('+ws.due+')',href:'#greske'},secondary:{label:'Simulacija ispita',href:'#ispit'},L,ws,sim};
  return{kind:'sim',li:null,title:'Simulacija ispita',why:sim===null?'Sve lekcije su savladane. Proveri se kao na ispitu: 30 pitanja iz svih lekcija, 30 minuta.':sim>=MASTER?`Spreman si: najbolja simulacija ${sim}%. Za sigurnost uradi još jednu.`:`Sve lekcije su savladane, a najbolja simulacija je ${sim}%. Cilj je 81% ili više.`,
    primary:{label:'Počni simulaciju',href:'#ispit'},secondary:{label:'Otvori skriptu',href:'skripta.html'},L,ws,sim};
}

/* ---------- prenos na drugi uređaj ---------- */
function exportData(){
  const s={};for(const r of REG){const h=results(r.key),c={};for(const id in h){const a=h[id]||[],b=bestRec(a),last=a.slice(-10);if(b&&!last.includes(b))last.unshift(b);
      c[id]=last.map(x=>[Math.round(x.pts*10)/10,x.max,Math.round((x.time||0)/1000),Math.round((x.date||0)/1000)])}
    const w=wrong(r.wkey);if(Object.keys(c).length||Object.keys(w).length)s[r.slug]={r:c,w}}
  return{v:2,d:dates(),p:passedRaw(),a:activity(),rd:readAll(),s}
}
function mergeData(o){if(!o||typeof o!=='object')throw new Error('bad');
  if(o.d)set(K.dates,Object.assign(dates(),o.d));
  if(o.p)set(K.passed,Object.assign(passedRaw(),o.p));
  if(o.a){const a=activity();for(const k in o.a)a[k]=Math.max(a[k]||0,+o.a[k]||0);set(K.act,a)}
  if(o.rd){const r=readAll();for(const sl in o.rd)r[sl]=Object.assign(r[sl]||{},o.rd[sl]);set(K.read,r)}
  if(o.s)for(const r of REG){const x=o.s[r.slug];if(!x)continue;
    if(x.r){const h=results(r.key);for(const id in x.r){const a=Array.isArray(h[id])?h[id]:[],seen=new Set(a.map(z=>Math.round((z.date||0)/1000)));
        for(const [pts,max,t,d] of x.r[id])if(!seen.has(d)){a.push({pts,max,time:t*1000,date:d*1000});seen.add(d)}
        a.sort((p,q)=>p.date-q.date);h[id]=a}set(r.key,h)}
    if(x.w){const w=wrong(r.wkey);for(const q in x.w)if(!w[q])w[q]=x.w[q];set(r.wkey,w)}}
}
const b64u=bytes=>{let s='';for(let i=0;i<bytes.length;i+=8192)s+=String.fromCharCode.apply(null,bytes.subarray(i,i+8192));return btoa(s).replace(/\+/g,'-').replace(/\//g,'_').replace(/=+$/,'')};
const unb64u=s=>{s=s.replace(/-/g,'+').replace(/_/g,'/');const b=atob(s),u=new Uint8Array(b.length);for(let i=0;i<b.length;i++)u[i]=b.charCodeAt(i);return u};
async function pipe(bytes,T){const st=new Blob([bytes]).stream().pipeThrough(new T('deflate-raw'));return new Uint8Array(await new Response(st).arrayBuffer())}
async function exportLink(base){const json=new TextEncoder().encode(JSON.stringify(exportData()));let tag='j',bytes=json;
  try{if(typeof CompressionStream==='function'){bytes=await pipe(json,CompressionStream);tag='z'}}catch(e){bytes=json;tag='j'}
  return base+'#prenos='+tag+'.'+b64u(bytes)}
async function decodeLink(hash){const m=/prenos=([jz])\.([A-Za-z0-9_-]+)/.exec(hash||'');if(!m)return null;let u=unb64u(m[2]);
  if(m[1]==='z')u=await pipe(u,DecompressionStream);return JSON.parse(new TextDecoder().decode(u))}
function decodeLegacy(search){const q=new URLSearchParams(search).get('s');if(!q)return null;const o=JSON.parse(decodeURIComponent(escape(atob(q))));return{d:o.d,p:o.p}}
function downloadBackup(){const blob=new Blob([JSON.stringify(exportData(),null,1)],{type:'application/json'}),a=document.createElement('a');
  a.href=URL.createObjectURL(blob);a.download='moji-ispiti-napredak-'+today()+'.json';document.body.appendChild(a);a.click();setTimeout(()=>{URL.revokeObjectURL(a.href);a.remove()},500)}

/* ---------- brisanje napretka ---------- */
function resetProgress(slug){for(const r of REG)if(!slug||r.slug===slug){del(r.key);del(r.wkey);const rd=readAll();delete rd[r.slug];set(K.read,rd)}if(!slug)del(K.act)}

window.IS={DAY,PASS,MASTER,K,REG,PRESET,get,set,del,esc,fmt,pl,iso,today,daysTo,dayStart,dateLong,dateShort,dateNum,dani,dueText,
  results,addResult,pct,bestRec,bestPct,wrong,markWrong,markRight,isDue,wrongStats,logActivity,activity,streak,readAll,setRead,isRead,
  dates,setDate,passedRaw,passedMap,setPassed,lessonStates,ST_LABEL,nextStep,exportData,mergeData,exportLink,decodeLink,decodeLegacy,downloadBackup,resetProgress,
  theme,setTheme,storageOk:!!LS};
})();
