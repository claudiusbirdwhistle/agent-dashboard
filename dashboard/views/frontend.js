'use strict';

const FRONTEND_HTML = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>Agent Dashboard</title>
<style>
  :root {
    --bg: #0d1117; --surface: #161b22; --border: #30363d;
    --text: #e6edf3; --dim: #8b949e; --accent: #58a6ff;
    --green: #3fb950; --red: #f85149; --yellow: #d29922;
    --font: -apple-system, BlinkMacSystemFont, 'Segoe UI', Helvetica, Arial, sans-serif;
    --mono: 'SF Mono', 'Fira Code', 'Cascadia Code', monospace;
  }
  * { margin: 0; padding: 0; box-sizing: border-box; }
  body { background: var(--bg); color: var(--text); font-family: var(--font); font-size: 14px; }
  .app { display: grid; grid-template-columns: 280px 1fr; grid-template-rows: auto 1fr; height: 100vh; }

  /* Header */
  header { grid-column: 1/-1; padding: 12px 20px; border-bottom: 1px solid var(--border);
           display: flex; align-items: center; justify-content: space-between; background: var(--surface); }
  .logo { font-size: 15px; font-weight: 600; }
  .logo span { color: var(--dim); font-weight: 400; }
  .header-right { display: flex; align-items: center; gap: 16px; }
  .stats { display: flex; gap: 14px; font-size: 12px; color: var(--dim); }
  .badge { padding: 3px 10px; border-radius: 10px; font-size: 11px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.3px; }
  .badge.running { background: rgba(63,185,80,0.15); color: var(--green); }
  .badge.sleeping { background: rgba(210,153,34,0.15); color: var(--yellow); }
  .badge.idle { background: rgba(139,148,158,0.15); color: var(--dim); }
  .badge.disabled { background: rgba(248,81,73,0.15); color: var(--red); }
  .toggle { padding: 5px 14px; border-radius: 6px; border: 1px solid var(--border); background: var(--surface);
            color: var(--text); cursor: pointer; font-family: var(--font); font-size: 12px; transition: 0.15s; }
  .toggle:hover { border-color: var(--accent); }
  .toggle.on { border-color: var(--red); color: var(--red); }
  .toggle.off { border-color: var(--green); color: var(--green); }
  .disk { font-size: 11px; color: var(--dim); }
  .disk.warn { color: var(--yellow); }

  /* Sidebar */
  .sidebar { border-right: 1px solid var(--border); overflow-y: auto; background: var(--surface); display: flex; flex-direction: column; }
  .tabs { display: flex; border-bottom: 1px solid var(--border); flex-wrap: wrap; }
  .tab { flex: 1; padding: 8px; font-size: 11px; text-align: center; color: var(--dim); cursor: pointer;
         background: none; border: none; border-bottom: 2px solid transparent; font-family: var(--font); min-width: 60px; }
  .tab:hover { color: var(--text); }
  .tab.on { color: var(--accent); border-bottom-color: var(--accent); }
  .panel { display: none; flex: 1; overflow-y: auto; padding: 4px 0; }
  .panel.on { display: block; }

  .item { padding: 5px 12px; cursor: pointer; display: flex; align-items: center; gap: 6px;
          font-size: 13px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; color: var(--text); }
  .item:hover { background: rgba(88,166,255,0.08); }
  .item.active { background: rgba(88,166,255,0.12); color: var(--accent); }
  .item .ico { flex-shrink: 0; width: 16px; text-align: center; font-size: 11px; }
  .dir { color: var(--dim); }
  .children { padding-left: 16px; }

  /* Main */
  .main { overflow-y: auto; padding: 24px; }
  .viewer-hd { margin-bottom: 16px; padding-bottom: 12px; border-bottom: 1px solid var(--border); }
  .viewer-hd h2 { font-size: 18px; }
  .viewer-hd .meta { font-size: 12px; color: var(--dim); margin-top: 4px; }

  .md { line-height: 1.7; }
  .md h1,.md h2,.md h3 { margin: 1.2em 0 0.6em; }
  .md h1 { font-size: 1.4em; border-bottom: 1px solid var(--border); padding-bottom: 0.3em; }
  .md h2 { font-size: 1.2em; }
  .md p { margin: 0.5em 0; }
  .md ul,.md ol { padding-left: 2em; margin: 0.5em 0; }
  .md code { background: var(--bg); padding: 2px 5px; border-radius: 3px; font-family: var(--mono); font-size: 0.9em; }
  .md pre { background: var(--bg); padding: 14px; border-radius: 6px; overflow-x: auto; margin: 0.8em 0; }
  .md pre code { background: none; padding: 0; }
  .md blockquote { border-left: 3px solid var(--accent); padding-left: 14px; color: var(--dim); margin: 0.8em 0; }
  .md a { color: var(--accent); }
  .md table { border-collapse: collapse; margin: 0.8em 0; }
  .md th,.md td { border: 1px solid var(--border); padding: 6px 12px; text-align: left; }
  .md th { background: var(--surface); }

  .raw { background: var(--bg); padding: 14px; border-radius: 6px; white-space: pre-wrap;
         font-family: var(--mono); font-size: 13px; line-height: 1.5; border: 1px solid var(--border); overflow-x: auto; }

  .welcome { display: flex; align-items: center; justify-content: center; height: 100%;
             color: var(--dim); font-size: 14px; text-align: center; line-height: 2; }

  /* Stream-JSON event timeline */
  .ev-list { display: flex; flex-direction: column; gap: 6px; }
  .ev { border: 1px solid var(--border); border-radius: 6px; overflow: hidden; }
  .ev-hd { display: flex; align-items: center; gap: 8px; padding: 8px 12px; cursor: pointer;
           font-size: 13px; user-select: none; }
  .ev-hd:hover { filter: brightness(1.15); }
  .ev-tag { font-size: 10px; font-weight: 700; padding: 2px 7px; border-radius: 4px; text-transform: uppercase;
            letter-spacing: 0.3px; flex-shrink: 0; }
  .ev-sum { flex: 1; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; color: var(--text); font-family: var(--mono); font-size: 12px; }
  .ev-chev { color: var(--dim); font-size: 11px; flex-shrink: 0; transition: transform 0.15s; }
  .ev.open .ev-chev { transform: rotate(90deg); }
  .ev-body { display: none; padding: 10px 12px; border-top: 1px solid var(--border); background: var(--bg);
             font-family: var(--mono); font-size: 12px; white-space: pre-wrap; word-break: break-all; max-height: 400px; overflow-y: auto; }
  .ev.open .ev-body { display: block; }
  .ev-body .ev-kv { display: grid; grid-template-columns: auto 1fr; gap: 4px 12px; }
  .ev-body .ev-kv-key { color: var(--accent); font-weight: 600; white-space: nowrap; }
  .ev-body .ev-kv-val { color: var(--text); }
  .ev-body .ev-section { margin-bottom: 8px; }
  .ev-body .ev-section-label { color: var(--dim); font-size: 10px; text-transform: uppercase; letter-spacing: 0.5px; margin-bottom: 4px; }
  .ev-body .ev-text-content { color: var(--text); line-height: 1.6; }
  .ev-body .ev-code-block { background: rgba(0,0,0,0.3); border: 1px solid var(--border); border-radius: 4px; padding: 8px 10px; margin: 4px 0; overflow-x: auto; }
  .ev-body .ev-stats { display: flex; gap: 16px; flex-wrap: wrap; }
  .ev-body .ev-stat { display: flex; flex-direction: column; align-items: center; }
  .ev-body .ev-stat-val { font-size: 16px; font-weight: 700; color: var(--text); }
  .ev-body .ev-stat-label { font-size: 10px; color: var(--dim); text-transform: uppercase; }
  .ev-hd.ev-system { background: rgba(88,166,255,0.08); }
  .ev-tag.ev-system { background: rgba(88,166,255,0.15); color: var(--accent); }
  .ev-hd.ev-text { background: rgba(63,185,80,0.06); }
  .ev-tag.ev-text { background: rgba(63,185,80,0.15); color: var(--green); }
  .ev-hd.ev-tool-use { background: rgba(210,153,34,0.06); }
  .ev-tag.ev-tool-use { background: rgba(210,153,34,0.15); color: var(--yellow); }
  .ev-hd.ev-tool-result { background: rgba(210,153,34,0.04); }
  .ev-tag.ev-tool-result { background: rgba(210,153,34,0.10); color: var(--yellow); }
  .ev-hd.ev-result { background: rgba(139,148,158,0.06); }
  .ev-tag.ev-result { background: rgba(139,148,158,0.15); color: var(--dim); }
  .ev-hd.ev-error { background: rgba(248,81,73,0.06); }
  .ev-tag.ev-error { background: rgba(248,81,73,0.15); color: var(--red); }
