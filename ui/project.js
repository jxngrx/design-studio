// Project page for unfinished projects. State lives on the server (status, brief, edits, log), so switching tabs,
// opening other projects or reloading never loses the questions or the progress.
// status: analyzing -> brief -> generating -> ready | partial | error
const PHONEQ={id:'phone',q:'Which phone are you designing for?',why:'Sets the preview frame and the design language (iOS vs Android)',options:['iPhone 15','iPhone 15 Pro Max','iPhone SE','Pixel 8','Samsung Galaxy S24']};
const PHONEID={'iPhone 15':'iphone15','iPhone 15 Pro Max':'iphone15max','iPhone SE':'iphonese','Pixel 8':'pixel8','Samsung Galaxy S24':'galaxys24'},PHONENAME=Object.fromEntries(Object.entries(PHONEID).map(([k,v])=>[v,k]));
const PJ={id:null,phone:'iPhone 15',sig:'',jobs:{},poll:null,loaded:null,ans:{},extra:{},screens:[],platform:'Mobile app',saveT:null,wasGen:{}};
const PLATQ={id:'platform',q:'Which platform is this for?',why:'Decides frame size and navigation patterns',options:['Mobile app','Web app (responsive)','Chrome extension']};
const PLATMAP={'Mobile app':'mobile','Web app (responsive)':'web','Chrome extension':'extension'},PLATBACK={mobile:'Mobile app',web:'Web app (responsive)',extension:'Chrome extension'};
const PHASES=['Reading your idea','Working out who it is for','Drafting questions','Sketching the screen list'];

function openDraft(id){PJ.id=id;store('pj',id);PJ.sig='';setView('proj');ensurePoll()}
const pjMeta=()=>metaById(PJ.id);

// ---- polling: runs while anything is analyzing or generating
function ensurePoll(){if(!PJ.poll){PJ.poll=setInterval(tick,2000);tick()}}
async function tick(){
  await loadMeta();
  const active=Object.values(META).filter(e=>e.id&&['analyzing','generating'].includes(e.status));
  if(active.some(e=>e.status==='generating')){try{screens=await get('screens.json')}catch{}}
  for(const e of active.filter(e=>e.status==='generating'&&e.jobId)){try{PJ.jobs[e.id]=await get('/api/job?id='+e.jobId)}catch{}}
  for(const e of Object.values(META).filter(e=>e.id&&['partial','error'].includes(e.status)&&e.jobId&&!PJ.jobs[e.id]))try{PJ.jobs[e.id]=await get('/api/job?id='+e.jobId)}catch{}
  // a generating project that just finished: refresh screens and leave the page for the canvas
  for(const e of Object.values(META).filter(e=>e.id)){
    if(PJ.wasGen[e.id]&&['ready','partial'].includes(e.status)){
      delete PJ.wasGen[e.id];try{screens=await get('screens.json')}catch{}
      if(view==='proj'&&PJ.id===e.id&&e.status==='ready'){proj=e.name;store('proj',e.name);px=py=40;sel=null;setView('canvas');await onProject()}
    }
    if(e.status==='generating')PJ.wasGen[e.id]=1;
  }
  sideRender();
  if(view==='proj')renderProject(false);
  jobBar();
  if(!active.length&&PJ.poll&&!(view==='proj'&&pjMeta()?.status==='analyzing')){clearInterval(PJ.poll);PJ.poll=null}
}
// small bar on the canvas while a project is generating in the background / when screens failed
function jobBar(){
  const bar=$('#jobbar'),g=Object.values(META).find(e=>e.id&&e.status==='generating'),p=Object.values(META).find(e=>e.id&&e.status==='partial'&&e.name===proj);
  if(g&&view!=='proj'){const j=PJ.jobs[g.id];bar.classList.add('show');bar.innerHTML=`<b>${esc(g.name==='Untitled'?'New project':g.name)}</b> · ${esc(j?.phase||'Working')} ${j?.total?`(${j.done||0}/${j.total})`:''}<i><u style="width:${j?.total?Math.round((j.done||0)/j.total*100):0}%"></u></i><button class="lnk" id="jbo">Open</button>`;$('#jbo').onclick=()=>openDraft(g.id)}
  else if(p&&view==='canvas'){bar.classList.add('show');bar.innerHTML=`<span class="bad">${(p.failedItems||[]).length} screen(s) failed.</span> <button class="lnk" id="jbo">See why and retry</button>`;$('#jbo').onclick=()=>openDraft(p.id)}
  else bar.classList.remove('show');
}

