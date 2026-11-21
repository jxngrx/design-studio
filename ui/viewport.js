// Web projects are responsive: switch the preview between laptop, desktop, tablet and mobile widths.
const VPS=[{id:'mobile',name:'Mobile 390'},{id:'tablet',name:'Tablet 820'},{id:'laptop',name:'Laptop 1280'},{id:'desktop',name:'Desktop 1440'}];
const VP=JSON.parse(localStorage.vp||'{}');
const isWeb=()=>{const l=screens.filter(s=>s.project===proj);return l.length>0&&l.every(s=>s.device==='browser')};
function vpFor(s){const v=VP[s.project];return s.device==='browser'&&v&&v!=='laptop'?DESK[v]:null}
function renderDevBar(){
  const bar=$('#dev');
  if(isWeb()){
    bar.style.display='';bar.dataset.mode='vp';
    bar.innerHTML=VPS.map(v=>`<button data-vp="${v.id}" class="${(VP[proj]||'laptop')===v.id?'on':''}">${v.name}</button>`).join('');
  }else if(bar.dataset.mode==='vp'){
    bar.dataset.mode='';bar.innerHTML=DEVICES.map(d=>`<button data-id="${d.id}">${d.name}</button>`).join('');devMark();
    bar.style.display=screens.filter(s=>s.project===proj).every(s=>s.device)?'none':'';
  }
}
$('#dev').addEventListener('click',e=>{const v=e.target.dataset?.vp;if(!v)return;VP[proj]=v;store('vp',JSON.stringify(VP));build();apply()});

// phone frame is remembered per project; a new project starts on the phone chosen in its questions
const DEVP=JSON.parse(localStorage.devp||'{}');
function applyProjectDevice(){const id=DEVP[proj]||metaByName(proj)?.device,d=DEVICES.find(x=>x.id===id);if(d&&d!==dev){dev=d}}
$('#dev').addEventListener('click',e=>{const id=e.target.dataset?.id;if(id&&DEVICES.some(d=>d.id===id)){DEVP[proj]=id;store('devp',JSON.stringify(DEVP))}});
