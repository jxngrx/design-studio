// Settings view with tabs: General, Generation, Skills, About. Every change saves immediately.
const ST={usage:{calls:0,usd:0,out:0,in:0,cr:0,cw:0},tab:'general',set:null,models:[],modes:[],skills:[],rec:[],q:'',saved:''};
const PLATS=[['mobile','Mobile app'],['web','Web app'],['extension','Chrome extension']];
const STABS=[['general','General'],['gen','Generation'],['conn','Connections'],['skills','Skills'],['about','About']];
async function renderSettings(){
  try{
    const [s,m,k,r,us]=await Promise.all([get('/api/settings'),get('/api/models'),get('/api/skills'),get('/api/recommended'),get('/api/usage')]);ST.usage=us;
    Object.assign(ST,{set:s,models:m.models,modes:m.modes,skills:k,rec:r});
  }catch(e){$('#settings').innerHTML=`<div class="sv"><p class="hs">Could not load settings: ${esc(e.message)}</p></div>`;return}
  drawSettings();
}
async function saveSet(p){
  try{ST.set=await api('/api/settings',p);ST.saved='Saved';Object.assign(H,{model:ST.set.model,mode:ST.set.mode,platform:ST.set.platform,count:ST.set.count,sel:[...ST.set.skills]})}
  catch(e){ST.saved='Error: '+e.message}
  const el=$('#sstat');if(el){el.textContent=ST.saved;setTimeout(()=>{if(el.textContent===ST.saved)el.textContent=''},1800)}
}
const srow=(a,b,c)=>`<div class="sr"><div>${a}<p>${b}</p></div><div>${c}</div></div>`;
const stoggle=(on,k)=>`<span class="tg2${on?' on':''}" data-tg="${k}"></span>`;
function drawSettings(){
  const s=ST.set,pane={
    general:()=>srow('Default platform','Preselected on the New screen',`<select class="cb" data-k="platform">${opts(PLATS,s.platform)}</select>`)+
      srow('Default screen count','How many screens a new project gets (3-16)',`<input class="cb sn" type="number" min="3" max="16" data-k="count" value="${s.count}">`)+
      srow('Default style','Added to every new project unless you override it in Options',`<input class="cb sw2" data-k="style" value="${esc(s.style)}" placeholder="e.g. calm, editorial, soft greens">`),
    gen:()=>srow('Economy mode','Lean calls: cheap model, no hooks or connectors, 3 screens per call, terse markup. Typically 30 to 100 times cheaper than a default Claude Code call. Turn off for the old one-screen-per-call, full-power flow.',stoggle(s.economy,'economy'))+
      srow('Drawing model','Used to draw screens and variants in economy mode',`<select class="cb" data-k="drawModel">${opts(ST.models.filter(m=>m.id),s.drawModel)}</select>`)+
      srow('Planning model','Analysis, planning and the design system. Same as drawing is cheapest; pick a stronger one for better plans.',`<select class="cb" data-k="planModel"><option value="">Same as drawing</option>${opts(ST.models.filter(m=>m.id),s.planModel)}</select>`)+
      srow('Screens per call','Drawing several screens in one call pays the fixed overhead once',`<select class="cb" data-k="batch">${[1,2,3,4,5].map(n=>`<option${n===s.batch?' selected':''}>${n}</option>`).join('')}</select>`)+
      srow('Spent so far',`Measured from Claude's own usage reports: ${ST.usage.calls} calls, ${Math.round((ST.usage.out||0)/1000)}K output tokens`,`<b>${(ST.usage.usd||0).toFixed(2)} USD</b>`)+
      srow('Model','Used for every Claude call the studio makes. Default uses your Claude Code setting.',`<select class="cb" data-k="model">${opts(ST.models,s.model)}</select>`)+
      srow('Mode','Claude design plans and draws. Research and design first studies similar products on the web.',`<select class="cb" data-k="mode">${opts(ST.modes,s.mode)}</select>`)+
      srow('Parallel screens','Screens drawn at the same time (faster, uses more of your limit)',`<select class="cb" data-k="parallel">${[1,2,3,4].map(n=>`<option${n===s.parallel?' selected':''}>${n}</option>`).join('')}</select>`)+
      srow('Timeout per step','Minutes before one Claude call is stopped (2-15)',`<input class="cb sn" type="number" min="2" max="15" data-k="timeoutMin" value="${s.timeoutMin}">`)+
      srow('Web access','Lets Claude search and read pages for research mode and reference links',stoggle(s.web,'web')),
    conn:()=>'<div id="mcpbox"><p class="hs">Loading…</p></div>',
    skills:()=>{const q=ST.q.trim().toLowerCase(),list=ST.skills.filter(k=>!q||k.name.toLowerCase().includes(q)||k.description.toLowerCase().includes(q));
      return `<h4 class="sh">UI design skills</h4>
      ${srow('Auto-add UI skills','Every project automatically uses the skills below that are installed, on top of the ones you pick (max 4 in total).',stoggle(s.autoSkills,'autoSkills'))}
      <div class="rec2">${ST.rec.map(r=>`<div class="rk"><div><b>${esc(r.name)}</b> <span class="bdg ${r.installed?'ok':''}">${r.installed?'Installed':'Not installed'}</span><p>${esc(r.why)}</p><code>${esc(r.install)}</code></div><a href="https://github.com/${esc(r.repo.split(' ')[0])}" target="_blank" rel="noopener noreferrer" class="cb">GitHub</a></div>`).join('')}</div>
      <h4 class="sh">Your skills</h4><div class="sk-h"><input class="cb sw2" id="sq2" placeholder="Search ${ST.skills.length} installed skills" value="${esc(ST.q)}"><button class="cb" id="srf2">↻ Refresh</button></div>
      <p class="hs" style="text-align:left;margin:6px 0 10px">Tick up to 4 skills to preselect on the New screen. They are read from your Claude Code setup (<code>~/.claude/skills</code> and plugins).</p>
      <div id="skl">${list.map(k=>`<label class="pi"><input type="checkbox" data-sk="${esc(k.name)}"${s.skills.includes(k.name)?' checked':''}><div><b>${esc(k.name)}</b><small>${esc(k.description)}</small></div></label>`).join('')||'<p class="hs">No skills match.</p>'}</div>`},
    about:()=>`<div class="sr"><div>Design Studio<p>A local canvas to describe, design and prototype UI with Claude. Everything stays on this machine (listening on 127.0.0.1 only).</p></div></div>
      ${srow('Data files','In the studio folder','<code>screens.json</code> <code>projects.json</code> <code>settings.json</code> <code>proto.json</code> <code>refs/</code>')}
      ${srow('Claude skill','Start it from anywhere in Claude','<code>/design-studio</code>')}`
  };
  $('#settings').innerHTML=`<div class="sv"><h2>Settings <span id="sstat" class="sstat"></span></h2>
    <div class="stabs">${STABS.map(([k,l])=>`<button class="${ST.tab===k?'on':''}" data-st="${k}">${l}</button>`).join('')}</div><div class="spane">${pane[ST.tab]()}</div></div>`;
  $('#settings').querySelectorAll('[data-st]').forEach(b=>b.onclick=()=>{ST.tab=b.dataset.st;drawSettings()});
  $('#settings').querySelectorAll('[data-k]').forEach(i=>i.onchange=()=>saveSet({[i.dataset.k]:i.type==='number'||['parallel','batch'].includes(i.dataset.k)?+i.value:i.value}));
  $('#settings').querySelectorAll('[data-tg]').forEach(t=>t.onclick=async()=>{await saveSet({[t.dataset.tg]:!ST.set[t.dataset.tg]});drawSettings()});
  if(ST.tab==='conn')showMcp($('#mcpbox'));
  const sq=$('#sq2');if(sq){sq.oninput=e=>{ST.q=e.target.value;const pos=e.target.selectionStart;drawSettings();const n=$('#sq2');n.focus();n.setSelectionRange(pos,pos)};
    $('#srf2').onclick=async e=>{e.target.textContent='Scanning…';try{ST.skills=await get('/api/skills?refresh=1')}catch{}drawSettings()}}
  $('#settings').querySelectorAll('[data-sk]').forEach(c=>c.onchange=async()=>{
    let l=[...ST.set.skills];
    if(c.checked){if(l.length>=4){c.checked=false;return}l.push(c.dataset.sk)}else l=l.filter(x=>x!==c.dataset.sk);
    await saveSet({skills:l})});
}
