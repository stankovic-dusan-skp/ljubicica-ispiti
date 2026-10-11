/* Moji ispiti · čitač skripte: pretraga, trenutna lekcija u meniju, oznaka „pročitano” */
(function(){
'use strict';
const K=window.SKRIPTA,top=document.querySelector('.reader-top'),toc=document.getElementById('toc'),q=document.getElementById('q'),hits=document.getElementById('hits');
const norm=s=>String(s||'').toLowerCase().replace(/đ/g,'dj').normalize('NFD').replace(/[̀-ͯ]/g,'');

/* visina gornje trake → sidra ne završavaju ispod nje */
function stick(){if(top)document.documentElement.style.setProperty('--stick',(top.offsetHeight+12)+'px')}
const st=document.createElement('style');st.textContent='.prose [id],.prose{scroll-margin-top:var(--stick,150px)}.flashhit{animation:fh 2s ease-out}@keyframes fh{0%,40%{background:color-mix(in srgb,var(--warn) 30%,transparent)}100%{background:transparent}}';document.head.appendChild(st);
stick();addEventListener('resize',stick);
if(location.hash){const t=document.getElementById(decodeURIComponent(location.hash.slice(1)));if(t)requestAnimationFrame(()=>t.scrollIntoView())}

/* pročitano */
function paint(){let n=0;
  document.querySelectorAll('[data-read]').forEach(b=>{const on=IS.isRead(K.slug,+b.dataset.read);if(on)n++;b.classList.toggle('read-on',on);b.setAttribute('aria-pressed',on);b.textContent=on?'✓ Pročitano':'Označi kao pročitano'});
  toc.querySelectorAll('a[data-li]').forEach(a=>{const on=IS.isRead(K.slug,+a.dataset.li);let d=a.querySelector('.rd');if(on&&!d){d=document.createElement('i');d.className='rd';d.setAttribute('aria-label','pročitano');a.prepend(d)}else if(!on&&d)d.remove()});
  const rc=document.getElementById('readcount');if(rc)rc.textContent=n?`pročitano ${n} od ${K.n}`:''}
document.addEventListener('click',e=>{const b=e.target.closest('[data-read]');if(!b)return;const li=+b.dataset.read;IS.setRead(K.slug,li,!IS.isRead(K.slug,li));paint()});
addEventListener('storage',paint);paint();

/* trenutna lekcija u meniju */
const secs=[...document.querySelectorAll('.prose')];let cur=null;
function mark(){const y=(top?top.offsetHeight:0)+40;let s=secs[0];for(const x of secs)if(x.getBoundingClientRect().top<=y)s=x;
  const id=s.querySelector('h2').id;if(id===cur)return;cur=id;
  toc.querySelectorAll('a').forEach(a=>{const on=a.getAttribute('href')==='#'+id;a.classList.toggle('cur',on);if(on){a.setAttribute('aria-current','true');const r=a.getBoundingClientRect(),tr=toc.getBoundingClientRect();if(r.left<tr.left||r.right>tr.right)toc.scrollTo({left:a.offsetLeft-16,behavior:'smooth'})}else a.removeAttribute('aria-current')})}
let raf=0;addEventListener('scroll',()=>{if(!raf)raf=requestAnimationFrame(()=>{raf=0;mark()})},{passive:true});mark();

/* pretraga */
const blocks=[];
secs.forEach(s=>{const h2=s.querySelector('h2'),ln=h2.querySelector('.ln'),lesson=ln?ln.textContent:h2.textContent;let h3=null;
  s.querySelectorAll('h3,p,li,tr,.formula,blockquote').forEach(el=>{if(el.tagName==='H3'){h3=el;}
    if(el.closest('.lesson-end')||(el.tagName==='P'&&el.closest('li,blockquote'))||(el.tagName==='LI'&&el.querySelector('li')))return;
    const t=el.textContent.replace(/\s+/g,' ').trim();if(t)blocks.push({el,t,n:norm(t),where:lesson+(h3&&el!==h3?' · '+h3.textContent:'')})})});
const escH=s=>s.replace(/[&<>"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'})[c]);
function snip(b,w){const i=b.n.indexOf(w),a=Math.max(0,i-50),z=Math.min(b.t.length,i+w.length+70);
  return(a?'…':'')+escH(b.t.slice(a,i))+'<mark>'+escH(b.t.slice(i,i+w.length))+'</mark>'+escH(b.t.slice(i+w.length,z))+(z<b.t.length?'…':'')}
let found=[];
function search(){const w=norm(q.value.trim());if(w.length<2){hits.hidden=true;hits.innerHTML='';found=[];return}
  found=blocks.filter(b=>b.n.includes(w)).slice(0,40);
  hits.innerHTML=found.length?found.map((b,i)=>`<a href="#" role="option" data-hit="${i}"><b>${escH(b.where)}</b>${snip(b,w)}</a>`).join('')+(found.length===40?'<p class="muted small" style="padding:8px 10px">Prikazano prvih 40. Suzi pojam.</p>':'')
    :'<p class="muted small" style="padding:10px">Nema rezultata za „'+escH(q.value.trim())+'”.</p>';
  hits.hidden=false}
q.addEventListener('input',search);
q.addEventListener('keydown',e=>{if(e.key==='Escape'){q.value='';search();q.blur()}if(e.key==='ArrowDown'){const a=hits.querySelector('a');if(a){e.preventDefault();a.focus()}}if(e.key==='Enter'){const a=hits.querySelector('a');if(a){e.preventDefault();a.click()}}});
hits.addEventListener('keydown',e=>{const a=e.target.closest('a');if(!a)return;if(e.key==='ArrowDown'){e.preventDefault();(a.nextElementSibling||a).focus()}if(e.key==='ArrowUp'){e.preventDefault();(a.previousElementSibling||q).focus()}if(e.key==='Escape'){hits.hidden=true;q.focus()}});
hits.addEventListener('click',e=>{const a=e.target.closest('[data-hit]');if(!a)return;e.preventDefault();const b=found[+a.dataset.hit];hits.hidden=true;
  b.el.scrollIntoView({block:'center'});b.el.classList.remove('flashhit');void b.el.offsetWidth;b.el.classList.add('flashhit')});
document.addEventListener('click',e=>{if(!e.target.closest('.search'))hits.hidden=true});
document.addEventListener('keydown',e=>{if(e.key==='/'&&document.activeElement!==q&&!/INPUT|TEXTAREA/.test(document.activeElement.tagName)){e.preventDefault();q.focus()}});
})();
