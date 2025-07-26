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
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0"/>
  <title>Admin World Code Manager</title>
  <style>
    body {
      font-family: "Segoe UI", sans-serif;
      background: #f0f2f5;
      margin: 0;
      padding: 20px;
      color: #333;
    }
    .container {
      max-width: 800px;
      margin: auto;
      background: white;
      border-radius: 12px;
      padding: 30px;
      box-shadow: 0 4px 20px rgba(0,0,0,0.1);
    }
    h2 {
      margin-bottom: 20px;
    }
    input[type="password"] {
      padding: 10px;
      font-size: 1em;
      width: 60%;
      margin-right: 10px;
      border-radius: 8px;
      border: 1px solid #ccc;
    }
    button {
      padding: 10px 18px;
      font-size: 1em;
      background-color: #4CAF50;
      border: none;
      color: white;
      border-radius: 8px;
      cursor: pointer;
    }
    button:hover {
      background-color: #45a049;
    }
    pre {
      background: #f7f7f7;
      border: 1px solid #ccc;
      padding: 20px;
      overflow: auto;
      border-radius: 8px;
      max-height: 500px;
    }
    #editor {
      margin-top: 20px;
    }
    #logout {
      position: fixed;
      bottom: 20px;
      right: 20px;
      background: #f44336;
    }
    #logout:hover {
      background: #d32f2f;
    }
  </style>
</head>
<body>
  <div class="container">
    <h2>Admin World Code Manager</h2>
    <div id="loginPanel">
      <input type="password" id="pw" placeholder="Enter password..." />
      <button onclick="login()">Login</button>
    </div>
    <div id="editor" style="display:none;">
      <pre id="json">Loading...</pre>
      <button onclick="save()">Save</button>
    </div>
  </div>
  <button id="logout" style="display:none;" onclick="logout()">Logout</button>

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
      } else {
        alert('Unauthorized');
      }
    }

    async function load() {
      const res = await fetch('/admin/worlds', {
        headers: { Authorization: 'Bearer ' + token }
      });
      if (!res.ok) return alert('Login failed');
      const data = await res.json();
      document.getElementById('json').innerText = JSON.stringify(data, null, 2);
      document.getElementById('loginPanel').style.display = 'none';
      document.getElementById('editor').style.display = 'block';
      document.getElementById('logout').style.display = 'block';
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
      } catch {
        alert('Invalid JSON');
      }
    }

    function logout() {
      localStorage.removeItem('token');
      token = null;
      location.reload();
    }

    if (token) load();
  </script>
</body>
</html>`;