</style>
</head>
<body>
<div class="app">
  <header>
    <div class="logo">Agent <span>Dashboard</span></div>
    <div class="header-right">
      <a href="/solar-cycles" id="solar-link" style="font-size:12px;color:var(--accent);text-decoration:none;padding:4px 10px;border:1px solid var(--border);border-radius:6px;">Solar Cycles</a>
      <a href="/sea-level" id="sea-level-link" style="font-size:12px;color:var(--accent);text-decoration:none;padding:4px 10px;border:1px solid var(--border);border-radius:6px;">Sea Level</a>
      <a href="/covid-attention" id="covid-link" style="font-size:12px;color:var(--accent);text-decoration:none;padding:4px 10px;border:1px solid var(--border);border-radius:6px;">COVID Attention</a>
      <a href="/climate" id="climate-link" style="font-size:12px;color:var(--accent);text-decoration:none;padding:4px 10px;border:1px solid var(--border);border-radius:6px;">Climate Trends</a>
      <a href="/attention-gap" id="gap-link" style="font-size:12px;color:var(--accent);text-decoration:none;padding:4px 10px;border:1px solid var(--border);border-radius:6px;">Attention Gap</a>
      <a href="/trends" id="trends-link" style="font-size:12px;color:var(--accent);text-decoration:none;padding:4px 10px;border:1px solid var(--border);border-radius:6px;">Science Trends</a>
      <a href="/exoplanet-census" id="exoplanet-link" style="font-size:12px;color:var(--accent);text-decoration:none;padding:4px 10px;border:1px solid var(--border);border-radius:6px;">Exoplanet Census</a>
      <a href="/ocean-warming" id="ocean-link" style="font-size:12px;color:var(--accent);text-decoration:none;padding:4px 10px;border:1px solid var(--border);border-radius:6px;">Ocean Warming</a>
      <a href="/uk-grid-decarb" id="grid-link" style="font-size:12px;color:var(--accent);text-decoration:none;padding:4px 10px;border:1px solid var(--border);border-radius:6px;">UK Grid</a>
      <a href="/us-debt-dynamics" id="debt-link" style="font-size:12px;color:var(--accent);text-decoration:none;padding:4px 10px;border:1px solid var(--border);border-radius:6px;">US Debt</a>
      <a href="/solar-seismic" id="seismic-link" style="font-size:12px;color:var(--accent);text-decoration:none;padding:4px 10px;border:1px solid var(--border);border-radius:6px;">Solar-Seismic</a>
      <a href="/river-flow" id="river-link" style="font-size:12px;color:var(--accent);text-decoration:none;padding:4px 10px;border:1px solid var(--border);border-radius:6px;">River Flow</a>
      <a href="/currency-contagion" id="currency-link" style="font-size:12px;color:var(--accent);text-decoration:none;padding:4px 10px;border:1px solid var(--border);border-radius:6px;">FX Contagion</a>
      <a href="/gbif-biodiversity" id="biodiversity-link" style="font-size:12px;color:var(--accent);text-decoration:none;padding:4px 10px;border:1px solid var(--border);border-radius:6px;">Biodiversity</a>
      <div class="stats" id="stats"></div>
      <span class="disk" id="disk"></span>
      <span class="badge" id="badge">&mdash;</span>
      <button class="toggle" id="tog" onclick="tog()">&mdash;</button>
    </div>
  </header>
  <div class="sidebar">
    <div class="tabs">
      <button class="tab on" data-t="docs">Docs</button>
      <button class="tab" data-t="summary">Summary</button>
      <button class="tab" data-t="journal">Journal</button>
      <button class="tab" data-t="state">State</button>
      <button class="tab" data-t="logs">Logs</button>
      <button class="tab" data-t="live"><span class="live-dot" id="live-ind"></span>Live</button>
    </div>
    <div class="panel on" id="p-docs"></div>
    <div class="panel" id="p-summary">
      <div style="padding:12px;font-size:12px;color:var(--dim)">Plain-English digest of agent activity, updated after each invocation.</div>
      <div class="item" onclick="loadSummary()"><span class="ico">&#128221;</span>Latest Summary</div>
      <div style="padding:8px 12px 4px;font-size:11px;color:var(--dim);text-transform:uppercase;letter-spacing:0.3px;">Archive</div>
      <div id="summary-archive"></div>
    </div>
    <div class="panel" id="p-journal"><div class="item" onclick="viewJournal()"><span class="ico">&#128214;</span>journal.md</div></div>
    <div class="panel" id="p-state"></div>
    <div class="panel" id="p-logs"></div>
    <div class="panel" id="p-live"><div style="padding:12px;font-size:12px;color:var(--dim)">Output refreshes every 2s while this tab is active.</div></div>
  </div>
  <div class="main" id="main"><div class="welcome">Select a file from the sidebar to view it.<br>Enable the agent with the button above to begin.</div></div>
