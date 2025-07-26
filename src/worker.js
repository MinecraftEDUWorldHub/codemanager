export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const pathname = url.pathname;

    // --- PUBLIC WORLD CODES (no login) ---
    if (pathname === '/public/worlds' && request.method === 'GET') {
      const raw = await env.WORLD_CODES.get('codes');
      const codes = raw ? JSON.parse(raw) : {};
      return new Response(JSON.stringify(codes), {
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*',
        },
      });
    }

    // --- ADMIN LOGIN ---
    if (pathname === '/admin/login' && request.method === 'POST') {
      const { password } = await request.json();
      const storedPassword = await env.ADMIN_DATA.get('password');
      if (password === storedPassword) {
        // simple token: base64 encode password + timestamp
        const token = btoa(password + ':' + Date.now());
        return new Response(JSON.stringify({ token }), {
          headers: { 'Content-Type': 'application/json' },
        });
      }
      return new Response('Unauthorized', { status: 401 });
    }

    // --- ADMIN WORLD CODES (protected) ---
    if (pathname === '/admin/worlds') {
      const auth = request.headers.get('Authorization');
      const token = auth?.split(' ')[1];
      const storedPassword = await env.ADMIN_DATA.get('password');

      // Validate token: must start with btoa(storedPassword)
      if (!token || !token.startsWith(btoa(storedPassword))) {
        return new Response('Unauthorized', { status: 401 });
      }

      if (request.method === 'GET') {
        const raw = await env.WORLD_CODES.get('codes');
        return new Response(raw || '{}', {
          headers: { 'Content-Type': 'application/json' },
        });
      }

      if (request.method === 'POST') {
        const data = await request.json();
        await env.WORLD_CODES.put('codes', JSON.stringify(data));
        return new Response('Saved', { status: 200 });
      }
    }

    // --- ADMIN GUI ---
    if (pathname === '/admin' && request.method === 'GET') {
      return new Response(adminHtml, {
        headers: { 'Content-Type': 'text/html' },
      });
    }

    return new Response('Not Found', { status: 404 });
  },
};

const adminHtml = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<title>Admin World Code Manager</title>
<style>
  body { font-family: Arial, sans-serif; background: #f0f0f0; padding: 20px; }
  .container { max-width: 600px; margin: 40px auto; background: white; padding: 30px; border-radius: 12px; box-shadow: 0 4px 12px rgba(0,0,0,0.1); }
  h1 { text-align: center; }
  .world { margin-bottom: 15px; }
  label { display: block; font-weight: bold; margin-bottom: 5px; }
  input[type="text"] { width: 100%; padding: 8px; border: 1px solid #ccc; border-radius: 6px; }
  button { margin-top: 20px; padding: 12px 20px; background: #4CAF50; border: none; color: white; border-radius: 6px; cursor: pointer; font-size: 16px; }
  button:hover { background: #45a049; }
  #logout-btn { position: fixed; bottom: 20px; right: 20px; background: #d9534f; }
  #logout-btn:hover { background: #c9302c; }
  #login-section { max-width: 300px; margin: 80px auto; background: white; padding: 30px; border-radius: 12px; box-shadow: 0 0 10px rgba(0,0,0,0.1); }
  #login-section input { width: 100%; padding: 10px; margin-top: 15px; border: 1px solid #ccc; border-radius: 6px; }
</style>
</head>
<body>

<div id="login-section">
  <h2>Admin Login</h2>
  <input type="password" id="password" placeholder="Enter password" />
  <button onclick="login()">Login</button>
</div>

<div class="container" id="admin-container" style="display:none;">
  <h1>Manage World Codes</h1>
  <form id="codes-form"></form>
  <button onclick="save()">Save Changes</button>
</div>

<button id="logout-btn" style="display:none;" onclick="logout()">Logout</button>

<script>
  let token = localStorage.getItem('token');

  async function login() {
    const password = document.getElementById('password').value.trim();
    if (!password) return alert('Please enter a password');

    try {
      const res = await fetch('/admin/login', {
        method: 'POST',
        headers: {'Content-Type': 'application/json'},
        body: JSON.stringify({password})
      });
      if (!res.ok) throw new Error('Unauthorized');
      const data = await res.json();
      token = data.token;
      localStorage.setItem('token', token);
      showAdmin();
      loadCodes();
    } catch (e) {
      alert('Login failed');
    }
  }

  async function loadCodes() {
    const res = await fetch('/admin/worlds', {
      headers: { Authorization: 'Bearer ' + token }
    });
    if (!res.ok) {
      alert('Failed to load world codes. Please login again.');
      logout();
      return;
    }
    const data = await res.json();
    const form = document.getElementById('codes-form');
    form.innerHTML = '';

    // For each world, create 4 input fields in one line:
    for (const world in data) {
      const fullCode = data[world];
      // assume code is words separated by hyphens: Word1-Word2-Word3-Word4
      const parts = fullCode.split('-');
      while (parts.length < 4) parts.push('');
      
      const div = document.createElement('div');
      div.className = 'world';

      const label = document.createElement('label');
      label.textContent = world;
      label.setAttribute('for', \`input-\${world}\`);
      div.appendChild(label);

      for (let i = 0; i < 4; i++) {
        const input = document.createElement('input');
        input.type = 'text';
        input.name = world + '-part-' + i;
        input.value = parts[i];
        input.placeholder = \`Part \${i+1}\`;
        input.style.width = '22%';
        input.style.marginRight = '3%';
        div.appendChild(input);
      }
      form.appendChild(div);
    }
  }

  async function save() {
    const form = document.getElementById('codes-form');
    const inputs = form.querySelectorAll('input');
    const newCodes = {};

    // Group inputs by world
    const grouped = {};
    inputs.forEach(input => {
      const [world, , index] = input.name.split('-part-');
      if (!grouped[world]) grouped[world] = [];
      grouped[world][index] = input.value.trim();
    });

    // Compose final codes with hyphens
    for (const world in grouped) {
      const parts = grouped[world];
      // join non-empty parts with '-'
      const code = parts.filter(p => p).join('-');
      newCodes[world] = code;
    }

    try {
      const res = await fetch('/admin/worlds', {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          Authorization: 'Bearer ' + token
        },
        body: JSON.stringify(newCodes)
      });
      if (!res.ok) throw new Error('Failed to save');
      alert('Codes saved successfully!');
    } catch (e) {
      alert('Error saving codes.');
    }
  }

  function showAdmin() {
    document.getElementById('login-section').style.display = 'none';
    document.getElementById('admin-container').style.display = 'block';
    document.getElementById('logout-btn').style.display = 'block';
  }

  function logout() {
    localStorage.removeItem('token');
    token = null;
    document.getElementById('login-section').style.display = 'block';
    document.getElementById('admin-container').style.display = 'none';
    document.getElementById('logout-btn').style.display = 'none';
  }

  if (token) {
    showAdmin();
    loadCodes();
  }
</script>

</body>
</html>
`;
