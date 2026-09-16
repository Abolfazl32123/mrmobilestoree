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
  await env.DB.prepare(`CREATE TABLE IF NOT EXISTS customer_addresses (id INTEGER PRIMARY KEY AUTOINCREMENT,user_id INTEGER NOT NULL UNIQUE,first_name TEXT NOT NULL DEFAULT '',last_name TEXT NOT NULL DEFAULT '',phone TEXT NOT NULL DEFAULT '',province TEXT NOT NULL DEFAULT '',city TEXT NOT NULL DEFAULT '',address TEXT NOT NULL DEFAULT '',postal_code TEXT NOT NULL DEFAULT '',updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP)`).run();
  await env.DB.prepare(`CREATE TABLE IF NOT EXISTS order_addresses (id INTEGER PRIMARY KEY AUTOINCREMENT,order_id INTEGER NOT NULL UNIQUE,user_id INTEGER NOT NULL,first_name TEXT NOT NULL DEFAULT '',last_name TEXT NOT NULL DEFAULT '',phone TEXT NOT NULL DEFAULT '',province TEXT NOT NULL DEFAULT '',city TEXT NOT NULL DEFAULT '',address TEXT NOT NULL DEFAULT '',postal_code TEXT NOT NULL DEFAULT '',created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP)`).run();
  await env.DB.prepare(`CREATE TABLE IF NOT EXISTS shipments (id INTEGER PRIMARY KEY AUTOINCREMENT,order_id INTEGER NOT NULL UNIQUE,carrier TEXT NOT NULL DEFAULT '',tracking_code TEXT NOT NULL DEFAULT '',status TEXT NOT NULL DEFAULT 'آماده ارسال',shipped_at TEXT DEFAULT NULL,delivered_at TEXT DEFAULT NULL,updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP)`).run();
  await env.DB.prepare(`CREATE INDEX IF NOT EXISTS idx_shipments_order ON shipments(order_id)`).run();
  await env.DB.prepare(`CREATE INDEX IF NOT EXISTS idx_order_addresses_user ON order_addresses(user_id)`).run();
  await env.DB.prepare(`CREATE TABLE IF NOT EXISTS payment_settings (id INTEGER PRIMARY KEY CHECK (id=1),card_number TEXT NOT NULL DEFAULT '',card_holder TEXT NOT NULL DEFAULT '',bank_name TEXT NOT NULL DEFAULT '',instructions TEXT NOT NULL DEFAULT '',updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP)`).run();
  const psCols=await env.DB.prepare('PRAGMA table_info(payment_settings)').all();const psNames=new Set((psCols.results||[]).map(x=>x.name));const psAdds={gateway_enabled:"ALTER TABLE payment_settings ADD COLUMN gateway_enabled INTEGER NOT NULL DEFAULT 0",gateway_provider:"ALTER TABLE payment_settings ADD COLUMN gateway_provider TEXT NOT NULL DEFAULT ''",gateway_merchant_id:"ALTER TABLE payment_settings ADD COLUMN gateway_merchant_id TEXT NOT NULL DEFAULT ''"};for(const [name,sql] of Object.entries(psAdds))if(!psNames.has(name))await env.DB.prepare(sql).run();
  await env.DB.prepare(`CREATE TABLE IF NOT EXISTS payments (id INTEGER PRIMARY KEY AUTOINCREMENT,order_id INTEGER NOT NULL,user_id INTEGER NOT NULL,amount INTEGER NOT NULL,tracking_code TEXT NOT NULL DEFAULT '',receipt_data TEXT NOT NULL DEFAULT '',status TEXT NOT NULL DEFAULT 'در انتظار بررسی',admin_note TEXT NOT NULL DEFAULT '',created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,reviewed_at TEXT DEFAULT NULL)`).run();
  await env.DB.prepare(`CREATE INDEX IF NOT EXISTS idx_payments_status ON payments(status)`).run();
  await env.DB.prepare(`CREATE INDEX IF NOT EXISTS idx_payments_order ON payments(order_id)`).run();
  await env.DB.prepare(`CREATE TABLE IF NOT EXISTS admin_notifications (id INTEGER PRIMARY KEY AUTOINCREMENT,type TEXT NOT NULL DEFAULT 'system',title TEXT NOT NULL,message TEXT NOT NULL DEFAULT '',link TEXT NOT NULL DEFAULT '',read_at TEXT DEFAULT NULL,created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP)`).run();
  await env.DB.prepare(`CREATE INDEX IF NOT EXISTS idx_admin_notifications_read ON admin_notifications(read_at,created_at)`).run();
  await env.DB.prepare(`CREATE TABLE IF NOT EXISTS discount_coupons (id INTEGER PRIMARY KEY AUTOINCREMENT,code TEXT NOT NULL UNIQUE,discount_type TEXT NOT NULL DEFAULT 'percent',discount_value INTEGER NOT NULL DEFAULT 0,min_order INTEGER NOT NULL DEFAULT 0,start_at TEXT DEFAULT NULL,end_at TEXT DEFAULT NULL,max_uses INTEGER NOT NULL DEFAULT 0,used_count INTEGER NOT NULL DEFAULT 0,active INTEGER NOT NULL DEFAULT 1,created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP)`).run();
  await env.DB.prepare(`CREATE INDEX IF NOT EXISTS idx_discount_coupons_code ON discount_coupons(code)`).run();
}
async function getCoupon(env,code,total){
  const c=String(code||'').trim().toUpperCase(); if(!c)return {coupon:null,discount:0};
  const x=await env.DB.prepare('SELECT * FROM discount_coupons WHERE code=?').bind(c).first(); if(!x)return {error:'کد تخفیف معتبر نیست.'};
  const now=Date.now(); const start=x.start_at?Date.parse(x.start_at):null,end=x.end_at?Date.parse(x.end_at):null;
  if(!x.active)return {error:'این کد تخفیف غیرفعال است.'}; if(start&&now<start)return {error:'زمان استفاده از این کد تخفیف هنوز شروع نشده است.'}; if(end&&now>end)return {error:'این کد تخفیف منقضی شده است.'}; if(Number(x.max_uses)>0&&Number(x.used_count)>=Number(x.max_uses))return {error:'ظرفیت استفاده از این کد تخفیف تکمیل شده است.'}; if(Number(total)<Number(x.min_order))return {error:`حداقل مبلغ سفارش برای این کد ${Number(x.min_order).toLocaleString('fa-IR')} تومان است.`};
  let discount=x.discount_type==='fixed'?Number(x.discount_value):Math.floor(Number(total)*Number(x.discount_value)/100); discount=Math.max(0,Math.min(discount,Number(total))); return {coupon:x,discount};
}

