// Right drawer: Inspiration (per-project references) and Design system (live-editable tokens).
const DR={open:false,tab:'insp'};
const drawerOpen=()=>DR.open;
function toggleDrawer(tab){
  if(DR.open&&DR.tab===tab)DR.open=false;else{DR.open=true;DR.tab=tab}
  $('#drawer').classList.toggle('show',DR.open);renderTools();if(DR.open)drawerRender();
}
$('#drawer').onmousedown=e=>e.stopPropagation();
function drawerRender(){
  $('#drawer').innerHTML=`<div class="dt"><button class="${DR.tab==='insp'?'on':''}" data-t="insp">Inspiration</button><button class="${DR.tab==='var'?'on':''}" data-t="var">Variants</button><button class="${DR.tab==='ds'?'on':''}" data-t="ds">Design system</button><button class="dx" id="dx" title="Close">×</button></div><div id="dbody"></div>`;
  $('#drawer').querySelectorAll('[data-t]').forEach(b=>b.onclick=()=>{DR.tab=b.dataset.t;renderTools();drawerRender()});
  $('#dx').onclick=()=>toggleDrawer(DR.tab);
  DR.tab==='insp'?drawInsp():DR.tab==='var'?drawVar():drawDS();
}

// ---- Inspiration
const SITES=[['Mobbin','mobbin.com','Real app screens and flows'],['Dribbble','dribbble.com','Visual concepts'],['Behance','behance.net','Full case studies'],['Awwwards','awwwards.com','Award-winning web'],['Land-book','land-book.com','Landing pages'],['Refero','refero.design','Searchable UI library'],['Page Flows','pageflows.com','User flow videos'],['Godly','godly.website','Web design gallery']];
async function drawInsp(){
  let meta={};try{meta=await get('/api/projects')}catch{}
  const refs=meta[slug(proj)]?.refs||[],b=$('#dbody');if(!b)return;
  b.innerHTML=`<p class="s">References for <b>${esc(proj)}</b>. Claude uses them whenever it designs or edits screens in this project.</p>
  <h4>Add a link</h4><input id="ru" placeholder="https://..."><input id="rn" placeholder="What to take from it (optional)"><div><button class="b" id="ra">Save link</button></div>
  <h4>Add an image</h4><p class="s">Pick a screenshot, or paste one here.</p><div><input type="file" id="rf" accept="image/png,image/jpeg,image/webp,image/gif" style="display:none"><button class="b" id="rb">Choose image</button></div>
  <h4>Saved (${refs.length})</h4>${refs.map(r=>`<div class="ref">${r.kind==='image'?`<img src="/${esc(r.file)}">`:''}<div class="t">${r.kind==='url'?`<a href="${esc(r.url)}" target="_blank" rel="noopener noreferrer">${esc(r.url)}</a>`:'Image'}<small>${esc(r.note||'')}</small></div><button data-d="${esc(r.id)}" title="Remove">×</button></div>`).join('')||'<p class="s">Nothing saved yet.</p>'}
  <h4>Design sources (MCP)</h4><div id="mcpbox"><p class="s">Loading…</p></div>`;
  showMcp($('#mcpbox'));
  $('#ra').onclick=()=>saveRef({kind:'url',url:$('#ru').value.trim(),note:$('#rn').value.trim()});
  $('#rb').onclick=()=>$('#rf').click();
  $('#rf').onchange=e=>e.target.files[0]&&sendImg(e.target.files[0]);
  b.querySelectorAll('[data-d]').forEach(x=>x.onclick=()=>api('/api/ref/delete',{project:proj,id:x.dataset.d}).then(drawInsp));
}
const saveRef=b=>api('/api/ref',{project:proj,...b}).then(drawInsp).catch(e=>alert(e.message));
function sendImg(f){if(f.size>6e6)return alert('Image is over 6 MB');const r=new FileReader();r.onload=()=>saveRef({kind:'image',dataUrl:r.result,note:$('#rn')?.value.trim()||''});r.readAsDataURL(f)}
$('#drawer').addEventListener('paste',e=>{if(DR.tab!=='insp')return;const f=[...(e.clipboardData?.files||[])].find(x=>x.type.startsWith('image/'));if(f)sendImg(f)});

