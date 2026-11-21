// Explorer-style sidebar: each project is a folder (expand for sections and screens), like a code editor's file tree.
let META={};
const OPEN=new Set(JSON.parse(localStorage.open||'[]')),CLOSED=new Set(JSON.parse(localStorage.closed||'[]'));
const saveTree=()=>{store('open',JSON.stringify([...OPEN]));store('closed',JSON.stringify([...CLOSED]))};
const ICON={
  folder:'<svg class="ic" viewBox="0 0 16 16"><path d="M1.5 3.5h4l1.5 1.5h7.5v7.5h-13z" fill="none" stroke="currentColor" stroke-width="1.2" stroke-linejoin="round"/></svg>',
  folderOpen:'<svg class="ic" viewBox="0 0 16 16"><path d="M1.5 12.5v-9h4l1.5 1.5h6.5v2.5M1.5 12.5l2-5.5h12l-2 5.5z" fill="none" stroke="currentColor" stroke-width="1.2" stroke-linejoin="round"/></svg>',
  file:'<svg class="ic" viewBox="0 0 16 16"><path d="M3.5 1.5h6l3 3v10h-9z M9.5 1.5v3h3" fill="none" stroke="currentColor" stroke-width="1.2" stroke-linejoin="round"/></svg>',
  plus:'<svg class="ic" viewBox="0 0 16 16"><path d="M8 3v10M3 8h10" stroke="currentColor" stroke-width="1.4" stroke-linecap="round"/></svg>',
  gear:'<svg class="ic" viewBox="0 0 16 16"><circle cx="8" cy="8" r="2.2" fill="none" stroke="currentColor" stroke-width="1.2"/><path d="M8 1.5v2M8 12.5v2M1.5 8h2M12.5 8h2M3.4 3.4l1.4 1.4M11.2 11.2l1.4 1.4M3.4 12.6l1.4-1.4M11.2 4.8l1.4-1.4" stroke="currentColor" stroke-width="1.2" stroke-linecap="round"/></svg>'};
const metaByName=n=>Object.values(META).find(e=>e.name===n);
const metaById=id=>Object.values(META).find(e=>e.id===id);
async function loadMeta(){try{META=await get('/api/projects')}catch{}}

// folders = projects that have screens + drafts that do not have any yet
function folders(){
  const names=[...new Set(screens.map(s=>s.project))],out=names.map(n=>({name:n,e:metaByName(n)}));
  for(const e of Object.values(META))if(e.id&&!names.includes(e.name)&&['analyzing','brief','error','generating','partial'].includes(e.status))out.push({name:e.name==='Untitled'?'Analyzing idea…':e.name,e,draft:true});
  return out;
}
const badge=e=>!e?.status||e.status==='ready'?'':e.status==='analyzing'||e.status==='generating'?'<span class="bd spin" title="Working…"></span>':e.status==='brief'?'<span class="bd ask" title="Questions waiting"></span>':e.status==='partial'?'<span class="bd warn" title="Some screens failed">!</span>':'<span class="bd err" title="Failed"></span>';
const needsPage=e=>e?.id&&(['analyzing','brief','error'].includes(e.status)||(e.status==='generating'&&!screens.some(s=>s.project===e.name)));

function sideRender(){
  const sc=document.body.classList.contains('sc'),cur=view==='canvas'?proj:view==='proj'?metaById(PJ.id)?.name:null;
  const rows=folders().map(({name,e,draft})=>{
    const open=OPEN.has(name)&&!sc,list=screens.filter(s=>s.project===name),groups=[...new Set(list.map(s=>s.group))];
    const on=name===cur||(view==='proj'&&e&&e.id===PJ.id);
    return `<div class="tn proj${on?' on':''}" data-f="${esc(name)}" title="${esc(name)}"><span class="chev${open?' o':''}">›</span>${open?ICON.folderOpen:ICON.folder}<span class="lbl nm">${esc(name)}</span><span class="lbl n">${draft?'':list.length}</span>${badge(e)}</div>`+
      (open?`<div class="kids">${groups.map(g=>{const gk=name+'/'+g,gopen=!CLOSED.has(gk);return `<div class="tn grp" data-g="${esc(gk)}"><span class="chev${gopen?' o':''}">›</span>${gopen?ICON.folderOpen:ICON.folder}<span class="lbl nm">${esc(g)}</span></div>`+
        (gopen?list.filter(s=>s.group===g).map(s=>`<div class="tn file${view==='canvas'&&sel===s.id?' on':''}" data-s="${esc(s.id)}" data-p="${esc(name)}" title="${esc(s.name)}">${ICON.file}<span class="lbl nm">${esc(s.name)}</span></div>`).join(''):'')}).join('')}</div>`:'');
  }).join('');
  $('#side').innerHTML=`<div class="h"><span class="lbl">Explorer</span><button id="tg" title="Toggle sidebar">${sc?'»':'«'}</button></div>
    <div class="tn nav${view==='new'?' on':''}" id="nv" title="New">${ICON.plus}<span class="lbl nm">New project</span></div>
    <div class="cap lbl">Projects</div><div class="tree">${rows||'<p class="lbl none">No projects yet.</p>'}</div>
    <div class="tn nav${view==='settings'?' on':''}" id="stg" title="Settings" style="margin-top:auto">${ICON.gear}<span class="lbl nm">Settings</span></div>`;
  $('#nv').onclick=()=>setView('new');$('#stg').onclick=()=>setView('settings');
  $('#tg').onclick=()=>{document.body.classList.toggle('sc');store('sc',document.body.classList.contains('sc')?1:'');sideRender()};
  $('#side').querySelectorAll('[data-f]').forEach(r=>r.onclick=()=>{
    const n=r.dataset.f,e=folders().find(f=>f.name===n)?.e;
    if(OPEN.has(n)&&!(view!=='canvas'&&view!=='proj'))OPEN.delete(n);else OPEN.add(n);saveTree();
    openProjectByName(n,e);});
  $('#side').querySelectorAll('[data-g]').forEach(r=>r.onclick=()=>{const k=r.dataset.g;CLOSED.has(k)?CLOSED.delete(k):CLOSED.add(k);saveTree();sideRender()});
  $('#side').querySelectorAll('[data-s]').forEach(r=>r.onclick=async()=>{
    if(view!=='canvas'||proj!==r.dataset.p){proj=r.dataset.p;store('proj',proj);px=py=40;setView('canvas');await onProject()}
    focusScreen(r.dataset.s)});
}
async function openProjectByName(name,e){
  e=e||metaByName(name);
  if(needsPage(e)){openDraft(e.id);return}
  proj=name;store('proj',name);sel=null;px=py=40;setView('canvas');await onProject();
}
function focusScreen(id){
  sel=id;mark();sideRender();
  const c=document.querySelector(`.cell[data-id="${id}"]`);if(!c)return;
  const a=c.getBoundingClientRect(),w=world.getBoundingClientRect();px=60-(a.left-w.left);py=90-(a.top-w.top);apply();
}
$('#side').onmousedown=e=>e.stopPropagation();