</div>
<script>
const TK='__TOKEN__';
let S={};
function ap(url){const u=new URL(url,location.origin);if(TK)u.searchParams.set('token',TK);return u.toString();}
document.getElementById('solar-link').href=ap('/solar-cycles');
document.getElementById('sea-level-link').href=ap('/sea-level');
document.getElementById('trends-link').href=ap('/trends');
document.getElementById('gap-link').href=ap('/attention-gap');
document.getElementById('climate-link').href=ap('/climate');
document.getElementById('covid-link').href=ap('/covid-attention');
document.getElementById('exoplanet-link').href=ap('/exoplanet-census');
document.getElementById('ocean-link').href=ap('/ocean-warming');
document.getElementById('grid-link').href=ap('/uk-grid-decarb');
document.getElementById('debt-link').href=ap('/us-debt-dynamics');
document.getElementById('seismic-link').href=ap('/solar-seismic');
document.getElementById('river-link').href=ap('/river-flow');
document.getElementById('biodiversity-link').href=ap('/gbif-biodiversity');

// Tabs
document.querySelectorAll('.tab').forEach(t=>t.onclick=()=>{
  document.querySelectorAll('.tab').forEach(x=>x.classList.remove('on'));
  document.querySelectorAll('.panel').forEach(x=>x.classList.remove('on'));
  t.classList.add('on');
  document.getElementById('p-'+t.dataset.t).classList.add('on');
});

