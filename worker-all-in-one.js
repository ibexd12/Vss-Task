// ================================================================
// worker-all-in-one.js  —  Approach B: No Cloudflare Pages needed
// Serves HTML at "/" AND handles /add, /list from the same Worker
// No CORS headers needed — same-origin requests
// ================================================================

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const id  = env.MyDatabase.idFromName("main");
    const obj = env.MyDatabase.get(id);

    // Serve the embedded HTML page at "/"
    if (url.pathname === "/" || url.pathname === "") {
      return new Response(HTML, {
        headers: { "content-type": "text/html;charset=UTF-8" }
      });
    }

    // All other routes go to Durable Object (/add, /list)
    return obj.fetch(request);
  }
};

// ── Durable Object ────────────────────────────────────────────────
export class MyDatabase {
  constructor(state, env) {
    this.storage = state.storage;
  }

  async fetch(request) {
    const url = new URL(request.url);

    // POST /add
    if (url.pathname === "/add" && request.method === "POST") {
      try {
        const { name, email } = await request.json();
        if (!name || !email) {
          return new Response(JSON.stringify({ error: "name and email required" }), {
            status: 400, headers: { "content-type": "application/json" }
          });
        }
        await this.storage.put(`record:${Date.now()}:${name}`, {
          name, email, addedAt: new Date().toISOString()
        });
        return new Response(JSON.stringify({ success: true, message: `Added ${name}` }), {
          headers: { "content-type": "application/json" }
        });
      } catch (e) {
        return new Response(JSON.stringify({ error: "Invalid JSON" }), {
          status: 400, headers: { "content-type": "application/json" }
        });
      }
    }

    // GET /list
    if (url.pathname === "/list" && request.method === "GET") {
      const entries = await this.storage.list({ prefix: "record:" });
      const records = [...entries.values()];
      records.sort((a, b) => new Date(b.addedAt) - new Date(a.addedAt));
      return new Response(JSON.stringify(records), {
        headers: { "content-type": "application/json" }
      });
    }

    return new Response("Not found", { status: 404 });
  }
}

