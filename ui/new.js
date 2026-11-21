// New: describe an idea -> Claude analyzes it -> questions + editable screen list -> generate.
const H={ready:false,set:{},models:[],modes:[],skills:[],sel:[],model:'',mode:'design',text:'',style:'',urls:'',web:true,sites:'',opt:false,pop:false,mcps:[],mpop:false,q:'',busy:false,msg:'',
  step:'compose',A:null,ans:{},extra:{},err:'',plat:'',phase:0};
const IDEAS=['A habit tracker for busy parents','Analytics dashboard for a SaaS startup','Landing page for a specialty coffee brand','Chrome extension that blocks distracting sites'];
const opts=(list,cur)=>list.map(o=>`<option value="${esc(o.id??o[0])}"${(o.id??o[0])===cur?' selected':''}>${esc(o.name??o[1])}</option>`).join('');

async function renderHome(){
  if(!H.ready){
    try{
      const [s,m]=await Promise.all([get('/api/settings'),get('/api/models')]);
      Object.assign(H,{set:s,models:m.models,modes:m.modes,model:s.model,mode:s.mode,style:s.style||'',web:s.web!==false,sel:[...(s.skills||[])],plat:{mobile:'Mobile app',web:'Web app (desktop)',extension:'Chrome extension'}[s.platform],ready:true});
    }catch(e){$('#home').innerHTML=`<div class="hm"><p class="hs">Could not reach the studio server: ${esc(e.message)}</p></div>`;return}
    loadSkills(false);
  }
  drawHome();
}
async function loadSkills(refresh){
  try{H.skills=await get('/api/skills'+(refresh?'?refresh=1':''))}catch{H.skills=[]}
  if(H.pop)drawPop();
}

function drawHome(){drawCompose()}

