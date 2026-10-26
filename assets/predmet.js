/* ============================================================
   Moji ispiti · stranica predmeta (početna, test, rezultat, kartice)
   Podatke daje stranica: window.PREDMET (podešavanja) i pitanja.js (TESTS, ORDER, NOTE).
   Tipovi pitanja:
   mc   → {t:'mc', q:'tekst', o:['a','b','c','d'], a:indeks tačnog, e:'objašnjenje'}
   fill → {t:'fill', q:'tekst sa ___ za svaku prazninu', a:[['odgovor','varijanta'], ...], unordered:true ako redosled nije bitan}
   tf   → {t:'tf', q:'tvrdnja', a:true/false, e:'objašnjenje'}
   ============================================================ */
(function(){
'use strict';
const P=window.PREDMET,{esc,fmt,pl}=IS;
const LESSONS=ORDER.filter(l=>TESTS.some(t=>t.lesson===l)).concat([...new Set(TESTS.map(t=>t.lesson))].filter(l=>!ORDER.includes(l)));
const POOL=TESTS.flatMap(t=>t.qs.map(q=>({...q,src:t.lesson})));
const SUB={lessons:LESSONS,tests:TESTS.map(t=>[t.id,LESSONS.indexOf(t.lesson),t.title,t.qs.length])};
const LIX=l=>LESSONS.indexOf(l);
const TYPE={mc:'Zaokruži tačan odgovor',fill:'Dopuni',tf:'Tačno ili netačno'};
const SHORT={mc:'Zaokruživanje',fill:'Dopuna',tf:'Tačno / netačno'};
const app=document.getElementById('app');
let view='home',S=null,R=null,C=null,onlyWrong=false,confirmEnd=false,modal=null,copied=null,tick=null,toastT=null,pushed=false,refocus=null;
const openL=new Set();

/* ---------- ocenjivanje ---------- */
const clock=ms=>{const s=Math.max(0,Math.floor(ms/1000));return String(Math.floor(s/60)).padStart(2,'0')+':'+String(s%60).padStart(2,'0')};
const CYR={'а':'a','б':'b','в':'v','г':'g','д':'d','ђ':'dj','е':'e','ж':'z','з':'z','и':'i','ј':'j','к':'k','л':'l','љ':'lj','м':'m','н':'n','њ':'nj','о':'o','п':'p','р':'r','с':'s','т':'t','ћ':'c','у':'u','ф':'f','х':'h','ц':'c','ч':'c','џ':'dz','ш':'s'};
const norm=s=>String(s||'').toLowerCase().replace(/[а-яђјљњћџ]/g,c=>CYR[c]??c).replace(/đ/g,'dj').normalize('NFD').replace(/[̀-ͯ]/g,'').replace(/[^a-z0-9 ]+/g,' ').replace(/\s+/g,' ').trim();
function lev(a,b){const d=Array.from({length:a.length+1},(_,i)=>[i]);for(let j=1;j<=b.length;j++)d[0][j]=j;
  for(let i=1;i<=a.length;i++)for(let j=1;j<=b.length;j++)d[i][j]=Math.min(d[i-1][j]+1,d[i][j-1]+1,d[i-1][j-1]+(a[i-1]===b[j-1]?0:1));return d[a.length][b.length]}
function matches(input,alts){const x=norm(input);if(!x)return false;
  return alts.some(a=>{const y=norm(a);if(x===y)return true;const tol=y.length>=10?2:y.length>=5?1:0;return tol>0&&lev(x,y)<=tol})}
function grade(q,ans){
  if(q.t!=='fill')return{pts:ans===q.a?1:0,ok:[]};
  const a=ans||[],used=new Set(),ok=q.a.map(()=>false);
  q.a.forEach((alts,i)=>{
    if(!q.unordered){ok[i]=matches(a[i],alts);return}
    const j=q.a.findIndex((g,k)=>!used.has(k)&&matches(a[i],g));
    if(j>-1){used.add(j);ok[i]=true}
  });
  return{pts:ok.filter(Boolean).length/ok.length,ok};
}
const answered=(q,a)=>q.t==='fill'?!!(a&&a.some(x=>norm(x))):a!==null&&a!==undefined;
const mark=p=>p<51?5:p<61?6:p<71?7:p<81?8:p<91?9:10;
const correctText=q=>q.t==='mc'?'abcd'[q.a]+') '+q.o[q.a]:q.t==='tf'?(q.a?'Tačno':'Netačno'):q.a.map(g=>g[0]).join('; ');
const givenText=(q,a)=>!answered(q,a)?'bez odgovora':q.t==='mc'?'abcd'[a]+') '+q.o[a]:q.t==='tf'?(a?'Tačno':'Netačno'):a.map(x=>x&&x.trim()?x.trim():'—').join('; ');
const shuffle=a=>{a=a.slice();for(let i=a.length-1;i>0;i--){const j=Math.floor(Math.random()*(i+1));[a[i],a[j]]=[a[j],a[i]]}return a};
const tone=p=>p===null?'':p>=IS.MASTER?'ok':p>=IS.PASS?'warn':'bad';

/* ---------- čuvanje (trajno, u ovom pregledaču) ---------- */
const res=()=>IS.results(P.key);
const wrongs=()=>IS.wrong(P.wkey);

/* ---------- pokretanje ---------- */
function prep(q){if(q.t!=='mc')return{...q};const ix=shuffle(q.o.map((_,i)=>i));return{...q,o:ix.map(i=>q.o[i]),a:ix.indexOf(q.a)}}
function draw(n,lesson){
  const all=lesson?POOL.filter(q=>q.src===lesson):POOL,ls=[...new Set(all.map(q=>q.src))];
  return['mc','fill','tf'].flatMap(t=>{const pools=shuffle(ls).map(l=>shuffle(all.filter(q=>q.t===t&&q.src===l))),out=[];
    for(let r=0;out.length<n&&pools.some(p=>p.length);r++){const p=pools[r%pools.length];if(p.length)out.push(p.pop())}
    return shuffle(out)});
}
const lessonExamN=l=>['mc','fill','tf'].reduce((s,t)=>s+Math.min(7,POOL.filter(q=>q.src===l&&q.t===t).length),0);
function enter(v){view=v;if(!pushed){try{history.pushState({ispit:1},'');pushed=true}catch(e){}}}
function begin(id,title,qs,opts){
  if(!qs.length){toast('Nema pitanja za ovaj izbor.');return}
  qs=qs.map(prep);
  S={id,title,qs,ans:qs.map(q=>q.t==='fill'?q.a.map(()=>''):null),flag:qs.map(()=>false),idx:0,start:Date.now(),keep:!!opts.keep,limit:opts.limit||0};
  enter('quiz');confirmEnd=false;modal=null;render();scrollTo(0,0);
}
const dynamic=id=>id==='ispit'||id==='mix'||id==='greske'||id==='greske-sve'||id.startsWith('lekcija-');
function startTest(id){
  if(id==='ispit')return begin(id,'Simulacija ispita',draw(10),{keep:true,limit:30});
  if(id==='mix')return begin(id,'Brzi miks',draw(5),{keep:true});
  if(id==='greske'||id==='greske-sve'){const w=wrongs(),now=Date.now();
    return begin(id,id==='greske'?'Moje greške · za danas':'Moje greške · sve',shuffle(POOL.filter(q=>w[q.q]&&(id==='greske-sve'||IS.isDue(w[q.q],now)))).slice(0,30),{})}
  if(id.startsWith('lekcija-')){const l=LESSONS[+id.slice(8)];if(!l)return;return begin(id,'Ispit iz lekcije '+(+id.slice(8)+1),draw(7,l),{keep:true,limit:20})}
  const t=TESTS.find(t=>t.id===id);if(!t)return toast('Taj test ne postoji.');
  begin(t.id,t.title+' · Lekcija '+(LIX(t.lesson)+1),t.qs.map(q=>({...q,src:t.lesson})),{keep:true});
}
function finish(timeout){
  const g=S.qs.map((q,i)=>grade(q,S.ans[i]));
  const pts=g.reduce((s,r)=>s+r.pts,0),time=S.limit?Math.min(Date.now()-S.start,S.limit*60000):Date.now()-S.start;
  R={...S,res:g,pts,max:S.qs.length,time,timeout:!!timeout};
  const w=wrongs(),now=Date.now();S.qs.forEach((q,i)=>{if(g[i].pts<1)IS.markWrong(w,q.q);else IS.markRight(w,q.q,now)});IS.set(P.wkey,w);
  if(S.keep)IS.addResult(P.key,S.id,{pts,max:R.max,time,date:Date.now()});
  IS.logActivity(S.qs.filter((q,i)=>answered(q,S.ans[i])).length);
  view='result';onlyWrong=false;copied=null;S=null;render();scrollTo(0,0);
  const h=document.getElementById('res-h');if(h)h.focus({preventScroll:true});
}
let expectPop=false;
function goHome(){clearInterval(tick);S=null;R=null;C=null;modal=null;view='home';
  if(pushed){pushed=false;expectPop=true;try{history.back()}catch(e){expectPop=false}}render();scrollTo(0,0)}

/* ---------- kartice ---------- */
function startCards(which){
  let deck,title;
  if(which==='greske'){const w=wrongs();deck=POOL.filter(q=>w[q.q]);title='Kartice · moje greške'}
  else if(which==='sve'){deck=POOL;title='Kartice · sve lekcije'}
  else{const l=LESSONS[+which];if(!l)return;deck=POOL.filter(q=>q.src===l);title='Kartice · Lekcija '+(+which+1)}
  if(!deck.length)return toast('Nema kartica za ovaj izbor.');
  C={which,title,deck:shuffle(deck),i:0,flipped:false,known:0,unknown:[]};enter('cards');modal=null;render();scrollTo(0,0);
}
function cardAnswer(knew){const q=C.deck[C.i],w=wrongs();if(knew){C.known++;IS.markRight(w,q.q)}else{C.unknown.push(q);IS.markWrong(w,q.q)}IS.set(P.wkey,w);IS.logActivity(1);
  C.i++;C.flipped=false;render()}

/* ---------- ikonice ---------- */
const I={
  back:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M15 18l-6-6 6-6"/></svg>',
  book:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20V3H6.5A2.5 2.5 0 0 0 4 5.5z"/><path d="M4 19.5A2.5 2.5 0 0 0 6.5 22H20v-5"/></svg>',
  cards:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="3" y="6" width="14" height="14" rx="2"/><path d="M7 2h12a2 2 0 0 1 2 2v12"/></svg>',
  x:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><path d="M18 6L6 18M6 6l12 12"/></svg>',
  caret:'<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M9 18l6-6-6-6"/></svg>'
};

/* ---------- početna ---------- */
function actBtn(a,cls,id){const m=/^#(?:test=)?(.+)$/.exec(a.href);
  return m?`<button class="${cls}" ${id?`id="${id}"`:''} data-act="start" data-id="${esc(m[1])}">${esc(a.label)}</button>`:`<a class="${cls}" ${id?`id="${id}"`:''} href="${esc(a.href)}">${esc(a.label)}</a>`}
function home(){
  const h=res(),w=wrongs(),ws=IS.wrongStats(w),st=IS.nextStep(SUB,h,w),L=st.L,D=IS.dates()[P.slug],n=IS.daysTo(D),passed=IS.passedMap()[P.slug];
  const mastered=L.filter(x=>x.st==='l3').length,sim=IS.bestPct(h,'ispit'),mix=IS.bestPct(h,'mix');
  const segs=L.map(x=>`<i class="seg ${x.st==='none'?'':x.st}" title="Lekcija ${x.li+1}: ${esc(IS.ST_LABEL[x.st])}"></i>`).join('');
  const pill=passed?`<span class="due-pill" style="color:var(--ok)"><i style="background:var(--ok)"></i>Položeno${passed.o?' · ocena '+passed.o:''}</span>`
    :D&&n>=0?`<span class="due-pill ${n<=7?'urgent':''}"><i></i>Ispit ${n===0?'je danas':n===1?'je sutra':'za '+n+' '+IS.dani(n)} · ${esc(IS.dateLong(D))}</span>`
    :D&&n<0?`<a class="due-pill" href="../" style="text-decoration:none;color:var(--warn)"><i style="background:var(--warn)"></i>Ispit održan ${esc(IS.dateNum(D))} · čeka rezultat</a>`
    :`<a class="due-pill" href="../#datum=${P.slug}" style="text-decoration:none;color:var(--muted)"><i></i>Dodaj datum ispita</a>`;
  const best=p=>p===null?'<span class="best">nije rađen</span>':`<span class="best ${tone(p)}">najbolje ${p}%</span>`;
  const lessons=L.map(x=>{const l=LESSONS[x.li],ts=TESTS.filter(t=>t.lesson===l),nq=ts.reduce((s,t)=>s+t.qs.length,0),rd=IS.isRead(P.slug,x.li),ln=lessonExamN(l),lb=IS.bestPct(h,'lekcija-'+x.li);
    return`<details class="lesson" id="lekcija-${x.li+1}" data-l="${x.li}" ${openL.has(x.li)?'open':''}>
      <summary><span class="num st-${x.st}" aria-hidden="true">${x.li+1}</span>
        <span><span class="ttl">${esc(l)}</span><span class="sub" style="display:block">${esc(ts[0].author||'')}${NOTE[l]?' · '+esc(NOTE[l]):''} · ${ts.length} ${pl(ts.length,'test','testa','testova')} · ${nq} pitanja${rd?' · <span style="color:var(--ok)">pročitano</span>':''}</span></span>
        <span class="state"><span class="txt">${x.st==='none'?'':esc(IS.ST_LABEL[x.st])+(x.avg!==null?' · '+x.avg+'%':'')}</span><span class="caret">${I.caret}</span></span></summary>
      <div class="inner">
        <div class="tools"><a class="btn sm" href="skripta.html#l${x.li+1}">${I.book}Čitaj u skripti</a><button class="btn sm" data-act="cards" data-v="${x.li}">${I.cards}Kartice</button></div>
        ${ts.map(t=>`<div class="trow"><div class="grow"><h4>${esc(t.title)}</h4><p class="meta">${t.qs.length} pitanja</p></div>${best(IS.bestPct(h,t.id))}<button class="btn sm ${IS.bestPct(h,t.id)===null?'primary':''}" data-act="start" data-id="${t.id}">${IS.bestPct(h,t.id)===null?'Počni':'Ponovi'}</button></div>`).join('')}
        <div class="trow lexam"><div class="grow"><h4>Ispit iz ove lekcije</h4><p class="meta">${ln} ${pl(ln,'pitanje','pitanja','pitanja')} iz svih testova lekcije · 20 minuta</p></div>${lb===null?'':best(lb)}<button class="btn sm" data-act="start" data-id="lekcija-${x.li}">Počni ispit</button></div>
      </div></details>`}).join('');
  return`<a class="skip" href="#main">Preskoči na sadržaj</a>
  <nav class="crumbs" aria-label="Navigacija"><a class="back" href="../">${I.back}Moji ispiti</a><a class="btn sm ghost" href="skripta.html">${I.book}Skripta</a></nav>
  <header class="subject-head" id="main" tabindex="-1"><h1 class="h1">${esc(P.title)}</h1><p class="who">${esc(P.authors)}</p>${pill}</header>
  <section class="card striped overview" aria-label="Napredak">
    <div class="segs" role="img" aria-label="Lekcije: ${mastered} savladano od ${L.length}">${segs}</div>
    <div class="meta"><span><b>${mastered} od ${L.length}</b> ${pl(L.length,'lekcije','lekcije','lekcija')} savladano</span><span>${sim===null?'Simulacija nije rađena':`Simulacija: <b>${sim}%</b>`} · ${ws.total} u greškama</span></div>
  </section>
  <section class="next-card" aria-labelledby="nx-h"><div><p class="label">Preporuka za danas</p><h2 id="nx-h">${esc(st.title)}</h2><p>${esc(st.why)}</p></div>
    <div class="actions">${actBtn(st.primary,'btn primary','go-next')}${actBtn(st.secondary,'btn','')}</div></section>
  <section class="stack" style="gap:14px" aria-labelledby="pr-h"><div class="sec-head"><h2 class="h2" id="pr-h">Proveri se</h2><p>Sve lekcije pomešano</p></div>
    <div class="tiles">
      <div class="tile"><h3>Simulacija ispita</h3><p>30 pitanja ravnomerno iz svih lekcija, 30 minuta. Predaje se sam kad vreme istekne.</p>
        <p class="score">${sim===null?'Još nije rađena':`<b>${sim}%</b>najbolje · ocena ${mark(sim)}`}</p><button class="btn primary" id="go-ispit" data-act="start" data-id="ispit">Počni simulaciju</button></div>
      <div class="tile"><h3>Brzi miks</h3><p>15 pitanja iz svih lekcija, bez ograničenja vremena.</p>
        <p class="score">${mix===null?'Još nije rađen':`<b>${mix}%</b>najbolje`}</p><button class="btn" data-act="start" data-id="mix">Počni miks</button></div>
      <div class="tile"><h3>Moje greške</h3><p>${ws.total?'Pitanje se vraća odmah, pa sutra, pa za 3 dana; posle tri tačna odgovora nestaje.':'Ovde se skupljaju pitanja na kojima pogrešiš, da ih ponoviš u pravo vreme.'}</p>
        <p class="score"><b>${ws.due}</b>za danas · ${ws.total} ukupno${!ws.due&&ws.next?' · sledeće '+(IS.daysTo(IS.iso(ws.next))<=1?'sutra':IS.dateShort(IS.iso(ws.next))):''}</p>
        <div class="two"><button class="btn ${ws.due?'primary':''}" id="go-greske" data-act="start" data-id="greske" ${ws.due?'':'disabled'}>Ponovi</button><button class="btn" data-act="start" data-id="greske-sve" ${ws.total?'':'disabled'}>Sve (${ws.total})</button></div></div>
    </div></section>
  <section class="stack" style="gap:14px" aria-labelledby="le-h"><div class="sec-head"><h2 class="h2" id="le-h">Lekcije</h2>
      <div class="legend"><span><i style="background:var(--sunk);box-shadow:inset 0 0 0 1px var(--line)"></i>nije rađeno</span><span><i style="background:color-mix(in srgb,var(--c) 45%,var(--sunk))"></i>u toku</span><span><i style="background:var(--c)"></i>savladano</span><span><i style="background:var(--urgent-soft);box-shadow:inset 0 0 0 1.5px var(--urgent)"></i>za ponavljanje</span></div></div>
    <div class="lessons">${lessons}</div>
    <div class="row"><button class="btn sm ghost" data-act="cards" data-v="sve">${I.cards}Kartice iz svih lekcija</button></div></section>
  <details class="plain help" data-l="help" ${openL.has('help')?'open':''}><summary>Kako se boduje i kako se prati napredak<span class="caret">${I.caret}</span></summary><div class="inner"><ul>
    <li>Svako pitanje nosi 1 poen. Kod dopune sa više praznina dobijaš deo poena za svaku tačnu prazninu. Dopune se priznaju i bez kvačica, na ćirilici i sa sitnom greškom u kucanju.</li>
    <li>Ocene: ispod 51% je 5, zatim 6 (51–60%), 7 (61–70%), 8 (71–80%), 9 (81–90%) i 10 (91–100%). Redosled ponuđenih odgovora menja se pri svakom pokušaju.</li>
    <li><b>Savladana lekcija</b>: svi njeni testovi urađeni sa najmanje 81%. <b>Za ponavljanje</b>: prosek najboljih rezultata ispod 51%.</li>
    <li><b>Moje greške</b>: pogrešno odgovoreno pitanje se vraća odmah, pa sutra, pa za tri dana. Kad ga tri puta tačno odgovoriš kad je na redu, nestaje sa liste.</li>
    <li>Napredak se čuva trajno, samo u ovom pregledaču na ovom uređaju. Kad nekome pošalješ link sajta, on dobija prazan napredak i ne vidi tvoj.</li></ul></div></details>
  <footer class="foot"><span>Napredak se čuva trajno u ovom pregledaču.</span><span class="links"><a href="../#podesavanja">Prenesi na telefon</a><button id="reset" data-act="resetAsk" ${Object.keys(h).length||ws.total?'':'disabled'}>Obriši napredak predmeta</button></span></footer>`;
}

/* ---------- test ---------- */
function body(q,i,a){
  if(q.t==='mc')return`<div class="opts" role="group" aria-label="Ponuđeni odgovori">${q.o.map((o,k)=>`<button class="opt ${a===k?'sel':''}" id="o-${i}-${k}" data-act="pick" data-v="${k}" aria-pressed="${a===k}"><span class="k">${'abcd'[k]}</span><span>${esc(o)}</span></button>`).join('')}</div>`;
  if(q.t==='tf')return`<div class="tf" role="group" aria-label="Tačno ili netačno">${[true,false].map(v=>`<button class="opt ${a===v?'sel':''}" id="o-${i}-${v}" data-act="pick" data-v="${v}" aria-pressed="${a===v}">${v?'Tačno':'Netačno'}</button>`).join('')}</div>`;
  const parts=q.q.split('___');
  return`<p class="q">${parts.map((p,k)=>esc(p)+(k<parts.length-1?`<input class="blank" id="b-${i}-${k}" data-k="${k}" value="${esc(a[k]||'')}" autocomplete="off" autocapitalize="off" spellcheck="false" enterkeyhint="next" aria-label="Praznina ${k+1}">`:'')).join('')}</p>`;
}
const remaining=()=>S.limit*60000-(Date.now()-S.start);
function quiz(){
  const i=S.idx,q=S.qs[i],a=S.ans[i],last=i===S.qs.length-1,missing=S.qs.filter((x,k)=>!answered(x,S.ans[k])).length;
  return`<div class="qbar"><div class="row"><button class="btn sm ghost" id="q-quit" data-act="quitAsk" aria-label="Prekini test">${I.x}<span>Prekini</span></button>
      <h1 class="ttl grow">${esc(S.title)}</h1><span class="clock ${S.limit&&remaining()<5*60000?'low':''}" id="clock" aria-live="off">${S.limit?clock(remaining()):clock(Date.now()-S.start)}</span></div>
    <div class="bar" role="progressbar" aria-valuemin="0" aria-valuemax="${S.qs.length}" aria-valuenow="${i+1}" aria-label="Pitanje ${i+1} od ${S.qs.length}"><i style="width:${(i+1)/S.qs.length*100}%"></i></div></div>
  <section class="qcard" aria-labelledby="qn">
    <div class="qhead"><span class="chip">${TYPE[q.t]}</span>${q.src?`<span class="chip c">Lekcija ${LIX(q.src)+1}</span>`:''}<span class="n" id="qn">${i+1} / ${S.qs.length}</span></div>
    ${q.t==='fill'?'':`<p class="q">${esc(q.q)}</p>`}
    ${body(q,i,a)}
    <div class="qnav"><button class="btn" id="q-prev" data-act="prev" ${i===0?'disabled':''}>Nazad</button>
      <button class="btn ${S.flag[i]?'on':''}" id="flag" data-act="flag" aria-pressed="${S.flag[i]}">${S.flag[i]?'Označeno':'Označi za kasnije'}</button><span class="spacer"></span>
      ${last?'<button class="btn primary" id="q-end" data-act="end">Predaj test</button>':'<button class="btn primary" id="q-next" data-act="next">Dalje</button>'}</div>
    ${confirmEnd?`<div class="fb warn" role="alert"><strong>Ostalo je ${missing} ${pl(missing,'pitanje','pitanja','pitanja')} bez odgovora.</strong> <span>Neodgovorena pitanja nose 0 poena.</span>
      <div class="row" style="margin-top:10px"><button class="btn" data-act="cancelEnd">Vrati se</button><button class="btn primary" id="force-end" data-act="forceEnd">Predaj svejedno</button></div></div>`:''}
  </section>
  <nav class="dots" aria-label="Pitanja">${S.qs.map((x,k)=>`<button class="dot ${answered(x,S.ans[k])?'done':''} ${S.flag[k]?'flag':''} ${k===i?'cur':''}" data-act="go" data-v="${k}" aria-label="Pitanje ${k+1}${answered(x,S.ans[k])?', odgovoreno':''}${S.flag[k]?', označeno':''}" ${k===i?'aria-current="step"':''}>${k+1}</button>`).join('')}</nav>
  <div class="row"><p class="kbd-hint grow">Tastatura: a–d bira odgovor, T ili N za tačno/netačno, Enter ili strelice za sledeće pitanje.</p>${last?'':'<button class="btn sm ghost" data-act="end">Predaj test</button>'}</div>`;
}

/* ---------- rezultat ---------- */
const summary=()=>{const p=Math.round(R.pts/R.max*100);return`${P.title} · ${R.title}: ${fmt(R.pts)}/${R.max} (${p}%), ocena ${mark(p)}, vreme ${clock(R.time)}`};
function result(){
  const p=Math.round(R.pts/R.max*100),m=mark(p),C2=2*Math.PI*54,pass=m>5;
  const group=(key,label)=>[...new Set(R.qs.map(key))].map(k=>{const ix=R.qs.map((q,i)=>key(q)===k?i:-1).filter(i=>i>-1);return{k,name:label(k),n:ix.length,pts:ix.reduce((s,i)=>s+R.res[i].pts,0)}});
  const tile=b=>{const q=b.pts/b.n*100;return`<div class="bd ${q<IS.PASS?'weak':q<IS.MASTER?'mid':''}"><small>${esc(b.name)}</small><b>${fmt(b.pts)} / ${b.n}</b><div class="bar"><i style="width:${q}%"></i></div></div>`};
  const byType=group(q=>q.t,k=>SHORT[k]),byLesson=group(q=>q.src||'',k=>k?'Lekcija '+(LIX(k)+1)+': '+k:'');
  const wrong=R.qs.filter((q,i)=>R.res[i].pts<1).length;
  const todo=byLesson.filter(b=>b.k&&b.pts/b.n*100<IS.MASTER).sort((a,b)=>a.pts/a.n-b.pts/b.n).slice(0,4);
  const rows=R.qs.map((q,i)=>{const g=R.res[i];if(onlyWrong&&g.pts===1)return'';
    const c=g.pts===1?'ok':g.pts===0?'bad':'warn';
    return`<div class="rev"><div class="row" style="gap:8px"><span class="muted" style="font-weight:700">${i+1}.</span><span class="chip ${c}">${g.pts===1?'tačno':g.pts===0?'netačno':'delimično'} · ${fmt(g.pts)}</span><span class="chip">${SHORT[q.t]}</span>${q.src&&byLesson.length>1?`<span class="chip c">Lekcija ${LIX(q.src)+1}</span>`:''}</div>
      <p>${esc(q.q.replace(/___/g,'_____'))}</p>
      <p class="ans">Tvoj odgovor: <strong>${esc(givenText(q,R.ans[i]))}</strong></p>
      ${g.pts<1?`<p class="ans">Tačan odgovor: <strong class="right">${esc(correctText(q))}</strong></p>`:''}
      ${q.e&&g.pts<1?`<p class="exp">${esc(q.e)}</p>`:''}
      ${g.pts<1&&q.src?`<a class="link small" href="skripta.html#l${LIX(q.src)+1}">Pročitaj u skripti: Lekcija ${LIX(q.src)+1}</a>`:''}</div>`}).join('');
  return`<nav class="crumbs" aria-label="Navigacija"><button class="back" style="background:none;border:0;cursor:pointer" data-act="home">${I.back}${esc(P.title)}</button></nav>
  <header class="stack" style="gap:6px"><p class="muted">Rezultat · ${esc(R.title)}</p><h1 class="h1" id="res-h" tabindex="-1">${pass?(m>=9?'Odlično · ocena '+m:'Položeno · ocena '+m):'Nije položeno'}</h1></header>
  ${R.timeout?'<div class="fb bad" role="alert"><strong>Vreme je isteklo.</strong> <span>Test je predat sa odgovorima koje si do tada uneo.</span></div>':''}
  <section class="card stack" style="gap:22px">
    <div class="verdict"><svg class="ring" viewBox="0 0 132 132" role="img" aria-label="${p}% tačno"><circle cx="66" cy="66" r="54" fill="none" stroke="var(--sunk)" stroke-width="12"/>
        <circle cx="66" cy="66" r="54" fill="none" stroke="var(--${pass?'ok':'urgent'})" stroke-width="12" stroke-linecap="round" stroke-dasharray="${C2*p/100} ${C2}" transform="rotate(-90 66 66)"/>
        <text x="66" y="74" text-anchor="middle" fill="var(--ink)" font-family="Onest,system-ui,sans-serif" font-weight="700" font-size="26">${p}%</text></svg>
      <div class="stack" style="gap:6px"><span class="bigscore">${fmt(R.pts)} <small>/ ${R.max} poena</small></span>
        <span class="gradebox">Ocena <b style="color:var(--${pass?'ok':'urgent'})">${m}</b>${pass?'':'<span class="muted small">potrebno je 51% za prolaz</span>'}</span>
        <span class="muted">Vreme ${clock(R.time)} · ${R.max-wrong} tačnih, ${wrong} sa greškom</span></div></div>
    ${todo.length?`<div class="stack"><h2 class="h3">Šta da ponoviš</h2><div class="todo">${todo.map(b=>`<a href="skripta.html#l${LIX(b.k)+1}"><span><b>Lekcija ${LIX(b.k)+1}</b> <span>${esc(b.k)} · ${Math.round(b.pts/b.n*100)}% tačno</span></span><span class="arr">Čitaj →</span></a>`).join('')}</div></div>`:''}
    <div class="stack"><h2 class="h3">Po vrsti pitanja</h2><div class="breakdown">${byType.map(tile).join('')}</div></div>
    ${byLesson.length>1?`<div class="stack"><h2 class="h3">Po lekciji</h2><div class="breakdown">${byLesson.map(tile).join('')}</div></div>`:''}
    <div class="dots" aria-hidden="true">${R.res.map((g,k)=>`<span class="dot ${g.pts===1?'ok':g.pts===0?'no':'half'}">${k+1}</span>`).join('')}</div>
    <div class="row"><button class="btn primary" id="again" data-act="again">Ponovi test</button>${wrong?`<button class="btn" data-act="wrongOnly">Vežbaj samo greške (${wrong})</button>`:''}
      <button class="btn" id="copy" data-act="copy">${copied===true?'Kopirano':'Kopiraj rezultat'}</button><button class="btn ghost" data-act="home">Nazad na predmet</button></div>
    ${copied===false?`<p class="copybox">${esc(summary())}</p>`:''}
  </section>
  <section class="card"><div class="row" style="margin-bottom:8px"><h2 class="h2 grow">Pregled odgovora</h2>
    ${wrong?`<div class="seg-ctl" role="group" aria-label="Filter"><button data-act="filter" data-v="0" aria-pressed="${!onlyWrong}">Sve</button><button data-act="filter" data-v="1" aria-pressed="${onlyWrong}">Samo greške</button></div>`:''}</div>${rows}</section>`;
}

/* ---------- kartice ---------- */
function cardFront(q){
  if(q.t==='fill')return`<p class="q">${esc(q.q).replace(/___/g,'<span class="gap">&nbsp;?&nbsp;</span>')}</p><p class="muted small">Šta ide na mesto praznine?</p>`;
  if(q.t==='tf')return`<p class="q">${esc(q.q)}</p><p class="muted small">Tačno ili netačno?</p>`;
  return`<p class="q">${esc(q.q)}</p><p class="muted small">Odgovori u sebi, pa okreni karticu.</p>`;
}
function cardBack(q){
  let s=0;const full=q.t==='fill'?esc(q.q).replace(/___/g,()=>`<span class="gap">${esc(q.a[s++][0])}</span>`):'';
  return q.t==='fill'?`<p class="answer">${full}</p>`:`<p class="answer">${esc(q.t==='tf'?(q.a?'Tačno':'Netačno'):q.o[q.a])}</p>${q.t==='tf'?`<p>${esc(q.q)}</p>`:''}${q.e?`<p class="muted">${esc(q.e)}</p>`:''}`;
}
function cards(){
  const n=C.deck.length;
  const top=`<div class="qbar"><div class="row"><button class="btn sm ghost" data-act="home" aria-label="Zatvori kartice">${I.x}<span>Zatvori</span></button><h1 class="ttl grow">${esc(C.title)}</h1><span class="clock">${Math.min(C.i+1,n)} / ${n}</span></div>
    <div class="bar"><i style="width:${C.i/n*100}%"></i></div></div>`;
  if(C.i>=n)return top+`<section class="card stack" style="gap:16px;text-align:left"><h2 class="h2" id="cards-done" tabindex="-1">Kartice su završene</h2>
    <p>Znao si <b>${C.known}</b> od ${n}. ${C.unknown.length?`${C.unknown.length} ${pl(C.unknown.length,'kartica je otišla','kartice su otišle','kartica je otišlo')} u „Moje greške”.`:'Sve si znao.'}</p>
    <div class="row">${C.unknown.length?`<button class="btn primary" data-act="cardsAgain">Ponovi nepoznate (${C.unknown.length})</button>`:''}<button class="btn" data-act="cardsRestart">Ceo špil ponovo</button><button class="btn ghost" data-act="home">Nazad na predmet</button></div></section>`;
  const q=C.deck[C.i];
  return top+`<div class="flash"><div class="fcard ${C.flipped?'flipped':''}" id="fcard" data-act="flip" role="button" tabindex="0" aria-label="${C.flipped?'Odgovor':'Pitanje'}; pritisni da okreneš">
      <div class="fface front" aria-hidden="${C.flipped}"><div class="row" style="gap:8px"><span class="chip">${SHORT[q.t]}</span><span class="chip c">Lekcija ${LIX(q.src)+1}</span></div>${cardFront(q)}<p class="hint">Dodirni karticu ili pritisni razmak da vidiš odgovor.</p></div>
      <div class="fface back" aria-hidden="${!C.flipped}"><span class="muted small" style="font-weight:600">Odgovor</span>${cardBack(q)}</div></div></div>
    <div class="qnav">${C.flipped?`<button class="btn" id="c-no" data-act="cardNo" style="flex:1">Nisam znao</button><button class="btn ok" id="c-yes" data-act="cardYes" style="flex:1">Znao sam</button>`
      :`<button class="btn primary" id="c-flip" data-act="flip" style="flex:1">Okreni karticu</button>`}</div>
    <p class="kbd-hint">Tastatura: razmak okreće, 1 = nisam znao, 2 = znao sam. „Nisam znao” šalje pitanje u Moje greške.</p>`;
}

/* ---------- modali i poruke ---------- */
function modalHtml(){
  if(!modal)return'';
  if(modal==='reset')return`<div class="veil" data-act="close"><div class="modal" role="dialog" aria-modal="true" aria-labelledby="mt" data-act="noop">
    <h2 class="h2" id="mt">Obrisati napredak iz ovog predmeta?</h2><p class="muted">Brišu se svi rezultati testova, lista grešaka i oznake „pročitano” za <b>${esc(P.title)}</b>. Datum ispita ostaje. Ovo ne može da se vrati.</p>
    <div class="acts"><button class="btn" id="reset-no" data-act="close">Odustani</button><button class="btn danger" id="reset-yes" data-act="resetDo">Obriši</button></div></div></div>`;
  if(modal==='quit')return`<div class="veil" data-act="close"><div class="modal" role="dialog" aria-modal="true" aria-labelledby="mt" data-act="noop">
    <h2 class="h2" id="mt">Prekinuti test?</h2><p class="muted">Odgovori iz ovog pokušaja neće biti sačuvani.</p>
    <div class="acts"><button class="btn" id="quit-no" data-act="close">Nastavi test</button><button class="btn danger" id="quit-yes" data-act="quitDo">Prekini</button></div></div></div>`;
  return'';
}
function toast(m){clearTimeout(toastT);let t=document.getElementById('toast');if(!t){t=document.createElement('div');t.id='toast';t.className='toast';t.setAttribute('role','status');document.body.appendChild(t)}
  t.textContent=m;t.hidden=false;toastT=setTimeout(()=>{t.hidden=true},3500)}

/* ---------- prikaz ---------- */
function render(){
  clearInterval(tick);
  app.innerHTML=(view==='home'?home():view==='quiz'?quiz():view==='cards'?cards():result())+modalHtml();
  document.title=(view==='quiz'?S.title+' · ':view==='result'?'Rezultat · ':view==='cards'?C.title+' · ':'')+P.title;
  if(view==='quiz'){tick=setInterval(()=>{if(!S)return;const c=document.getElementById('clock');
      if(S.limit){const r=remaining();if(r<=0){modal=null;return finish(true)}if(c){c.textContent=clock(r);c.classList.toggle('low',r<5*60000)}}
      else if(c)c.textContent=clock(Date.now()-S.start)},1000);
    const b=app.querySelector('.blank');if(b&&!b.value&&!modal&&matchMedia('(hover:hover)').matches)b.focus({preventScroll:true})}
  if(modal){const f=app.querySelector('.modal .btn');if(f)f.focus()}
  else if(refocus){const e=document.getElementById(refocus);if(e)e.focus({preventScroll:true})}
  refocus=null;
}
function step(d){S.idx=Math.max(0,Math.min(S.qs.length-1,S.idx+d));confirmEnd=false;render();const q=app.querySelector('.qcard');if(q&&q.getBoundingClientRect().top<0)q.scrollIntoView({block:'start'})}

app.addEventListener('toggle',e=>{const d=e.target,l=d.dataset&&d.dataset.l;if(l===undefined)return;const k=l==='help'?l:+l;d.open?openL.add(k):openL.delete(k)},true);
app.addEventListener('click',e=>{
  const b=e.target.closest('[data-act]');if(!b)return;const act=b.dataset.act,v=b.dataset.v;
  if(act==='noop')return;
  if(b.id)refocus=b.id;
  if(act==='close'){if(e.target!==b&&b.classList.contains('veil'))return;modal=null;render()}
  else if(act==='resetAsk'){modal='reset';render()}
  else if(act==='resetDo'){IS.resetProgress(P.slug);modal=null;render();toast('Napredak iz predmeta je obrisan.')}
  else if(act==='quitAsk'){if(S&&S.ans.some((a,k)=>answered(S.qs[k],a))){modal='quit';render()}else goHome()}
  else if(act==='quitDo'){modal=null;goHome()}
  else if(act==='start')startTest(b.dataset.id);
  else if(act==='cards')startCards(v);
  else if(act==='home')goHome();
  else if(act==='pick'){const q=S.qs[S.idx];S.ans[S.idx]=q.t==='mc'?+v:v==='true';refocus=b.id;render()}
  else if(act==='flag'){S.flag[S.idx]=!S.flag[S.idx];render()}
  else if(act==='next')step(1);else if(act==='prev')step(-1);
  else if(act==='go'){S.idx=+v;confirmEnd=false;refocus=null;render()}
  else if(act==='end'){if(S.qs.some((q,k)=>!answered(q,S.ans[k]))){confirmEnd=true;refocus='force-end';render()}else finish()}
  else if(act==='cancelEnd'){confirmEnd=false;render()}
  else if(act==='forceEnd')finish();
  else if(act==='filter'){onlyWrong=v==='1';render()}
  else if(act==='again'){const r=R;if(dynamic(r.id))startTest(r.id);else begin(r.id,r.title,r.qs,{keep:r.keep,limit:r.limit})}
  else if(act==='wrongOnly'){const r=R;begin(r.id+'~greske',r.title+' · samo greške',r.qs.filter((q,i)=>r.res[i].pts<1),{})}
  else if(act==='copy'){const done=ok=>{copied=ok;if(view==='result')render()};
    try{navigator.clipboard.writeText(summary()).then(()=>done(true),()=>done(false))}catch(err){done(false)}}
  else if(act==='flip'){C.flipped=!C.flipped;refocus=C.flipped?'c-yes':'c-flip';render()}
  else if(act==='cardYes')cardAnswer(true);else if(act==='cardNo')cardAnswer(false);
  else if(act==='cardsAgain'){C={...C,deck:shuffle(C.unknown),i:0,flipped:false,known:0,unknown:[]};render()}
  else if(act==='cardsRestart'){C={...C,deck:shuffle(C.deck),i:0,flipped:false,known:0,unknown:[]};render()}
});
app.addEventListener('input',e=>{
  if(!e.target.classList.contains('blank')||!S)return;
  S.ans[S.idx][+e.target.dataset.k]=e.target.value;
  const d=app.querySelectorAll('.dot')[S.idx];if(d)d.classList.toggle('done',answered(S.qs[S.idx],S.ans[S.idx]));
});
document.addEventListener('keydown',e=>{
  if(e.key==='Escape'&&modal){modal=null;render();return}
  if(modal)return;
  if(view==='cards'&&C&&C.i<C.deck.length){const k=e.key;
    if((k===' '||k==='Enter')&&(e.target===document.body||e.target.id==='fcard')){e.preventDefault();C.flipped=!C.flipped;render();return}
    if(C.flipped&&(k==='1'||k==='ArrowLeft')){cardAnswer(false);return} if(C.flipped&&(k==='2'||k==='ArrowRight')){cardAnswer(true);return}
    return}
  if(view!=='quiz'||!S)return;const inField=e.target.tagName==='INPUT',q=S.qs[S.idx];
  if(e.key==='Enter'&&e.target.tagName!=='BUTTON'){e.preventDefault();
    if(inField){const all=[...app.querySelectorAll('.blank')],n=all[all.indexOf(e.target)+1];if(n){n.focus();return}}
    if(S.idx<S.qs.length-1)step(1);return}
  if(inField||e.ctrlKey||e.metaKey||e.altKey)return;const k=e.key.toLowerCase();
  if(q.t==='mc'&&k.length===1&&'abcd1234'.includes(k)){const n='abcd1234'.indexOf(k)%4;if(n<q.o.length){S.ans[S.idx]=n;render()}}
  else if(q.t==='tf'&&(k==='t'||k==='n')){S.ans[S.idx]=k==='t';render()}
  else if(e.key==='ArrowRight')step(1);else if(e.key==='ArrowLeft')step(-1);
});
/* dugme „nazad” na telefonu vraća na početnu predmeta umesto da napusti sajt */
addEventListener('popstate',()=>{if(expectPop){expectPop=false;return}if(location.hash.length>1){pushed=false;return}if(!pushed)return;pushed=false;
  if(view==='quiz'&&S&&S.ans.some((a,k)=>answered(S.qs[k],a))){try{history.pushState({ispit:1},'');pushed=true}catch(e){}modal='quit';render();return}
  clearInterval(tick);S=null;R=null;C=null;modal=null;view='home';render();scrollTo(0,0)});
addEventListener('pageshow',e=>{if(e.persisted&&view==='home')render()});
addEventListener('storage',()=>{if(view==='home')render()});

/* ---------- linkovi: #ispit #mix #greske #test=ID #lekcija=N #kartice=N ---------- */
function route(){
  const h=decodeURIComponent(location.hash.slice(1));if(!h||h==='main')return;
  try{history.replaceState(history.state,'',location.pathname+location.search)}catch(e){}
  let m;
  if(h==='ispit'||h==='mix'||h==='greske'||h==='greske-sve')return startTest(h);
  if((m=/^test=(.+)$/.exec(h)))return startTest(m[1]);
  if((m=/^kartice=(\d+|sve|greske)$/.exec(h)))return startCards(/^\d+$/.test(m[1])?String(+m[1]-1):m[1]);
  if((m=/^(?:lekcija[=-])(\d+)$/.exec(h))){const li=+m[1]-1;if(li>=0&&li<LESSONS.length){openL.add(li);if(view!=='home'){S=null;R=null;C=null;view='home'}render();
      const el=document.getElementById('lekcija-'+(li+1));if(el){el.scrollIntoView({block:'start'});const s=el.querySelector('summary');if(s)s.focus({preventScroll:true})}}}
}
addEventListener('hashchange',route);
render();route();
window.__predmet={get view(){return view},startTest,finish,get S(){return S},get R(){return R},POOL,LESSONS,TESTS};
})();
