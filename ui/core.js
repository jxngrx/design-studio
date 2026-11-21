// Studio shell: helpers, view switching (new | canvas | settings), toolbar, job watcher.
const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const slug=s=>String(s).toLowerCase().replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,'').slice(0,40);
const get=p=>fetch(p).then(async r=>{const j=await r.json();if(!r.ok)throw new Error(j.error||r.status);return j});
const api=(p,b)=>fetch(p,{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify(b)}).then(async r=>{const j=await r.json();if(!r.ok)throw new Error(j.error||r.status);return j});
const store=(k,v)=>{try{localStorage[k]=v}catch(_){}};
let view='new';

function pre(){ // before first render: restore sidebar state, project and view
  try{if(localStorage.sc)document.body.classList.add('sc')}catch(_){}
  const ps=[...new Set(screens.map(s=>s.project))];
  proj=ps.includes(localStorage.proj)?localStorage.proj:ps[0]||'';
  view=['new','canvas','settings','proj'].includes(localStorage.view)?localStorage.view:'new';
  if(view==='canvas'&&!proj)view='new';
}
async function boot(){await loadMeta();PJ.id=localStorage.pj||null;if(view==='proj'&&!metaById(PJ.id))view='new';if(!(await route()))setView(view);if(Object.values(META).some(e=>e.id&&['analyzing','generating'].includes(e.status)))ensurePoll();ideaFromUrl()}
function setView(v){
  view=v;store('view',v);document.body.dataset.view=v==='proj'?'new':v; // the project page reuses the New layout
  if(v==='proj')renderProject(true);if(v==='new')renderHome();if(v==='settings')renderSettings();if(v==='canvas')renderTools();
  side();
}
async function onProject(){ // after the current project changed
  await protoLoad();applyProjectDevice();devMark();build();apply();renderTools();if(drawerOpen())drawerRender();
}

// toolbar over the canvas: mode switch (left), panels (right)
function renderTools(){
  $('#modes').innerHTML=`<div class="seg"><button class="${pmode==='design'?'on':''}" data-m="design">Design</button><button class="${pmode==='proto'?'on':''}" data-m="proto">Prototype</button></div>`+
    (pmode==='proto'?`<button class="tb" id="pplay">▶ Play</button><button class="tb" id="pstart" title="Make the selected screen the first screen of the prototype">⚑ Set start</button><span class="hint">Drag on a screen to draw a hotspot, then pick where it leads.</span>`:'');
  $('#modes').querySelectorAll('[data-m]').forEach(b=>b.onclick=()=>setPMode(b.dataset.m));
  if(pmode==='proto'){$('#pplay').onclick=playProto;$('#pstart').onclick=setStart}
  $('#tools').innerHTML=`<button class="tb${drawerOpen()&&DR.tab==='insp'?' on':''}" id="tinsp">Inspiration</button><button class="tb${drawerOpen()&&DR.tab==='var'?' on':''}" id="tvar" title="Alternative takes on the selected screen">Variants</button><button class="tb${drawerOpen()&&DR.tab==='ds'?' on':''}" id="tds">Design system</button>`;
  $('#tinsp').onclick=()=>toggleDrawer('insp');$('#tds').onclick=()=>toggleDrawer('ds');$('#tvar').onclick=()=>toggleDrawer('var');
}
$('#tools').onmousedown=$('#modes').onmousedown=e=>e.stopPropagation();

addEventListener('keydown',e=>{if(e.key==='Escape'){closePlayer();closePicker();closePop();if(drawerOpen())toggleDrawer(DR.tab)}});

// deep links (play=<screen id> opens the prototype player): #new  #settings?tab=skills  #d/<draft id>  #p/<Project>?vp=mobile&panel=ds|insp|var&mode=proto&select=<screen id>&zoom=0.4
async function route(){
  const [path,qs]=decodeURIComponent(location.hash.slice(1)).split('?'),[k,a]=path.split('/'),q=new URLSearchParams(qs||'');
  if(k==='new'){setView('new');return true}
  if(k==='settings'){if(q.get('tab'))ST.tab=q.get('tab');setView('settings');return true}
  if(k==='d'&&metaById(a)){openDraft(a);return true}
  if(k==='p'&&screens.some(s=>s.project===a)){
    if(q.get('vp'))VP[a]=q.get('vp');if(q.get('dev'))DEVP[a]=q.get('dev');
    if(q.get('open')){OPEN.add(a);saveTree()}
    await openProjectByName(a);
    if(q.get('zoom')){z=+q.get('zoom');apply()}
    if(q.get('mode')==='proto'||q.get('play'))await setPMode('proto');
    if(q.get('select')){await new Promise(r=>setTimeout(r,300));focusScreen(q.get('select'))}
    if(q.get('panel'))toggleDrawer(q.get('panel'));
    if(q.get('play')){proto.start=q.get('play');await new Promise(r=>setTimeout(r,800));playProto()}
    return true;
  }
  return false;
}
