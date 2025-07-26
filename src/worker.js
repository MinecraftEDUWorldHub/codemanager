export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);

    // Routes
    if (url.pathname === "/admin/login" && request.method === "POST") {
      return handleLogin(request, env);
    }

    if (url.pathname === "/admin/worlds") {
      const token = request.headers.get("Authorization")?.replace("Bearer ", "");
      if (!token || !(await validateToken(env, token))) {
        return new Response("Unauthorized", { status: 401 });
      }

      if (request.method === "GET") {
        const raw = await env.WORLD_CODES.get("codes");
        const data = JSON.parse(raw || "{}");
        return Response.json(data);
      }

      if (request.method === "POST") {
        const body = await request.json();
        await env.WORLD_CODES.put("codes", JSON.stringify(body));
        return new Response("Saved", { status: 200 });
      }

      return new Response("Method not allowed", { status: 405 });
    }

    return new Response("Not found", { status: 404 });
  }
};

async function handleLogin(request, env) {
  const { password } = await request.json();

  if (!password) return new Response("Missing password", { status: 400 });

  const raw = await env.ADMIN_DATA.get("passwords");
  const passwords = JSON.parse(raw || "[]");

  if (!passwords.includes(password)) {
    return new Response("Unauthorized", { status: 401 });
  }

  const token = await generateToken();
  await env.ADMIN_DATA.put(`token:${token}`, password, { expirationTtl: 3600 });
  return Response.json({ token });
}

async function validateToken(env, token) {
  const value = await env.ADMIN_DATA.get(`token:${token}`);
  return !!value;
}

async function generateToken() {
  const array = new Uint8Array(24);
  crypto.getRandomValues(array);
  return btoa(String.fromCharCode(...array)).replace(/[^a-zA-Z0-9]/g, '');
}
