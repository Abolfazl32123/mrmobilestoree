const json = (data, status = 200) => new Response(JSON.stringify(data), {
  status,
  headers: { "content-type": "application/json; charset=utf-8", "cache-control": "no-store" }
});

function cookie(name, value, options = {}) {
  let s = `${name}=${encodeURIComponent(value)}; Path=/; HttpOnly; SameSite=Strict`;
  if (options.maxAge != null) s += `; Max-Age=${options.maxAge}`;
  if (options.secure !== false) s += "; Secure";
  return s;
}
function getCookie(request, name) {
  const m = request.headers.get("Cookie")?.match(new RegExp(`(?:^|; )${name}=([^;]*)`));
  return m ? decodeURIComponent(m[1]) : null;
}
function b64u(bytes) {
  let s = "";
  for (const b of bytes) s += String.fromCharCode(b);
  return btoa(s).replace(/\+/g,"-").replace(/\//g,"_").replace(/=+$/,"");
}
function fromB64u(s) {
  s = s.replace(/-/g,"+").replace(/_/g,"/");
  while (s.length % 4) s += "=";
  const bin = atob(s); return Uint8Array.from(bin, c => c.charCodeAt(0));
}
async function hmac(secret, text) {
  const key = await crypto.subtle.importKey("raw", new TextEncoder().encode(secret),
    {name:"HMAC", hash:"SHA-256"}, false, ["sign"]);
  return new Uint8Array(await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(text)));
}
async function makeSession(secret) {
  const exp = Date.now() + 8 * 60 * 60 * 1000;
  const body = b64u(new TextEncoder().encode(String(exp)));
  return `${body}.${b64u(await hmac(secret, body))}`;
}
async function validSession(request, secret) {
  const token = getCookie(request, "mr_admin");
  if (!token) return false;
  const [body, sig] = token.split(".");
  if (!body || !sig) return false;
  const expected = await hmac(secret, body);
  const actual = fromB64u(sig);
  if (actual.length !== expected.length) return false;
  let diff = 0; for (let i=0;i<actual.length;i++) diff |= actual[i] ^ expected[i];
  const exp = Number(new TextDecoder().decode(fromB64u(body)));
  return diff === 0 && Number.isFinite(exp) && exp > Date.now();
}
async function requireAdmin(request, env) {
  return validSession(request, env.ADMIN_SECRET);
}

async function listProducts(env, all = false) {
  let q = "SELECT id,name,price,condition,description,image_key,image_url,available,created_at FROM products";
  if (!all) q += " WHERE available=1";
  q += " ORDER BY id DESC";
  const { results } = await env.DB.prepare(q).all();
  return results;
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const path = url.pathname;

    if (path === "/api/login" && request.method === "POST") {
      const body = await request.json().catch(() => ({}));
      if (!env.ADMIN_PASSWORD || !env.ADMIN_SECRET) return json({error:"ADMIN_PASSWORD و ADMIN_SECRET تنظیم نشده‌اند."},500);
      if (body.password !== env.ADMIN_PASSWORD) return json({error:"رمز عبور اشتباه است."},401);
      const token = await makeSession(env.ADMIN_SECRET);
      return new Response(JSON.stringify({ok:true}), {
        headers: { "content-type":"application/json; charset=utf-8", "Set-Cookie": cookie("mr_admin", token, {maxAge:28800}) }
      });
    }

    if (path === "/api/logout" && request.method === "POST") {
      return new Response(JSON.stringify({ok:true}), {
        headers: { "content-type":"application/json; charset=utf-8", "Set-Cookie": cookie("mr_admin","",{maxAge:0}) }
      });
    }

    if (path === "/api/products" && request.method === "GET") {
      const admin = url.searchParams.get("admin") === "1" && await requireAdmin(request, env);
      return json(await listProducts(env, admin));
    }

    if (path.startsWith("/api/products/") && request.method === "DELETE") {
      if (!await requireAdmin(request, env)) return json({error:"Unauthorized"},401);
      const id = Number(path.split("/").pop());
      await env.DB.prepare("DELETE FROM products WHERE id=?").bind(id).run();
      return json({ok:true});
    }

    if (path === "/api/products" && request.method === "POST") {
      if (!await requireAdmin(request, env)) return json({error:"Unauthorized"},401);
      const body = await request.json().catch(() => ({}));
      if (!body.name || !body.price) return json({error:"نام و قیمت الزامی است."},400);
      const r = await env.DB.prepare(
        "INSERT INTO products (name,price,condition,description,image_key,image_url,available) VALUES (?,?,?,?,?,?,?)"
      ).bind(body.name, body.price, body.condition || "نو", body.description || "", body.image_key || "", body.image_url || "", body.available ? 1 : 0).run();
      return json({ok:true,id:r.meta.last_row_id});
    }

    if (path.startsWith("/api/products/") && request.method === "PUT") {
      if (!await requireAdmin(request, env)) return json({error:"Unauthorized"},401);
      const id = Number(path.split("/").pop());
      const body = await request.json().catch(() => ({}));
      await env.DB.prepare(
        "UPDATE products SET name=?,price=?,condition=?,description=?,image_key=?,image_url=?,available=? WHERE id=?"
      ).bind(body.name,body.price,body.condition||"نو",body.description||"",body.image_key||"",body.image_url||"",body.available?1:0,id).run();
      return json({ok:true});
    }

    if (path === "/api/upload" && request.method === "POST") {
      if (!await requireAdmin(request, env)) return json({error:"Unauthorized"},401);
      if (!env.IMAGES) return json({error:"R2 متصل نیست."},500);
      const form = await request.formData();
      const file = form.get("file");
      if (!(file instanceof File)) return json({error:"فایل تصویر ارسال نشده است."},400);
      if (!file.type.startsWith("image/")) return json({error:"فقط فایل تصویری مجاز است."},400);
      if (file.size > 5 * 1024 * 1024) return json({error:"حداکثر حجم تصویر ۵ مگابایت است."},400);
      const ext = (file.name.split(".").pop() || "jpg").toLowerCase().replace(/[^a-z0-9]/g,"");
      const key = `products/${crypto.randomUUID()}.${ext || "jpg"}`;
      await env.IMAGES.put(key, file.stream(), {httpMetadata:{contentType:file.type, cacheControl:"public, max-age=31536000, immutable"}});
      return json({ok:true,key});
    }

    if (path.startsWith("/media/") && request.method === "GET") {
      const key = path.slice("/media/".length);
      const obj = await env.IMAGES.get(key);
      if (!obj) return new Response("Not found",{status:404});
      const headers = new Headers();
      obj.writeHttpMetadata(headers); headers.set("cache-control","public, max-age=31536000, immutable");
      return new Response(obj.body,{headers});
    }

    if (path === "/api/me" && request.method === "GET") return json({admin: await requireAdmin(request,env)});

    return env.ASSETS.fetch(request);
  }
};