// ---- rendering by status
function renderProject(force){
  const e=pjMeta();if(!e){setView('new');return}
  const j=PJ.jobs[e.id],done=screens.filter(s=>s.project===e.name).length;
  const phase=e.status==='analyzing'?Math.min(PHASES.length-1,Math.floor((Date.now()-(e.created||Date.now()))/6000)):0;
  const sig=[e.status,e.name,j?.phase,j?.done,(j?.log||[]).length,done,phase,(j?.failed||[]).length].join('|');
  if(!force&&sig===PJ.sig)return;PJ.sig=sig;
  const body={analyzing:pAnalyzing,brief:pBrief,generating:pGenerating,partial:pDone,error:pError,ready:pDone}[e.status]||pDone;
  $('#home').innerHTML=`<div class="hm thread"><div class="phead"><span class="pname">${esc(e.name==='Untitled'?'New project':e.name)}</span>${'' }</div>
    <div class="msg you">${esc(e.description)}</div>${e.usage?`<p class="hs cost">Cost so far: <b>${e.usage.usd.toFixed(3)} USD</b> · ${e.usage.calls} calls · ${Math.round((e.usage.out||0)/1000)}K output tokens</p>`:''}${body(e,j,done,phase)}</div>`;
  bindProject(e);
}
function pAnalyzing(e,j,d,phase){
  return `<div class="msg ai"><ul class="steps">${PHASES.map((p,i)=>`<li class="${i<phase?'done':i===phase?'now':''}">${p}</li>`).join('')}</ul><div class="sk1"></div><div class="sk1 w2"></div><div class="sk1 w3"></div></div>
    <p class="hs">You can leave this page. The project keeps working in the sidebar and your questions will be waiting.</p>`;
}
function pError(e,j){
  return `<div class="blk"><h2>Something went wrong</h2><p class="bad">${esc(e.error||'Unknown error')}</p>
    <div class="actbar" style="position:static"><button class="go" id="rt">${e.items?.length&&(e.failedItems||[]).length?'Retry failed screens':'Try again'}</button></div></div>${logBlock(e,j)}`;
}

// brief: understanding + multi-select questions + editable screens
function loadBrief(e){
  if(PJ.loaded===e.id)return;PJ.loaded=e.id;const ed=e.edits||{};
  PJ.ans=ed.ans||{};PJ.extra=ed.extra||{};PJ.screens=(ed.screens&&ed.screens.length?ed.screens:e.brief.screens).map(s=>({...s}));
  PJ.platform=PLATBACK[ed.platform||e.platform]||'Mobile app';PJ.phone=PHONENAME[ed.device||e.device]||'iPhone 15';
}
const pqs=e=>[PLATQ,...(PJ.platform==='Mobile app'?[PHONEQ]:[]),...e.brief.questions];
function saveEdits(){
  clearTimeout(PJ.saveT);PJ.saveT=setTimeout(()=>api('/api/draft/save',{id:PJ.id,edits:{ans:PJ.ans,extra:PJ.extra,screens:PJ.screens,platform:PLATMAP[PJ.platform],device:PHONEID[PJ.phone]}}).catch(()=>{}),400);
}
function pBrief(e){
  loadBrief(e);const A=e.brief,groups=[...new Set(PJ.screens.map(s=>s.group))];
  const sel=(q,o)=>q.id==='platform'?PJ.platform===o:q.id==='phone'?PJ.phone===o:(PJ.ans[q.id]||[]).includes(o);
  return `<div class="msg ai"><p class="und">${esc(A.understanding||'Here is how I read your idea.')}</p></div>
    <div class="blk"><h2>A few questions</h2><p class="hs">Pick all that apply. Skip anything that does not matter.</p>
    ${pqs(e).map(q=>`<div class="q"><div class="qh"><b>${esc(q.q)}</b>${q.why?`<small>${esc(q.why)}</small>`:''}${q.id==='platform'||q.id==='phone'?'':'<small>select several</small>'}</div>
      <div class="opts">${q.options.map(o=>`<button class="chip${sel(q,o)?' on':''}" data-q="${esc(q.id)}" data-o="${esc(o)}">${esc(o)}</button>`).join('')}</div>
      ${q.id==='platform'||q.id==='phone'?'':`<input class="qx" data-x="${esc(q.id)}" placeholder="Or say it in your own words" value="${esc(PJ.extra[q.id]||'')}">`}</div>`).join('')}</div>
    <div class="blk"><h2>Screens <span class="cnt">${PJ.screens.length}</span></h2><p class="hs">Rename, remove, or add. This is exactly what gets designed.</p>
    <div class="slist">${groups.map(g=>`<div class="sg"><div class="sgh">${esc(g)}</div>${PJ.screens.map((s,i)=>s.group!==g?'':`<div class="srow"><input data-n="${i}" value="${esc(s.name)}"><span class="sd">${esc(s.description)}</span><button class="rm" data-rm="${i}" title="Remove screen">×</button></div>`).join('')}</div>`).join('')}</div>
    <div class="add"><input id="an" placeholder="Add a screen, e.g. Settings"><input id="ag" list="agl" placeholder="Section"><datalist id="agl">${groups.map(g=>`<option value="${esc(g)}">`).join('')}</datalist><button class="cb" id="aa">＋ Add</button></div></div>
    <div class="actbar"><button class="cb" id="dl">Discard</button><span class="grow"></span><button class="go" id="gen"${PJ.screens.length<3?' disabled':''}>Design ${PJ.screens.length} screens</button></div><div id="hstat" class="hstat"></div>`;
}

