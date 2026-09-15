const state={products:[],category:'همه',search:'',cart:JSON.parse(localStorage.getItem('mr_cart')||'[]'),authMode:'login',user:null,payment:{orderId:null,amount:0,receiptData:''},pendingOrderItems:null,filters:{category:'همه',brand:'همه',condition:'همه',storage:'همه',availability:'همه',minPrice:'',maxPrice:''},sort:'newest'};

const $=id=>document.getElementById(id);
const toman=n=>Number(n||0).toLocaleString('fa-IR')+' تومان';
const toast=(m)=>{const t=$('toast');t.textContent=m;t.classList.add('show');setTimeout(()=>t.classList.remove('show'),2200)};
function saveCart(){localStorage.setItem('mr_cart',JSON.stringify(state.cart));renderCart();}
function imageUrls(p){const raw=String(p.image_url||p.image_key||'').trim(); if(!raw)return ['/assets/mr-mobile-logo.png']; const sep=raw.startsWith('data:image/')?/\r?\n|\|/:/\r?\n|\|/; const urls=raw.split(sep).map(x=>x.trim()).filter(Boolean); return urls.length?urls:['/assets/mr-mobile-logo.png']}
function imgUrl(p){return imageUrls(p)[0]}
function numeric(v){return Number(String(v??'').replace(/[^\d]/g,''))||0}
function getEffectivePrice(p){const price=numeric(p.price),discount=numeric(p.discount_price);return discount>0&&discount<price?discount:price}
function getBrand(name=''){
  const n=name.toLowerCase();
  if(/iphone|ipad|apple/.test(n))return 'Apple';
  if(/samsung|galaxy/.test(n))return 'Samsung';
  if(/xiaomi|redmi|poco/.test(n))return 'Xiaomi';
  if(/honor/.test(n))return 'Honor';
  if(/huawei/.test(n))return 'Huawei';
  if(/oneplus/.test(n))return 'OnePlus';
  if(/nothing/.test(n))return 'Nothing';
  if(/google|pixel/.test(n))return 'Google';
  if(/nokia/.test(n))return 'Nokia';
  if(/motorola|moto/.test(n))return 'Motorola';
  return 'سایر';
}
function getStorage(p){
  const m=String((p.name||'')+' '+(p.description||'')).match(/(?:\d{2,4}\s?(?:GB|TB)|\d{2,4}\s?گیگ)/i);
  return m?m[0].replace(/\s+/g,' ').trim().toUpperCase().replace(/گیگ/,'GB'):'—';
}
async function loadProducts(){
  try{const r=await fetch('/api/products');state.products=await r.json();populateAdvancedFilters();renderProducts();}
  catch(e){$('productsGrid').innerHTML='<div class="loading">خطا در دریافت محصولات.</div>'}
}
function populateAdvancedFilters(){
  const cats=[...new Set(state.products.map(p=>p.category||'موبایل'))].sort((a,b)=>a.localeCompare(b,'fa'));
  const brands=[...new Set(state.products.map(p=>getBrand(p.name)))].sort();
  const storages=[...new Set(state.products.map(getStorage).filter(x=>x!=='—'))];
  const cat=$('filterCategory'),brand=$('filterBrand'),storage=$('filterStorage');
  if(cat)cat.innerHTML='<option value="همه">همه دسته‌ها</option>'+cats.map(x=>`<option value="${esc(x)}">${esc(x)}</option>`).join('');
  if(brand)brand.innerHTML='<option value="همه">همه برندها</option>'+brands.map(x=>`<option value="${esc(x)}">${esc(x)}</option>`).join('');
  if(storage)storage.innerHTML='<option value="همه">همه حافظه‌ها</option>'+storages.map(x=>`<option value="${esc(x)}">${esc(x)}</option>`).join('');
}
function renderProducts(){
  const q=state.search.trim().toLowerCase();
  let list=state.products.filter(p=>{
    const cat=p.category||'موبایل';
    const text=String((p.name||'')+' '+(p.description||'')+' '+getBrand(p.name)).toLowerCase();
    const price=getEffectivePrice(p), min=numeric(state.filters.minPrice), max=numeric(state.filters.maxPrice);
    return (state.category==='همه'||cat===state.category)
      && (!q||text.includes(q))
      && (state.filters.category==='همه'||cat===state.filters.category)
      && (state.filters.brand==='همه'||getBrand(p.name)===state.filters.brand)
      && (state.filters.condition==='همه'||String(p.condition||'نو')===state.filters.condition)
      && (state.filters.storage==='همه'||getStorage(p)===state.filters.storage)
      && (state.filters.availability==='همه'||(state.filters.availability==='available'?!!p.available:!p.available))
      && (!min||price>=min) && (!max||price<=max);
  });
  if(state.sort==='priceAsc')list.sort((a,b)=>getEffectivePrice(a)-getEffectivePrice(b));
  else if(state.sort==='priceDesc')list.sort((a,b)=>getEffectivePrice(b)-getEffectivePrice(a));
  else if(state.sort==='name')list.sort((a,b)=>String(a.name).localeCompare(String(b.name),'fa'));
  else list.sort((a,b)=>Number(b.id)-Number(a.id));
  $('productsResult').textContent=`${list.length.toLocaleString('fa-IR')} محصول نمایش داده شد`;
  updateFilterCount();
  if(!list.length){$('productsGrid').innerHTML='<div class="loading">محصولی با این فیلترها پیدا نشد.</div>';return}
  $('productsGrid').innerHTML=list.map(p=>{
    const price=numeric(p.price),discount=numeric(p.discount_price),hasDiscount=discount>0&&discount<price;
    return `<article class="product-card ${p.available?'':'unavailable'}" onclick="openProductDetail(${p.id})">
      ${p.badge?`<span class="badge">${esc(p.badge)}</span>`:''}
      <button class="wish" onclick="event.stopPropagation();toast('قابلیت علاقه‌مندی به‌زودی اضافه می‌شود')">♡</button>
      <div class="product-image"><img src="${esc(imgUrl(p))}" alt="${esc(p.name)}" onerror="this.src='/assets/mr-mobile-logo.png'"></div>
      <div class="product-name">${esc(p.name)}</div>
      <div class="product-meta">${esc(p.condition||'نو')} · ${esc(getBrand(p.name))}${getStorage(p)!=='—'?' · '+esc(getStorage(p)):''}</div>
      <div class="price">${toman(hasDiscount?discount:price)} ${hasDiscount?`<del>${toman(price)}</del>`:''}</div>
      <button class="add-btn" ${p.available?'':'disabled'} onclick="event.stopPropagation();addToCart(${p.id})">${p.available?'افزودن به سبد خرید 🛒':'ناموجود'}</button>
    </article>`}).join('');
}
function syncProductSearch(v){state.search=v;const h=$('searchInput');if(h&&h.value!==v)h.value=v;renderProducts()}
function toggleAdvancedFilters(){$('advancedFilters').classList.toggle('hidden')}
function setAdvancedFilter(key,value){state.filters[key]=value;renderProducts()}
function setSort(value){state.sort=value;renderProducts()}
function clearAdvancedFilters(){state.filters={category:'همه',brand:'همه',condition:'همه',storage:'همه',availability:'همه',minPrice:'',maxPrice:''};['filterCategory','filterBrand','filterCondition','filterStorage','filterAvailability','filterMinPrice','filterMaxPrice'].forEach(id=>{if($(id))$(id).value=id==='filterMinPrice'||id==='filterMaxPrice'?'': 'همه'});state.category='همه';document.querySelectorAll('.filter').forEach(x=>x.classList.toggle('active',x.dataset.cat==='همه'));renderProducts()}
function updateFilterCount(){const f=state.filters;const n=Object.entries(f).filter(([k,v])=>v&&v!=='همه').length+(state.search?1:0);$('filterCount').textContent=n.toLocaleString('fa-IR')}
function setCategory(c){state.category=c;state.filters.category=c;const fc=$('filterCategory');if(fc)fc.value=c;document.querySelectorAll('.filter').forEach(x=>x.classList.toggle('active',x.dataset.cat===c));renderProducts();location.hash='products'}
function applyFilters(){state.search=$('searchInput').value;const ps=$('productSearch');if(ps)ps.value=state.search;renderProducts()}
$('searchInput').addEventListener('input',()=>{state.search=$('searchInput').value;const ps=$('productSearch');if(ps)ps.value=state.search;renderProducts()});

