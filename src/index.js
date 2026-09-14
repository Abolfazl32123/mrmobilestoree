const json=(data,status=200,extra={})=>new Response(JSON.stringify(data),{status,headers:{'content-type':'application/json; charset=utf-8','cache-control':'no-store',...extra}});
const cookie=(name,value,maxAge=0)=>`${name}=${encodeURIComponent(value)}; Path=/; HttpOnly; SameSite=Lax; Secure; Max-Age=${maxAge}`;
const getCookie=(req,name)=>req.headers.get('Cookie')?.match(new RegExp(`(?:^|; )${name}=([^;]*)`))?.[1] ? decodeURIComponent(req.headers.get('Cookie').match(new RegExp(`(?:^|; )${name}=([^;]*)`))[1]) : null;
const b64u=b=>{let s='';for(const x of b)s+=String.fromCharCode(x);return btoa(s).replace(/\+/g,'-').replace(/\//g,'_').replace(/=+$/,'')};
const fromB64u=s=>{s=s.replace(/-/g,'+').replace(/_/g,'/');while(s.length%4)s+='=';return Uint8Array.from(atob(s),c=>c.charCodeAt(0))};
async function hmac(secret,text){const k=await crypto.subtle.importKey('raw',new TextEncoder().encode(secret),{name:'HMAC',hash:'SHA-256'},false,['sign']);return new Uint8Array(await crypto.subtle.sign('HMAC',k,new TextEncoder().encode(text)))}
async function signSession(secret,prefix,payload){const body=b64u(new TextEncoder().encode(JSON.stringify(payload)));return `${prefix}.${body}.${b64u(await hmac(secret,prefix+'.'+body))}`}
async function verifySession(req,env,prefix){
  const token=getCookie(req,prefix);if(!token||!env.ADMIN_SECRET)return null;const [p,body,sig]=token.split('.');if(p!==prefix||!body||!sig)return null;
  const exp=await hmac(env.ADMIN_SECRET,p+'.'+body),act=fromB64u(sig);if(act.length!==exp.length)return null;let diff=0;for(let i=0;i<act.length;i++)diff|=act[i]^exp[i];
  if(diff)return null;try{const data=JSON.parse(new TextDecoder().decode(fromB64u(body)));return data.exp>Date.now()?data:null}catch{return null}
}
async function adminOK(req,env){return !!(await verifySession(req,env,'mr_admin'))}
async function hashPassword(password,saltBytes){const key=await crypto.subtle.importKey('raw',new TextEncoder().encode(password),'PBKDF2',false,['deriveBits']);const bits=await crypto.subtle.deriveBits({name:'PBKDF2',salt:saltBytes,iterations:100000,hash:'SHA-256'},key,256);return b64u(new Uint8Array(bits))}
function rand(n=16){const a=new Uint8Array(n);crypto.getRandomValues(a);return a}
async function ensureCustomerTables(env){
  await env.DB.prepare(`CREATE TABLE IF NOT EXISTS users (id INTEGER PRIMARY KEY AUTOINCREMENT,name TEXT NOT NULL,phone TEXT NOT NULL UNIQUE,password_hash TEXT NOT NULL,password_salt TEXT NOT NULL,created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP)`).run();
  await env.DB.prepare(`CREATE TABLE IF NOT EXISTS orders (id INTEGER PRIMARY KEY AUTOINCREMENT,user_id INTEGER NOT NULL,total INTEGER NOT NULL DEFAULT 0,status TEXT NOT NULL DEFAULT 'در انتظار بررسی',created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP)`).run();
  await env.DB.prepare(`CREATE TABLE IF NOT EXISTS order_items (id INTEGER PRIMARY KEY AUTOINCREMENT,order_id INTEGER NOT NULL,product_id INTEGER NOT NULL,quantity INTEGER NOT NULL,price INTEGER NOT NULL)`).run();
}
async function userFromReq(req,env){const d=await verifySession(req,env,'mr_user');return d?.uid||null}
async function ensureProductColumns(env){
  const cols=(await env.DB.prepare('PRAGMA table_info(products)').all()).results||[];
  const names=new Set(cols.map(x=>x.name));
  if(!names.has('category')) await env.DB.prepare("ALTER TABLE products ADD COLUMN category TEXT NOT NULL DEFAULT 'موبایل'").run();
  if(!names.has('badge')) await env.DB.prepare("ALTER TABLE products ADD COLUMN badge TEXT NOT NULL DEFAULT ''").run();
}
async function listProducts(env,all=false){await ensureProductColumns(env);let q='SELECT id,name,price,condition,description,image_key,image_url,category,badge,available,created_at FROM products';if(!all)q+=' WHERE available=1';q+=' ORDER BY id DESC';return (await env.DB.prepare(q).all()).results}

export default {async fetch(request,env){
  const url=new URL(request.url),path=url.pathname;
  try{
    if(path==='/api/auth/register'&&request.method==='POST'){
      await ensureCustomerTables(env);const b=await request.json().catch(()=>({}));const name=String(b.name||'').trim(),phone=String(b.phone||'').trim(),password=String(b.password||'');
      if(name.length<2||!/^09\d{9}$/.test(phone)||password.length<6)return json({error:'نام، شماره موبایل معتبر و رمز حداقل ۶ کاراکتری لازم است.'},400);
      const salt=rand(16),ph=await hashPassword(password,salt);
      try{const r=await env.DB.prepare('INSERT INTO users(name,phone,password_hash,password_salt) VALUES(?,?,?,?)').bind(name,phone,ph,b64u(salt)).run();const exp=Date.now()+30*86400000;const token=await signSession(env.ADMIN_SECRET||'fallback','mr_user',{uid:r.meta.last_row_id,exp});return json({ok:true,user:{id:r.meta.last_row_id,name,phone} },200,{'Set-Cookie':cookie('mr_user',token,30*86400)})}catch(e){return json({error:'این شماره موبایل قبلاً ثبت نام کرده است.'},409)}
    }
    if(path==='/api/auth/login'&&request.method==='POST'){
      await ensureCustomerTables(env);const b=await request.json().catch(()=>({})),phone=String(b.phone||'').trim(),password=String(b.password||'');const u=(await env.DB.prepare('SELECT * FROM users WHERE phone=?').bind(phone).first());
      if(!u)return json({error:'حسابی با این شماره پیدا نشد.'},401);const ph=await hashPassword(password,fromB64u(u.password_salt));if(ph!==u.password_hash)return json({error:'رمز عبور اشتباه است.'},401);
      const token=await signSession(env.ADMIN_SECRET||'fallback','mr_user',{uid:u.id,exp:Date.now()+30*86400000});return json({ok:true,user:{id:u.id,name:u.name,phone:u.phone}},200,{'Set-Cookie':cookie('mr_user',token,30*86400)})
    }
    if(path==='/api/auth/me'&&request.method==='GET'){await ensureCustomerTables(env);const uid=await userFromReq(request,env);if(!uid)return json({user:null});const u=await env.DB.prepare('SELECT id,name,phone FROM users WHERE id=?').bind(uid).first();return json({user:u||null})}
    if(path==='/api/auth/logout'&&request.method==='POST')return json({ok:true},200,{'Set-Cookie':cookie('mr_user','',0)})

    if(path==='/api/orders'&&request.method==='GET'){await ensureCustomerTables(env);const uid=await userFromReq(request,env);if(!uid)return json({error:'ابتدا وارد حساب شوید.'},401);const orders=(await env.DB.prepare('SELECT id,total,status,created_at FROM orders WHERE user_id=? ORDER BY id DESC').bind(uid).all()).results;return json({orders})}
    if(path==='/api/orders'&&request.method==='POST'){
      await ensureCustomerTables(env);const uid=await userFromReq(request,env);if(!uid)return json({error:'ابتدا وارد حساب شوید.'},401);const b=await request.json().catch(()=>({}));const items=Array.isArray(b.items)?b.items:[];if(!items.length)return json({error:'سبد خرید خالی است.'},400);
      let total=0,clean=[];for(const it of items){const p=await env.DB.prepare('SELECT id,price,available FROM products WHERE id=?').bind(Number(it.product_id)).first();if(!p||!p.available)continue;const price=Number(String(p.price).replace(/[^\d]/g,''))||0,q=Math.max(1,Math.min(99,Number(it.quantity)||1));total+=price*q;clean.push({id:p.id,price,q})}
      if(!clean.length)return json({error:'هیچ‌کدام از محصولات موجود نیستند.'},400);const r=await env.DB.prepare('INSERT INTO orders(user_id,total) VALUES(?,?)').bind(uid,total).run();for(const x of clean)await env.DB.prepare('INSERT INTO order_items(order_id,product_id,quantity,price) VALUES(?,?,?,?)').bind(r.meta.last_row_id,x.id,x.q,x.price).run();return json({ok:true,order_id:r.meta.last_row_id})
    }

    if(path==='/api/login'&&request.method==='POST'){if(!env.ADMIN_PASSWORD||!env.ADMIN_SECRET)return json({error:'ADMIN_PASSWORD و ADMIN_SECRET تنظیم نشده‌اند.'},500);const b=await request.json().catch(()=>({}));if(b.password!==env.ADMIN_PASSWORD)return json({error:'رمز عبور اشتباه است.'},401);const exp=Date.now()+8*3600000,token=await signSession(env.ADMIN_SECRET,'mr_admin',{exp});return json({ok:true},200,{'Set-Cookie':cookie('mr_admin',token,28800)})}
    if(path==='/api/logout'&&request.method==='POST')return json({ok:true},200,{'Set-Cookie':cookie('mr_admin','',0)})
    if(path==='/api/products'&&request.method==='GET'){const all=url.searchParams.get('admin')==='1'&&await adminOK(request,env);return json(await listProducts(env,all))}
    if(path.startsWith('/api/products/')&&request.method==='DELETE'){if(!await adminOK(request,env))return json({error:'Unauthorized'},401);const id=Number(path.split('/').pop());await env.DB.prepare('DELETE FROM products WHERE id=?').bind(id).run();return json({ok:true})}
    if(path==='/api/products'&&request.method==='POST'){if(!await adminOK(request,env))return json({error:'Unauthorized'},401);await ensureProductColumns(env);const b=await request.json().catch(()=>({}));if(!b.name||!b.price)return json({error:'نام و قیمت الزامی است.'},400);if(String(b.image_url||'').startsWith('data:image/')&&String(b.image_url).length>700000)return json({error:'حجم تصویر زیاد است؛ لطفاً تصویر کوچک‌تری انتخاب کنید.'},400);const r=await env.DB.prepare('INSERT INTO products(name,price,condition,description,image_key,image_url,category,badge,available) VALUES(?,?,?,?,?,?,?,?,?)').bind(b.name,b.price,b.condition||'نو',b.description||'',b.image_key||'',b.image_url||'',b.category||'موبایل',b.badge||'',b.available?1:0).run();return json({ok:true,id:r.meta.last_row_id})}
    if(path.startsWith('/api/products/')&&request.method==='PUT'){if(!await adminOK(request,env))return json({error:'Unauthorized'},401);await ensureProductColumns(env);const id=Number(path.split('/').pop()),b=await request.json().catch(()=>({}));if(String(b.image_url||'').startsWith('data:image/')&&String(b.image_url).length>700000)return json({error:'حجم تصویر زیاد است؛ لطفاً تصویر کوچک‌تری انتخاب کنید.'},400);await env.DB.prepare('UPDATE products SET name=?,price=?,condition=?,description=?,image_key=?,image_url=?,category=?,badge=?,available=? WHERE id=?').bind(b.name,b.price,b.condition||'نو',b.description||'',b.image_key||'',b.image_url||'',b.category||'موبایل',b.badge||'',b.available?1:0,id).run();return json({ok:true})}
    if(path==='/api/admin/stats'&&request.method==='GET'){
      if(!await adminOK(request,env))return json({error:'Unauthorized'},401);
      await ensureCustomerTables(env);
      const p=await env.DB.prepare('SELECT COUNT(*) AS c FROM products').first();
      const u=await env.DB.prepare('SELECT COUNT(*) AS c FROM users').first();
      const o=await env.DB.prepare('SELECT COUNT(*) AS c, COALESCE(SUM(total),0) AS total, COALESCE(AVG(total),0) AS avg FROM orders').first();
      const n=await env.DB.prepare("SELECT COUNT(*) AS c FROM orders WHERE status='در انتظار بررسی'").first();
      const done=await env.DB.prepare("SELECT COUNT(*) AS c FROM orders WHERE status='تکمیل شده'").first();
      const monthly=(await env.DB.prepare("SELECT strftime('%Y-%m',created_at) AS ym, COALESCE(SUM(total),0) AS total FROM orders GROUP BY ym ORDER BY ym DESC LIMIT 6").all()).results.reverse();
      return json({products:p?.c||0,users:u?.c||0,orders:o?.c||0,total_sales:o?.total||0,avg_order:Math.round(o?.avg||0),new_orders:n?.c||0,completed_orders:done?.c||0,monthly_sales:monthly.map(x=>({month:x.ym,total:x.total}))});
    }
    if(path==='/api/admin/orders'&&request.method==='GET'){
      if(!await adminOK(request,env))return json({error:'Unauthorized'},401);await ensureCustomerTables(env);
      const rows=(await env.DB.prepare(`SELECT o.id,o.total,o.status,o.created_at,u.name AS customer_name,u.phone FROM orders o JOIN users u ON u.id=o.user_id ORDER BY o.id DESC`).all()).results;
      for(const o of rows){const items=(await env.DB.prepare(`SELECT oi.product_id,oi.quantity,oi.price,COALESCE(p.name,'محصول حذف‌شده') AS name FROM order_items oi LEFT JOIN products p ON p.id=oi.product_id WHERE oi.order_id=?`).bind(o.id).all()).results;o.items=items;o.items_text=items.map(i=>`${i.name} ×${i.quantity}`).join('، ')}
      return json(rows);
    }
    if(path.startsWith('/api/admin/orders/')&&path.endsWith('/status')&&request.method==='PUT'){
      if(!await adminOK(request,env))return json({error:'Unauthorized'},401);await ensureCustomerTables(env);const id=Number(path.split('/')[4]);const b=await request.json().catch(()=>({}));const allowed=['در انتظار بررسی','تأیید شده','آماده ارسال','ارسال شده','در حال ارسال','تکمیل شده','لغو شده'];if(!allowed.includes(b.status))return json({error:'وضعیت نامعتبر است.'},400);await env.DB.prepare('UPDATE orders SET status=? WHERE id=?').bind(b.status,id).run();return json({ok:true});
    }
    if(path==='/api/admin/users'&&request.method==='GET'){
      if(!await adminOK(request,env))return json({error:'Unauthorized'},401);await ensureCustomerTables(env);
      const rows=(await env.DB.prepare(`SELECT u.id,u.name,u.phone,u.created_at,COUNT(o.id) AS order_count,COALESCE(SUM(CASE WHEN o.status!='لغو شده' THEN o.total ELSE 0 END),0) AS total_spent,MAX(o.created_at) AS last_order_at FROM users u LEFT JOIN orders o ON o.user_id=u.id GROUP BY u.id ORDER BY u.id DESC`).all()).results;
      return json(rows);
    }
    if(path.startsWith('/api/admin/users/')&&request.method==='GET'){
      if(!await adminOK(request,env))return json({error:'Unauthorized'},401);await ensureCustomerTables(env);
      const id=Number(path.split('/').pop());
      if(!Number.isFinite(id))return json({error:'کاربر نامعتبر است.'},400);
      const user=await env.DB.prepare(`SELECT id,name,phone,created_at FROM users WHERE id=?`).bind(id).first();
      if(!user)return json({error:'کاربر پیدا نشد.'},404);
      const orders=(await env.DB.prepare(`SELECT id,total,status,created_at FROM orders WHERE user_id=? ORDER BY id DESC`).bind(id).all()).results;
      return json({user,orders});
    }
    if(path==='/api/me'&&request.method==='GET')return json({admin:await adminOK(request,env)});
    return env.ASSETS.fetch(request);
  }catch(e){return json({error:'خطای سرور: '+(e?.message||'unknown')},500)}
}};