// generating: every planned screen is a tile that draws itself, then becomes a live thumbnail
function tileDevice(e){const pl=e.edits?.platform||e.platform;return pl==='web'?DESK.browser:pl==='extension'?DESK.popup:DEVICES.find(d=>d.id===(e.edits?.device||e.device))||dev}
function pGenerating(e,j,done){
  const items=(e.items&&e.items.length?e.items:(e.edits?.screens||e.brief?.screens||[])).map(s=>({...s})),D=tileDevice(e),W=D.w>600?250:116,k=W/D.w;
  const have=n=>screens.find(s=>s.project===e.name&&(s.id===n.id||s.name===n.name));
  const total=j?.total||items.length||1;
  return `<div class="blk gen"><h2>${esc(j?.phase||'Starting')}</h2><div class="pbar2"><i style="width:${Math.round((j?.done||0)/total*100)}%"></i></div>
    <p class="hs">${j?.done||0} of ${total} screens · you can leave this page, it keeps going.${done?` <button class="lnk" id="oc">Open canvas</button>`:''}</p>
    <div class="tiles">${items.map(n=>{const s=have(n);return s?`<div class="tile done"><div class="vp" style="width:${W}px;height:${Math.round(D.h*k)}px"><iframe src="/screens/${esc(s.id)}.html" style="width:${D.w}px;height:${D.h}px;transform:scale(${k})" data-vf></iframe></div><small>${esc(n.name)}</small></div>`
      :`<div class="tile"><div class="wf" style="width:${W}px;height:${Math.round(D.h*k)}px"><i></i><i></i><i></i><i></i><i></i><u></u></div><small>${esc(n.name)} · drawing…</small></div>`}).join('')||'<div class="tile"><div class="wf" style="width:116px;height:230px"><i></i><i></i><i></i><u></u></div><small>Planning…</small></div>'}</div></div>${logBlock(e,j)}`;
}
function pDone(e,j,done){
  const failed=e.failedItems||[],errs=j?.failed||[];
  return `<div class="blk"><h2>${failed.length?`${failed.length} screen${failed.length===1?'':'s'} failed`:'All screens designed'}</h2>
    ${failed.length?`<ul class="fails">${failed.map(f=>`<li><b>${esc(f.name)}</b><span>${esc(errs.find(x=>x.name===f.name)?.error||(e.log||[]).filter(l=>!l.ok&&l.msg.includes(`"${f.name}"`)).map(l=>l.msg).pop()||'No error recorded.')}</span></li>`).join('')}</ul>`:''}
    <div class="actbar" style="position:static">${failed.length?'<button class="go" id="rt">Retry failed screens</button>':''}<button class="cb" id="oc">Open canvas</button></div></div>${logBlock(e,j)}`;
}
function logBlock(e,j){
  const lines=(j?.log?.length?j.log:e.log)||[];if(!lines.length)return '';
  return `<details class="logs"${e.status==='error'||e.status==='partial'?' open':''}><summary>Log (${lines.length})</summary><div class="lg">${lines.map(l=>`<div class="${l.ok?'':'bad'}"><time>${esc(l.t)}</time> ${esc(l.msg)}</div>`).join('')}</div></details>`;
}

