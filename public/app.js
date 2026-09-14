const state={products:[],category:'همه',search:'',cart:JSON.parse(localStorage.getItem('mr_cart')||'[]'),authMode:'login',user:null};

const $=id=>document.getElementById(id);
const toman=n=>Number(n||0).toLocaleString('fa-IR')+' تومان';
const toast=(m)=>{const t=$('toast');t.textContent=m;t.classList.add('show');setTimeout(()=>t.classList.remove('show'),2200)};
function saveCart(){localStorage.setItem('mr_cart',JSON.stringify(state.cart));renderCart();}
function imgUrl(p){return p.image_url||p.image_key||'/assets/mr-mobile-logo.png'}

async function loadProducts(){
  try{const r=await fetch('/api/products');state.products=await r.json();renderProducts();}
  catch(e){$('productsGrid').innerHTML='<div class="loading">خطا در دریافت محصولات.</div>'}
}
function renderProducts(){
  const q=state.search.trim().toLowerCase();
  const list=state.products.filter(p=>(state.category==='همه'||p.category===state.category||state.category==='موبایل'&&(!p.category||p.category==='نو'))&&(!q||String(p.name).toLowerCase().includes(q)||String(p.description||'').toLowerCase().includes(q)));
  if(!list.length){$('productsGrid').innerHTML='<div class="loading">محصولی پیدا نشد.</div>';return}
  $('productsGrid').innerHTML=list.map(p=>`
    <article class="product-card ${p.available?'':'unavailable'}">
      ${p.badge?`<span class="badge">${esc(p.badge)}</span>`:''}
      <button class="wish" onclick="toast('قابلیت علاقه‌مندی به‌زودی اضافه می‌شود')">♡</button>
      <div class="product-image"><img src="${esc(imgUrl(p))}" alt="${esc(p.name)}" onerror="this.src='/assets/mr-mobile-logo.png'"></div>
      <div class="product-name">${esc(p.name)}</div>
      <div class="product-meta">${esc(p.condition||'نو')} ${p.description?' | '+esc(p.description).slice(0,55):''}</div>
      <div class="price">${esc(String(p.price))} <small>تومان</small></div>
      <button class="add-btn" ${p.available?'':'disabled'} onclick="addToCart(${p.id})">${p.available?'افزودن به سبد خرید 🛒':'ناموجود'}</button>
    </article>`).join('');
}
function esc(s){return String(s??'').replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[m]))}
function setCategory(c){state.category=c;document.querySelectorAll('.filter').forEach(x=>x.classList.toggle('active',x.dataset.cat===c));renderProducts();location.hash='products'}
function applyFilters(){state.search=$('searchInput').value;renderProducts()}
$('searchInput').addEventListener('input',()=>{state.search=$('searchInput').value;renderProducts()});

function addToCart(id){const p=state.products.find(x=>Number(x.id)===Number(id));if(!p||!p.available)return;const x=state.cart.find(i=>i.id===p.id);x?x.qty++:state.cart.push({id:p.id,qty:1,name:p.name,price:p.price,image:imgUrl(p)});saveCart();toast('محصول به سبد خرید اضافه شد');toggleCart();}
function cartPrice(x){return Number(String(x.price).replace(/[^\d]/g,''))||0}
function renderCart(){
  const count=state.cart.reduce((a,x)=>a+x.qty,0), total=state.cart.reduce((a,x)=>a+cartPrice(x)*x.qty,0);
  $('cartCount').textContent=count.toLocaleString('fa-IR');$('cartTotal').textContent=toman(total);$('drawerTotal').textContent=toman(total);
  $('cartItems').innerHTML=state.cart.length?state.cart.map(x=>`
  <div class="cart-row"><img src="${esc(x.image)}" onerror="this.src='/assets/mr-mobile-logo.png'"><div><h4>${esc(x.name)}</h4><small>${toman(cartPrice(x))}</small><div class="qty"><button onclick="changeQty(${x.id},-1)">−</button><b>${x.qty}</b><button onclick="changeQty(${x.id},1)">+</button></div></div><button class="remove" onclick="removeCart(${x.id})">حذف</button></div>`).join(''):'<div class="loading">سبد خرید شما خالی است.</div>';
}
function changeQty(id,d){const x=state.cart.find(i=>i.id===id);if(!x)return;x.qty+=d;if(x.qty<=0)state.cart=state.cart.filter(i=>i.id!==id);saveCart()}
function removeCart(id){state.cart=state.cart.filter(i=>i.id!==id);saveCart()}
function clearCart(){state.cart=[];saveCart()}
function toggleCart(){ $('cartDrawer').classList.toggle('open');$('drawerBackdrop').classList.toggle('show')}
async function checkout(){
  if(!state.cart.length)return toast('سبد خرید خالی است');
  if(!state.user){toggleCart();openAuth('login');toast('برای ثبت سفارش ابتدا وارد حساب شوید');return}
  const items=state.cart.map(x=>({product_id:x.id,quantity:x.qty,price:cartPrice(x)}));
  const r=await fetch('/api/orders',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({items})});
  const d=await r.json();if(!r.ok)return toast(d.error||'خطا در ثبت سفارش');
  clearCart();toggleCart();toast('سفارش شما با موفقیت ثبت شد');
}

