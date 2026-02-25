'use strict';

const LOGIN_HTML = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>Agent Dashboard — Login</title>
<style>
  body { background: #0d1117; color: #e6edf3; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
         display: flex; align-items: center; justify-content: center; height: 100vh; margin: 0; }
  .login { background: #161b22; border: 1px solid #30363d; border-radius: 8px; padding: 32px; width: 340px; }
  h2 { font-size: 16px; margin-bottom: 16px; }
  input { width: 100%; padding: 8px 12px; background: #0d1117; border: 1px solid #30363d; border-radius: 6px;
          color: #e6edf3; font-size: 14px; margin-bottom: 12px; box-sizing: border-box; }
  button { width: 100%; padding: 8px; background: #238636; border: none; border-radius: 6px; color: white;
           font-size: 14px; cursor: pointer; } button:hover { background: #2ea043; }
  .err { color: #f85149; font-size: 12px; display: none; margin-bottom: 8px; }
  .live-dot { display: inline-block; width: 8px; height: 8px; border-radius: 50%;
              background: var(--dim); margin-right: 4px; vertical-align: middle; }
  .live-dot.on { background: var(--green); box-shadow: 0 0 6px var(--green); animation: pulse 2s infinite; }
  @keyframes pulse { 0%,100%{opacity:1} 50%{opacity:0.4} }
  .live-badge { font-size: 11px; font-weight: 600; padding: 2px 8px; border-radius: 4px; vertical-align: middle; }
  .live-badge.on { background: rgba(63,185,80,0.15); color: var(--green); }
  .live-badge.off { background: rgba(139,148,158,0.15); color: var(--dim); }
  .live-output { max-height: calc(100vh - 140px); overflow-y: auto; }
</style>
</head>
<body>
<div class="login">
  <h2>Agent Dashboard</h2>
  <div class="err" id="err">Invalid token</div>
  <input type="password" id="tok" placeholder="Dashboard token" autofocus>
  <button onclick="go()">Authenticate</button>
</div>
<script>
function go(){
  const t=document.getElementById('tok').value.trim();
  if(!t) return;
  window.location.href='/?token='+encodeURIComponent(t);
}
document.getElementById('tok').addEventListener('keydown',e=>{if(e.key==='Enter')go()});
if(window.location.search.includes('token=')) document.getElementById('err').style.display='block';
</script>
</body>
</html>`;

module.exports = { LOGIN_HTML };