// ---- step 1: compose
function composer(){
  return `<div class="cmp" id="cmp">
    ${H.sel.length||H.mcps.length?`<div class="cch">${H.sel.map(n=>`<span class="sk">${esc(n)}<button data-rs="${esc(n)}" title="Remove skill">×</button></span>`).join('')}${H.mcps.map(n=>`<span class="sk mk">MCP · ${esc(n)}<button data-rm2="${esc(n)}" title="Remove">×</button></span>`).join('')}</div>`:''}
    <textarea id="hd" rows="3" placeholder="Describe your idea. What is it, who is it for, what should it feel like?">${esc(H.text)}</textarea>
    <div class="crow"><div class="cl">
      <button class="cb${H.mpop?' on':''}" id="hmc" title="Use design sources (MCP) while researching">＋ MCP${H.mcps.length?' · '+H.mcps.length:''}</button>
      <button class="cb${H.pop?' on':''}" id="hsk" title="Add skills from your Claude setup">＋ Skills${H.sel.length?' · '+H.sel.length:''}</button>
      <button class="cb${H.opt?' on':''}" id="ho">Options</button></div>
     <div class="cr"><select class="cb" id="hmo" title="Model">${opts(H.models,H.model)}</select><select class="cb" id="hmd" title="Mode">${opts(H.modes,H.mode)}</select>
      <button class="send" id="hgo" title="Analyze my idea"${H.busy?' disabled':''}>↑</button></div></div>
    ${H.opt?`<div class="opt"><input id="hs" placeholder="Style, e.g. calm, editorial, dark, brutalist" value="${esc(H.style)}"><textarea id="hu" rows="2" placeholder="Reference links, one per line (add images later in the Inspiration panel)">${esc(H.urls)}</textarea>
      <div class="webrow"><div><b>Let Claude browse the web</b><small>${H.mode==='research'?'Research mode searches and reads pages.':'Used in Research and design mode.'} Turn off to research from its own knowledge only.</small></div><span class="tg2${H.web?' on':''}" id="hw"></span></div>
      <textarea id="hsi" rows="2" placeholder="Pages to read first (optional), one URL per line">${esc(H.sites)}</textarea></div>`:''}
    <div class="pop" id="hpop"${H.pop?'':' hidden'}></div><div class="pop" id="hmpop"${H.mpop?'':' hidden'}></div></div>`;
}
function bindComposer(){
  const $h=s=>$('#home').querySelector(s),ta=$h('#hd');
  const grow=()=>{ta.style.height='auto';ta.style.height=Math.min(240,ta.scrollHeight)+'px'};grow();
  ta.oninput=()=>{H.text=ta.value;grow()};
  ta.onkeydown=e=>{if(e.key==='Enter'&&!e.shiftKey&&!e.isComposing){e.preventDefault();analyze()}};
  $h('#hgo').onclick=analyze;
  $h('#hmo').onchange=e=>H.model=e.target.value;
  $h('#hmd').onchange=e=>H.mode=e.target.value;
  $h('#ho').onclick=()=>{H.opt=!H.opt;drawHome()};
  $h('#hmc').onclick=e=>{e.stopPropagation();H.mpop=!H.mpop;if(H.mpop)H.pop=false;drawHome()};
  $h('#hsk').onclick=e=>{H.mpop=false;e.stopPropagation();H.pop=!H.pop;drawHome();if(H.pop)loadSkills(false)};
  if($h('#hs'))$h('#hs').oninput=e=>H.style=e.target.value;
  if($h('#hu'))$h('#hu').oninput=e=>H.urls=e.target.value;
  if($h('#hsi'))$h('#hsi').oninput=e=>H.sites=e.target.value;
  if($h('#hw'))$h('#hw').onclick=()=>{H.web=!H.web;drawHome()};
  $('#home').querySelectorAll('[data-rm2]').forEach(b=>b.onclick=()=>{H.mcps=H.mcps.filter(x=>x!==b.dataset.rm2);drawHome()});
  if(H.mpop)drawMpop();
  $('#home').querySelectorAll('[data-rs]').forEach(b=>b.onclick=()=>{H.sel=H.sel.filter(x=>x!==b.dataset.rs);drawHome()});
  if(H.pop)drawPop();
  return ta;
}
function drawCompose(){
  const projs=[...new Set(screens.map(s=>s.project))];
  $('#home').innerHTML=`<div class="hm">
    <h1>What do you want to <em>design</em>?</h1>
    <p class="hs">Tell me the idea. A project is created right away; I'll ask a few questions and suggest the screens, and you decide what goes in before anything is drawn.</p>
    ${composer()}
    <div class="sugs">${IDEAS.map(t=>`<button class="cb" data-i="${esc(t)}">${esc(t)}</button>`).join('')}</div>
    <div id="hstat" class="hstat">${H.msg}</div>
    <div class="rec"><h3>Projects</h3><div class="rg">${projs.map(p=>{const n=screens.filter(s=>s.project===p).length;return `<button class="rc" data-p="${esc(p)}"><i style="background:hsl(${hue(p)} 38% 42%)">${esc(p[0])}</i><div><b>${esc(p)}</b><small>${n} screens</small></div></button>`}).join('')||'<p class="hs">No projects yet.</p>'}</div></div></div>`;
  const ta=bindComposer();
  $('#home').querySelectorAll('[data-i]').forEach(b=>b.onclick=()=>{H.text=b.dataset.i;drawHome();$('#hd').focus()});
  $('#home').querySelectorAll('[data-p]').forEach(b=>b.onclick=()=>{OPEN.add(b.dataset.p);saveTree();openProjectByName(b.dataset.p)});
  if(H.err)ta.focus();
}

// ---- submit: the project is created on the server right away (named by Claude); questions and progress live on its page
async function analyze(){
  const description=H.text.trim();if(!description||H.busy)return;
  H.busy=true;H.err='';H.msg='';$('#hgo')&&($('#hgo').disabled=true);
  try{
    const r=await api('/api/draft',{description,mode:H.mode,model:H.model,skills:H.sel,mcps:H.mcps,style:H.style.trim(),urls:H.urls.split('\n').map(x=>x.trim()).filter(Boolean),web:H.web,sites:H.sites.split('\n').map(x=>x.trim()).filter(Boolean)});
    H.text='';H.urls='';H.sites='';await loadMeta();openDraft(r.id);
  }catch(e){H.err=e.message;H.msg=`<span class="bad">Could not start: ${esc(e.message)}</span>`}
  H.busy=false;if(view==='new')drawHome();
}

