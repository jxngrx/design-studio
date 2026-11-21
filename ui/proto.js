// Prototype mode: draw hotspots on screens, link them to other screens, play the flow.
// Hotspots are fractions of the device screen {x,y,w,h,to}. Elements with data-to="<screen id>" are linked automatically.
let pmode='design',proto={start:null,hot:{}},PK=null;
const projScreens=()=>screens.filter(s=>s.project===proj);
const nameOf=id=>screens.find(s=>s.id===id)?.name||id;
async function protoLoad(){try{proto=await get('/api/proto?project='+encodeURIComponent(proj))}catch{proto={start:null,hot:{}}}}
const protoSave=()=>api('/api/proto',{project:proj,data:proto}).then(r=>{proto=r}).catch(e=>alert(e.message));

async function setPMode(m){
  pmode=m;document.body.classList.toggle('proto',m==='proto');closePicker();
  if(m==='proto')await protoLoad();
  renderTools();build();apply();
}
function setStart(){
  if(!sel||!projScreens().some(s=>s.id===sel))return alert('Select a screen first, then set it as the start.');
  proto.start=sel;protoSave().then(()=>build());
}

// called by index.html frame() for every screen; adds the hotspot layer when in prototype mode
function protoDecorate(el,s,D){
  if(pmode!=='proto')return;
  const sc=el.querySelector('.scr'),hit=el.querySelector('.hit'),f=el.querySelector('iframe');
  if(proto.start===s.id)el.querySelector('p').textContent='⚑ '+s.name+' (start)';
  const hl=document.createElement('div');hl.className='hl';sc.appendChild(hl);
  const place=(b,h)=>{b.style.cssText=`left:${h.x*100}%;top:${h.y*100}%;width:${h.w*100}%;height:${h.h*100}%`};
  (proto.hot[s.id]||[]).forEach((h,i)=>{
    const b=document.createElement('div');b.className='hsp';place(b,h);b.innerHTML=`<span>→ ${esc(nameOf(h.to))}</span>`;
    b.onmousedown=e=>e.stopPropagation();
    b.onclick=e=>{e.stopPropagation();openPicker(s.id,h,e.clientX,e.clientY,i)};
    hl.appendChild(b);
  });
  f.addEventListener('load',()=>{ // data-to elements found inside the screen
    try{const d=f.contentDocument,W=f.clientWidth,Hh=f.clientHeight;
      d.querySelectorAll('[data-to]').forEach(n=>{const r=n.getBoundingClientRect();if(!r.width||!r.height)return;
        const b=document.createElement('div');b.className='hsp auto';place(b,{x:r.left/W,y:r.top/Hh,w:r.width/W,h:r.height/Hh});b.innerHTML=`<span>↗ ${esc(nameOf(n.dataset.to))}</span>`;hl.appendChild(b)})}catch{}
  });
  hit.onclick=e=>e.stopPropagation();
  hit.onmousedown=e=>{
    e.stopPropagation();closePicker();
    const r=sc.getBoundingClientRect(),x0=(e.clientX-r.left)/r.width,y0=(e.clientY-r.top)/r.height,tmp=document.createElement('div');tmp.className='hsp tmp';hl.appendChild(tmp);
    const box=ev=>{const x1=Math.min(1,Math.max(0,(ev.clientX-r.left)/r.width)),y1=Math.min(1,Math.max(0,(ev.clientY-r.top)/r.height));return {x:Math.min(x0,x1),y:Math.min(y0,y1),w:Math.abs(x1-x0),h:Math.abs(y1-y0)}};
    const mv=ev=>place(tmp,box(ev));
    const up=ev=>{removeEventListener('mousemove',mv);removeEventListener('mouseup',up);tmp.remove();const b=box(ev);
      if(b.w<0.02||b.h<0.02){select(s.id);return}  // a click, not a drag
      openPicker(s.id,b,ev.clientX,ev.clientY,null)};
    addEventListener('mousemove',mv);addEventListener('mouseup',up);
  };
}

// small popover to choose (or change / delete) a hotspot's target
function openPicker(id,box,cx,cy,idx){
  closePicker();
  const others=projScreens().filter(x=>x.id!==id),cur=idx!=null?proto.hot[id][idx].to:'';
  PK=document.createElement('div');PK.id='pk';PK.style.left=Math.min(cx,innerWidth-250)+'px';PK.style.top=Math.min(cy,innerHeight-170)+'px';
  PK.innerHTML=`<label>Links to</label><select><option value="">Choose a screen…</option>${others.map(o=>`<option value="${esc(o.id)}"${o.id===cur?' selected':''}>${esc(o.name)}</option>`).join('')}</select>
    <div class="pb2">${idx!=null?'<button data-x>Delete</button>':''}<button data-c>Cancel</button></div>`;
  PK.onmousedown=e=>e.stopPropagation();PK.onclick=e=>e.stopPropagation();
  PK.querySelector('select').onchange=async e=>{
    if(!e.target.value)return;
    const list=(proto.hot[id]??=[]);
    if(idx!=null)list[idx].to=e.target.value;else list.push({x:box.x,y:box.y,w:box.w,h:box.h,to:e.target.value});
    closePicker();await protoSave();build();apply()};
  PK.querySelector('[data-c]').onclick=closePicker;
  const del=PK.querySelector('[data-x]');if(del)del.onclick=async()=>{proto.hot[id].splice(idx,1);closePicker();await protoSave();build();apply()};
  document.body.appendChild(PK);PK.querySelector('select').focus();
}
function closePicker(){PK?.remove();PK=null}
document.addEventListener('mousedown',e=>{if(PK&&!e.target.closest('#pk'))closePicker()});

