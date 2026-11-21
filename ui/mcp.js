// MCP connections: the servers Claude Code already knows (claude.ai connectors and ones added here), a catalog of
// good design sources, and a form for custom servers. Used in Settings > Connections and in each project's Inspiration tab.
const MCP={servers:[],catalog:[],loaded:false,msg:''};
async function loadMcp(refresh){
  try{const d=await get('/api/mcp'+(refresh?'?refresh=1':''));MCP.servers=d.servers;MCP.catalog=d.catalog;MCP.loaded=true}catch(e){MCP.msg=e.message}
}
const mcpBadge=s=>`<span class="bdg ${s.status==='connected'?'ok':''}">${esc(s.status)}</span>`;

function mcpPanelHtml(){
  const have=new Set(MCP.servers.map(s=>s.name.toLowerCase()));
  const catalog=MCP.catalog.filter(c=>!have.has(c.id.toLowerCase()));
  return `<div class="mcp">
    <p class="s">Design sources Claude can use while researching. Pick which ones to use for a project in the first chat box.</p>
    <h4>Connected${MCP.servers.length?` (${MCP.servers.length})`:''}</h4>
    ${MCP.servers.map(s=>`<div class="rk"><div><b>${esc(s.name)}</b> ${mcpBadge(s)}<p>${esc(s.source==='claude.ai'?'Claude.ai connector':s.source==='local'?'Added here / Claude Code':'Other')} · ${esc(s.target)}</p>${s.status==='needs sign-in'?'<p>Sign in once: run <code>/mcp</code> inside Claude Code.</p>':''}</div>${s.source==='local'?`<button class="cb" data-mrm="${esc(s.name)}">Remove</button>`:''}</div>`).join('')||'<p class="s">Nothing connected yet.</p>'}
    <h4>Add a design source</h4>
    ${catalog.map(c=>`<div class="rk"><div><b>${esc(c.id)}</b><p>${esc(c.what)}</p><code>${esc(c.transport==='http'?c.url:c.command+' '+c.args.join(' '))}</code> <span class="bdg">${esc(c.auth)}</span></div><button class="cb" data-madd="${esc(c.id)}">Add</button></div>`).join('')||'<p class="s">All catalog sources are connected.</p>'}
    <details class="cust"><summary>Custom MCP server</summary>
      <div class="cf"><input id="mn" placeholder="Name, e.g. my-gallery"><select id="mt" class="cb"><option value="http">HTTP (remote URL)</option><option value="sse">SSE (remote URL)</option><option value="stdio">Command (runs on your machine)</option></select>
      <input id="mu" placeholder="https://example.com/mcp"><input id="mc" placeholder="Command, e.g. npx" style="display:none"><input id="ma" placeholder="Arguments, space separated" style="display:none">
      <textarea id="mh" rows="2" placeholder="Headers, one per line:  Authorization: Bearer ..."></textarea>
      <textarea id="me" rows="2" placeholder="Environment, one per line:  API_KEY=..." style="display:none"></textarea>
      <p class="s warn" id="mw" style="display:none">A command server runs a program on your computer every time it is used. Only add ones you trust.</p>
      <button class="cb" id="mgo">Add server</button></div></details>
    <p class="s" id="mmsg">${esc(MCP.msg)}</p>
    <button class="cb" id="mrf" title="Check the connection status again">↻ Refresh status</button></div>`;
}
function bindMcpPanel(root,after){
  const q=s=>root.querySelector(s),redo=async()=>{await loadMcp(true);after()},say=t=>{MCP.msg=t;const m=q('#mmsg');if(m)m.textContent=t};
  const add=async body=>{say('Adding…');try{const r=await api('/api/mcp/add',body);MCP.msg=r.note||'Added.';await redo()}catch(e){say(e.message)}};
  root.querySelectorAll('[data-madd]').forEach(b=>b.onclick=()=>{
    const c=MCP.catalog.find(x=>x.id===b.dataset.madd);
    if(c.transport==='stdio'&&!confirm(`This runs "${c.command} ${c.args.join(' ')}" on your computer whenever it is used. Add it?`))return;
    add(c.transport==='http'?{name:c.id,transport:'http',url:c.url}:{name:c.id,transport:'stdio',command:c.command,args:c.args});
  });
  root.querySelectorAll('[data-mrm]').forEach(b=>b.onclick=async()=>{if(!confirm(`Remove ${b.dataset.mrm}?`))return;try{await api('/api/mcp/remove',{name:b.dataset.mrm});await redo()}catch(e){say(e.message)}});
  q('#mrf').onclick=redo;
  const type=q('#mt'),sync=()=>{const st=type.value==='stdio';q('#mu').style.display=st?'none':'';q('#mc').style.display=q('#ma').style.display=q('#me').style.display=q('#mw').style.display=st?'':'none'};
  type.onchange=sync;sync();
  q('#mgo').onclick=()=>{
    const lines=t=>t.split('\n').map(x=>x.trim()).filter(Boolean),name=q('#mn').value.trim(),t=type.value;
    add(t==='stdio'?{name,transport:t,command:q('#mc').value.trim(),args:q('#ma').value.trim().split(/\s+/).filter(Boolean),env:lines(q('#me').value)}:{name,transport:t,url:q('#mu').value.trim(),headers:lines(q('#mh').value)});
  };
}

function mountMcp(box){box.innerHTML=mcpPanelHtml();bindMcpPanel(box,()=>mountMcp(box))}
async function showMcp(box){if(!MCP.loaded)await loadMcp();if(box&&box.isConnected)mountMcp(box)}