// Status
async function poll(){
  try{ S=await(await fetch(ap('/api/status'))).json(); }catch(e){return}
  const b=document.getElementById('badge'), g=document.getElementById('tog'), s=document.getElementById('stats'), dk=document.getElementById('disk');
  if(!S.enabled){ b.textContent='disabled'; b.className='badge disabled'; g.textContent='Enable'; g.className='toggle off'; }
  else{ b.textContent=S.processStatus; b.className='badge '+S.processStatus; g.textContent='Disable'; g.className='toggle on'; }
  let h='';
  if(S.phase) h+='<span>'+esc(S.phase)+'</span>';
  h+='<span>'+S.totalInvocations+' runs</span>';
  if(S.activeTasks) h+='<span>'+S.activeTasks+' tasks</span>';
  if(S.stallCount) h+='<span style="color:var(--yellow)">'+S.stallCount+' stalls</span>';
  s.innerHTML=h;
  if(S.diskUsage){
    const pct=parseInt(S.diskUsage.percent)||0;
    dk.textContent='Disk: '+S.diskUsage.percent+' ('+S.diskUsage.available+' free)';
    dk.className=pct>=85?'disk warn':'disk';
  }
}
async function tog(){ await fetch(ap('/api/toggle'),{method:'POST'}); poll(); }

// Trees
async function loadDocs(){ const r=await(await fetch(ap('/api/documents'))).json(); document.getElementById('p-docs').innerHTML=tree(r); }
async function loadState(){ const r=await(await fetch(ap('/api/state'))).json(); document.getElementById('p-state').innerHTML=tree(r); }
async function loadLogs(){
  const r=await(await fetch(ap('/api/logs'))).json();
  document.getElementById('p-logs').innerHTML=r.map(l=>{
    const ts=l.name.replace('invocation_','').replace('.log','');
    return '<div class="item" onclick="viewLog(\\''+esc(l.name)+'\\')">'+
      '<span class="ico">&#128203;</span>'+esc(ts)+'</div>';
  }).join('');
  document.getElementById('p-logs')._logs=r;
}
function tree(items,d=0){
  return items.map(i=>{
    if(i.type==='directory') return '<div class="item dir" style="padding-left:'+(12+d*14)+'px"><span class="ico">&#128193;</span>'+esc(i.name)+'</div><div class="children">'+tree(i.children||[],d+1)+'</div>';
    const ic={'.md':'&#128221;','.json':'&#128202;','.py':'&#128013;','.js':'&#128220;','.sh':'&#9881;','.txt':'&#128196;','.csv':'&#128200;','.html':'&#127760;','.log':'&#128203;'}[i.ext]||'&#128196;';
    return '<div class="item" data-p="'+esc(i.path)+'" onclick="view(\\''+esc(i.path)+'\\')" style="padding-left:'+(12+d*14)+'px"><span class="ico">'+ic+'</span>'+esc(i.name)+'</div>';
  }).join('');
}