function openAuth(mode='login'){state.authMode=mode;$('authModal').classList.add('show');updateAuth()}
function closeAuth(){$('authModal').classList.remove('show')}
function switchAuth(){state.authMode=state.authMode==='login'?'register':'login';updateAuth()}
function updateAuth(){
  const reg=state.authMode==='register';$('authTitle').textContent=reg?'ساخت حساب کاربری':'ورود به حساب';$('authSub').textContent=reg?'برای ثبت سفارش یک حساب بسازید.':'برای ادامه وارد حساب کاربری شوید.';
  $('registerNameWrap').classList.toggle('hidden',!reg);$('authSubmit').textContent=reg?'ثبت نام':'ورود';$('authError').textContent='';
}
async function submitAuth(){
  const phone=$('authPhone').value.trim(),password=$('authPassword').value;
  if(!phone||!password)return $('authError').textContent='شماره موبایل و رمز عبور را وارد کنید.';
  const body={phone,password};if(state.authMode==='register')body.name=$('authName').value.trim();
  const r=await fetch('/api/auth/'+state.authMode,{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify(body)}),d=await r.json();
  if(!r.ok)return $('authError').textContent=d.error||'خطا';
  state.user=d.user;closeAuth();updateUser();toast(state.authMode==='register'?'حساب با موفقیت ساخته شد':'خوش آمدید');
}
async function loadMe(){const r=await fetch('/api/auth/me');const d=await r.json();state.user=d.user||null;updateUser()}
function updateUser(){$('userLabel').textContent=state.user?state.user.name||'حساب من':'حساب کاربری'}
async function openAccount(){
  if(!state.user)return openAuth('login');
  $('accountModal').classList.add('show');$('accountInfo').innerHTML=`<div class="account-info"><b>${esc(state.user.name||'کاربر')}</b><br><small>${esc(state.user.phone)}</small></div>`;loadOrders();
}
function closeAccount(){$('accountModal').classList.remove('show')}
async function loadOrders(){const r=await fetch('/api/orders');if(!r.ok)return;$('ordersList').innerHTML='<h3>سفارش‌های من</h3>'+((await r.json()).orders||[]).map(o=>`<div class="order"><b>سفارش #${o.id}</b> — <strong>${toman(o.total)}</strong><br><small>وضعیت: ${esc(o.status)} | ${esc(o.created_at)}</small></div>`).join('')||'<p style="color:#899">هنوز سفارشی ندارید.</p>'}
async function logout(){await fetch('/api/auth/logout',{method:'POST'});state.user=null;closeAccount();updateUser();toast('از حساب خارج شدید')}
function subscribe(){const e=$('newsletterEmail').value.trim();if(!e)return toast('ایمیل را وارد کنید');toast('ایمیل شما ثبت شد 🌱');$('newsletterEmail').value=''}

loadProducts();loadMe();renderCart();
