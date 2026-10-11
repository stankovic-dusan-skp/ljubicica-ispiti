/* ============================================================
   Moji ispiti · kontrolna tabla
   Predmeti dolaze iz assets/predmeti.js (generiše build.py).
   ============================================================ */
(function(){
'use strict';
const SUBJ=window.PREDMETI,{esc,pl}=IS,app=document.getElementById('app');
let modal=null,menu=null,toastT=null,opener=null,pendingImport=null;

const ICON={
  more:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M6 9l6 6 6-6"/></svg>',
  cal:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="3" y="5" width="18" height="16" rx="2"/><path d="M16 3v4M8 3v4M3 10h18"/></svg>',
  check:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M20 6L9 17l-5-5"/></svg>',
  cards:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="3" y="6" width="14" height="14" rx="2"/><path d="M7 2h12a2 2 0 0 1 2 2v12"/></svg>',
  trash:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M3 6h18M8 6V4h8v2M19 6l-1 14H6L5 6"/></svg>'
};
const bySlug=s=>SUBJ.find(x=>x.slug===s);

function info(s){const h=IS.results(s.key),w=IS.wrong(s.wkey),st=IS.nextStep(s,h,w);
  return{h,w,st,L:st.L,mastered:st.L.filter(x=>x.st==='l3').length,started:Object.keys(h).length>0||st.ws.total>0}}

/* ---------- delovi ---------- */
function tally(P){const n=SUBJ.length,k=SUBJ.filter(s=>P[s.slug]).length;
  return`<div class="tally" role="img" aria-label="Položeno ${k} od ${n} predmeta"><span>Položeno <b>${k} od ${n}</b></span><div class="pips">${'<i class="pip on">✓</i>'.repeat(k)+'<i class="pip"></i>'.repeat(n-k)}</div></div>`}

function hero(active,D){
  if(!active.length)return`<section class="today" aria-label="Danas"><div class="count"><div><p class="label">Svi predmeti</p><p class="big word">Položeno</p></div><p class="when">Indeks je kompletan<span>Svi ispiti su upisani.</span></p></div>
    <div class="plan"><p class="label">Preporuka za danas</p><div class="step"><div><h2>Svi ispiti su položeni</h2><p>Kad dobiješ nove predmete, dodaju se ovde.</p></div></div></div></section>`;
  const up=active.find(x=>x.n!==null&&x.n>=0)||active[0],s=up.s,I=up.I,st=I.st,n=up.n,d=D[s.slug],today=IS.activity()[IS.today()]||0;
  const rem=I.L.filter(x=>x.st!=='l3').length;
  const left=n!==null&&n>=0?`<div><p class="label">Do sledećeg ispita</p>${n===0?'<p class="big word">Danas</p>':`<p class="big">${n}<small>${IS.dani(n)}</small></p>`}</div><p class="when">${esc(s.title)}<span>${esc(IS.dateLong(d))}</span></p>`
    :`<div><p class="label">Sledeći ispit</p><p class="big word">Datum nije unet</p></div><button class="btn setd" data-act="date" data-slug="${s.slug}" id="hero-date">${ICON.cal}Dodaj datum ispita</button>`;
  const pace=n!==null&&n>0?(rem?`Ostalo <b>${rem} ${pl(rem,'lekcija','lekcije','lekcija')}</b> do savladavanja · oko <b>${Math.ceil(rem/n)} dnevno</b>`:'Sve lekcije su savladane. Ostaje ponavljanje grešaka i simulacija.'):'';
  return`<section class="today" data-s="${s.s}" aria-label="Danas">
    <div class="count">${left}</div>
    <div class="plan"><p class="label">Preporuka za danas${n===null||n<0?' · '+esc(s.title):''}</p>
      <div class="step"><i class="pin" aria-hidden="true"></i><div><h2>${esc(st.title)}</h2><p>${esc(st.why)}</p></div></div>
      ${pace||today?`<p class="pace">${pace}${pace&&today?' · ':''}${today?`danas urađeno <b>${today}</b> ${pl(today,'pitanje','pitanja','pitanja')}`:''}</p>`:''}
      <div class="actions"><a class="btn primary" id="hero-go" href="${s.slug}/${esc(st.primary.href)}">${esc(st.primary.label)}</a><a class="btn" href="${s.slug}/${esc(st.secondary.href)}">${esc(st.secondary.label)}</a></div></div></section>`;
}

function subjCard(x,D){
  const s=x.s,I=x.I,n=x.n,d=D[s.slug],st=I.st;
  const due=d?`<div class="due ${n!==null&&n>=0&&n<=7?'urgent':''} ${n<0?'past':''}"><b>${n<0?'ispit je prošao':IS.dueText(n)}</b><span>${esc(IS.dateShort(d))}</span></div>`
    :`<div class="due"><button class="setdate" data-act="date" data-slug="${s.slug}" id="sd-${s.slug}">Dodaj datum ispita</button></div>`;
  const segs=I.L.map(l=>`<i class="seg ${l.st==='none'?'':l.st}" title="Lekcija ${l.li+1}: ${esc(s.lessons[l.li])} · ${esc(IS.ST_LABEL[l.st])}${l.avg!==null?' ('+l.avg+'%)':''}"></i>`).join('');
  const sim=st.sim,ws=st.ws;
  const right=!I.started?`Počni od lekcije 1: ${esc(s.lessons[0])}`:`${sim===null?'Simulacija nije rađena':`Simulacija: <b>${sim}%</b>`} · ${ws.due?`<b>${ws.due}</b> za ponavljanje`:`${ws.total} u greškama`}`;
  const open=menu===s.slug;
  return`<article class="card subj striped" data-s="${s.s}" id="p-${s.slug}" aria-labelledby="t-${s.slug}">
    <div><h3 class="h3" id="t-${s.slug}"><a href="${s.slug}/">${esc(s.title)}</a></h3><p class="prof">${esc(s.authors)}</p></div>
    ${due}
    <div class="strip"><div class="segs" role="img" aria-label="Lekcije: ${I.mastered} od ${I.L.length} savladano">${segs}</div>
      <div class="meta"><span><b>${I.mastered} od ${I.L.length}</b> ${pl(I.L.length,'lekcije','lekcije','lekcija')} savladano</span><span>${right}</span></div></div>
    ${I.started?`<p class="nextline">Sledeći korak: <b>${esc(st.primary.label)}</b>${st.li!==null&&st.li!==undefined?' · Lekcija '+(st.li+1):''}</p>`:''}
    <div class="row-actions">
      <a class="btn primary" href="${s.slug}/${esc(st.primary.href)}">${I.started?'Nastavi učenje':'Počni učenje'}</a>
      <a class="btn" href="${s.slug}/#ispit">Simulacija ispita</a>
      <a class="btn" href="${s.slug}/skripta.html">Skripta</a>
      <span class="spacer"></span>
      <div class="menu-wrap"><button class="btn ghost" id="more-${s.slug}" data-act="menu" data-slug="${s.slug}" aria-haspopup="true" aria-expanded="${open}">Još ${ICON.more}</button>
        ${open?`<div class="menu" role="menu" aria-label="Još opcija: ${esc(s.title)}">
          <button role="menuitem" data-act="date" data-slug="${s.slug}">${ICON.cal}${d?'Promeni datum ispita':'Dodaj datum ispita'}</button>
          <a role="menuitem" href="${s.slug}/#kartice=sve">${ICON.cards}Kartice iz svih lekcija</a>
          <button role="menuitem" data-act="pass" data-slug="${s.slug}">${ICON.check}Označi kao položeno</button><hr>
          <button role="menuitem" class="danger-text" data-act="resetOne" data-slug="${s.slug}">${ICON.trash}Obriši napredak predmeta</button></div>`:''}</div>
    </div></article>`;
}

function activitySec(){
  const a=IS.activity(),sk=IS.streak(a),t=a[IS.today()]||0,total=Object.values(a).reduce((x,y)=>x+y,0);
  const now=IS.dayStart(Date.now()),dow=(new Date(now).getDay()+6)%7,start=now-(dow+7*11)*IS.DAY,cells=[];
  for(let i=0;i<84;i++){const ts=start+i*IS.DAY,k=IS.iso(ts),v=a[k]||0,dd=new Date(ts);
    cells.push(ts>now?'<i class="fut"></i>':`<i class="${v>=40?'h3':v>=15?'h2':v>0?'h1':''} ${ts===now?'now':''}" title="${dd.getDate()}. ${dd.getMonth()+1}.: ${v} ${pl(v,'pitanje','pitanja','pitanja')}"></i>`)}
  return`<section aria-labelledby="h-akt"><div class="sec-head"><h2 class="h2" id="h-akt">Aktivnost</h2><p>poslednjih 12 nedelja</p></div>
    <div class="card flat activity" style="margin-top:14px"><div class="kpis">
      <div class="kpi"><b>${sk}</b><span>${pl(sk,'dan','dana','dana')} zaredom</span></div>
      <div class="kpi"><b>${t}</b><span>danas, pitanja</span></div>
      <div class="kpi"><b>${total}</b><span>ukupno odgovora</span></div></div>
      <div class="heat" role="img" aria-label="Aktivnost po danima: ${sk} ${pl(sk,'dan','dana','dana')} zaredom, ukupno ${total} odgovora">${cells.join('')}</div></div></section>`;
}

function indeks(P){
  const done=SUBJ.filter(s=>P[s.slug]),gr=done.map(s=>P[s.slug].o).filter(Boolean);
  const avg=gr.length?(gr.reduce((a,b)=>a+b,0)/gr.length).toFixed(2).replace('.',','):null;
  return`<section aria-labelledby="h-ind"><div class="sec-head"><h2 class="h2" id="h-ind">Indeks</h2><p>${avg?'prosek '+avg:done.length?'':'još nema položenih'}</p></div>
    <div class="indeks" style="margin-top:14px">${done.length?`<table><thead><tr><th scope="col">Predmet</th><th scope="col" class="dt">Datum</th><th scope="col" style="text-align:right">Ocena</th></tr></thead><tbody>
      ${done.map(s=>{const v=P[s.slug];return`<tr id="p-${s.slug}"><td class="nm">${esc(s.title)}<small>${esc(s.authors)}${s.slug in IS.PRESET?'':` · <button class="undo" data-act="unpass" data-slug="${s.slug}" id="un-${s.slug}">Poništi</button>`}</small></td>
        <td class="dt">${v.d?esc(IS.dateNum(v.d)):'–'}</td><td class="grade ${v.o?'':'none'}">${v.o||'bez ocene'}</td></tr>`}).join('')}</tbody></table>`
      :'<p class="empty">Kad položiš predmet, izaberi „Još” → „Označi kao položeno” i upisaće se ovde sa ocenom.</p>'}</div></section>`;
}

/* ---------- modali ---------- */
function modalHtml(){
  if(!modal)return'';const s=modal.slug?bySlug(modal.slug):null,D=IS.dates();
  const wrap=(body,lab)=>`<div class="veil" data-act="close"><div class="modal" role="dialog" aria-modal="true" aria-labelledby="mt" data-act="noop">${body}</div></div>`;
  if(modal.type==='date')return wrap(`<div class="stack" style="gap:4px"><h2 class="h2" id="mt">Datum ispita</h2><p class="muted small">${esc(s.title)}</p></div>
    <label class="field">Datum<input class="input" type="date" id="date-in" value="${esc(D[s.slug]||'')}" min="2026-01-01" max="2030-12-31"></label>
    <div class="acts">${D[s.slug]?'<button class="btn ghost danger-text" data-act="dateClear" style="margin-right:auto">Ukloni datum</button>':''}<button class="btn" data-act="close">Otkaži</button><button class="btn primary" id="date-save" data-act="dateSave">Sačuvaj</button></div>`);
  if(modal.type==='pass')return wrap(`<div class="stack" style="gap:4px"><h2 class="h2" id="mt">Označi kao položeno</h2><p class="muted small">${esc(s.title)} se seli u indeks i sklanja iz aktivnih predmeta. Ocenu možeš i da preskočiš.</p></div>
    <div class="stack" style="gap:8px"><span style="font-weight:600;font-size:.92rem">Ocena</span><div class="seg-ctl" role="group" aria-label="Ocena" style="display:grid;grid-template-columns:repeat(5,1fr)">${[6,7,8,9,10].map(g=>`<button data-act="grade" data-g="${g}" aria-pressed="${modal.g===g}">${g}</button>`).join('')}</div></div>
    <label class="field">Datum polaganja<input class="input" type="date" id="pass-d" value="${esc(modal.d||IS.today())}"></label>
    <div class="acts"><button class="btn" data-act="close">Otkaži</button><button class="btn ok" id="pass-ok" data-act="passDo">${modal.g?'Položeno · ocena '+modal.g:'Položeno bez ocene'}</button></div>`);
  if(modal.type==='unpass')return wrap(`<h2 class="h2" id="mt">Vratiti „${esc(s.title)}” u aktivne predmete?</h2><p class="muted small">Oznaka „položeno” i ocena biće obrisane. Rezultati testova ostaju.</p>
    <div class="acts"><button class="btn" data-act="close">Ne</button><button class="btn danger" id="unpass-ok" data-act="unpassDo">Da, vrati</button></div>`);
  if(modal.type==='resetOne')return wrap(`<h2 class="h2" id="mt">Obrisati napredak iz predmeta?</h2><p class="muted">Brišu se rezultati testova, lista grešaka i oznake „pročitano” za <b>${esc(s.title)}</b>. Datum ispita ostaje. Ovo ne može da se vrati.</p>
    <div class="acts"><button class="btn" data-act="close">Odustani</button><button class="btn danger" id="reset-one-ok" data-act="resetOneDo">Obriši</button></div>`);
  if(modal.type==='resetAll')return wrap(`<h2 class="h2" id="mt">Obrisati sav napredak?</h2><p class="muted">Brišu se rezultati svih testova, sve greške, oznake „pročitano” i aktivnost po danima. Datumi ispita i indeks ostaju. Ovo ne može da se vrati.</p>
    <div class="acts"><button class="btn" data-act="settings">Nazad</button><button class="btn danger" id="reset-all-ok" data-act="resetAllDo">Obriši sve</button></div>`);
  if(modal.type==='import'){const o=pendingImport||{},nr=Object.values(o.s||{}).reduce((a,x)=>a+Object.values(x.r||{}).reduce((b,y)=>b+y.length,0),0),nd=Object.keys(o.d||{}).length;
    return wrap(`<h2 class="h2" id="mt">Preneti napredak na ovaj uređaj?</h2><p class="muted">U linku ${nr?`je <b>${nr}</b> ${pl(nr,'rezultat','rezultata','rezultata')} testova`:'nema rezultata testova'}${nd?`, <b>${nd}</b> ${pl(nd,'datum','datuma','datuma')} ispita`:''} i podešavanja. Spaja se sa onim što već postoji ovde; ništa se ne briše.</p>
    <div class="acts"><button class="btn" data-act="importNo">Odustani</button><button class="btn primary" id="import-ok" data-act="importDo">Prenesi</button></div>`)}
  if(modal.type==='settings'){const t=IS.theme();
    return wrap(`<div class="row" style="justify-content:space-between"><h2 class="h2" id="mt">Podešavanja</h2><button class="btn sm ghost" data-act="close" aria-label="Zatvori">Zatvori</button></div>
    <div class="stack" style="gap:8px"><h3 class="h3">Prenos na telefon ili drugi uređaj</h3><p class="muted small">Napredak živi samo u ovom pregledaču. Kopiraj link i otvori ga na telefonu (pošalji ga sebi porukom). Ne šalji ga drugima: link nosi kopiju tvog napretka.</p>
      <div class="row"><button class="btn primary" id="copy-sync" data-act="copyLink">Kopiraj link za prenos</button></div>
      <p class="muted small">Rezervna kopija u fajlu, za svaki slučaj:</p>
      <div class="row"><button class="btn sm" data-act="backup">Sačuvaj kopiju</button><label class="btn sm" for="restore-f">Učitaj iz fajla</label><input type="file" id="restore-f" accept="application/json,.json" class="sr"></div></div>
    <div class="stack divider" style="gap:8px;padding-top:16px"><h3 class="h3">Izgled</h3><div class="seg-ctl full" role="group" aria-label="Tema">
      <button data-act="theme" data-v="auto" aria-pressed="${t==='auto'}">Automatski</button><button data-act="theme" data-v="light" aria-pressed="${t==='light'}">Svetla</button><button data-act="theme" data-v="dark" aria-pressed="${t==='dark'}">Tamna</button></div></div>
    <div class="stack divider" style="gap:8px;padding-top:16px"><h3 class="h3">Privatnost</h3><p class="muted small">Sve se čuva trajno, samo na ovom uređaju, dok ne obrišeš. Kad nekome pošalješ adresu sajta, on dobija prazan napredak i ne vidi tvoj.</p>
      <div class="row"><button class="btn sm danger-text" id="reset-all" data-act="resetAll">Obriši sav napredak</button></div></div>`)}
  return'';
}

function toast(m){clearTimeout(toastT);let t=document.getElementById('toast');if(!t){t=document.createElement('div');t.id='toast';t.className='toast';t.setAttribute('role','status');document.body.appendChild(t)}
  t.textContent=m;t.hidden=false;toastT=setTimeout(()=>{t.hidden=true},3800)}

/* ---------- prikaz ---------- */
function render(){
  const D=IS.dates(),P=IS.passedMap();
  const all=SUBJ.map((s,i)=>({s,i,n:IS.daysTo(D[s.slug]),I:info(s)})),active=all.filter(x=>!P[x.s.slug]);
  const rank=x=>x.n===null?1:x.n<0?2:0;
  active.sort((a,b)=>rank(a)-rank(b)||(rank(a)===0?a.n-b.n:a.i-b.i));
  const y=new Date().getFullYear(),m=new Date().getMonth(),sy=m>=8?y:y-1;
  app.innerHTML=`<header class="top"><div><h1 class="h1">Moji ispiti</h1><p class="sub">ICEPS · Zdravstvena nega · ${sy}/${String(sy+1).slice(2)}</p></div>${tally(P)}</header>
  ${hero(active,D)}
  ${active.length?`<section aria-labelledby="h-pred"><div class="sec-head"><h2 class="h2" id="h-pred">Predmeti</h2>
      <div class="legend" aria-hidden="true"><span><i style="background:var(--sunk);box-shadow:inset 0 0 0 1px var(--line)"></i>nije rađeno</span><span><i style="background:color-mix(in srgb,var(--ink) 35%,var(--sunk))"></i>u toku</span><span><i style="background:var(--ink)"></i>savladano</span><span><i style="background:var(--urgent-soft);box-shadow:inset 0 0 0 1.5px var(--urgent)"></i>za ponavljanje</span></div></div>
    <div class="list" style="margin-top:14px">${active.map(x=>subjCard(x,D)).join('')}</div></section>`:''}
  ${activitySec()}
  ${indeks(P)}
  <footer class="foot"><span>${IS.storageOk?'Napredak se čuva trajno u ovom pregledaču.':'Pregledač ne dozvoljava čuvanje (privatni režim?), pa se napredak neće pamtiti.'}</span><span class="links"><button data-act="settings" id="open-sync">Prenesi na telefon</button><button data-act="settings" id="open-settings">Podešavanja</button></span></footer>
  ${modalHtml()}`;
  alignBig();
  if(modal){const f=app.querySelector('.modal input:not([type=file]),.modal [aria-pressed=true],.modal .btn.primary,.modal .btn.ok,.modal .btn.danger');if(f)f.focus()}
  else if(menu){const m=app.querySelector('.menu');if(m){fitMenu(m);const f=m.querySelector('[role=menuitem]');if(f)f.focus({preventScroll:true})}}
  else if(opener){const e=document.getElementById(opener);if(e)e.focus({preventScroll:true});opener=null}
}
const close=()=>{modal=null;menu=null;render()};
/* veliki broj dana: leva ivica cifre tačno ispod natpisa „Do sledećeg ispita” (optičko poravnanje po obliku cifre) */
function alignBig(){const big=app.querySelector('.today .big:not(.word)');if(!big)return;big.style.marginLeft='0px';
  try{const cs=getComputedStyle(big),x=document.createElement('canvas').getContext('2d'),t=big.firstChild.textContent;
    x.font=`${cs.fontWeight} ${cs.fontSize} Onest`;let bear=x.measureText(t).actualBoundingBoxLeft;const lab=big.parentElement.querySelector('.label');if(lab){const cl=getComputedStyle(lab);x.font=`${cl.fontWeight} ${cl.fontSize} Onest`;bear-=x.measureText(lab.textContent.trim()[0]).actualBoundingBoxLeft}
    if(Math.abs(bear)<parseFloat(cs.fontSize)*.15)big.style.marginLeft=bear+'px'}catch(e){}}
if(document.fonts&&document.fonts.ready)document.fonts.ready.then(alignBig);addEventListener('resize',alignBig);
/* meni uvek ceo na ekranu: poravnanje uz dugme, pa pomeranje ako bi izašao levo ili desno */
function fitMenu(m){const W=document.documentElement.clientWidth,g=12;m.style.left='auto';m.style.right='0';m.style.transform='';
  let r=m.getBoundingClientRect();if(r.left<g){m.style.right='auto';m.style.left='0';r=m.getBoundingClientRect()}
  if(r.right>W-g)m.style.transform=`translateX(${W-g-r.right}px)`;else if(r.left<g)m.style.transform=`translateX(${g-r.left}px)`;
  r=m.getBoundingClientRect();if(r.bottom>innerHeight)scrollBy({top:r.bottom-innerHeight+g,behavior:'smooth'})}
addEventListener('resize',()=>{const m=app.querySelector('.menu');if(m)fitMenu(m)});

app.addEventListener('click',async e=>{
  const b=e.target.closest('[data-act]');
  if(menu&&!e.target.closest('.menu-wrap')){menu=null;if(!b){render();return}}
  if(!b)return;const act=b.dataset.act,slug=b.dataset.slug;
  if(act==='noop')return;
  if(act==='close'){if(b.classList.contains('veil')&&e.target!==b)return;return close()}
  if(act==='menu'){menu=menu===slug?null:slug;opener='more-'+slug;return render()}
  if(['date','pass','unpass','resetOne'].includes(act)){opener=menu?'more-'+slug:b.id||null;menu=null;modal={type:act,slug,g:null};return render()}
  if(act==='settings'){opener=b.id||opener;menu=null;modal={type:'settings'};return render()}
  if(act==='dateSave'){const v=document.getElementById('date-in').value;IS.setDate(modal.slug,v);close();return toast(v?'Datum ispita je sačuvan.':'Datum je uklonjen.')}
  if(act==='dateClear'){IS.setDate(modal.slug,'');close();return toast('Datum je uklonjen.')}
  if(act==='grade'){modal.g=modal.g===+b.dataset.g?null:+b.dataset.g;modal.d=document.getElementById('pass-d').value;return render()}
  if(act==='passDo'){const d=document.getElementById('pass-d').value||IS.today();IS.setPassed(modal.slug,{d,o:modal.g});close();return toast('Predmet je upisan u indeks.')}
  if(act==='unpassDo'){IS.setPassed(modal.slug,null);close();return}
  if(act==='resetOneDo'){IS.resetProgress(modal.slug);close();return toast('Napredak iz predmeta je obrisan.')}
  if(act==='resetAll'){modal={type:'resetAll'};return render()}
  if(act==='resetAllDo'){IS.resetProgress();close();return toast('Sav napredak je obrisan.')}
  if(act==='theme'){IS.setTheme(b.dataset.v);return render()}
  if(act==='backup'){IS.downloadBackup();return toast('Kopija je sačuvana u preuzimanjima.')}
  if(act==='copyLink'){let l;try{l=await IS.exportLink(location.origin+location.pathname)}catch(err){return toast('Link nije mogao da se napravi.')}
    try{await navigator.clipboard.writeText(l);toast('Link je kopiran. Otvori ga na telefonu.')}catch(err){prompt('Kopiraj ovaj link:',l)}return}
  if(act==='importDo'){try{IS.mergeData(pendingImport);pendingImport=null;close();toast('Napredak je prenet na ovaj uređaj.')}catch(err){close();toast('Prenos nije uspeo: link je oštećen.')}return}
  if(act==='importNo'){pendingImport=null;return close()}
});
app.addEventListener('change',e=>{if(e.target.id!=='restore-f'||!e.target.files[0])return;const f=e.target.files[0];
  f.text().then(t=>{pendingImport=JSON.parse(t);if(!pendingImport||typeof pendingImport!=='object')throw 0;modal={type:'import'};render()}).catch(()=>toast('Fajl nije ispravna kopija napretka.'))});
document.addEventListener('keydown',e=>{if(e.key!=='Escape')return;if(modal||menu){if(modal&&modal.type==='import')pendingImport=null;close()}});

async function route(){const hs=location.hash;
  try{
    if(/prenos=/.test(hs)){history.replaceState(null,'',location.pathname);pendingImport=await IS.decodeLink(hs);if(pendingImport){modal={type:'import'};render()}return}
    if(/[?&]s=/.test(location.search)){const o=IS.decodeLegacy(location.search);history.replaceState(null,'',location.pathname);if(o){pendingImport=o;modal={type:'import'};render()}return}
    let m;if((m=/^#datum=([\w-]+)$/.exec(hs))&&bySlug(m[1])){history.replaceState(null,'',location.pathname);modal={type:'date',slug:m[1]};render();return}
    if(hs==='#podesavanja'){history.replaceState(null,'',location.pathname);modal={type:'settings'};render()}
  }catch(err){toast('Link za prenos je oštećen ili nepotpun.')}}
addEventListener('hashchange',route);
addEventListener('pageshow',e=>{if(e.persisted)render()});addEventListener('storage',()=>{if(!modal)render()});
render();route();
})();