// Viewer
async function view(p){
  document.querySelectorAll('.item').forEach(e=>e.classList.remove('active'));
  document.querySelectorAll('[data-p="'+CSS.escape(p)+'"]').forEach(e=>e.classList.add('active'));
  const d=await(await fetch(ap('/api/file?path='+encodeURIComponent(p)))).json();
  if(d.type==='directory') return;
  const sz=d.size<1024?d.size+' B':(d.size/1024).toFixed(1)+' KB';
  const dt=new Date(d.modified).toLocaleString();
  const c=d.html?'<div class="md">'+d.html+'</div>':'<pre class="raw">'+esc(d.content)+'</pre>';
  document.getElementById('main').innerHTML='<div class="viewer-hd"><h2>'+esc(d.name)+'</h2><div class="meta">'+esc(d.path)+' &middot; '+sz+' &middot; '+dt+'</div></div>'+c;
}
async function viewJournal(){
  document.querySelectorAll('.item').forEach(e=>e.classList.remove('active'));
  const d=await(await fetch(ap('/api/journal'))).json();
  if(!d.content){document.getElementById('main').innerHTML='<div class="welcome">No journal entries yet.</div>';return;}
  document.getElementById('main').innerHTML='<div class="viewer-hd"><h2>journal.md</h2><div class="meta">/state/journal.md</div></div><div class="md">'+d.html+'</div>';
}
function viewLog(name){
  const logs=document.getElementById('p-logs')._logs;
  const l=logs?.find(x=>x.name===name);
  if(!l) return;
  document.querySelectorAll('.item').forEach(e=>e.classList.remove('active'));
  let body;
  if(l.format==='stream-json'){
    const parsed=parseStreamJsonLogClient(l.content);
    body=parsed.events?renderStreamJsonEvents(parsed.events):'<pre class="raw">'+esc(l.content)+'</pre>';
  } else {
    body='<pre class="raw">'+esc(l.content)+'</pre>';
  }
  document.getElementById('main').innerHTML='<div class="viewer-hd"><h2>'+esc(name)+'</h2></div>'+body;
}

function esc(s){const d=document.createElement('div');d.textContent=s||'';return d.innerHTML;}

function truncStr(s,n){return s&&s.length>n?s.slice(0,n)+'...':s||'';}

// Helper: extract the content array from an event, handling both
// ev.content and ev.message.content wrapper structures
function evContent(ev){
  if(ev.message&&ev.message.content) return ev.message.content;
  if(ev.content) return ev.content;
  return null;
}

function renderKvInput(input){
  if(!input)return '';
  if(typeof input==='string')return '<div class="ev-code-block">'+esc(input)+'</div>';
  let h='<div class="ev-kv">';
  for(const[k,v] of Object.entries(input)){
    const valStr=typeof v==='string'?v:JSON.stringify(v,null,2);
    const isLong=valStr.length>120;
    h+='<span class="ev-kv-key">'+esc(k)+'</span><span class="ev-kv-val">'
      +(isLong?'<div class="ev-code-block">'+esc(valStr)+'</div>':esc(valStr))+'</span>';
  }
  h+='</div>';
  return h;
}