// ---- skills popover (composer)
function drawPop(){
  const pop=$('#hpop');if(!pop)return;
  pop.hidden=false;
  if(!pop.dataset.ready){
    pop.dataset.ready=1;
    pop.innerHTML=`<div class="ph"><input id="sq" placeholder="Search skills" value="${esc(H.q)}"><button class="cb" id="srf" title="Rescan installed skills">↻ Refresh</button></div><div class="pl" id="spl"></div><div class="pf" id="spf"></div>`;
    pop.querySelector('#sq').oninput=e=>{H.q=e.target.value;fillSkills()};
    pop.querySelector('#srf').onclick=async e=>{e.target.textContent='Scanning…';await loadSkills(true);e.target.textContent='↻ Refresh'};
    pop.onclick=e=>e.stopPropagation();
  }
  fillSkills();
}
function fillSkills(){
  const q=H.q.trim().toLowerCase(),list=H.skills.filter(s=>!q||s.name.toLowerCase().includes(q)||s.description.toLowerCase().includes(q));
  $('#spl').innerHTML=list.map(s=>`<label class="pi"><input type="checkbox" data-sk="${esc(s.name)}"${H.sel.includes(s.name)?' checked':''}><div><b>${esc(s.name)}</b><small>${esc(s.description)}</small></div></label>`).join('')||'<p class="hs" style="padding:12px">No skills match.</p>';
  $('#spf').textContent=`${H.sel.length}/4 selected · ${H.skills.length} installed`;
  $('#spl').querySelectorAll('[data-sk]').forEach(c=>c.onchange=()=>{
    const n=c.dataset.sk;
    if(c.checked){if(H.sel.length>=4){c.checked=false;return}H.sel.push(n)}else H.sel=H.sel.filter(x=>x!==n);
    const keepQ=H.q;drawHome();H.q=keepQ;
  });
}
// MCP picker: choose which connected design sources this project may use while researching
async function drawMpop(){
  const pop=$('#hmpop');if(!pop)return;pop.hidden=false;
  if(!MCP.loaded)await loadMcp();
  const list=MCP.servers.filter(s=>s.status==='connected'||s.status==='needs sign-in');
  pop.innerHTML=`<div class="pl">${list.map(s=>`<label class="pi"><input type="checkbox" data-mk="${esc(s.name)}"${H.mcps.includes(s.name)?' checked':''}><div><b>${esc(s.name)}</b><small>${esc(s.source==='claude.ai'?'Claude.ai connector (slower: loads all its tools)':s.target)}</small></div></label>`).join('')||'<p class="hs" style="padding:12px">No design sources connected yet.</p>'}</div>
    <div class="pf">${H.mcps.length}/4 selected · using any makes the project research first · <button class="lnk" id="mgo2">Add or manage connections</button></div>`;
  pop.onclick=e=>e.stopPropagation();
  pop.querySelectorAll('[data-mk]').forEach(c=>c.onchange=()=>{const n=c.dataset.mk;if(c.checked){if(H.mcps.length>=4){c.checked=false;return}H.mcps.push(n)}else H.mcps=H.mcps.filter(x=>x!==n);drawHome()});
  $('#mgo2').onclick=()=>{ST.tab='conn';setView('settings')};
}
function closePop(){H.mpop=false;if(H.pop){H.pop=false;const p=$('#hpop');if(p)p.hidden=true;const b=$('#hsk');b&&b.classList.remove('on')}}
document.addEventListener('click',e=>{if(H.mpop&&!e.target.closest('#hmpop')&&e.target.id!=='hmc'){H.mpop=false;const p=$('#hmpop');if(p)p.hidden=true}if(H.pop&&!e.target.closest('#hpop')&&e.target.id!=='hsk')closePop()});

// opened from Claude chat: http://localhost:4400/?idea=...  -> prefill and start the analysis
async function ideaFromUrl(){
  const idea=new URLSearchParams(location.search).get('idea');if(!idea)return;
  history.replaceState(null,'',location.pathname);
  setView('new');await renderHome();H.text=idea.slice(0,4000);analyze();
}
