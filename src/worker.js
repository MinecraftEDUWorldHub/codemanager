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
  .container { max-width: 700px; margin: 40px auto; background: white; padding: 30px; border-radius: 12px; box-shadow: 0 4px 12px rgba(0,0,0,0.1); }
  h1 { text-align: center; margin-bottom: 20px; }
  .world { margin-bottom: 15px; display: flex; align-items: center; gap: 10px; flex-wrap: wrap; }
  .world input[type="text"] { padding: 8px; border: 1px solid #ccc; border-radius: 6px; }
  .world input.name { width: 25%; font-weight: bold; }
  .world input.code-part { width: 16%; }
  button { padding: 10px 16px; background: #4CAF50; border: none; color: white; border-radius: 6px; cursor: pointer; font-size: 16px; }
  button:hover { background: #45a049; }
  .remove-btn { background: #d9534f; }
  .remove-btn:hover { background: #c9302c; }
  #logout-btn { position: fixed; bottom: 20px; right: 20px; background: #d9534f; }
  #logout-btn:hover { background: #c9302c; }
  #login-section { max-width: 300px; margin: 80px auto; background: white; padding: 30px; border-radius: 12px; box-shadow: 0 0 10px rgba(0,0,0,0.1); }
  #login-section input { width: 100%; padding: 10px; margin-top: 15px; border: 1px solid #ccc; border-radius: 6px; }
  #add-world-btn { margin-bottom: 20px; background: #007bff; }
  #add-world-btn:hover { background: #0056b3; }
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
  <button id="add-world-btn" onclick="addWorld()">+ Add World</button>
  <form id="codes-form"></form>
  <button onclick="save()">Save Changes</button>
</div>

<button id="logout-btn" style="display:none;" onclick="logout()">Logout</button>

<script>
  let token = localStorage.getItem('token');

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
    renderForm(data);
  }

  function renderForm(data) {
    const form = document.getElementById('codes-form');
    form.innerHTML = '';
    for (const world in data) {
      createWorldEntry(form, world, data[world]);
    }
  }

  function createWorldEntry(container, worldName, fullCode) {
    const div = document.createElement('div');
    div.className = 'world';

    const nameInput = document.createElement('input');
    nameInput.type = 'text';
    nameInput.value = worldName;
    nameInput.className = 'name';
    nameInput.title = 'World Name';
    div.appendChild(nameInput);

    const parts = fullCode.split('-');
    while(parts.length < 4) parts.push('');
    for(let i=0; i<4; i++) {
      const partInput = document.createElement('input');
      partInput.type = 'text';
      partInput.value = parts[i];
      partInput.className = 'code-part';
      partInput.placeholder = 'Part ' + (i+1);
      div.appendChild(partInput);
    }

    const removeBtn = document.createElement('button');
    removeBtn.type = 'button';
    removeBtn.textContent = 'Remove';
    removeBtn.className = 'remove-btn';
    removeBtn.onclick = () => div.remove();
    div.appendChild(removeBtn);

    container.appendChild(div);
  }

  function addWorld() {
    const form = document.getElementById('codes-form');
    createWorldEntry(form, '', '');
  }

  async function save() {
    const form = document.getElementById('codes-form');
    const worlds = {};

    const entries = form.querySelectorAll('.world');
    for(const div of entries) {
      const inputs = div.querySelectorAll('input');
      if(inputs.length < 5) continue;
      const name = inputs[0].value.trim();
      if(!name) continue;
      const codeParts = [];
      for(let i=1; i<=4; i++) {
        const part = inputs[i].value.trim();
        if(part) codeParts.push(part);
      }
      worlds[name] = codeParts.join('-');
    }

    try {
      const res = await fetch('/admin/worlds', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: 'Bearer ' + token
        },
        body: JSON.stringify(worlds)
      });
      if (!res.ok) throw new Error('Save failed');
      alert('World codes saved successfully!');
    } catch {
      alert('Error saving world codes.');
    }
  }

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
    } catch {
      alert('Login failed');
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