function renderEventBody(ev){
  // system init
  if(ev.type==='system'&&ev.subtype==='init'){
    let h='<div class="ev-kv">';
    const m=ev.message||ev;
    if(m.model||ev.model)h+='<span class="ev-kv-key">Model</span><span class="ev-kv-val">'+esc(m.model||ev.model)+'</span>';
    if(ev.session_id)h+='<span class="ev-kv-key">Session</span><span class="ev-kv-val">'+esc(ev.session_id)+'</span>';
    if(ev.tools)h+='<span class="ev-kv-key">Tools</span><span class="ev-kv-val">'+esc(ev.tools.length+' available: '+ev.tools.slice(0,8).join(', ')+(ev.tools.length>8?' ...':''))+'</span>';
    if(ev.cwd)h+='<span class="ev-kv-key">Working Dir</span><span class="ev-kv-val">'+esc(ev.cwd)+'</span>';
    h+='</div>';
    return h;
  }

  const content=evContent(ev);
  const contentArr=Array.isArray(content)?content:null;

  // assistant with tool_use
  if(ev.type==='assistant'&&contentArr){
    const toolBlock=contentArr.find(c=>c.type==='tool_use');
    if(toolBlock){
      let h='<div class="ev-section"><span class="ev-section-label">Tool</span><div>'+esc(toolBlock.name||'unknown')+'</div></div>';
      if(toolBlock.input)h+='<div class="ev-section"><span class="ev-section-label">Input</span>'+renderKvInput(toolBlock.input)+'</div>';
      const texts=contentArr.filter(c=>c.type==='text').map(c=>c.text).join('');
      if(texts)h+='<div class="ev-section"><span class="ev-section-label">Message</span><div class="ev-text-content">'+esc(texts)+'</div></div>';
      return h;
    }
    // assistant with text only
    const texts=contentArr.filter(c=>c.type==='text').map(c=>c.text).join('');
    if(texts)return '<div class="ev-text-content">'+esc(texts)+'</div>';
  }
  if(ev.type==='assistant'&&typeof content==='string'&&content){
    return '<div class="ev-text-content">'+esc(content)+'</div>';
  }

  // user / tool_result
  if(ev.type==='user'&&contentArr){
    const resultBlock=contentArr.find(c=>c.type==='tool_result');
    if(resultBlock){
      const txt=typeof resultBlock.content==='string'?resultBlock.content:
        (Array.isArray(resultBlock.content)?resultBlock.content.map(c=>c.text||'').join(''):'');
      if(txt)return '<div class="ev-text-content">'+esc(txt)+'</div>';
    }
    const texts=contentArr.map(c=>c.text||'').join('');
    if(texts)return '<div class="ev-text-content">'+esc(texts)+'</div>';
  }

  // result / done
  if(ev.type==='result'){
    let h='<div class="ev-stats">';
    if(ev.num_turns)h+='<div class="ev-stat"><span class="ev-stat-val">'+esc(String(ev.num_turns))+'</span><span class="ev-stat-label">turns</span></div>';
    if(ev.cost_usd)h+='<div class="ev-stat"><span class="ev-stat-val">$'+ev.cost_usd.toFixed(4)+'</span><span class="ev-stat-label">cost</span></div>';
    if(ev.duration_ms)h+='<div class="ev-stat"><span class="ev-stat-val">'+(ev.duration_ms/1000).toFixed(1)+'s</span><span class="ev-stat-label">duration</span></div>';
    if(ev.duration_api_ms)h+='<div class="ev-stat"><span class="ev-stat-val">'+(ev.duration_api_ms/1000).toFixed(1)+'s</span><span class="ev-stat-label">api time</span></div>';
    h+='</div>';
    if(ev.result)h+='<div class="ev-section" style="margin-top:8px"><span class="ev-section-label">Result</span><div class="ev-text-content">'+esc(ev.result)+'</div></div>';
    return h;
  }

  // Fallback: nicely formatted JSON in a code block
  return '<div class="ev-code-block">'+esc(JSON.stringify(ev,null,2))+'</div>';
}