function esc(s){return String(s??'').replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[m]))}
let detailTouchX=0;
function initDetailSwipe(){const el=$('detailImage');if(!el||el.dataset.swipeReady)return;el.dataset.swipeReady='1';el.addEventListener('touchstart',e=>{detailTouchX=e.changedTouches[0].screenX},{passive:true});el.addEventListener('touchend',e=>{const dx=e.changedTouches[0].screenX-detailTouchX;if(Math.abs(dx)>45){dx<0?nextDetailImage():prevDetailImage()}},{passive:true});}
initDetailSwipe();

async function openProductDetail(id){
  const p=state.products.find(x=>Number(x.id)===Number(id)); if(!p)return;
  $('detailName').textContent=p.name||'محصول'; $('detailCondition').textContent=p.condition||'نو'; $('detailCategory').textContent=p.category||'موبایل';
  $('detailDesc').textContent=p.description||'برای این محصول توضیحی ثبت نشده است.'; $('detailDescriptionFull').textContent=p.description||'برای این محصول توضیحی ثبت نشده است.';
  const price=numeric(p.price),discount=numeric(p.discount_price),hasDiscount=discount>0&&discount<price;
  $('detailPrice').textContent=toman(hasDiscount?discount:price); $('detailOldPrice').textContent=hasDiscount?toman(price):''; $('detailDiscount').textContent=hasDiscount?Math.round((1-discount/price)*100)+'٪ تخفیف':'';
  $('detailStock').textContent=p.available?'● موجود در فروشگاه':'● ناموجود'; $('detailStock').className='detail-stock '+(p.available?'in':'out');
  const storage=getStorage(p); $('detailStorage').textContent=storage; $('detailStorage2').textContent=storage; $('detailCondition2').textContent=p.condition||'نو'; $('detailCondition3').textContent=p.condition||'نو'; $('detailCategory2').textContent=p.category||'موبایل';
  const urls=imageUrls(p); state.detailGallery={urls,index:0}; renderDetailGallery();
  const btn=$('detailAdd'); btn.disabled=!p.available; btn.textContent=p.available?'افزودن به سبد خرید 🛒':'ناموجود'; btn.onclick=()=>{if(p.available){addToCart(p.id);closeProductDetail();}};
  state.detailProductId=Number(id); setDetailTab('specs'); $('productDetailModal').classList.add('show'); await loadReviews(Number(id));
}
function setDetailTab(tab){state.detailTab=tab;document.querySelectorAll('.detail-tabs button').forEach(b=>b.classList.toggle('active',b.dataset.tab===tab));document.querySelectorAll('.detail-panel').forEach(x=>x.classList.toggle('hidden',x.dataset.panel!==tab))}
async function loadReviews(productId){const box=$('detailReviews');if(!box)return;box.innerHTML='<div class="loading">در حال دریافت نظرات...</div>';try{const d=await fetch('/api/products/'+productId+'/reviews').then(r=>r.json());const rows=Array.isArray(d)?d:[];box.innerHTML=`<div class="review-summary"><strong>${rows.length.toLocaleString('fa-IR')}</strong><span>نظر ثبت شده</span></div>`+(rows.length?rows.map(r=>`<article class="review-card"><div><b>${esc(r.user_name||'مشتری')}</b><span>${'★'.repeat(Number(r.rating)||5)}${'☆'.repeat(5-(Number(r.rating)||5))}</span></div><p>${esc(r.comment||'')}</p><small>${esc(r.created_at||'')}</small></article>`).join(''):'<div class="empty">هنوز نظری برای این محصول ثبت نشده است.</div>')+`<div class="review-form"><h4>نظر شما</h4><div class="review-stars">${[1,2,3,4,5].map(n=>`<button type="button" onclick="setReviewRating(${n})" data-rating="${n}">★</button>`).join('')}</div><textarea id="reviewText" placeholder="نظر خود را درباره این محصول بنویسید..."></textarea><button class="btn primary" onclick="submitReview(${productId})">ثبت نظر</button><small id="reviewMsg"></small></div>`;setReviewRating(5)}catch(e){box.innerHTML='<div class="empty">دریافت نظرات انجام نشد.</div>'}}
let reviewRating=5;function setReviewRating(n){reviewRating=n;document.querySelectorAll('.review-stars button').forEach(b=>b.classList.toggle('selected',Number(b.dataset.rating)<=n))}
async function submitReview(productId){const text=$('reviewText')?.value.trim();if(!text)return $('reviewMsg').textContent='متن نظر را وارد کنید.';try{const r=await fetch('/api/products/'+productId+'/reviews',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({rating:reviewRating,comment:text})});const d=await r.json();if(!r.ok)throw Error(d.error||'خطا');await loadReviews(productId);toast('نظر شما ثبت شد ✓')}catch(e){$('reviewMsg').textContent=e.message}}
function renderDetailGallery(){
  const g=state.detailGallery||{urls:['/assets/mr-mobile-logo.png'],index:0};
  const url=g.urls[g.index]||g.urls[0];
  const img=$('detailImage'); img.src=url; img.alt='تصویر محصول'; img.onerror=()=>{img.src='/assets/mr-mobile-logo.png'};
  $('detailGalleryCount').textContent=`${(g.index+1).toLocaleString('fa-IR')} / ${g.urls.length.toLocaleString('fa-IR')}`;
  const thumbs=$('detailThumbs');
  thumbs.innerHTML=g.urls.map((u,i)=>`<button class="detail-thumb ${i===g.index?'active':''}" onclick="setDetailImage(${i})"><img src="${esc(u)}" alt="تصویر ${i+1}" onerror="this.src='/assets/mr-mobile-logo.png'"></button>`).join('');
  $('detailPrev').style.display=g.urls.length>1?'grid':'none'; $('detailNext').style.display=g.urls.length>1?'grid':'none';
}
function setDetailImage(i){const g=state.detailGallery;if(!g)return;g.index=Math.max(0,Math.min(i,g.urls.length-1));renderDetailGallery()}
function nextDetailImage(){const g=state.detailGallery;if(!g||g.urls.length<2)return;g.index=(g.index+1)%g.urls.length;renderDetailGallery()}
function prevDetailImage(){const g=state.detailGallery;if(!g||g.urls.length<2)return;g.index=(g.index-1+g.urls.length)%g.urls.length;renderDetailGallery()}
function zoomDetailImage(){const src=$('detailImage').src; if(src)window.open(src,'_blank','noopener,noreferrer')}
function closeProductDetail(){$('productDetailModal').classList.remove('show')}
{$('productDetailModal').classList.remove('show');}

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
  state.pendingOrderItems=state.cart.map(x=>({product_id:x.id,quantity:x.qty,price:cartPrice(x)}));
  await openAddress();
}
async function openAddress(){
  $('addressError').textContent='';$('addressSubmit').disabled=false;
  try{const r=await fetch('/api/account/address');const d=await r.json();const a=d.address||{};
    $('addressFirstName').value=a.first_name||'';$('addressLastName').value=a.last_name||'';$('addressPhone').value=a.phone||state.user?.phone||'';$('addressProvince').value=a.province||'';$('addressCity').value=a.city||'';$('addressPostal').value=a.postal_code||'';$('addressText').value=a.address||'';
  }catch(e){$('addressPhone').value=state.user?.phone||''}
  $('addressModal').classList.add('show');
}
function closeAddress(){$('addressModal').classList.remove('show')}
async function submitAddressAndOrder(){
  const first=$('addressFirstName').value.trim(),last=$('addressLastName').value.trim(),phone=$('addressPhone').value.trim(),province=$('addressProvince').value.trim(),city=$('addressCity').value.trim(),postal=$('addressPostal').value.replace(/\D/g,''),address=$('addressText').value.trim();
  if(first.length<2||last.length<2||!/^09\d{9}$/.test(phone)||province.length<2||city.length<2||address.length<8||postal.length!==10)return $('addressError').textContent='لطفاً همه اطلاعات آدرس را صحیح و کامل وارد کنید.';
  $('addressSubmit').disabled=true;$('addressError').textContent='';
  try{
    const ar=await fetch('/api/account/address',{method:'PUT',headers:{'content-type':'application/json'},body:JSON.stringify({first_name:first,last_name:last,phone,province,city,address,postal_code:postal})});
    const ad=await ar.json();if(!ar.ok)throw Error(ad.error||'خطا در ذخیره آدرس');
    const r=await fetch('/api/orders',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({items:state.pendingOrderItems})});const d=await r.json();if(!r.ok)throw Error(d.error||'خطا در ثبت سفارش');
    state.pendingOrderItems=null;clearCart();closeAddress();toggleCart();toast('سفارش ثبت شد؛ حالا رسید پرداخت را ارسال کنید');openPayment(d.order_id,d.total);
  }catch(e){$('addressError').textContent=e.message;$('addressSubmit').disabled=false}
}

