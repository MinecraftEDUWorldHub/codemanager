export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    const pathname = url.pathname;

    // --- PUBLIC: Get world codes ---
    if (pathname === '/public/worlds' && request.method === 'GET') {
      const raw = await env.WORLD_CODES.get("codes");
      const codes = raw ? JSON.parse(raw) : {};
      return new Response(JSON.stringify(codes), {
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*'
        }
      });
    }

    // --- ADMIN: Login ---
    if (pathname === '/admin/login' && request.method === 'POST') {
      const { password } = await request.json();
      const storedPassword = await env.ADMIN_DATA.get("password");
      if (password === storedPassword) {
        const token = btoa(password + ':' + Date.now());
        return new Response(JSON.stringify({ token }), {
          headers: { 'Content-Type': 'application/json' }
        });
      }
      return new Response("Unauthorized", { status: 401 });
    }

    // --- ADMIN: Read/Write world codes ---
    if (pathname === '/admin/worlds') {
      const auth = request.headers.get('Authorization');
      const token = auth?.split(' ')[1];
      const storedPassword = await env.ADMIN_DATA.get("password");

      if (!token || !token.startsWith(btoa(storedPassword))) {
        return new Response("Unauthorized", { status: 401 });
      }

      if (request.method === 'GET') {
        const raw = await env.WORLD_CODES.get("codes");
        return new Response(raw || '{}', {
          headers: { 'Content-Type': 'application/json' }
        });
      }

      if (request.method === 'POST') {
        const data = await request.json();
        await env.WORLD_CODES.put("codes", JSON.stringify(data));
        return new Response("Saved", { status: 200 });
      }
    }

    // --- ADMIN: GUI ---
    if (pathname === '/admin' && request.method === 'GET') {
      return new Response(adminHtml, {
        headers: { 'Content-Type': 'text/html' }
      });
    }

    // --- Fallback ---
    return new Response("Not Found", { status: 404 });
  },
};

const adminHtml = `<!DOCTYPE html>
<html>
<head>
  <title>Admin Panel</title>
  <style>
    body { font-family: sans-serif; padding: 20px; }
    #logoutBtn {
      position: fixed;
      bottom: 10px;
      right: 10px;
      padding: 8px 12px;
      border: none;
      background: #f44336;
      color: white;
      border-radius: 6px;
      cursor: pointer;
    }
  </style>
</head>
<body>
<h2>Admin World Code Manager</h2>
<input type="password" id="pw" placeholder="Password">
<button onclick="login()">Login</button>
<div id="editor" style="display:none;">
  <pre id="json">Loading...</pre>
  <button onclick="save()">Save</button>
</div>
<button id="logoutBtn" onclick="logout()" style="display:none;">Logout</button>

<script>
let token = localStorage.getItem('token');

async function login() {
  const pw = document.getElementById('pw').value;
  const res = await fetch('/admin/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ password: pw })
  });
  if (res.ok) {
    token = (await res.json()).token;
    localStorage.setItem('token', token);
    load();
  } else alert('Unauthorized');
}

async function load() {
  const res = await fetch('/admin/worlds', {
    headers: { Authorization: 'Bearer ' + token }
  });
  if (!res.ok) return alert('Login failed');
  const data = await res.json();
  document.getElementById('json').innerText = JSON.stringify(data, null, 2);
  document.getElementById('editor').style.display = 'block';
  document.getElementById('logoutBtn').style.display = 'inline-block';
}

async function save() {
  const text = document.getElementById('json').innerText;
  try {
    const json = JSON.parse(text);
    await fetch('/admin/worlds', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: 'Bearer ' + token
      },
      body: JSON.stringify(json)
    });
    alert('Saved!');
  } catch { alert('Invalid JSON'); }
}

function logout() {
  localStorage.removeItem('token');
  location.reload();
}

if (token) load();
</script>
</body>
</html>`;