// ---- events
function bindProject(e){
  const h=$('#home'),on=(s,f)=>{const el=h.querySelector(s);if(el)el.onclick=f};
  h.querySelectorAll('[data-q]').forEach(b=>b.onclick=()=>{
    const id=b.dataset.q,o=b.dataset.o;
    if(id==='platform')PJ.platform=o;else if(id==='phone')PJ.phone=o;else{const c=PJ.ans[id]||[];PJ.ans[id]=c.includes(o)?c.filter(x=>x!==o):[...c,o]}
    saveEdits();renderProject(true)});
  h.querySelectorAll('[data-x]').forEach(i=>i.oninput=()=>{PJ.extra[i.dataset.x]=i.value;saveEdits()});
  h.querySelectorAll('[data-n]').forEach(i=>i.onchange=()=>{PJ.screens[+i.dataset.n].name=i.value.trim()||PJ.screens[+i.dataset.n].name;saveEdits()});
  h.querySelectorAll('[data-rm]').forEach(b=>b.onclick=()=>{PJ.screens.splice(+b.dataset.rm,1);saveEdits();renderProject(true)});
  const add=()=>{const n=$('#an').value.trim(),g=$('#ag').value.trim()||PJ.screens[PJ.screens.length-1]?.group||'Flow';if(!n||PJ.screens.length>=16)return;PJ.screens.push({name:n,group:g,description:''});saveEdits();renderProject(true);$('#an').focus()};
  on('#aa',add);if($('#an'))$('#an').onkeydown=ev=>{if(ev.key==='Enter')add()};
  on('#gen',()=>generateDraft(e));
  on('#dl',async()=>{await api('/api/draft/delete',{id:e.id}).catch(()=>{});await loadMeta();setView('new')});
  on('#oc',()=>{proj=e.name;store('proj',e.name);px=py=40;sel=null;setView('canvas');onProject()});
  on('#rt',async()=>{
    try{if(e.items?.length&&(e.failedItems||[]).length){const r=await api('/api/project/retry',{id:e.id});PJ.wasGen[e.id]=1;PJ.sig=''}else{await api('/api/draft/retry',{id:e.id})}}catch(err){alert(err.message)}
    ensurePoll();tick()});
  h.querySelectorAll('[data-vf]').forEach(f=>{const s=screens.find(x=>f.src.includes('/'+x.id+'.html'));if(s)f.onload=()=>style(f,s,tileDevice(e))});
}
function answersText(e){
  return pqs(e).map(q=>{const a=q.id==='platform'?[PJ.platform]:q.id==='phone'?[PJ.phone+(/iPhone/.test(PJ.phone)?' (iOS)':' (Android)')]:[...(PJ.ans[q.id]||[]),PJ.extra[q.id]].filter(Boolean);return a.length?`- ${q.q} ${a.join('; ')}`:''}).filter(Boolean).join('\n');
}
async function generateDraft(e){
  const b=$('#gen');if(b)b.disabled=true;
  try{
    await api('/api/draft/save',{id:e.id,edits:{ans:PJ.ans,extra:PJ.extra,screens:PJ.screens,platform:PLATMAP[PJ.platform],device:PHONEID[PJ.phone]}});
    const r=await api('/api/project',{id:e.id,screens:PJ.screens,answers:answersText(e),platform:PLATMAP[PJ.platform]});
    PJ.wasGen[e.id]=1;PJ.jobs[e.id]={phase:'Starting',total:PJ.screens.length,done:0,log:[]};
    META[Object.keys(META).find(k=>META[k].id===e.id)].status='generating';renderProject(true);ensurePoll();
  }catch(err){const s=$('#hstat');if(s)s.innerHTML=`<span class="bad">${esc(err.message)}</span>`;if(b)b.disabled=false}
}