// ── Embedded HTML ─────────────────────────────────────────────────
// Note: fetch() calls use RELATIVE URLs ("/add", "/list")
// because the frontend and API are on the SAME origin.
const HTML = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8"/>
  <meta name="viewport" content="width=device-width,initial-scale=1"/>
  <title>DataVault — All-in-One Worker</title>
  <link href="https://fonts.googleapis.com/css2?family=DM+Mono:wght@400;500&family=Syne:wght@700;800&family=DM+Sans:wght@400;500&display=swap" rel="stylesheet"/>
  <style>
    :root{--bg:#0a0a0f;--surface:#13131a;--surface2:#1c1c27;--border:#2a2a3d;--accent:#7c6af7;--accent2:#4fd1c5;--text:#e8e8f0;--muted:#6b6b8a;--success:#4fd1a0;--danger:#fc6b6b;}
    *{box-sizing:border-box;margin:0;padding:0;}
    body{background:var(--bg);color:var(--text);font-family:'DM Sans',sans-serif;min-height:100vh;}
    body::before{content:'';position:fixed;top:-200px;left:50%;transform:translateX(-50%);width:800px;height:500px;background:radial-gradient(ellipse,rgba(124,106,247,0.12) 0%,transparent 70%);pointer-events:none;}
    .container{max-width:680px;margin:0 auto;padding:60px 24px 80px;position:relative;z-index:1;}
    .badge{display:inline-flex;align-items:center;gap:6px;background:rgba(79,209,197,0.1);border:1px solid rgba(79,209,197,0.3);color:var(--accent2);font-family:'DM Mono',monospace;font-size:11px;letter-spacing:.1em;padding:4px 12px;border-radius:100px;margin-bottom:16px;}
    .badge::before{content:'';width:6px;height:6px;background:var(--accent2);border-radius:50%;animation:pulse 2s infinite;}
    @keyframes pulse{0%,100%{opacity:1}50%{opacity:.3}}
    h1{font-family:'Syne',sans-serif;font-size:40px;font-weight:800;letter-spacing:-.02em;background:linear-gradient(135deg,#fff 30%,var(--accent2) 100%);-webkit-background-clip:text;-webkit-text-fill-color:transparent;background-clip:text;line-height:1.1;margin-bottom:8px;}
    .sub{color:var(--muted);font-size:14px;margin-bottom:40px;}
    .status{display:flex;align-items:center;gap:8px;font-family:'DM Mono',monospace;font-size:12px;color:var(--muted);margin-bottom:28px;padding:10px 14px;background:var(--surface);border:1px solid var(--border);border-radius:8px;}
    .dot{width:8px;height:8px;border-radius:50%;background:var(--muted);transition:background .3s;}
    .dot.on{background:var(--success);box-shadow:0 0 8px var(--success);}
    .dot.err{background:var(--danger);}
    .card{background:var(--surface);border:1px solid var(--border);border-radius:16px;padding:28px;margin-bottom:20px;}
    .card:hover{border-color:rgba(124,106,247,.3);}
    .card-title{font-family:'Syne',sans-serif;font-size:12px;font-weight:700;letter-spacing:.08em;text-transform:uppercase;color:var(--muted);margin-bottom:18px;}
    .row{display:grid;grid-template-columns:1fr 1fr;gap:12px;margin-bottom:12px;}
    @media(max-width:480px){.row{grid-template-columns:1fr;}}
    .ig{display:flex;flex-direction:column;gap:5px;}
    label{font-size:11px;font-weight:500;color:var(--muted);font-family:'DM Mono',monospace;letter-spacing:.05em;}
    input{background:var(--surface2);border:1px solid var(--border);border-radius:10px;color:var(--text);font-family:'DM Sans',sans-serif;font-size:14px;padding:11px 14px;outline:none;transition:border-color .2s,box-shadow .2s;width:100%;}
    input::placeholder{color:var(--muted);}
    input:focus{border-color:var(--accent);box-shadow:0 0 0 3px rgba(124,106,247,.15);}
    .btn{display:inline-flex;align-items:center;justify-content:center;gap:7px;padding:13px;border-radius:10px;font-family:'DM Sans',sans-serif;font-size:15px;font-weight:500;border:none;cursor:pointer;transition:all .15s;width:100%;}
    .btn-p{background:var(--accent);color:#fff;}
    .btn-p:hover{background:#6a58e8;transform:translateY(-1px);box-shadow:0 4px 20px rgba(124,106,247,.35);}
    .btn-p:disabled{opacity:.5;cursor:not-allowed;transform:none;}
    .rec-header{display:flex;align-items:center;justify-content:space-between;margin-bottom:14px;}
    .btn-sm{background:transparent;color:var(--muted);border:1px solid var(--border);padding:6px 12px;font-size:12px;border-radius:8px;cursor:pointer;font-family:'DM Sans',sans-serif;transition:all .15s;}
    .btn-sm:hover{color:var(--text);border-color:var(--accent);}
    #records{display:flex;flex-direction:column;gap:8px;}
    .ri{display:flex;align-items:center;gap:12px;padding:14px 16px;background:var(--surface2);border:1px solid var(--border);border-radius:10px;animation:in .25s ease;}
    @keyframes in{from{opacity:0;transform:translateY(-8px)}to{opacity:1;transform:translateY(0)}}
    .av{width:36px;height:36px;border-radius:50%;background:linear-gradient(135deg,var(--accent),var(--accent2));display:flex;align-items:center;justify-content:center;font-family:'Syne',sans-serif;font-weight:700;font-size:14px;color:#fff;flex-shrink:0;}
    .ri-info{flex:1;min-width:0;}
    .ri-name{font-weight:500;font-size:14px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;}
    .ri-email{font-family:'DM Mono',monospace;font-size:11px;color:var(--muted);white-space:nowrap;overflow:hidden;text-overflow:ellipsis;}
    .ri-time{font-family:'DM Mono',monospace;font-size:10px;color:var(--muted);flex-shrink:0;}
    .empty{text-align:center;padding:40px 20px;color:var(--muted);font-size:14px;}
    .spinner{width:16px;height:16px;border:2px solid rgba(255,255,255,.3);border-top-color:#fff;border-radius:50%;animation:spin .6s linear infinite;}
    @keyframes spin{to{transform:rotate(360deg)}}
    .toast{position:fixed;bottom:24px;right:24px;padding:12px 20px;border-radius:10px;font-size:13px;font-weight:500;z-index:100;opacity:0;transform:translateY(10px);transition:all .25s;pointer-events:none;}
    .toast.show{opacity:1;transform:translateY(0);}
    .toast.ok{background:rgba(79,209,160,.15);border:1px solid rgba(79,209,160,.3);color:var(--success);}
    .toast.err{background:rgba(252,107,107,.15);border:1px solid rgba(252,107,107,.3);color:var(--danger);}
  </style>
</head>
<body>
<div class="container">
  <div class="badge">ALL-IN-ONE WORKER · NO PAGES NEEDED</div>
  <h1>DataVault</h1>
  <p class="sub">Served entirely from a single Cloudflare Worker — no Cloudflare Pages required.</p>

  <div class="status">
    <div class="dot" id="dot"></div>
    <span id="st">Connecting…</span>
    <span id="cnt" style="flex:1;text-align:right;color:var(--accent);font-weight:500;"></span>
  </div>

  <div class="card">
    <div class="card-title">+ Add Record</div>
    <div class="row">
      <div class="ig"><label>NAME</label><input id="name" placeholder="John Doe"/></div>
      <div class="ig"><label>EMAIL</label><input id="email" type="email" placeholder="john@example.com" onkeydown="if(event.key==='Enter')add()"/></div>
    </div>
    <button class="btn btn-p" id="add-btn" onclick="add()">Add to Database</button>
  </div>

  <div class="card">
    <div class="rec-header">
      <div class="card-title" style="margin-bottom:0">Stored Records</div>
      <button class="btn-sm" onclick="load()">↻ Refresh</button>
    </div>
    <div id="records"><div class="empty">Loading…</div></div>
  </div>
</div>

<div class="toast" id="toast"></div>

<script>
  // No WORKER_URL config needed — same-origin relative URLs
  function toast(msg,type){const t=document.getElementById('toast');t.textContent=msg;t.className='toast '+type+' show';setTimeout(()=>t.classList.remove('show'),3000);}

  async function add(){
    const name=document.getElementById('name').value.trim();
    const email=document.getElementById('email').value.trim();
    if(!name||!email)return toast('Enter name and email','err');
    const btn=document.getElementById('add-btn');
    btn.disabled=true;btn.innerHTML='<div class="spinner"></div> Adding…';
    try{
      const r=await fetch('/add',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({name,email})});
      const d=await r.json();
      if(!r.ok)throw new Error(d.error||'Failed');
      document.getElementById('name').value='';
      document.getElementById('email').value='';
      toast('✓ '+name+' added!','ok');
      load();
    }catch(e){toast('Error: '+e.message,'err');}
    finally{btn.disabled=false;btn.innerHTML='Add to Database';}
  }

  async function load(){
    try{
      const r=await fetch('/list');
      const data=await r.json();
      render(data);
      document.getElementById('dot').className='dot on';
      document.getElementById('st').textContent='Connected · same-origin';
      document.getElementById('cnt').textContent=data.length+' record'+(data.length!==1?'s':'');
    }catch(e){
      document.getElementById('dot').className='dot err';
      document.getElementById('st').textContent='Error loading records';
      document.getElementById('records').innerHTML='<div class="empty">Could not load records.</div>';
    }
  }

  function render(recs){
    const c=document.getElementById('records');
    if(!recs.length){c.innerHTML='<div class="empty">No records yet. Add one above!</div>';return;}
    c.innerHTML=recs.map(r=>{
      const ini=(r.name||'?').split(' ').map(w=>w[0]).join('').slice(0,2).toUpperCase();
      const t=r.addedAt?new Date(r.addedAt).toLocaleDateString('en-US',{month:'short',day:'numeric'}):'';
      return \`<div class="ri"><div class="av">\${ini}</div><div class="ri-info"><div class="ri-name">\${esc(r.name)}</div><div class="ri-email">\${esc(r.email)}</div></div>\${t?'<div class="ri-time">'+t+'</div>':''}</div>\`;
    }).join('');
  }

  function esc(s){return String(s||'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');}

  load();
</script>
</body>
</html>`;