function openAuth(mode='login'){state.authMode=mode;$('authModal').classList.add('show');updateAuth()}
function closeAuth(){$('authModal').classList.remove('show')}
function switchAuth(){state.authMode=state.authMode==='login'?'register':'login';updateAuth()}
function updateAuth(){
  const reg=state.authMode==='register';$('authTitle').textContent=reg?'ساخت حساب کاربری':'ورود به حساب';$('authSub').textContent=reg?'برای ثبت سفارش یک حساب بسازید.':'برای ادامه وارد حساب کاربری شوید.';
  $('registerNameWrap').classList.toggle('hidden',!reg);$('authSubmit').textContent=reg?'ثبت نام':'ورود';$('authSwitch').textContent=reg?'حساب دارید؟ وارد شوید':'ثبت نام نکرده‌اید؟ ثبت نام کنید';$('authError').textContent='';
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
async function loadOrders(){const r=await fetch('/api/orders');if(!r.ok)return;const data=await r.json();$('ordersList').innerHTML='<h3>سفارش‌های من</h3>'+((data.orders||[]).map(o=>{const ship=o.tracking_code?`<div class="shipping-info"><b>📦 ارسال: ${esc(o.shipping_status||'ارسال شد')}</b><br><small>${esc(o.carrier||'شرکت حمل')} — کد رهگیری: <strong>${esc(o.tracking_code)}</strong></small><button class="btn ghost" onclick="navigator.clipboard?.writeText('${esc(o.tracking_code).replace(/'/g,"\'")}');toast('کد رهگیری کپی شد ✓')">کپی کد رهگیری</button></div>`:`<div class="shipping-info muted">📦 وضعیت ارسال: ${esc(o.shipping_status||'در انتظار ارسال')}</div>`;return `<div class="order"><b>سفارش #${o.id}</b> — <strong>${toman(o.total)}</strong><br><small>وضعیت سفارش: ${esc(o.status)} | پرداخت: ${esc(o.payment_status||'پرداخت نشده')} | ${esc(o.created_at)}</small>${ship}${(!o.payment_status||o.payment_status==='رد شده')&&o.status!=='لغو شده'?`<button class="btn ghost full" onclick="openPayment(${o.id},${Number(o.total)||0})">💳 ارسال رسید پرداخت</button>`:''}</div>`}).join('')||'<p style="color:#899">هنوز سفارشی ندارید.</p>')}
async function logout(){await fetch('/api/auth/logout',{method:'POST'});state.user=null;closeAccount();updateUser();toast('از حساب خارج شدید')}

async function openPayment(orderId,amount){
  if(!state.user)return openAuth('login');
  state.payment={orderId,amount:Number(amount)||0,receiptData:''};
  $('paymentOrderId').textContent='#'+fa(orderId);$('paymentAmount').textContent=toman(amount);$('paymentTracking').value='';$('receiptName').textContent='هنوز فایلی انتخاب نشده';$('receiptPreview').hidden=true;$('receiptPreview').src='';$('paymentError').textContent='';$('sendPaymentBtn').disabled=false;
  try{const st=await fetch('/api/payment-settings').then(r=>r.json());$('paymentBank').textContent=st.bank_name||'کارت فروشگاه';$('paymentCard').textContent=st.card_number||'شماره کارت هنوز تنظیم نشده';$('paymentHolder').textContent=st.card_holder?'به نام '+st.card_holder:'';$('paymentInstructions').textContent=st.instructions||'پس از کارت‌به‌کارت، شماره پیگیری و تصویر رسید را ارسال کنید.'}catch(e){$('paymentError').textContent='دریافت اطلاعات کارت انجام نشد.'}
  $('paymentModal').classList.add('show');
}
function closePayment(){$('paymentModal').classList.remove('show')}
function fa(n){return Number(n||0).toLocaleString('fa-IR')}
async function copyPaymentCard(){const raw=($('paymentCard').textContent||'').replace(/\D/g,'');if(!raw)return toast('شماره کارت تنظیم نشده است');try{await navigator.clipboard.writeText(raw);toast('شماره کارت کپی شد ✓')}catch{toast('کپی خودکار در این مرورگر در دسترس نیست')}}
function prepareReceipt(input){const file=input.files?.[0];if(!file)return;const ok=['image/jpeg','image/png','image/webp'].includes(file.type);if(!ok){$('paymentError').textContent='فقط JPG، PNG یا WEBP قابل قبول است.';input.value='';return}const reader=new FileReader();reader.onload=()=>{const img=new Image();img.onload=()=>{const max=1100,scale=Math.min(1,max/Math.max(img.width,img.height));const c=document.createElement('canvas');c.width=Math.max(1,Math.round(img.width*scale));c.height=Math.max(1,Math.round(img.height*scale));c.getContext('2d').drawImage(img,0,0,c.width,c.height);const data=c.toDataURL('image/jpeg',.68);if(data.length>1700000){$('paymentError').textContent='تصویر هنوز بزرگ است؛ لطفاً عکس ساده‌تری انتخاب کنید.';return}state.payment.receiptData=data;$('receiptName').textContent=file.name;$('receiptPreview').src=data;$('receiptPreview').hidden=false;$('paymentError').textContent=''};img.src=reader.result};reader.readAsDataURL(file)}
async function submitPaymentReceipt(){const tracking=$('paymentTracking').value.trim();if(!tracking)return $('paymentError').textContent='شماره پیگیری را وارد کنید.';if(!state.payment.receiptData)return $('paymentError').textContent='تصویر رسید را انتخاب کنید.';$('sendPaymentBtn').disabled=true;try{const r=await fetch('/api/orders/'+state.payment.orderId+'/payment',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({tracking_code:tracking,receipt_data:state.payment.receiptData})});const d=await r.json();if(!r.ok)throw Error(d.error||'خطا در ارسال رسید');closePayment();toast('رسید با موفقیت برای بررسی ارسال شد ✓');if($('accountModal')?.classList.contains('show'))loadOrders()}catch(e){$('paymentError').textContent=e.message;$('sendPaymentBtn').disabled=false}}