// ---- player: the screen is live. Clicking real buttons, links, tabs and cards navigates by, in order:
// 1) data-to="<screen id>"  2) a drawn hotspot under the click  3) the clicked element's text matching a screen name.
let PL=null;
function playProto(){
  const list=projScreens();if(!list.length)return;
  const start=list.find(s=>s.id===proto.start)||list.find(s=>s.id===sel)||list[0];
  PL={stack:[start.id]};
  const p=$('#player');p.classList.add('show');
  p.innerHTML=`<div class="pbar"><button id="pbk">← Back</button><button id="prs">Restart</button><span id="ppt"></span><span id="pmsg"></span><button id="pcl">Close (Esc)</button></div><div id="pstage"></div><div class="phint">Click buttons, tabs and cards as you would in the real app. Click anything that is not linked to see where you can go.</div>`;
  $('#pbk').onclick=()=>{if(PL.stack.length>1){PL.stack.pop();showScreen()}};
  $('#prs').onclick=()=>{PL.stack=[start.id];showScreen()};
  $('#pcl').onclick=closePlayer;
  showScreen();
}
function closePlayer(){if(PL){PL=null;$('#player').classList.remove('show');$('#player').innerHTML=''}}
function showScreen(){
  const id=PL.stack[PL.stack.length-1],s=screens.find(x=>x.id===id);if(!s)return;
  $('#ppt').textContent=PL.stack.map(nameOf).join('  ›  ');
  const pm=pmode;pmode='design';const cell=frame(s);pmode=pm;cell.querySelector('p').remove();cell.querySelector('.hit').remove(); // no overlay: the screen itself receives clicks
  const dv=cell.querySelector('.dev'),W=parseFloat(dv.style.width),Hh=parseFloat(dv.style.height),k=Math.min((innerWidth-60)/W,(innerHeight-130)/Hh,1.25);
  const wrap=document.createElement('div');wrap.className='pwrap';wrap.style.cssText=`width:${W*k}px;height:${Hh*k}px`;cell.style.cssText=`transform:scale(${k});transform-origin:0 0;width:${W}px`;
  wrap.appendChild(cell);$('#pstage').replaceChildren(wrap);
  const f=cell.querySelector('iframe');f.addEventListener('load',()=>wirePlayer(f,id));
}
const norm=t=>String(t||'').toLowerCase().replace(/[^a-z0-9 ]+/g,' ').replace(/\s+/g,' ').trim();
const clickable=el=>el.matches?.('a,button,[role=button],[role=tab],[data-to],.btn,.tab,.chip,.item,.card,.tile,nav *,.tabs *,li,summary')||getComputedStyle(el).cursor==='pointer';
function matchName(label,from){ // best screen whose name matches this label
  const l=norm(label);if(l.length<3||l.length>40)return null;let best=null,sc=0;
  for(const s of projScreens()){if(s.id===from)continue;const n=norm(s.name);let v=0;
    if(n===l)v=3;else if(n.length>=4&&(l.includes(n)||(l.length>=4&&n.includes(l))))v=2;
    if(v>sc){sc=v;best=s.id}}
  return best;
}
function targetFor(d,e,id,W,H2){
  let el=e.target.nodeType===1?e.target:e.target.parentElement;
  const dt=el.closest('[data-to]');if(dt&&screens.some(x=>x.id===dt.dataset.to))return dt.dataset.to;
  const fx=e.clientX/W,fy=e.clientY/H2,hit=(proto.hot[id]||[]).find(h=>fx>=h.x&&fx<=h.x+h.w&&fy>=h.y&&fy<=h.y+h.h);if(hit)return hit.to;
  for(let i=0;el&&el!==d.body&&i<6;i++,el=el.parentElement){
    const t=matchName(el.getAttribute('aria-label')||el.getAttribute('title')||el.innerText,id);if(t&&(clickable(el)||i>0))return t;
  }
  return null;
}
function wirePlayer(f,id){
  let d;try{d=f.contentDocument}catch{return}if(!d)return;
  const W=f.clientWidth,H2=f.clientHeight,st=d.createElement('style');
  st.textContent='a,button,[data-to],.btn,[role=button],[role=tab],.tab,.chip{cursor:pointer!important}.sp-hint{outline:2px solid #4c8dff!important;outline-offset:2px;border-radius:6px}';d.head.appendChild(st);
  d.addEventListener('click',e=>{
    const t=targetFor(d,e,id,W,H2);
    if(t){e.preventDefault();e.stopPropagation();PL.stack.push(t);showScreen();return}
    if(e.target.closest?.('a[href]'))e.preventDefault(); // never leave the prototype
    const hints=[...d.querySelectorAll('a,button,[role=button],[role=tab],[data-to],.btn,.tab,nav *,.tabs *')].filter(x=>x.dataset?.to||matchName(x.getAttribute('aria-label')||x.innerText,id));
    hints.forEach(x=>x.classList.add('sp-hint'));setTimeout(()=>hints.forEach(x=>x.classList.remove('sp-hint')),900);
    const m=$('#pmsg');if(m){m.textContent=hints.length?'Not linked. Linked items are outlined.':'Nothing here links to another screen.';setTimeout(()=>{if(m)m.textContent=''},1800)}
  },true);
}