// ---- Design system: CSS custom properties of the project's stylesheet, edited in place
const hex6=v=>/^#[0-9a-f]{6}$/i.test(v);
let dsTimer;
async function drawDS(){
  const b=$('#dbody');if(!b)return;
  let d;try{d=await get('/api/ds?project='+encodeURIComponent(proj))}catch(e){b.innerHTML=`<p class="s">${esc(e.message)}. Generate this project from the New screen to get a design system.</p>`;return}
  const by=k=>d.tokens.filter(t=>t.kind===k),font=d.tokens.filter(t=>t.kind==='font'||/font/.test(t.name));
  const row=t=>`<div class="tk"><span class="sw" style="background:${t.kind==='color'?esc(t.value):'transparent'}"></span><code>${esc(t.name)}</code>${t.kind==='color'&&hex6(t.value)?`<input type="color" data-n="${esc(t.name)}" value="${esc(t.value)}">`:''}<input class="tv" data-n="${esc(t.name)}" value="${esc(t.value)}"></div>`;
  const sec=(t,l)=>l.length?`<h4>${t}</h4>${l.map(row).join('')}`:'';
  b.innerHTML=`<p class="s">Tokens in <code>${esc(d.file)}</code>. Edits rewrite the stylesheet, so every screen of <b>${esc(proj)}</b> updates live.</p>
    ${sec('Colors',by('color'))}${sec('Typography',font.filter(t=>t.kind!=='color'))}${sec('Size and shape',by('size').filter(t=>!font.includes(t)))}${sec('Other',by('other').filter(t=>!font.includes(t)))}
    <h4>Components</h4><iframe id="dspv" class="dspv"></iframe>`;
  const pv=()=>{$('#dspv').srcdoc=`<link rel="stylesheet" href="/${d.file}"><style>html,body{height:auto!important;overflow:auto!important}body{padding:16px;background:var(--bg,var(--surface,#fff))}</style>
    <div class="h2" style="font-size:20px;font-weight:700">Heading</div><p class="muted" style="margin:4px 0 12px">Body text in the muted ink colour.</p>
    <div style="display:flex;gap:8px;flex-wrap:wrap;align-items:center;margin-bottom:12px"><span class="btn" style="width:auto;padding:0 18px;height:44px">Primary</span><span class="btn ghost" style="width:auto;padding:0 18px;height:44px">Secondary</span><span class="chip">Chip</span><span class="tag">Tag</span></div>
    <div class="input" style="margin-bottom:12px">Input field</div><div class="card"><div class="item">List item</div><div class="divider" style="margin:8px 0"></div><div class="item muted">Another item</div></div>`};
  pv();
  const save=(name,value)=>{clearTimeout(dsTimer);dsTimer=setTimeout(async()=>{
    try{await api('/api/ds',{project:proj,name,value});
      document.querySelectorAll('.cell iframe').forEach(f=>{try{f.contentWindow.location.reload()}catch{}});pv()}
    catch(e){alert(e.message)}},250)};
  b.querySelectorAll('input[data-n]').forEach(i=>i.addEventListener(i.type==='color'?'input':'change',()=>{
    const n=i.dataset.n,v=i.value.trim();
    b.querySelectorAll(`input[data-n="${n}"]`).forEach(o=>{if(o!==i&&(o.type!=='color'||hex6(v)))o.value=v});
    const sw=i.closest('.tk').querySelector('.sw');if(sw&&sw.style.background!=='transparent')sw.style.background=v;
    save(n,v)}));
}

// ---- Variants: alternative takes on the selected screen; "Use this" replaces it (original kept in history/)
let varTimer=null;
const onSelect=()=>{if(drawerOpen()&&DR.tab==='var')drawVar()};
function vcard(s,D,label,file,n){
  const W=D.w>600?300:148,k=W/D.w;
  return `<div class="vc"><div class="vp" style="width:${W}px;height:${Math.round(D.h*k)}px"><iframe src="/screens/${esc(file)}?t=${Date.now()}" style="width:${D.w}px;height:${D.h}px;transform:scale(${k})" data-vf></iframe></div>
    <div class="vl"><b>${esc(label)}</b>${n!=null?`<span><button class="b" data-use="${n}">Use this</button><button class="b" data-dis="${n}" title="Discard">×</button></span>`:'<small>current</small>'}</div></div>`;
}
async function drawVar(){
  const b=$('#dbody');if(!b)return;
  const s=screens.find(x=>x.id===sel&&x.project===proj);
  if(!s){b.innerHTML='<p class="s">Select a screen on the canvas, then generate alternative takes on it.</p>';return}
  const list=await get('/api/variants?screen='+s.id).catch(()=>[]),D=s.device?DESK[s.device]:dev;
  b.innerHTML=`<p class="s">Alternative takes on <b>${esc(s.name)}</b>. Choosing one replaces the screen; the original is kept in <code>history/</code>.</p>
    <input id="vm" placeholder="Direction (optional): dark mode, playful, more data…"><div><button class="b" id="vg">Generate 3 variants</button></div><div id="vst" class="s"></div>
    <div class="vgrid" style="grid-template-columns:${D.w>600?'1fr':'repeat(auto-fill,minmax(148px,1fr))'}">${vcard(s,D,'Original',s.id+'.html',null)}${list.map(v=>vcard(s,D,v.label,v.file.replace('screens/',''),v.n)).join('')}</div>`;
  b.querySelectorAll('[data-vf]').forEach(f=>f.onload=()=>style(f,s,D));
  $('#vg').onclick=()=>genVar(s);
  b.querySelectorAll('[data-use]').forEach(x=>x.onclick=async()=>{await api('/api/variants/apply',{screen:s.id,n:+x.dataset.use});document.querySelectorAll(`.cell[data-id="${s.id}"] iframe`).forEach(f=>f.src=`screens/${s.id}.html?t=${Date.now()}`);drawVar()});
  b.querySelectorAll('[data-dis]').forEach(x=>x.onclick=async()=>{await api('/api/variants/discard',{screen:s.id,n:+x.dataset.dis});drawVar()});
}
async function genVar(s){
  if(varTimer)return;
  const st=$('#vst');$('#vg').disabled=true;st.textContent='Starting…';
  let job;try{job=(await api('/api/variants',{screen:s.id,count:3,message:$('#vm').value.trim()})).job}catch(e){st.textContent=e.message;$('#vg').disabled=false;return}
  let shown=0;
  varTimer=setInterval(async()=>{
    let j;try{j=await get('/api/job?id='+job)}catch{return}
    const el=$('#vst');if(el)el.textContent=j.status==='error'?'Failed: '+j.error:`${j.phase} ${j.done}/${j.total}`;
    if(sel===s.id&&DR.open&&DR.tab==='var'&&j.done!==shown){shown=j.done;const g=$('.vgrid');if(g){const keep=$('#vm').value;await drawVar();$('#vm').value=keep;$('#vst').textContent=`${j.phase} ${j.done}/${j.total}`}}
    if(j.status!=='running'){clearInterval(varTimer);varTimer=null;if(DR.open&&DR.tab==='var'){await drawVar();if(j.failed?.length)$('#vst').textContent=`${j.failed.length} variant(s) failed: ${j.failed[0].error}`}}
  },2500);
}