const infoPages={
 faq:{title:'سوالات متداول',icon:'❓',html:`<div class="info-list"><details open><summary>چطور سفارش ثبت کنم؟</summary><p>محصول را به سبد خرید اضافه کنید، وارد حساب کاربری شوید، آدرس را ثبت کنید و سفارش را نهایی کنید.</p></details><details><summary>پرداخت سفارش چگونه انجام می‌شود؟</summary><p>پس از ثبت سفارش، اطلاعات کارت فروشگاه نمایش داده می‌شود. سپس شماره پیگیری و تصویر رسید را ارسال کنید.</p></details><details><summary>کد رهگیری را از کجا ببینم؟</summary><p>بعد از ارسال سفارش، کد رهگیری در حساب کاربری و جزئیات سفارش شما نمایش داده می‌شود.</p></details></div>`},
 returns:{title:'شرایط بازگشت کالا',icon:'↩️',html:`<div class="info-text"><p>برای درخواست بازگشت، ابتدا با فروشگاه تماس بگیرید تا شرایط سفارش بررسی شود.</p><ul><li>کالا باید در شرایط اولیه و همراه متعلقات تحویل داده شود.</li><li>در صورت وجود ایراد یا مغایرت، موضوع را در اولین فرصت اطلاع دهید.</li><li>شرایط بازگشت ممکن است با توجه به نوع کالا و وضعیت آن متفاوت باشد.</li></ul><p class="info-note">شرایط نهایی بازگشت هنگام بررسی سفارش به مشتری اعلام می‌شود.</p></div>`},
 privacy:{title:'حریم خصوصی',icon:'🔒',html:`<div class="info-text"><p>اطلاعاتی که هنگام ثبت‌نام، سفارش و ارسال وارد می‌کنید فقط برای ارائه خدمات فروشگاه و پیگیری سفارش استفاده می‌شود.</p><ul><li>اطلاعات حساب کاربری محرمانه نگهداری می‌شود.</li><li>اطلاعات آدرس برای پردازش و ارسال سفارش استفاده می‌شود.</li><li>اطلاعات پرداخت و رسید فقط برای بررسی سفارش استفاده می‌شود.</li></ul></div>`},
 terms:{title:'قوانین و مقررات',icon:'📋',html:`<div class="info-text"><ul><li>ثبت سفارش به معنی پذیرش اطلاعات و قیمت نمایش‌داده‌شده در زمان خرید است.</li><li>پرداخت کارت‌به‌کارت پس از بررسی رسید توسط مدیریت تأیید می‌شود.</li><li>زمان و روش ارسال با توجه به سفارش و شرایط ارسال تعیین می‌شود.</li><li>در صورت نیاز به اطلاعات بیشتر، پشتیبانی فروشگاه پاسخ‌گو خواهد بود.</li></ul></div>`}
};
function openInfo(key){const p=infoPages[key];if(!p)return;$('infoTitle').textContent=p.title;$('infoIcon').textContent=p.icon;$('infoContent').innerHTML=p.html;$('infoModal').classList.add('show')}
function closeInfo(){$('infoModal').classList.remove('show')}

function cleanNewsletterField(){const el=$('newsletterEmail');if(el && el.value && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(el.value.trim())) el.value=''}
if(document.readyState==='loading') document.addEventListener('DOMContentLoaded',cleanNewsletterField); else cleanNewsletterField();
function subscribe(){const e=$('newsletterEmail').value.trim();if(!e)return toast('ایمیل را وارد کنید');if(!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e))return toast('لطفاً یک ایمیل معتبر وارد کنید');toast('ایمیل شما ثبت شد 🌱');$('newsletterEmail').value=''}

loadProducts();loadMe();renderCart();
