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
  <title>World Code Admin</title>
  <style>
    body {
      font-family: sans-serif;
      margin: 40px;
      background: #f4f4f4;
    }
    .login, .editor {
      max-width: 600px;
      margin: auto;
      padding: 20px;
      background: white;
      border-radius: 12px;
      box-shadow: 0 0 20px rgba(0,0,0,0.1);
    }
    textarea {
      width: 100%;
      height: 300px;
      font-family: monospace;
      font-size: 14px;
      border: 1px solid #ccc;
      border-radius: 8px;
      padding: 10px;
      resize: vertical;
    }
    button {
      margin-top: 10px;
      padding: 10px 16px;
      font-size: 14px;
      background: #4CAF50;
      color: white;
      border: none;
      border-radius: 6px;
      cursor: pointer;
    }
    button:hover {
      background: #45a049;
    }
    h2 {
      text-align: center;
    }
  </style>
</head>
<body>
  <div class="login" id="login">
    <h2>Admin Login</h2>
    <input type="password" id="pw" placeholder="Enter admin password" />
    <button onclick="login()">Login</button>
  </div>

  <div class="editor" id="editor" style="display: none;">
    <h2>Edit World Codes</h2>
    <textarea id="json">Loading...</textarea>
    <button onclick="save()">Save</button>
  </div>

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
        document.getElementById('login').style.display = 'none';
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
      document.getElementById('json').value = JSON.stringify(data, null, 2);
      document.getElementById('editor').style.display = 'block';
    }

    async function save() {
      const text = document.getElementById('json').value;
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
        alert('Invalid JSON format!');
      }
    }

    if (token) {
      document.getElementById('login').style.display = 'none';
      load();
    }
  </script>
</body>
</html>`;