function renderEvent(ev,idx){
  let cls='',tag='',sum='';
  const content=evContent(ev);
  const contentArr=Array.isArray(content)?content:null;

  if(ev.type==='system'){
    cls='ev-system'; tag='system';
    const parts=[];
    if(ev.subtype==='init'){
      const model=(ev.message&&ev.message.model)||ev.model;
      if(model)parts.push('model: '+model);
      if(ev.session_id)parts.push('session: '+ev.session_id.slice(0,12));
      if(ev.tools)parts.push(ev.tools.length+' tools');
    }
    sum=parts.length?parts.join(' | '):(ev.subtype||'system');
  } else if(ev.type==='assistant'){
    const toolBlock=contentArr?contentArr.find(c=>c.type==='tool_use'):null;
    if(toolBlock){
      cls='ev-tool-use'; tag='tool call';
      const inputStr=toolBlock.input?(typeof toolBlock.input==='string'?toolBlock.input:JSON.stringify(toolBlock.input)):'';
      sum=(toolBlock.name||'tool')+' '+truncStr(inputStr,100);
    } else {
      cls='ev-text'; tag='text';
      const txt=contentArr?contentArr.filter(c=>c.type==='text').map(c=>c.text).join(''):(typeof content==='string'?content:'');
      sum=truncStr(txt,120);
    }
  } else if(ev.type==='user'){
    cls='ev-tool-result'; tag='tool result';
    const resultBlock=contentArr?contentArr.find(c=>c.type==='tool_result'):null;
    if(resultBlock){
      const rContent=resultBlock.content;
      const txt=typeof rContent==='string'?rContent:(Array.isArray(rContent)?rContent.map(c=>c.text||'').join(''):'');
      sum=truncStr(txt,120);
    } else {
      sum=truncStr(JSON.stringify(content),120);
    }
  } else if(ev.type==='result'){
    cls='ev-result'; tag=ev.subtype==='error'?'error':'done';
    if(ev.subtype==='error')cls='ev-error';
    const parts=[];
    if(ev.num_turns)parts.push(ev.num_turns+' turns');
    if(ev.cost_usd)parts.push('$'+ev.cost_usd.toFixed(4));
    if(ev.duration_ms)parts.push((ev.duration_ms/1000).toFixed(1)+'s');
    if(ev.duration_api_ms)parts.push('api '+(ev.duration_api_ms/1000).toFixed(1)+'s');
    sum=parts.length?parts.join(' | '):(ev.result||'done');
  } else {
    cls='ev-system'; tag=ev.type||'event';
    sum=ev.subtype||truncStr(JSON.stringify(ev),80);
  }
  const body=renderEventBody(ev);
  return '<div class="ev" data-ev-idx="'+idx+'"><div class="ev-hd '+esc(cls)+'" onclick="toggleEv(this)">'
    +'<span class="ev-tag '+esc(cls)+'">'+esc(tag)+'</span>'
    +'<span class="ev-sum">'+esc(sum)+'</span>'
    +'<span class="ev-chev">&#9654;</span>'
    +'</div><div class="ev-body">'+body+'</div></div>';
}

function renderStreamJsonEvents(events){
  if(!events||!events.length)return '<div class="welcome">No events yet.</div>';
  return '<div class="ev-list">'+events.map((ev,i)=>renderEvent(ev,i)).join('')+'</div>';
}

const openEvIndices=new Set();
function toggleEv(hd){
  const el=hd.parentElement;
  el.classList.toggle('open');
  const idx=el.getAttribute('data-ev-idx');
  if(idx!==null){
    if(el.classList.contains('open'))openEvIndices.add(idx);
    else openEvIndices.delete(idx);
  }
}

function parseStreamJsonLogClient(raw){
  const lines=raw.split('\\n');
  const events=[];
  let hasJson=false;
  for(const line of lines){
    const t=line.trim();
    if(!t||!t.startsWith('{'))continue;
    try{const o=JSON.parse(t);if(o.type){events.push(o);hasJson=true;}}catch{}
  }
  return {format:hasJson?'stream-json':'text',events:hasJson?events:null};
}