async function addAdminNotification(env,type,title,message,link=''){await ensureCustomerTables(env);await env.DB.prepare('INSERT INTO admin_notifications(type,title,message,link) VALUES(?,?,?,?)').bind(type,title,message,link).run()}

async function ensureReviewTables(env){
  await env.DB.prepare(`CREATE TABLE IF NOT EXISTS product_reviews (id INTEGER PRIMARY KEY AUTOINCREMENT,product_id INTEGER NOT NULL,user_id INTEGER NOT NULL,rating INTEGER NOT NULL DEFAULT 5,comment TEXT NOT NULL DEFAULT '',status TEXT NOT NULL DEFAULT 'pending',created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP)`).run();
  await env.DB.prepare(`CREATE INDEX IF NOT EXISTS idx_product_reviews_product ON product_reviews(product_id,status,created_at)`).run();
}
async function userFromReq(req,env){const d=await verifySession(req,env,'mr_user');return d?.uid||null}
async function ensureProductColumns(env){
  const cols=await env.DB.prepare('PRAGMA table_info(products)').all();
  const names=new Set((cols.results||[]).map(x=>x.name));
  const adds={discount_price:"ALTER TABLE products ADD COLUMN discount_price TEXT NOT NULL DEFAULT ''",badge:"ALTER TABLE products ADD COLUMN badge TEXT NOT NULL DEFAULT ''",featured:"ALTER TABLE products ADD COLUMN featured INTEGER NOT NULL DEFAULT 0",bestseller:"ALTER TABLE products ADD COLUMN bestseller INTEGER NOT NULL DEFAULT 0",newest:"ALTER TABLE products ADD COLUMN newest INTEGER NOT NULL DEFAULT 0",category:"ALTER TABLE products ADD COLUMN category TEXT NOT NULL DEFAULT 'موبایل'",specs:"ALTER TABLE products ADD COLUMN specs TEXT NOT NULL DEFAULT '{}'"};
  for(const [name,sql] of Object.entries(adds)) if(!names.has(name)) await env.DB.prepare(sql).run();
}
async function listProducts(env,all=false){
  const info=await env.DB.prepare('PRAGMA table_info(products)').all();
  const names=new Set((info.results||[]).map(x=>x.name));
  const base=['id','name','price','condition','description','image_key','image_url','available','created_at'];
  const optional=['discount_price','badge','featured','bestseller','newest','category','specs'];
  const cols=base.concat(optional.filter(c=>names.has(c)));
  let q='SELECT '+cols.join(',')+' FROM products';
  if(!all)q+=' WHERE available=1';
  q+=' ORDER BY id DESC';
  const rows=(await env.DB.prepare(q).all()).results||[];
  return rows.map(p=>({
    discount_price:p.discount_price??'',badge:p.badge??'',featured:Number(p.featured||0),bestseller:Number(p.bestseller||0),newest:Number(p.newest||0),category:p.category||'موبایل',specs:p.specs||'{}',...p
  }));
}

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

    if(path==='/api/account/address'&&request.method==='GET'){
      await ensureCustomerTables(env);const uid=await userFromReq(request,env);if(!uid)return json({error:'ابتدا وارد حساب شوید.'},401);
      const a=await env.DB.prepare('SELECT first_name,last_name,phone,province,city,address,postal_code FROM customer_addresses WHERE user_id=?').bind(uid).first();return json({address:a||null});
    }
    if(path==='/api/account/address'&&request.method==='PUT'){
      await ensureCustomerTables(env);const uid=await userFromReq(request,env);if(!uid)return json({error:'ابتدا وارد حساب شوید.'},401);
      const b=await request.json().catch(()=>({}));const first=String(b.first_name||'').trim().slice(0,60),last=String(b.last_name||'').trim().slice(0,60),phone=String(b.phone||'').trim().slice(0,20),province=String(b.province||'').trim().slice(0,60),city=String(b.city||'').trim().slice(0,60),address=String(b.address||'').trim().slice(0,500),postal=String(b.postal_code||'').replace(/\D/g,'').slice(0,10);
      if(first.length<2||last.length<2||!/^09\d{9}$/.test(phone)||province.length<2||city.length<2||address.length<8||postal.length!==10)return json({error:'لطفاً همه اطلاعات آدرس را صحیح و کامل وارد کنید.'},400);
      await env.DB.prepare(`INSERT INTO customer_addresses(user_id,first_name,last_name,phone,province,city,address,postal_code) VALUES(?,?,?,?,?,?,?,?) ON CONFLICT(user_id) DO UPDATE SET first_name=excluded.first_name,last_name=excluded.last_name,phone=excluded.phone,province=excluded.province,city=excluded.city,address=excluded.address,postal_code=excluded.postal_code,updated_at=CURRENT_TIMESTAMP`).bind(uid,first,last,phone,province,city,address,postal).run();return json({ok:true});
    }
    if(path==='/api/payment-settings'&&request.method==='GET'){
      await ensureCustomerTables(env);
      let st=await env.DB.prepare('SELECT card_number,card_holder,bank_name,instructions,gateway_enabled,gateway_provider,gateway_merchant_id FROM payment_settings WHERE id=1').first();
      if(!st) st={card_number:'',card_holder:'',bank_name:'',instructions:'',gateway_enabled:0,gateway_provider:'',gateway_merchant_id:''};
      return json(st);
    }
    if(path.startsWith('/api/orders/')&&path.endsWith('/payment')&&request.method==='GET'){
      await ensureCustomerTables(env);const uid=await userFromReq(request,env);if(!uid)return json({error:'ابتدا وارد حساب شوید.'},401);
      const id=Number(path.split('/')[3]);const order=await env.DB.prepare('SELECT id,total,status,created_at FROM orders WHERE id=? AND user_id=?').bind(id,uid).first();if(!order)return json({error:'سفارش پیدا نشد.'},404);
      const payment=await env.DB.prepare('SELECT id,amount,tracking_code,status,admin_note,created_at,reviewed_at FROM payments WHERE order_id=? ORDER BY id DESC LIMIT 1').bind(id).first();return json({order,payment:payment||null});
    }
    if(path.startsWith('/api/orders/')&&path.endsWith('/payment')&&request.method==='POST'){
      await ensureCustomerTables(env);const uid=await userFromReq(request,env);if(!uid)return json({error:'ابتدا وارد حساب شوید.'},401);
      const id=Number(path.split('/')[3]);const order=await env.DB.prepare('SELECT id,total FROM orders WHERE id=? AND user_id=?').bind(id,uid).first();if(!order)return json({error:'سفارش پیدا نشد.'},404);
      const b=await request.json().catch(()=>({}));const tracking=String(b.tracking_code||'').trim().slice(0,80);const receipt=String(b.receipt_data||'');
      if(!tracking)return json({error:'شماره پیگیری را وارد کنید.'},400);if(!/^data:image\/(jpeg|jpg|png|webp);base64,/i.test(receipt))return json({error:'تصویر رسید معتبر نیست.'},400);if(receipt.length>1800000)return json({error:'حجم تصویر رسید زیاد است. لطفاً تصویر کوچک‌تری انتخاب کنید.'},400);
      const old=await env.DB.prepare("SELECT id FROM payments WHERE order_id=? AND status='در انتظار بررسی' LIMIT 1").bind(id).first();if(old)return json({error:'رسید این سفارش قبلاً برای بررسی ارسال شده است.'},409);
      await env.DB.prepare('INSERT INTO payments(order_id,user_id,amount,tracking_code,receipt_data,status) VALUES(?,?,?,?,?,?)').bind(id,uid,order.total,tracking,receipt,'در انتظار بررسی').run();
      await env.DB.prepare("UPDATE orders SET status='در انتظار بررسی' WHERE id=? AND status NOT IN ('تکمیل شده','در حال ارسال')").bind(id).run();
      const customer=await env.DB.prepare('SELECT name FROM users WHERE id=?').bind(uid).first();
      await addAdminNotification(env,'payment','رسید پرداخت جدید',`رسید سفارش #${id} از ${customer?.name||'مشتری'} ارسال شد.`,`/admin/?section=payments`);
      return json({ok:true,status:'در انتظار بررسی'});
    }
    if(path==='/api/orders'&&request.method==='GET'){await ensureCustomerTables(env);const uid=await userFromReq(request,env);if(!uid)return json({error:'ابتدا وارد حساب شوید.'},401);const orders=(await env.DB.prepare(`SELECT o.id,o.total,o.status,o.created_at,(SELECT p.status FROM payments p WHERE p.order_id=o.id ORDER BY p.id DESC LIMIT 1) AS payment_status,s.carrier,s.tracking_code,s.status AS shipping_status,s.shipped_at,s.delivered_at FROM orders o LEFT JOIN shipments s ON s.order_id=o.id WHERE o.user_id=? ORDER BY o.id DESC`).bind(uid).all()).results;return json({orders})}
    if(path==='/api/orders'&&request.method==='POST'){
      await ensureCustomerTables(env);const uid=await userFromReq(request,env);if(!uid)return json({error:'ابتدا وارد حساب شوید.'},401);const b=await request.json().catch(()=>({}));const items=Array.isArray(b.items)?b.items:[];if(!items.length)return json({error:'سبد خرید خالی است.'},400);
      let subtotal=0,clean=[];for(const it of items){const p=await env.DB.prepare('SELECT id,price,available FROM products WHERE id=?').bind(Number(it.product_id)).first();if(!p||!p.available)continue;const price=Number(String(p.price).replace(/[^\d]/g,''))||0,q=Math.max(1,Math.min(99,Number(it.quantity)||1));subtotal+=price*q;clean.push({id:p.id,price,q})}
      if(!clean.length)return json({error:'هیچ‌کدام از محصولات موجود نیستند.'},400);
      const a=await env.DB.prepare('SELECT first_name,last_name,phone,province,city,address,postal_code FROM customer_addresses WHERE user_id=?').bind(uid).first();
      if(!a)return json({error:'آدرس ارسال را وارد کنید.',code:'ADDRESS_REQUIRED'},400);
      const cr=await getCoupon(env,b.coupon_code,subtotal);if(cr.error)return json({error:cr.error},400);const discount=cr.discount||0,total=subtotal-discount;
      const r=await env.DB.prepare('INSERT INTO orders(user_id,total) VALUES(?,?)').bind(uid,total).run();const oid=r.meta.last_row_id;
      if(cr.coupon)await env.DB.prepare('UPDATE discount_coupons SET used_count=used_count+1 WHERE id=?').bind(cr.coupon.id).run();
      const customer=await env.DB.prepare('SELECT name FROM users WHERE id=?').bind(uid).first();
      await addAdminNotification(env,'order','سفارش جدید',`سفارش #${oid} توسط ${customer?.name||'مشتری'} ثبت شد — ${total.toLocaleString('fa-IR')} تومان.`,`/admin/?section=orders`);
      const stmts=[...clean.map(x=>env.DB.prepare('INSERT INTO order_items(order_id,product_id,quantity,price) VALUES(?,?,?,?)').bind(oid,x.id,x.q,x.price)),env.DB.prepare('INSERT INTO order_addresses(order_id,user_id,first_name,last_name,phone,province,city,address,postal_code) VALUES(?,?,?,?,?,?,?,?,?)').bind(oid,uid,a.first_name,a.last_name,a.phone,a.province,a.city,a.address,a.postal_code)];
      await env.DB.batch(stmts);return json({ok:true,order_id:oid,total,subtotal,discount,coupon:cr.coupon?.code||''})
    }

    if(path==='/api/login'&&request.method==='POST'){if(!env.ADMIN_PASSWORD||!env.ADMIN_SECRET)return json({error:'ADMIN_PASSWORD و ADMIN_SECRET تنظیم نشده‌اند.'},500);const b=await request.json().catch(()=>({}));if(b.password!==env.ADMIN_PASSWORD)return json({error:'رمز عبور اشتباه است.'},401);const exp=Date.now()+8*3600000,token=await signSession(env.ADMIN_SECRET,'mr_admin',{exp});return json({ok:true},200,{'Set-Cookie':cookie('mr_admin',token,28800)})}
    if(path==='/api/logout'&&request.method==='POST')return json({ok:true},200,{'Set-Cookie':cookie('mr_admin','',0)})
    if(path==='/api/admin/reviews'&&request.method==='GET'){if(!await adminOK(request,env))return json({error:'Unauthorized'},401);await ensureReviewTables(env);const rows=(await env.DB.prepare(`SELECT r.id,r.product_id,r.user_id,r.rating,r.comment,r.status,r.created_at,p.name AS product_name,u.name AS customer_name,u.phone FROM product_reviews r LEFT JOIN products p ON p.id=r.product_id LEFT JOIN users u ON u.id=r.user_id ORDER BY r.id DESC`).all()).results;return json(rows)}
    if(path.match(/^\/api\/admin\/reviews\/\d+\/status$/)&&request.method==='PUT'){if(!await adminOK(request,env))return json({error:'Unauthorized'},401);await ensureReviewTables(env);const id=Number(path.split('/')[4]);const b=await request.json().catch(()=>({}));const status=['pending','approved','rejected'].includes(b.status)?b.status:'pending';await env.DB.prepare('UPDATE product_reviews SET status=? WHERE id=?').bind(status,id).run();return json({ok:true})}
    if(path.match(/^\/api\/admin\/reviews\/\d+$/)&&request.method==='DELETE'){if(!await adminOK(request,env))return json({error:'Unauthorized'},401);await ensureReviewTables(env);const id=Number(path.split('/').pop());await env.DB.prepare('DELETE FROM product_reviews WHERE id=?').bind(id).run();return json({ok:true})}
    if(path==='/api/coupons/validate'&&request.method==='POST'){
      await ensureCustomerTables(env); const b=await request.json().catch(()=>({})); const total=Math.max(0,Number(b.total)||0); const r=await getCoupon(env,b.code,total); if(r.error)return json({error:r.error},400); return json({ok:true,discount:r.discount,coupon:r.coupon?{code:r.coupon.code,discount_type:r.coupon.discount_type,discount_value:r.coupon.discount_value}:null,total_after:total-r.discount});
    }
    if(path==='/api/admin/coupons'&&request.method==='GET'){if(!await adminOK(request,env))return json({error:'Unauthorized'},401);await ensureCustomerTables(env);return json((await env.DB.prepare('SELECT * FROM discount_coupons ORDER BY id DESC').all()).results||[])}
    if(path==='/api/admin/coupons'&&request.method==='POST'){
      if(!await adminOK(request,env))return json({error:'Unauthorized'},401);await ensureCustomerTables(env);const b=await request.json().catch(()=>({}));const code=String(b.code||'').trim().toUpperCase().replace(/\s+/g,'');const type=b.discount_type==='fixed'?'fixed':'percent';const value=Math.max(0,Math.floor(Number(b.discount_value)||0));const min=Math.max(0,Math.floor(Number(b.min_order)||0));const max=Math.max(0,Math.floor(Number(b.max_uses)||0));if(!/^[A-Z0-9_-]{3,32}$/.test(code)||value<=0|| (type==='percent'&&value>100))return json({error:'اطلاعات کد تخفیف نامعتبر است.'},400);try{const r=await env.DB.prepare('INSERT INTO discount_coupons(code,discount_type,discount_value,min_order,start_at,end_at,max_uses,active) VALUES(?,?,?,?,?,?,?,?)').bind(code,type,value,min,b.start_at||null,b.end_at||null,max,b.active===0?0:1).run();return json({ok:true,id:r.meta.last_row_id})}catch(e){return json({error:'این کد تخفیف قبلاً ثبت شده است.'},409)}}
    if(path.match(/^\/api\/admin\/coupons\/\d+$/)&&request.method==='PUT'){if(!await adminOK(request,env))return json({error:'Unauthorized'},401);await ensureCustomerTables(env);const id=Number(path.split('/').pop()),b=await request.json().catch(()=>({}));const fields=[];const vals=[];for(const k of ['discount_type','discount_value','min_order','start_at','end_at','max_uses','active'])if(b[k]!==undefined){fields.push(k+'=?');vals.push(k==='discount_type'?(b[k]==='fixed'?'fixed':'percent'):k==='active'?(b[k]?1:0):b[k]);}if(fields.length)await env.DB.prepare('UPDATE discount_coupons SET '+fields.join(',')+' WHERE id=?').bind(...vals,id).run();return json({ok:true})}
    if(path.match(/^\/api\/admin\/coupons\/\d+$/)&&request.method==='DELETE'){if(!await adminOK(request,env))return json({error:'Unauthorized'},401);await ensureCustomerTables(env);await env.DB.prepare('DELETE FROM discount_coupons WHERE id=?').bind(Number(path.split('/').pop())).run();return json({ok:true})}
    if(path==='/api/products'&&request.method==='GET'){const all=url.searchParams.get('admin')==='1'&&await adminOK(request,env);return json(await listProducts(env,all))}
    if(path.match(/^\/api\/products\/\d+\/reviews$/)&&request.method==='GET'){
      await ensureReviewTables(env);const id=Number(path.split('/')[3]);
      const rows=(await env.DB.prepare(`SELECT r.id,r.rating,r.comment,r.created_at,COALESCE(u.name,'مشتری') AS user_name FROM product_reviews r LEFT JOIN users u ON u.id=r.user_id WHERE r.product_id=? AND r.status='approved' ORDER BY r.id DESC`).bind(id).all()).results;return json(rows);
    }
    if(path.match(/^\/api\/products\/\d+\/reviews$/)&&request.method==='POST'){
      await ensureReviewTables(env);const uid=await userFromReq(request,env);if(!uid)return json({error:'برای ثبت نظر ابتدا وارد حساب کاربری شوید.'},401);
      const id=Number(path.split('/')[3]);const product=await env.DB.prepare('SELECT id FROM products WHERE id=?').bind(id).first();if(!product)return json({error:'محصول پیدا نشد.'},404);
      const bought=await env.DB.prepare('SELECT 1 FROM order_items oi JOIN orders o ON o.id=oi.order_id WHERE oi.product_id=? AND o.user_id=? LIMIT 1').bind(id,uid).first();if(!bought)return json({error:'ثبت نظر فقط برای مشتریانی امکان‌پذیر است که این محصول را خریداری کرده‌اند.'},403);
      const existing=await env.DB.prepare('SELECT id FROM product_reviews WHERE product_id=? AND user_id=? LIMIT 1').bind(id,uid).first();if(existing)return json({error:'برای این محصول قبلاً نظر ثبت کرده‌اید.'},409);
      const b=await request.json().catch(()=>({}));const rating=Math.max(1,Math.min(5,Number(b.rating)||5));const comment=String(b.comment||'').trim().slice(0,1000);if(comment.length<3)return json({error:'متن نظر حداقل ۳ کاراکتر باشد.'},400);
      await env.DB.prepare("INSERT INTO product_reviews(product_id,user_id,rating,comment,status) VALUES(?,?,?,?,?)").bind(id,uid,rating,comment,'pending').run();return json({ok:true,status:'pending'});
    }
    if(path.startsWith('/api/products/')&&request.method==='DELETE'){if(!await adminOK(request,env))return json({error:'Unauthorized'},401);const id=Number(path.split('/').pop());await env.DB.prepare('DELETE FROM products WHERE id=?').bind(id).run();return json({ok:true})}
    if(path==='/api/products'&&request.method==='POST'){if(!await adminOK(request,env))return json({error:'Unauthorized'},401);await ensureProductColumns(env);const b=await request.json().catch(()=>({}));if(!b.name||!b.price)return json({error:'نام و قیمت الزامی است.'},400);const r=await env.DB.prepare('INSERT INTO products(name,price,discount_price,condition,badge,featured,bestseller,newest,category,specs,description,image_key,image_url,available) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?)').bind(b.name,b.price,b.discount_price||'',b.condition||'نو',b.badge||'',b.featured?1:0,b.bestseller?1:0,b.newest?1:0,b.category||'موبایل',typeof b.specs==='string'?b.specs:JSON.stringify(b.specs||{}),b.description||'',b.image_key||'',b.image_url||'',b.available?1:0).run();return json({ok:true,id:r.meta.last_row_id})}
    if(path.startsWith('/api/products/')&&request.method==='PUT'){if(!await adminOK(request,env))return json({error:'Unauthorized'},401);await ensureProductColumns(env);const id=Number(path.split('/').pop()),b=await request.json().catch(()=>({}));await env.DB.prepare('UPDATE products SET name=?,price=?,discount_price=?,condition=?,badge=?,featured=?,bestseller=?,newest=?,category=?,specs=?,description=?,image_key=?,image_url=?,available=? WHERE id=?').bind(b.name,b.price,b.discount_price||'',b.condition||'نو',b.badge||'',b.featured?1:0,b.bestseller?1:0,b.newest?1:0,b.category||'موبایل',typeof b.specs==='string'?b.specs:JSON.stringify(b.specs||{}),b.description||'',b.image_key||'',b.image_url||'',b.available?1:0,id).run();return json({ok:true})}
    if(path==='/api/admin/payment-settings'&&request.method==='GET'){
      if(!await adminOK(request,env))return json({error:'Unauthorized'},401);await ensureCustomerTables(env);let st=await env.DB.prepare('SELECT card_number,card_holder,bank_name,instructions,gateway_enabled,gateway_provider,gateway_merchant_id FROM payment_settings WHERE id=1').first();return json(st||{card_number:'',card_holder:'',bank_name:'',instructions:''});
    }
    if(path==='/api/admin/payment-settings'&&request.method==='PUT'){
      if(!await adminOK(request,env))return json({error:'Unauthorized'},401);await ensureCustomerTables(env);const b=await request.json().catch(()=>({}));
      const card=String(b.card_number||'').replace(/\s+/g,'').slice(0,24),holder=String(b.card_holder||'').trim().slice(0,120),bank=String(b.bank_name||'').trim().slice(0,80),instructions=String(b.instructions||'').trim().slice(0,1000);const gatewayEnabled=b.gateway_enabled?1:0,provider=String(b.gateway_provider||'').trim().slice(0,40),merchant=String(b.gateway_merchant_id||'').trim().slice(0,200);
      await env.DB.prepare(`INSERT INTO payment_settings(id,card_number,card_holder,bank_name,instructions,gateway_enabled,gateway_provider,gateway_merchant_id) VALUES(1,?,?,?,?,?,?,?) ON CONFLICT(id) DO UPDATE SET card_number=excluded.card_number,card_holder=excluded.card_holder,bank_name=excluded.bank_name,instructions=excluded.instructions,gateway_enabled=excluded.gateway_enabled,gateway_provider=excluded.gateway_provider,gateway_merchant_id=excluded.gateway_merchant_id,updated_at=CURRENT_TIMESTAMP`).bind(card,holder,bank,instructions,gatewayEnabled,provider,merchant).run();return json({ok:true});
    }
    if(path==='/api/admin/payments'&&request.method==='GET'){
      if(!await adminOK(request,env))return json({error:'Unauthorized'},401);await ensureCustomerTables(env);
      const rows=(await env.DB.prepare(`SELECT p.id,p.order_id,p.user_id,p.amount,p.tracking_code,p.receipt_data,p.status,p.admin_note,p.created_at,p.reviewed_at,u.name AS customer_name,u.phone FROM payments p LEFT JOIN users u ON u.id=p.user_id ORDER BY p.id DESC`).all()).results;return json(rows);
    }
    if(path.startsWith('/api/admin/payments/')&&path.endsWith('/status')&&request.method==='PUT'){
      if(!await adminOK(request,env))return json({error:'Unauthorized'},401);await ensureCustomerTables(env);const id=Number(path.split('/')[4]);const b=await request.json().catch(()=>({}));const status=String(b.status||'');if(!['تأیید شده','رد شده'].includes(status))return json({error:'وضعیت پرداخت نامعتبر است.'},400);
      const p=await env.DB.prepare('SELECT order_id FROM payments WHERE id=?').bind(id).first();if(!p)return json({error:'پرداخت پیدا نشد.'},404);
      await env.DB.prepare('UPDATE payments SET status=?,admin_note=?,reviewed_at=CURRENT_TIMESTAMP WHERE id=?').bind(status,String(b.admin_note||'').slice(0,500),id).run();
      if(status==='تأیید شده') await env.DB.prepare("UPDATE orders SET status='تأیید شده' WHERE id=? AND status NOT IN ('در حال ارسال','تکمیل شده','لغو شده')").bind(p.order_id).run();
      if(status==='رد شده') await env.DB.prepare("UPDATE orders SET status='لغو شده' WHERE id=? AND status NOT IN ('در حال ارسال','تکمیل شده')").bind(p.order_id).run();
      return json({ok:true});
    }
    if(path==='/api/admin/notifications'&&request.method==='GET'){
      if(!await adminOK(request,env))return json({error:'Unauthorized'},401);await ensureCustomerTables(env);
      const rows=(await env.DB.prepare(`SELECT id,type,title,message,link,read_at,created_at FROM admin_notifications ORDER BY id DESC LIMIT 50`).all()).results||[];
      const unread=rows.filter(x=>!x.read_at).length;return json({notifications:rows,unread});
    }
    if(path==='/api/admin/notifications/read-all'&&request.method==='PUT'){
      if(!await adminOK(request,env))return json({error:'Unauthorized'},401);await ensureCustomerTables(env);await env.DB.prepare('UPDATE admin_notifications SET read_at=CURRENT_TIMESTAMP WHERE read_at IS NULL').run();return json({ok:true});
    }
    if(path.match(/^\/api\/admin\/notifications\/\d+\/read$/)&&request.method==='PUT'){
      if(!await adminOK(request,env))return json({error:'Unauthorized'},401);await ensureCustomerTables(env);const id=Number(path.split('/')[4]);await env.DB.prepare('UPDATE admin_notifications SET read_at=CURRENT_TIMESTAMP WHERE id=?').bind(id).run();return json({ok:true});
    }
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
      const rows=(await env.DB.prepare(`SELECT o.id,o.total,o.status,o.created_at,u.name AS customer_name,u.phone,(SELECT p.status FROM payments p WHERE p.order_id=o.id ORDER BY p.id DESC LIMIT 1) AS payment_status,s.carrier,s.tracking_code,s.status AS shipping_status,s.shipped_at,s.delivered_at FROM orders o JOIN users u ON u.id=o.user_id LEFT JOIN shipments s ON s.order_id=o.id ORDER BY o.id DESC`).all()).results;
      for(const o of rows){const items=(await env.DB.prepare(`SELECT oi.product_id,oi.quantity,oi.price,COALESCE(p.name,'محصول حذف‌شده') AS name FROM order_items oi LEFT JOIN products p ON p.id=oi.product_id WHERE oi.order_id=?`).bind(o.id).all()).results;o.items=items;o.items_text=items.map(i=>`${i.name} ×${i.quantity}`).join('، ')}
      return json(rows);
    }
    if(path.startsWith('/api/admin/orders/')&&path.endsWith('/shipping')&&request.method==='PUT'){
      if(!await adminOK(request,env))return json({error:'Unauthorized'},401);await ensureCustomerTables(env);
      const id=Number(path.split('/')[4]);const b=await request.json().catch(()=>({}));
      const carrier=String(b.carrier||'').trim().slice(0,80),tracking=String(b.tracking_code||'').trim().slice(0,80),status=String(b.status||'آماده ارسال').trim();
      const allowed=['آماده ارسال','ارسال شد','تحویل داده شد'];if(!allowed.includes(status))return json({error:'وضعیت ارسال نامعتبر است.'},400);
      const order=await env.DB.prepare('SELECT id FROM orders WHERE id=?').bind(id).first();if(!order)return json({error:'سفارش پیدا نشد.'},404);
      if(status==='ارسال شد' && !tracking)return json({error:'برای وضعیت «ارسال شد» کد رهگیری را وارد کنید.'},400);
      // Avoid relying on an existing UNIQUE(order_id) constraint: older deployments may have created shipments differently.
      const existing=await env.DB.prepare('SELECT id,shipped_at,delivered_at FROM shipments WHERE order_id=? ORDER BY id DESC LIMIT 1').bind(id).first();
      if(existing){
        await env.DB.prepare(`UPDATE shipments SET carrier=?,tracking_code=?,status=?,shipped_at=CASE WHEN ?='ارسال شد' AND shipped_at IS NULL THEN CURRENT_TIMESTAMP WHEN ?='ارسال شد' THEN shipped_at ELSE NULL END,delivered_at=CASE WHEN ?='تحویل داده شد' AND delivered_at IS NULL THEN CURRENT_TIMESTAMP WHEN ?='تحویل داده شد' THEN delivered_at ELSE NULL END,updated_at=CURRENT_TIMESTAMP WHERE id=?`).bind(carrier,tracking,status,status,status,status,status,existing.id).run();
      }else{
        await env.DB.prepare(`INSERT INTO shipments(order_id,carrier,tracking_code,status,shipped_at,delivered_at) VALUES(?,?,?,?,CASE WHEN ?='ارسال شد' THEN CURRENT_TIMESTAMP ELSE NULL END,CASE WHEN ?='تحویل داده شد' THEN CURRENT_TIMESTAMP ELSE NULL END)`).bind(id,carrier,tracking,status,status,status).run();
      }
      if(status==='ارسال شد')await env.DB.prepare("UPDATE orders SET status='در حال ارسال' WHERE id=? AND status NOT IN ('لغو شده','تکمیل شده')").bind(id).run();
      if(status==='تحویل داده شد')await env.DB.prepare("UPDATE orders SET status='تکمیل شده' WHERE id=? AND status!='لغو شده'").bind(id).run();
      return json({ok:true});
    }
    if(path.startsWith('/api/admin/orders/')&&path.endsWith('/status')&&request.method==='PUT'){
      if(!await adminOK(request,env))return json({error:'Unauthorized'},401);await ensureCustomerTables(env);const id=Number(path.split('/')[4]);const b=await request.json().catch(()=>({}));const allowed=['در انتظار بررسی','تأیید شده','در حال ارسال','تکمیل شده','لغو شده'];if(!allowed.includes(b.status))return json({error:'وضعیت نامعتبر است.'},400);await env.DB.prepare('UPDATE orders SET status=? WHERE id=?').bind(b.status,id).run();return json({ok:true});
    }
    if(path==='/api/admin/users'&&request.method==='GET'){
      if(!await adminOK(request,env))return json({error:'Unauthorized'},401);await ensureCustomerTables(env);
      return json((await env.DB.prepare(`SELECT u.id,u.name,u.phone,u.created_at,COUNT(o.id) AS order_count FROM users u LEFT JOIN orders o ON o.user_id=u.id GROUP BY u.id ORDER BY u.id DESC`).all()).results);
    }
    if(path==='/api/me'&&request.method==='GET')return json({admin:await adminOK(request,env)});
    return env.ASSETS.fetch(request);
  }catch(e){return json({error:'خطای سرور: '+(e?.message||'unknown')},500)}
}};
