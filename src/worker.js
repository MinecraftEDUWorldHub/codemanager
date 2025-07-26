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
  <title>Admin World Code Manager</title>
  <style>
    body { font-family: Arial, sans-serif; background: #f9f9f9; padding: 20px; }
    h2 { text-align: center; }
    #login-container, #editor { max-width: 600px; margin: 0 auto; background: white; padding: 20px; border-radius: 12px; box-shadow: 0 0 10px rgba(0,0,0,0.1); }
    #editor { display: none; }
    .world {
      margin-bottom: 15px;
    }
    label {
      display: block;
      margin-bottom: 5px;
      font-weight: bold;
    }
    input[type=text] {
      width: 100%;
      padding: 8px;
      box-sizing: border-box;
      border-radius: 6px;
      border: 1px solid #ccc;
      font-size: 14px;
    }
    button {
      margin-top: 15px;
      padding: 10px 18px;
      font-size: 16px;
      border: none;
      border-radius: 8px;
      background-color: #4CAF50;
      color: white;
      cursor: pointer;
      transition: background-color 0.3s ease;
    }
    button:hover {
      background-color: #45a049;
    }
    #logout-btn {
      position: fixed;
      bottom: 20px;
      right: 20px;
      background: #d9534f;
    }
    #logout-btn:hover {
      background: #c9302c;
    }
  </style>
</head>
<body>
  <div id="login-container">
    <h2>Admin Login</h2>
    <input type="password" id="pw" placeholder="Password" />
    <button onclick="login()">Login</button>
  </div>

  <div id="editor">
    <h2>Edit World Codes</h2>
    <form id="worlds-form"></form>
    <button onclick="save()">Save Changes</button>
  </div>

  <button id="logout-btn" style="display:none;" onclick="logout()">Logout</button>

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
        showEditor();
        load();
      } else {
        alert('Unauthorized');
      }
    }

    function createWorldInput(name, value) {
      const div = document.createElement('div');
      div.className = 'world';

      const label = document.createElement('label');
      label.textContent = name;
      label.setAttribute('for', `input-${name}`);

      const input = document.createElement('input');
      input.type = 'text';
      input.id = `input-${name}`;
      input.name = name;
      input.value = value || '';

      div.appendChild(label);
      div.appendChild(input);
      return div;
    }

    async function load() {
      const res = await fetch('/admin/worlds', {
        headers: { Authorization: 'Bearer ' + token }
      });
      if (!res.ok) {
        alert('Login failed');
        logout();
        return;
      }
      const data = await res.json();
      const form = document.getElementById('worlds-form');
      form.innerHTML = '';
      for (const worldName in data) {
        form.appendChild(createWorldInput(worldName, data[worldName]));
      }
    }

    async function save() {
      const form = document.getElementById('worlds-form');
      const formData = new FormData(form);
      const result = {};

      for (const [key, value] of formData.entries()) {
        result[key] = value;
      }

      try {
        const res = await fetch('/admin/worlds', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: 'Bearer ' + token
          },
          body: JSON.stringify(result)
        });
        if (res.ok) {
          alert('Saved successfully!');
        } else {
          alert('Failed to save.');
        }
      } catch (e) {
        alert('Error saving data.');
      }
    }

    function logout() {
      token = null;
      localStorage.removeItem('token');
      document.getElementById('login-container').style.display = 'block';
      document.getElementById('editor').style.display = 'none';
      document.getElementById('logout-btn').style.display = 'none';
      document.getElementById('pw').value = '';
    }

    function showEditor() {
      document.getElementById('login-container').style.display = 'none';
      document.getElementById('editor').style.display = 'block';
      document.getElementById('logout-btn').style.display = 'block';
    }

    // Auto login if token exists
    if (token) {
      showEditor();
      load();
    }
  </script>
</body>
</html>`;