// Live output
let liveTimer=null;
async function loadLiveView(){
  try{
    const r=await(await fetch(ap('/api/live'))).json();
    const ind=document.getElementById('live-ind');
    if(ind)ind.className=r.running?'live-dot on':'live-dot';
    if(!document.querySelector('.tab[data-t="live"]').classList.contains('on'))return;
    const st=r.running?'<span class="live-badge on">&#9679; LIVE</span>':'<span class="live-badge off">&#9675; IDLE</span>';
    const nm=r.log?r.log.replace('invocation_','').replace('.log',''):'&mdash;';
    const sz=(r.size/1024).toFixed(1);
    const m=document.getElementById('main');
    const prevScroll=document.getElementById('live-pre')||document.querySelector('.ev-list');
    const wasAtBottom=prevScroll?(m.scrollHeight-m.scrollTop-m.clientHeight<50):true;
    let body;
    if(r.format==='stream-json'&&r.events&&r.events.length){
      body=renderStreamJsonEvents(r.events);
    } else {
      body='<pre class="raw live-output" id="live-pre">'+esc(r.content)+'</pre>';
    }
    // Save scroll positions of open event bodies before replacing DOM
    const evBodyScrolls={};
    openEvIndices.forEach(idx=>{
      const el=m.querySelector('[data-ev-idx="'+idx+'"] .ev-body');
      if(el)evBodyScrolls[idx]=el.scrollTop;
    });
    m.innerHTML='<div class="viewer-hd"><h2>'+st+' &nbsp;'+esc(nm)+'</h2><div class="meta">'
      +(r.running?'Auto-refreshing every 2s':'Most recent invocation (completed)')
      +' &middot; '+sz+' KB'
      +(r.format==='stream-json'&&r.events?' &middot; '+r.events.length+' events':'')
      +'</div></div>'+body;
    // Restore open/collapsed state and scroll positions for events
    openEvIndices.forEach(idx=>{
      const el=m.querySelector('[data-ev-idx="'+idx+'"]');
      if(el){
        el.classList.add('open');
        if(evBodyScrolls[idx]!==undefined){
          const bd=el.querySelector('.ev-body');
          if(bd)bd.scrollTop=evBodyScrolls[idx];
        }
      }
    });
    if(wasAtBottom)m.scrollTop=m.scrollHeight;
  }catch(e){console.error('live:',e);}
}
function startLive(){loadLiveView();if(liveTimer)clearInterval(liveTimer);liveTimer=setInterval(loadLiveView,2000);}
function stopLive(){if(liveTimer){clearInterval(liveTimer);liveTimer=null;}}
document.querySelector('.tab[data-t="live"]').addEventListener('click',startLive);
document.querySelectorAll('.tab:not([data-t="live"])').forEach(t=>t.addEventListener('click',stopLive));
// Poll live indicator even when not on live tab
setInterval(async()=>{try{const r=await(await fetch(ap('/api/live'))).json();const ind=document.getElementById('live-ind');if(ind)ind.className=r.running?'live-dot on':'live-dot';}catch{}},5000);

// Summary
async function loadSummary(){
  document.querySelectorAll('.item').forEach(e=>e.classList.remove('active'));
  const d=await(await fetch(ap('/api/summary'))).json();
  if(!d.exists){document.getElementById('main').innerHTML='<div class="welcome">No summary yet. One will appear after the first research invocation completes.</div>';return;}
  const dt=new Date(d.modified).toLocaleString();
  document.getElementById('main').innerHTML='<div class="viewer-hd"><h2>Agent Summary</h2><div class="meta">Updated: '+dt+'</div></div><div class="md">'+d.html+'</div>';
}
async function loadSummaryArchive(){
  try{
    const r=await(await fetch(ap('/api/summary/archive'))).json();
    const el=document.getElementById('summary-archive');
    if(!el)return;
    el.innerHTML=r.map(a=>{
      const ts=a.timestamp;
      return '<div class="item" onclick="viewSummaryArchive(\\''+esc(a.path)+'\\',\\''+esc(ts)+'\\')"><span class="ico">&#128196;</span>'+esc(ts)+'</div>';
    }).join('')||'<div style="padding:4px 12px;font-size:12px;color:var(--dim)">No archive entries yet.</div>';
  }catch{}
}
async function viewSummaryArchive(p,ts){
  document.querySelectorAll('.item').forEach(e=>e.classList.remove('active'));
  const d=await(await fetch(ap('/api/file?path='+encodeURIComponent(p)))).json();
  if(d.type==='directory')return;
  const dt=new Date(d.modified).toLocaleString();
  const c=d.html?'<div class="md">'+d.html+'</div>':'<pre class="raw">'+esc(d.content)+'</pre>';
  document.getElementById('main').innerHTML='<div class="viewer-hd"><h2>Summary: '+esc(ts)+'</h2><div class="meta">'+esc(d.path)+' &middot; '+dt+'</div></div>'+c;
}
// Auto-load summary when clicking summary tab
document.querySelector('.tab[data-t="summary"]').addEventListener('click',()=>{loadSummary();loadSummaryArchive();});

poll(); loadDocs(); loadState(); loadLogs(); loadSummaryArchive();
setInterval(poll,5000);
setInterval(()=>{loadDocs();loadState();loadLogs();loadSummaryArchive();},15000);
</script>
</body>
</html>`;

module.exports = { FRONTEND_HTML };
