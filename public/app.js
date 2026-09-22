const state={products:[],category:'همه',search:'',cart:JSON.parse(localStorage.getItem('mr_cart')||'[]'),compare:JSON.parse(localStorage.getItem('mr_compare')||'[]'),favorites:JSON.parse(localStorage.getItem('mr_favorites')||'[]'),authMode:'login',user:null,payment:{orderId:null,amount:0,receiptData:''},coupon:{code:'',discount:0},pendingOrderItems:null,filters:{category:'همه',brand:'همه',condition:'همه',storage:'همه',availability:'همه',minPrice:'',maxPrice:''},sort:'newest'};

const $=id=>document.getElementById(id);
function numeric(v){
  const fa='۰۱۲۳۴۵۶۷۸۹', ar='٠١٢٣٤٥٦٧٨٩';
  return Number(String(v??'').replace(/[۰-۹]/g,c=>fa.indexOf(c)).replace(/[٠-٩]/g,c=>ar.indexOf(c)).replace(/[^0-9.-]/g,''))||0;
}
function imageUrls(p){
  const raw=String(p?.image_url||'').trim();
  const list=raw.split(/\r?\n|\|/).map(x=>x.trim()).filter(Boolean);
  if(p?.image_key && !list.length) list.push('/assets/'+String(p.image_key).replace(/^\/+/,''));
  return list.length?list:['/assets/mr-mobile-logo.png'];
}
function imgUrl(p){return imageUrls(p)[0]}
const toman=n=>Number(n||0).toLocaleString('fa-IR')+' تومان';
// Customer-facing toast notifications are intentionally disabled.
const toast=()=>{};
function saveCart(){localStorage.setItem('mr_cart',JSON.stringify(state.cart));renderCart();}
function isFavorite(id){return state.favorites.includes(Number(id))}
function saveFavorites(){
  state.favorites=[...new Set(state.favorites.map(Number).filter(Number.isFinite))];
  localStorage.setItem('mr_favorites',JSON.stringify(state.favorites));
  updateFavoriteCount();
}
function updateFavoriteCount(){const el=$('favoriteCount');if(el)el.textContent=String(state.favorites.length)}
function toggleFavorite(id){
  const n=Number(id); if(!Number.isFinite(n))return;
  state.favorites=isFavorite(n)?state.favorites.filter(x=>Number(x)!==n):[...state.favorites,n];
  saveFavorites(); updateFavoriteButtons(n);
  toast(isFavorite(n)?'به علاقه‌مندی‌ها اضافه شد ❤️':'از علاقه‌مندی‌ها حذف شد');
  if($('favoritesModal')?.classList.contains('show'))renderFavorites();
}
function updateFavoriteButtons(id){
  const active=isFavorite(id);
  document.querySelectorAll(`[data-favorite-id="${id}"]`).forEach(b=>{
    b.classList.toggle('active',active); b.textContent=active?'♥':'♡';
    b.setAttribute('aria-pressed',active?'true':'false');
    b.title=active?'حذف از علاقه‌مندی‌ها':'افزودن به علاقه‌مندی‌ها';
  });
  const detail=$('detailFavorite');
  if(detail && Number(state.detailProductId)===Number(id)){detail.classList.toggle('active',active);detail.textContent=active?'♥ در علاقه‌مندی':'♡ علاقه‌مندی'}
}
function renderFavorites(){
  const box=$('favoritesList'); if(!box)return;
  const favs=state.favorites.map(Number);
  const items=state.products.filter(p=>favs.includes(Number(p.id)));
  if(!items.length){box.innerHTML='<div class="favorites-empty"><div>♡</div><p>هنوز محصولی به علاقه‌مندی‌ها اضافه نکرده‌اید.</p><button class="btn primary" onclick="closeFavorites();location.hash="products"">مشاهده محصولات</button></div>';return}
  box.innerHTML='<div class="favorites-grid">'+items.map(p=>`<article class="favorite-item"><button class="favorite-remove" onclick="toggleFavorite(${Number(p.id)})">×</button><button type="button" class="compare-btn detail-compare" data-detail-compare onclick="toggleCompareProduct(product.id)">مقایسه</button><button class="favorite-open" onclick="closeFavorites();openProductDetail(${Number(p.id)})"><img src="${esc(imgUrl(p))}" alt="${esc(p.name)}" onerror="this.src='/assets/mr-mobile-logo.png'"><div><b>${esc(p.name)}</b><span>${toman(cartPrice(p))}</span></div></button></article>`).join('')+'</div>';
}
function openFavorites(){renderFavorites();$('favoritesModal')?.classList.add('show')}
function closeFavorites(){$('favoritesModal')?.classList.remove('show')}

function productSpecs(p){try{return typeof p?.specs==='string'?JSON.parse(p.specs||'{}'):(p?.specs||{})}catch{return {}}}

function getEffectivePrice(p){const price=numeric(p.price),discount=numeric(p.discount_price);if(!(discount>0&&discount<price))return price;const now=Date.now(),start=p.sale_start_at?Date.parse(p.sale_start_at):null,end=p.sale_end_at?Date.parse(p.sale_end_at):null;return (!start||now>=start)&&(!end||now<=end)?discount:price}
function saleRemaining(p){if(!p?.sale_end_at)return 0;const end=Date.parse(p.sale_end_at);const start=p.sale_start_at?Date.parse(p.sale_start_at):null;const now=Date.now();const discount=numeric(p.discount_price),price=numeric(p.price);if(!(discount>0&&discount<price)|| (start&&now<start)|| now>end)return 0;return Math.max(0,end-now)}
function formatCountdown(ms){let sec=Math.floor(ms/1000);const d=Math.floor(sec/86400);sec%=86400;const h=Math.floor(sec/3600);sec%=3600;const m=Math.floor(sec/60);sec%=60;return `${d?d+'روز ':''}${String(h).padStart(2,'0')}:${String(m).padStart(2,'0')}:${String(sec).padStart(2,'0')}`}
function updateSaleTimers(){document.querySelectorAll('[data-sale-end]').forEach(el=>{const end=Number(el.dataset.saleEnd);const ms=Math.max(0,end-Date.now());if(ms<=0){el.remove();return}el.textContent=formatCountdown(ms)})}
setInterval(updateSaleTimers,1000);
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
function renderSpecialOffers(){const wrap=$('specialOffers'),grid=$('specialOffersGrid');if(!wrap||!grid)return;const items=state.products.filter(p=>getEffectivePrice(p)<numeric(p.price)&&saleRemaining(p)>0).slice(0,4);if(!items.length){wrap.hidden=true;return}wrap.hidden=false;grid.innerHTML=items.map(p=>{const price=numeric(p.price),effective=getEffectivePrice(p),remain=saleRemaining(p),pct=Math.max(1,Math.round((1-effective/price)*100));return `<article class="offer-card" onclick="openProductDetail(${p.id})"><div class="offer-img"><img src="${esc(imgUrl(p))}" alt="${esc(p.name)}"></div><div class="offer-body"><span class="offer-badge">${pct}٪ تخفیف</span><h3>${esc(p.name)}</h3><div class="offer-price"><strong>${toman(effective)}</strong><del>${toman(price)}</del></div><div class="sale-countdown" data-sale-end="${Date.now()+remain}">${formatCountdown(remain)}</div></div></article>`}).join('');updateSaleTimers()}
async function loadHomepageBanners(){try{const r=await fetch('/api/homepage-banners',{cache:'no-store'});if(!r.ok)return;const list=await r.json();const b=list[0];if(!b)return;if($('heroTitle'))$('heroTitle').textContent=b.title||'فراتر از یک موبایل‌فروشی.';if($('heroSubtitle'))$('heroSubtitle').textContent=b.subtitle||'تکنولوژی برای سبک زندگی تو.';if($('heroButton')){$('heroButton').textContent=b.button_text||'مشاهده محصولات';$('heroButton').href=b.button_link||'#products'}}catch(e){}}
async function loadProducts(){
  try{
    const r=await fetch('/api/products',{cache:'no-store'});
    const raw=await r.text();
    if(!r.ok) throw new Error('HTTP '+r.status+' '+raw.slice(0,180));
    const data=JSON.parse(raw);
    if(!Array.isArray(data)) throw new Error('پاسخ محصولات معتبر نیست');
    state.products=data;populateAdvancedFilters();renderProducts();renderSpecialOffers();
  }catch(e){
    console.error('loadProducts failed',e);
    const grid=$('productsGrid');
    if(grid) grid.innerHTML='<div class="loading">خطا در دریافت محصولات. لطفاً صفحه را یک‌بار تازه‌سازی کنید.</div>';
  }
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

function getCompareList(){
  try{return JSON.parse(localStorage.getItem('mr_compare')||'[]')}catch{return[]}
}
function isCompared(id){return getCompareList().some(x=>String(x.id)===String(id))}
function toggleCompareProduct(id){
  const list=getCompareList(), i=list.findIndex(x=>String(x.id)===String(id));
  const product=(window.products||products||[]).find(x=>String(x.id)===String(id));
  if(i>=0) list.splice(i,1);
  else if(product) list.push(product);
  localStorage.setItem('mr_compare',JSON.stringify(list.slice(-4)));
  document.querySelectorAll(`[data-compare-id="${id}"]`).forEach(b=>{
    b.classList.toggle('active',isCompared(id));
    b.textContent=isCompared(id)?'✓ مقایسه شد':'مقایسه';
  });
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
      && (state.filters.availability==='همه'||(state.filters.availability==='available'?Number(p.quantity??p.stock_qty??(p.available?1:0))>0:Number(p.quantity??p.stock_qty??(p.available?1:0))<=0))
      && (!min||price>=min) && (!max||price<=max);
  });
  if(state.sort==='priceAsc')list.sort((a,b)=>getEffectivePrice(a)-getEffectivePrice(b));
  else if(state.sort==='priceDesc')list.sort((a,b)=>getEffectivePrice(b)-getEffectivePrice(a));
  else if(state.sort==='name')list.sort((a,b)=>String(a.name).localeCompare(String(b.name),'fa'));
  else list.sort((a,b)=>Number(b.id)-Number(a.id));
  $('productsResult').textContent=`${list.length.toLocaleString('fa-IR')} محصول نمایش داده شد`;
  updateFilterCount();
  if(!list.length){$('productsGrid').innerHTML='<div class="products-empty-state"><div class="empty-icon">📦</div><strong>محصولی برای نمایش پیدا نشد</strong><span>محصولات واقعی فروشگاه از پنل مدیریت این بخش نمایش داده می‌شوند.</span></div>';return}
  $('productsGrid').innerHTML=list.map(p=>{
    const price=numeric(p.price),discount=numeric(p.discount_price),effective=getEffectivePrice(p),hasDiscount=effective<price; const remain=saleRemaining(p); const stockQty=Math.max(0,Number(p.quantity??p.stock_qty??(p.available?1:0))||0); const inStock=stockQty>0;
    return `<article class="product-card ${inStock?'':'unavailable'}" onclick="openProductDetail(${p.id})">
      ${p.badge?`<span class="badge">${esc(p.badge)}</span>`:''}
      <button class="wish ${isFavorite(p.id)?'active':''}" data-favorite-id="${p.id}" aria-pressed="${isFavorite(p.id)?'true':'false'}" title="${isFavorite(p.id)?'حذف از علاقه‌مندی‌ها':'افزودن به علاقه‌مندی‌ها'}" onclick="event.stopPropagation();toggleFavorite(${p.id})">${isFavorite(p.id)?'♥':'♡'}</button>
      <div class="product-image"><img src="${esc(imgUrl(p))}" alt="${esc(p.name)}" onerror="this.src='/assets/mr-mobile-logo.png'"></div>
      <div class="product-name">${esc(p.name)}</div>
      <div class="product-meta">${esc(p.condition||'نو')} · ${esc(getBrand(p.name))}${getStorage(p)!=='—'?' · '+esc(getStorage(p)):''}</div>
      <div class="product-bottom"><div class="price">${toman(effective)} ${hasDiscount?`<del>${toman(price)}</del>`:''}</div><div class="stock-mini ${inStock?'in':'out'}">${inStock?`● موجود · ${stockQty.toLocaleString('fa-IR')} عدد`:'● ناموجود'}</div><button class="add-btn" aria-label="افزودن به سبد خرید" title="افزودن به سبد خرید" ${inStock?'':'disabled'} onclick="event.stopPropagation();addToCart(${p.id})">${inStock?'🛒':'×'}</button></div>${remain?`<div class="sale-countdown" data-sale-end="${Date.now()+remain}">${formatCountdown(remain)}</div>`:''}
      <button class="compare-btn ${isCompared(p.id)?'active':''}" data-compare-id="${p.id}" onclick="event.stopPropagation();toggleCompare(${p.id})">${isCompared(p.id)?'✓ حذف از مقایسه':'⚖ مقایسه'}</button>
    </article>`}).join('');
}
function syncProductSearch(v){state.search=v;const h=$('searchInput');if(h&&h.value!==v)h.value=v;renderProducts()}
function toggleAdvancedFilters(){$('advancedFilters').classList.toggle('hidden')}
function setAdvancedFilter(key,value){state.filters[key]=value;renderProducts()}
function setSort(value){state.sort=value;renderProducts()}
function clearAdvancedFilters(){state.filters={category:'همه',brand:'همه',condition:'همه',storage:'همه',availability:'همه',minPrice:'',maxPrice:''};['filterCategory','filterBrand','filterCondition','filterStorage','filterAvailability','filterMinPrice','filterMaxPrice'].forEach(id=>{if($(id))$(id).value=id==='filterMinPrice'||id==='filterMaxPrice'?'': 'همه'});state.category='همه';document.querySelectorAll('.filter').forEach(x=>x.classList.toggle('active',x.dataset.cat==='همه'));renderProducts()}
function updateFilterCount(){const f=state.filters;const n=Object.entries(f).filter(([k,v])=>v&&v!=='همه').length+(state.search?1:0);$('filterCount').textContent=n.toLocaleString('fa-IR')}
function setCategory(c){state.category=c;state.filters.category=c;const fc=$('filterCategory');if(fc)fc.value=c;document.querySelectorAll('.filter').forEach(x=>x.classList.toggle('active',x.dataset.cat===c));renderProducts();location.hash="products"}
function applyFilters(){state.search=$('searchInput').value;const ps=$('productSearch');if(ps)ps.value=state.search;renderProducts()}
$('searchInput').addEventListener('input',()=>{state.search=$('searchInput').value;const ps=$('productSearch');if(ps)ps.value=state.search;renderProducts()});

function esc(s){return String(s??'').replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[m]))}
let detailTouchX=0;
function initDetailSwipe(){const el=$('detailImage');if(!el||el.dataset.swipeReady)return;el.dataset.swipeReady='1';el.addEventListener('touchstart',e=>{detailTouchX=e.changedTouches[0].screenX},{passive:true});el.addEventListener('touchend',e=>{const dx=e.changedTouches[0].screenX-detailTouchX;if(Math.abs(dx)>45){dx<0?nextDetailImage():prevDetailImage()}},{passive:true});}
initDetailSwipe();

window.openProductDetail=async function openProductDetail(id){
  const p=state.products.find(x=>Number(x.id)===Number(id)); if(!p)return;
  $('detailName').textContent=p.name||'محصول'; $('detailCondition').textContent=p.condition||'نو'; $('detailCategory').textContent=p.category||'موبایل';
  $('detailDesc').textContent=p.description||'برای این محصول توضیحی ثبت نشده است.'; $('detailDescriptionFull').textContent=p.description||'برای این محصول توضیحی ثبت نشده است.';
  const price=numeric(p.price),discount=numeric(p.discount_price),effective=getEffectivePrice(p),hasDiscount=effective<price;
  $('detailPrice').textContent=toman(effective); $('detailOldPrice').textContent=hasDiscount?toman(price):''; $('detailDiscount').textContent=hasDiscount?Math.round((1-effective/price)*100)+'٪ تخفیف':''; const detailTimer=$('detailSaleCountdown'); if(detailTimer){const rem=saleRemaining(p);detailTimer.dataset.saleEnd=rem?String(Date.now()+rem):'';detailTimer.textContent=rem?'⏳ '+formatCountdown(rem):'';detailTimer.hidden=!rem}
  const detailQty=Math.max(0,Number(p.quantity??p.stock_qty??(p.available?1:0))||0); const detailInStock=detailQty>0; $('detailStock').textContent=detailInStock?`● موجود در فروشگاه · ${detailQty.toLocaleString('fa-IR')} عدد موجود`:'● ناموجود'; $('detailStock').className='detail-stock '+(detailInStock?'in':'out');
  const sp=productSpecs(p);
  const storage=sp.storage||getStorage(p); const stockQty=detailQty;
  const storageEl=$('detailStorage');
  const memoryBox=$('detailStorageBox');
  const isMobileCategory=(p.category||'موبایل')==='موبایل';
  if(storageEl)storageEl.textContent=isMobileCategory?storage:'—';
  if(memoryBox)memoryBox.style.display=isMobileCategory?'':'none';
  const quick=$('detailQuick');
  if(quick)quick.classList.toggle('single',!isMobileCategory);
  $('detailCondition2').textContent=p.condition||'نو';
  const detailSpecConfig={
    'موبایل':[['batteryHealth','سلامت باتری'],['appearance','وضعیت ظاهری'],['registry','رجیستری'],['simCount','تعداد سیم‌کارت'],['ram','RAM'],['storage','حافظه داخلی'],['color','رنگ'],['processor','پردازنده'],['accessories','لوازم همراه'],['warranty','گارانتی']],
    'لوازم جانبی':[['compatibility','سازگاری'],['connection','نوع اتصال'],['material','جنس'],['power','توان / ظرفیت'],['length','طول'],['color','رنگ'],['model','مدل / نسخه'],['accessories','لوازم همراه'],['warranty','گارانتی']],
    'تبلت':[['display','اندازه صفحه‌نمایش'],['os','سیستم‌عامل'],['ram','RAM'],['processor','پردازنده'],['battery','ظرفیت باتری'],['simCount','تعداد سیم‌کارت'],['camera','دوربین'],['color','رنگ'],['warranty','گارانتی']],
    'ساعت هوشمند':[['display','نوع / اندازه نمایشگر'],['os','سیستم‌عامل'],['connection','اتصال'],['battery','باتری'],['waterResistance','مقاومت در برابر آب'],['sensors','حسگرها'],['size','اندازه / بند'],['color','رنگ'],['accessories','لوازم همراه'],['warranty','گارانتی']],
    'هدفون':[['type','نوع'],['connection','اتصال'],['battery','شارژدهی'],['noiseCancel','حذف نویز'],['microphone','میکروفون'],['driver','درایور'],['compatibility','سازگاری'],['color','رنگ'],['warranty','گارانتی']],
    'اسپیکر':[['power','توان خروجی'],['connection','اتصال'],['battery','باتری / شارژدهی'],['waterResistance','مقاومت در برابر آب'],['inputs','درگاه‌ها / ورودی‌ها'],['weight','وزن'],['dimensions','ابعاد'],['color','رنگ'],['warranty','گارانتی']],
    'کابل و شارژر':[['type','نوع محصول'],['connector','نوع کانکتور'],['power','توان خروجی'],['length','طول کابل'],['fastCharge','شارژ سریع'],['compatibility','سازگاری'],['material','جنس'],['color','رنگ'],['warranty','گارانتی']]
  };
  const specRows=detailSpecConfig[p.category||'موبایل']||detailSpecConfig['لوازم جانبی'];
  const box=$('detailSpecsRows');
  if(box){
    const rows=[['دسته‌بندی',p.category||'موبایل'],['وضعیت',stockQty>0?'موجود':'ناموجود'],['تعداد موجودی',String(stockQty)],...specRows.map(([k,l])=>[l,sp[k]||'ثبت نشده'])];
    box.innerHTML=rows.map(([l,v])=>`<div class="spec-row"><span>${esc(l)}</span><b>${esc(v)}</b></div>`).join('');
  }
  const urls=imageUrls(p); state.detailGallery={urls,index:0}; renderDetailGallery();
  const btn=$('detailAdd'); btn.disabled=!detailInStock; btn.textContent=detailInStock?'افزودن به سبد خرید 🛒':'ناموجود'; btn.onclick=()=>{if(detailInStock){addToCart(p.id);closeProductDetail();}};
  state.detailProductId=Number(id); updateFavoriteButtons(Number(id)); const fav=$('detailFavorite'); if(fav){fav.classList.toggle('active',isFavorite(id));fav.textContent=isFavorite(id)?'♥ در علاقه‌مندی':'♡ علاقه‌مندی';} const cmp=$('detailCompare'); if(cmp){cmp.classList.toggle('active',isCompared(id));cmp.textContent=isCompared(id)?'✓ حذف از مقایسه':'⚖ مقایسه';} setDetailTab('specs'); $('productDetailModal').classList.add('show'); await loadReviews(Number(id));
}
function setDetailTab(tab){state.detailTab=tab;document.querySelectorAll('.detail-tabs button').forEach(b=>b.classList.toggle('active',b.dataset.tab===tab));document.querySelectorAll('.detail-panel').forEach(x=>x.classList.toggle('hidden',x.dataset.panel!==tab))}
async function loadReviews(productId){const box=$('detailReviews');if(!box)return;box.innerHTML='<div class="loading">در حال دریافت نظرات...</div>';try{const d=await fetch('/api/products/'+productId+'/reviews').then(r=>r.json());const rows=Array.isArray(d)?d:[];box.innerHTML=`<div class="review-summary"><div class="review-summary-dot"></div><strong>${rows.length.toLocaleString('fa-IR')}</strong><span>نظر ثبت شده</span></div>`+(rows.length?rows.map(r=>`<article class="review-card"><div><b>${esc(r.user_name||'مشتری')}</b><span>${'★'.repeat(Number(r.rating)||5)}${'☆'.repeat(5-(Number(r.rating)||5))}</span></div><p>${esc(r.comment||'')}</p><small>${esc(r.created_at||'')}</small></article>`).join(''):'<div class="review-empty"><strong>هنوز نظری برای این محصول ثبت نشده است.</strong><span>اولین نفری باشید که تجربه‌تان را با دیگران به اشتراک می‌گذارد.</span></div>')+`<div class="review-form review-form-modern"><div class="review-form-head"><div><h4>نظر شما</h4><p>تجربه خود را از این محصول با دیگران به اشتراک بگذارید.</p></div><div class="review-help"><span class="review-help-icon">💬</span><div><b>نظر شما برای ما ارزشمند است</b><small>با ثبت نظر، به انتخاب بهتر کاربران دیگر کمک می‌کنید.</small></div></div></div><div class="review-rating-row"><div class="review-stars">${[1,2,3,4,5].map(n=>`<button type="button" onclick="setReviewRating(${n})" data-rating="${n}" aria-label="${n} ستاره">★</button>`).join('')}</div><span class="review-rating-hint">روی ستاره‌ها کلیک کنید</span></div><div class="review-text-wrap"><span class="review-pencil">✎</span><textarea id="reviewText" maxlength="500" placeholder="نظر خود را درباره این محصول بنویسید..."></textarea></div><div class="review-form-footer"><small id="reviewCount">۰ / ۵۰۰</small><div><small id="reviewMsg"></small><button class="btn primary review-submit" onclick="submitReview(${productId})">ثبت نظر <span>➤</span></button></div></div></div>`;setReviewRating(5);const rt=$('reviewText');if(rt){const sync=()=>{const c=$('reviewCount');if(c)c.textContent=`${rt.value.length.toLocaleString('fa-IR')} / ۵۰۰`;};rt.addEventListener('input',sync);sync();}}catch(e){box.innerHTML='<div class="empty">دریافت نظرات انجام نشد.</div>'}}
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

function setCategory(c){state.category=c;document.querySelectorAll('.filter').forEach(x=>x.classList.toggle('active',x.dataset.cat===c));renderProducts();location.hash="products"}
function applyFilters(){state.search=$('searchInput').value;renderProducts()}
$('searchInput').addEventListener('input',()=>{state.search=$('searchInput').value;renderProducts()});

function saveCompare(){state.compare=[...new Set((state.compare||[]).map(Number).filter(Number.isFinite))].slice(0,3);localStorage.setItem('mr_compare',JSON.stringify(state.compare));updateCompareUI()}
function isCompared(id){return (state.compare||[]).includes(Number(id))}
function updateCompareUI(){const c=$('compareCount');if(c)c.textContent=(state.compare||[]).length.toLocaleString('fa-IR');document.querySelectorAll('[data-compare-id]').forEach(b=>{const a=isCompared(b.dataset.compareId);b.classList.toggle('active',a);b.textContent=a?'✓ حذف از مقایسه':'⚖ مقایسه'});const d=$('detailCompare');if(d&&state.detailProductId!=null){const a=isCompared(state.detailProductId);d.classList.toggle('active',a);d.textContent=a?'✓ حذف از مقایسه':'⚖ مقایسه'}}
function toggleCompare(id){const n=Number(id);if(!Number.isFinite(n))return;if(isCompared(n)){state.compare=state.compare.filter(x=>Number(x)!==n);saveCompare();return}if(state.compare.length>=3)return;state.compare.push(n);saveCompare()}
function renderCompare(){const box=$('compareContent');if(!box)return;const items=(state.compare||[]).map(id=>state.products.find(p=>Number(p.id)===Number(id))).filter(Boolean);if(!items.length){box.innerHTML='<div class="compare-empty"><div>⚖️</div><h3>هنوز محصولی برای مقایسه انتخاب نشده</h3><p>از روی کارت محصولات، گزینه «مقایسه» را بزنید.</p></div>';return}const rows=[['قیمت',p=>{const price=numeric(p.price),d=numeric(p.discount_price);return toman(d>0&&d<price?d:price)}],['برند',p=>getBrand(p.name)],['دسته‌بندی',p=>p.category||'موبایل'],['وضعیت',p=>p.condition||'نو'],['حافظه',p=>productSpecs(p).storage||getStorage(p)],['سلامت باتری',p=>productSpecs(p).batteryHealth||'ثبت نشده'],['RAM',p=>productSpecs(p).ram||'ثبت نشده'],['پردازنده',p=>productSpecs(p).processor||'ثبت نشده'],['رجیستری',p=>productSpecs(p).registry||'ثبت نشده'],['تعداد سیم‌کارت',p=>productSpecs(p).simCount||'ثبت نشده'],['رنگ',p=>productSpecs(p).color||'ثبت نشده']];box.innerHTML='<div class="compare-table-wrap"><table class="compare-table"><thead><tr><th>مشخصات</th>'+items.map(p=>`<th><button class="compare-remove" onclick="toggleCompare(${Number(p.id)});renderCompare()">×</button><img src="${esc(imgUrl(p))}" alt=""><b>${esc(p.name)}</b></th>`).join('')+'</tr></thead><tbody>'+rows.map(([l,f])=>`<tr><td>${esc(l)}</td>`+items.map(p=>`<td>${esc(f(p))}</td>`).join('')+'</tr>').join('')+'</tbody></table></div><div class="compare-open-note">برای دیدن همه مشخصات، داخل جدول اسکرول کنید ↔️</div>';updateCompareUI()}
function openCompare(){
  const modal=$('compareModal');
  if(!modal)return;
  renderCompare();
  modal.classList.add('show');
  document.body.style.overflow='hidden';
}
function closeCompare(){
  const modal=$('compareModal');
  if(modal)modal.classList.remove('show');
  document.body.style.overflow='';
}


function addToCart(id){const p=state.products.find(x=>Number(x.id)===Number(id));const availableQty=Math.max(0,Number(p?.quantity??p?.stock_qty??(p?.available?1:0))||0);if(!p||availableQty<=0)return;const x=state.cart.find(i=>i.id===p.id);if(x){if(x.qty>=availableQty){toast(`حداکثر ${availableQty.toLocaleString('fa-IR')} عدد موجود است`);return;}x.qty++;x.price=getEffectivePrice(p)}else state.cart.push({id:p.id,qty:1,name:p.name,price:getEffectivePrice(p),image:imgUrl(p)});saveCart();toast('محصول به سبد خرید اضافه شد');toggleCart();}
function cartPrice(x){return Number(String(x.price).replace(/[^\d]/g,''))||0}
function renderCart(){
  const count=state.cart.reduce((a,x)=>a+x.qty,0), subtotal=state.cart.reduce((a,x)=>a+cartPrice(x)*x.qty,0), total=Math.max(0,subtotal-(state.coupon.discount||0));
  const cc=$('cartCount');if(cc)cc.textContent=count.toLocaleString('fa-IR');const ct=$('cartTotal');if(ct)ct.textContent=toman(total);const dt=$('drawerTotal');if(dt)dt.textContent=toman(total);
  $('cartItems').innerHTML=state.cart.length?state.cart.map(x=>`
  <div class="cart-row"><img src="${esc(x.image)}" onerror="this.src='/assets/mr-mobile-logo.png'"><div><h4>${esc(x.name)}</h4><small>${toman(cartPrice(x))}</small><div class="qty"><button onclick="changeQty(${x.id},-1)">−</button><b>${x.qty}</b><button onclick="changeQty(${x.id},1)">+</button></div></div><button class="remove" onclick="removeCart(${x.id})">حذف</button></div>`).join(''):'<div class="loading">سبد خرید شما خالی است.</div>';
}
function changeQty(id,d){const x=state.cart.find(i=>i.id===id);if(!x)return;x.qty+=d;if(x.qty<=0)state.cart=state.cart.filter(i=>i.id!==id);saveCart()}
function removeCart(id){state.cart=state.cart.filter(i=>i.id!==id);saveCart()}
function clearCart(){state.cart=[];saveCart()}
function toggleCart(){ $('cartDrawer').classList.toggle('open');$('drawerBackdrop').classList.toggle('show')}
async function applyCoupon(){const input=$('couponCode');const msg=$('couponMsg');if(!input)return;const code=input.value.trim();if(!code){state.coupon={code:'',discount:0};msg.textContent='';renderCart();return}const subtotal=state.cart.reduce((a,x)=>a+cartPrice(x)*x.qty,0);try{const r=await fetch('/api/coupons/validate',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({code,total:subtotal})});const d=await r.json();if(!r.ok)throw Error(d.error||'کد تخفیف نامعتبر است');state.coupon={code:code.toUpperCase(),discount:Number(d.discount)||0};msg.textContent=`تخفیف ${toman(state.coupon.discount)} اعمال شد ✓`;renderCart()}catch(e){state.coupon={code:'',discount:0};msg.textContent=e.message;renderCart()}}
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
    const r=await fetch('/api/orders',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({items:state.pendingOrderItems,coupon_code:state.coupon.code||''})});const d=await r.json();if(!r.ok)throw Error(d.error||'خطا در ثبت سفارش');
    state.pendingOrderItems=null;state.coupon={code:'',discount:0};clearCart();closeAddress();toggleCart();toast('سفارش ثبت شد؛ حالا رسید پرداخت را ارسال کنید');openPayment(d.order_id,d.total);
  }catch(e){$('addressError').textContent=e.message;$('addressSubmit').disabled=false}
}

function openAuth(mode='login'){$('authModal').classList.add('show');setAuthMode(mode)}
function closeAuth(){$('authModal').classList.remove('show')}
function setAuthMode(mode){state.authMode=mode;updateAuth()}
function switchAuth(){setAuthMode(state.authMode==='login'?'register':'login')}
function updateAuth(){const reg=state.authMode==='register';$('authTitle').textContent=reg?'ساخت حساب کاربری':'ورود به حساب';$('authSub').textContent=reg?'برای ثبت سفارش یک حساب بسازید.':'برای ادامه وارد حساب کاربری خود شوید.';$('registerNameWrap').classList.toggle('hidden',!reg);$('authSubmit').textContent=reg?'ساخت حساب کاربری →':'ورود به حساب کاربری →';$('authSwitch').textContent=reg?'حساب دارید؟ وارد شوید':'ثبت نام نکرده‌اید؟ ثبت نام کنید';$('authLoginTab')?.classList.toggle('active',!reg);$('authRegisterTab')?.classList.toggle('active',reg);$('authError').textContent=''}
function toggleAuthPassword(){const x=$('authPassword');x.type=x.type==='password'?'text':'password'}
function authRecovery(){$('authError').textContent='برای بازیابی رمز عبور، فعلاً با پشتیبانی تماس بگیرید.'}
function socialLogin(provider){$('authError').textContent='در حال اتصال امن...';location.href='/api/auth/'+provider+'/start'}
async function submitAuth(){
  const phone=$('authPhone').value.trim(),password=$('authPassword').value;
  if(!phone||!password)return $('authError').textContent='شماره موبایل و رمز عبور را وارد کنید.';
  const body={phone,password};if(state.authMode==='register')body.name=$('authName').value.trim();
  const r=await fetch('/api/auth/'+state.authMode,{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify(body)}),d=await r.json();
  if(!r.ok)return $('authError').textContent=d.error||'خطا';
  state.user=d.user;closeAuth();updateUser();toast(state.authMode==='register'?'حساب با موفقیت ساخته شد':'خوش آمدید');
}
async function loadMe(){const r=await fetch('/api/auth/me');const d=await r.json();state.user=d.user||null;updateUser()}
function updateUser(){const el=$('userLabel');if(!el)return;el.textContent=state.user?`حساب کاربری / ${state.user.name||'کاربر'}`:'ثبت نام / ورود'}
async function openAccount(){
  if(!state.user)return openAuth('login');
  $('accountModal').classList.add('show');$('accountInfo').innerHTML=`<div class="account-info"><b>${esc(state.user.name||'کاربر')}</b><br><small>${esc(state.user.phone)}</small></div>`;loadOrders();
}
function closeAccount(){$('accountModal').classList.remove('show')}
async function loadOrders(){const r=await fetch('/api/orders');if(!r.ok)return;const data=await r.json();$('ordersList').innerHTML='<h3>سفارش‌های من</h3>'+((data.orders||[]).map(o=>{const payment=o.payment_status||'پرداخت نشده';const rejected=payment==='رد شده';const ship=rejected?`<div class="shipping-info muted rejected-shipping">❌ وضعیت ارسال: متوقف شد — علت: رسید پرداخت رد شده است.</div>`:o.tracking_code?`<div class="shipping-info"><b>📦 ارسال: ${esc(o.shipping_status||'ارسال شد')}</b><br><small>${esc(o.carrier||'شرکت حمل')} — کد رهگیری: <strong>${esc(o.tracking_code)}</strong></small><button class="btn ghost" onclick="navigator.clipboard?.writeText('${esc(o.tracking_code).replace(/'/g,"\'")}');toast('کد رهگیری کپی شد ✓')">کپی کد رهگیری</button></div>`:`<div class="shipping-info muted">📦 وضعیت ارسال: ${esc(o.shipping_status||'در انتظار ارسال')}</div>`;return `<div class="order"><b>سفارش #${o.id}</b> — <strong>${toman(o.total)}</strong><br><small>وضعیت سفارش: <b>${esc(o.status)}</b> | پرداخت: <b class="payment-state ${rejected?'rejected':payment==='تأیید شده'?'approved':''}">${esc(payment)}</b> | ${esc(o.created_at)}</small>${ship}${rejected?`<div class="shipping-info muted">💳 برای این سفارش رسید جدید ارسال کنید تا دوباره بررسی شود.</div>`:''}${(!o.payment_status||rejected)&&o.status!=='در حال ارسال'&&o.status!=='تکمیل شده'?`<button class="btn ghost full" onclick="openPayment(${o.id},${Number(o.total)||0})">💳 ${rejected?'ارسال مجدد رسید پرداخت':'ارسال رسید پرداخت'}</button>`:''}</div>`}).join('')||'<p style="color:#899">هنوز سفارشی ندارید.</p>')}
async function logout(){await fetch('/api/auth/logout',{method:'POST'});state.user=null;closeAccount();updateUser();toast('از حساب خارج شدید')}

async function openPayment(orderId,amount){
  if(!state.user)return openAuth('login');
  state.payment={orderId,amount:Number(amount)||0,receiptData:''};
  $('paymentOrderId').textContent='#'+fa(orderId);$('paymentAmount').textContent=toman(amount);$('paymentTracking').value='';$('receiptName').textContent='هنوز فایلی انتخاب نشده';$('receiptPreview').hidden=true;$('receiptPreview').src='';$('paymentError').textContent='';$('sendPaymentBtn').disabled=false;
  try{const st=await fetch('/api/payment-settings').then(r=>r.json());$('paymentBank').textContent=st.bank_name||'کارت فروشگاه';$('paymentCard').textContent=st.card_number||'شماره کارت هنوز تنظیم نشده';$('paymentHolder').textContent=st.card_holder?'به نام '+st.card_holder:'';$('paymentInstructions').textContent=st.instructions||'پس از کارت‌به‌کارت، شماره پیگیری و تصویر رسید را ارسال کنید.';const online=!!st.gateway_enabled&&!!st.gateway_provider;$('onlinePayBtn').hidden=!online;$('onlinePayBtn').textContent=online?('💳 پرداخت آنلاین با '+(st.gateway_provider==='zarinpal'?'زرین‌پال':st.gateway_provider==='zibal'?'زیبال':'درگاه آنلاین')):'💳 پرداخت آنلاین'}catch(e){$('paymentError').textContent='دریافت اطلاعات کارت انجام نشد.'}
  $('paymentModal').classList.add('show');
}
async function startOnlinePayment(){const btn=$('onlinePayBtn');btn.disabled=true;btn.textContent='در حال انتقال به درگاه...';$('paymentError').textContent='';try{const r=await fetch('/api/gateway/create',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({order_id:state.payment.orderId})});const d=await r.json();if(!r.ok)throw Error(d.error||'شروع پرداخت آنلاین ناموفق بود.');if(!d.url)throw Error('آدرس درگاه دریافت نشد.');location.href=d.url}catch(e){$('paymentError').textContent=e.message;btn.disabled=false;btn.textContent='💳 پرداخت آنلاین'}}
function closePayment(){$('paymentModal').classList.remove('show')}
function fa(n){return Number(n||0).toLocaleString('fa-IR')}
async function copyPaymentCard(){const raw=($('paymentCard').textContent||'').replace(/\D/g,'');if(!raw)return toast('شماره کارت تنظیم نشده است');try{await navigator.clipboard.writeText(raw);toast('شماره کارت کپی شد ✓')}catch{toast('کپی خودکار در این مرورگر در دسترس نیست')}}
function prepareReceipt(input){const file=input.files?.[0];if(!file)return;const ok=['image/jpeg','image/png','image/webp'].includes(file.type);if(!ok){$('paymentError').textContent='فقط JPG، PNG یا WEBP قابل قبول است.';input.value='';return}const reader=new FileReader();reader.onload=()=>{const img=new Image();img.onload=()=>{const max=1100,scale=Math.min(1,max/Math.max(img.width,img.height));const c=document.createElement('canvas');c.width=Math.max(1,Math.round(img.width*scale));c.height=Math.max(1,Math.round(img.height*scale));c.getContext('2d').drawImage(img,0,0,c.width,c.height);const data=c.toDataURL('image/jpeg',.68);if(data.length>1700000){$('paymentError').textContent='تصویر هنوز بزرگ است؛ لطفاً عکس ساده‌تری انتخاب کنید.';return}state.payment.receiptData=data;$('receiptName').textContent=file.name;$('receiptPreview').src=data;$('receiptPreview').hidden=false;$('paymentError').textContent=''};img.src=reader.result};reader.readAsDataURL(file)}
async function submitPaymentReceipt(){const tracking=$('paymentTracking').value.trim();if(!tracking)return $('paymentError').textContent='شماره پیگیری را وارد کنید.';if(!state.payment.receiptData)return $('paymentError').textContent='تصویر رسید را انتخاب کنید.';$('sendPaymentBtn').disabled=true;try{const r=await fetch('/api/orders/'+state.payment.orderId+'/payment',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({tracking_code:tracking,receipt_data:state.payment.receiptData})});const d=await r.json();if(!r.ok)throw Error(d.error||'خطا در ارسال رسید');closePayment();toast('رسید با موفقیت برای بررسی ارسال شد ✓');if($('accountModal')?.classList.contains('show'))loadOrders()}catch(e){$('paymentError').textContent=e.message;$('sendPaymentBtn').disabled=false}}

(function(){const q=new URLSearchParams(location.search);const result=q.get('payment');if(result){setTimeout(()=>{if(result==='success')toast('پرداخت آنلاین با موفقیت تأیید شد ✓');else if(result==='cancelled')toast('پرداخت لغو شد');else toast('پرداخت آنلاین ناموفق بود');history.replaceState({},'',location.pathname+location.hash)},400)}})();

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

loadProducts();loadMe();renderCart();updateFavoriteCount();updateCompareUI();
(()=>{const q=new URLSearchParams(location.search),err=q.get('auth_error');if(err){openAuth('login');$('authError').textContent=err;history.replaceState({},'',location.pathname)}})();

// V31: robust product-card click handling
document.addEventListener('click', (event)=>{
  const card=event.target.closest('.product-card');
  if(card && !event.target.closest('button')){
    const m=card.getAttribute('onclick')?.match(/openProductDetail\((\d+)\)/);
    if(m) window.openProductDetail(Number(m[1]));
  }
});
// V93: Premium customer support center (tickets / live chat / loyalty club)
let supportTicketId=null;
let supportActiveTab='tickets';
async function openSupportCenter(){
  if(!state.user)return openAuth('login');
  $('supportModal').classList.add('show');
  supportTab('tickets');
}
function closeSupportCenter(){$('supportModal').classList.remove('show')}
function supportTab(tab){
  supportActiveTab=tab;
  document.querySelectorAll('#supportModal .support-tabs button').forEach(b=>b.classList.toggle('active',b.dataset.tab===tab));
  const box=$('supportContent');
  if(!box)return;
  box.innerHTML='<div class="support-loading"><span></span><b>در حال بارگذاری...</b></div>';
  if(tab==='tickets') return renderSupportTickets();
  if(tab==='chat') return renderSupportChat();
  return renderLoyaltyClub();
}
function supportHeader(title,subtitle,icon){
  return `<div class="support-title-row"><div class="support-title-icon">${icon}</div><div><h3>${title}</h3><p>${subtitle}</p></div></div>`;
}
async function renderSupportTickets(){
  const box=$('supportContent');
  try{
    const rows=await fetch('/api/tickets').then(r=>r.json());
    const list=Array.isArray(rows)?rows:[];
    box.innerHTML=`
      ${supportHeader('تیکت‌های پشتیبانی','درخواستت را ثبت کن؛ سریع پیگیری می‌کنیم.','🎫')}
      <div class="support-new-ticket">
        <div class="support-section-head"><div><b>ثبت تیکت جدید</b><small>موضوع و درخواستت را کامل بنویس.</small></div><span>＋</span></div>
        <div class="support-form-grid">
          <label><span>موضوع تیکت</span><input id="ticketSubject" maxlength="160" placeholder="مثلاً پیگیری سفارش، مشکل محصول ..."></label>
          <label><span>اولویت</span><select id="ticketPriority"><option value="normal">عادی</option><option value="high">مهم</option></select></label>
        </div>
        <label class="support-field-wide"><span>شرح درخواست</span><textarea id="ticketMessage" maxlength="4000" placeholder="توضیحات کامل درخواست خود را بنویسید ..."></textarea></label>
        <button class="support-primary-btn" onclick="createTicket()"><span>ارسال تیکت</span><b>➤</b></button>
      </div>
      <div class="support-list-head"><b>تیکت‌های من</b><span>${fa(list.length)} مورد</span></div>
      <div class="support-ticket-list">${list.length?list.map(t=>`<button class="support-ticket-item" onclick="openTicket(${t.id})"><span class="ticket-icon">🎫</span><span class="ticket-main"><b>#${t.id} — ${esc(t.subject)}</b><small>${esc(t.created_at||'')} · ${t.priority==='high'?'مهم':'عادی'}</small></span><span class="ticket-status ${t.status==='closed'?'closed':''}">${t.status==='closed'?'بسته شده':'باز'}</span><span class="ticket-arrow">‹</span></button>`).join(''):`<div class="support-empty"><div>🎫</div><b>هنوز تیکتی ثبت نکرده‌اید</b><small>اگر سوال یا مشکلی دارید، اولین تیکت خود را ثبت کنید.</small></div>`}</div>`;
  }catch(e){box.innerHTML='<div class="support-empty"><div>⚠️</div><b>دریافت تیکت‌ها انجام نشد</b><small>لطفاً دوباره تلاش کنید.</small></div>'}
}
async function createTicket(){
  const subject=$('ticketSubject')?.value.trim(),message=$('ticketMessage')?.value.trim();
  if(!subject||!message)return toast('موضوع و متن تیکت را وارد کنید');
  const btn=document.querySelector('.support-primary-btn');if(btn)btn.disabled=true;
  try{
    const r=await fetch('/api/tickets',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({subject,message,priority:$('ticketPriority')?.value||'normal'})});
    const d=await r.json();if(!r.ok)throw Error(d.error||'خطا در ثبت تیکت');
    toast('تیکت با موفقیت ثبت شد ✓');supportTab('tickets');
  }catch(e){toast(e.message||'خطا در ثبت تیکت');if(btn)btn.disabled=false}
}
async function openTicket(id){
  supportTicketId=id;const box=$('supportContent');
  box.innerHTML='<div class="support-loading"><span></span><b>در حال دریافت گفتگو...</b></div>';
  try{
    const rows=await fetch('/api/tickets/'+id+'/messages').then(r=>r.json());
    const list=Array.isArray(rows)?rows:[];
    box.innerHTML=`<button class="support-back" onclick="supportTab('tickets')">→ بازگشت به تیکت‌ها</button>${supportHeader('تیکت #'+id,'گفتگو با تیم پشتیبانی','🎧')}<div class="support-thread">${list.map(x=>`<div class="support-message ${x.sender_type==='admin'?'from-admin':'from-user'}"><div class="support-message-label">${x.sender_type==='admin'?'پشتیبانی':'شما'} <small>${esc(x.created_at||'')}</small></div><p>${esc(x.message)}</p></div>`).join('')}</div><div class="support-reply"><textarea id="ticketReply" maxlength="4000" placeholder="پاسخ خود را بنویسید ..."></textarea><button class="support-send-btn" onclick="replyTicket()">➤</button></div>`;
  }catch(e){box.innerHTML='<div class="support-empty"><div>⚠️</div><b>تیکت پیدا نشد</b></div>'}
}
async function replyTicket(){
  const m=$('ticketReply')?.value.trim();if(!m)return;
  const r=await fetch('/api/tickets/'+supportTicketId+'/messages',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({message:m})});
  const d=await r.json().catch(()=>({}));if(!r.ok)return toast(d.error||'خطا');await openTicket(supportTicketId);toast('پیام ارسال شد ✓');
}
async function renderSupportChat(){
  const box=$('supportContent');
  try{
    const rows=await fetch('/api/account/chat').then(r=>r.json());
    const list=Array.isArray(rows)?rows:[];
    box.innerHTML=`${supportHeader('چت آنلاین','مستقیم با پشتیبانی در ارتباط باشید.','💬')}<div class="chat-online-pill"><span></span>پشتیبانی آنلاین است · پاسخ‌گویی در ساعات کاری</div><div class="support-chat-window">${list.length?list.map(x=>`<div class="support-message ${x.sender_type==='admin'?'from-admin':'from-user'}"><div class="support-message-label">${x.sender_type==='admin'?'پشتیبانی':'شما'} <small>${esc(x.created_at||'')}</small></div><p>${esc(x.message)}</p></div>`).join(''):`<div class="chat-welcome"><div class="chat-avatar">🎧</div><b>سلام! 👋</b><p>پیامتان را بنویسید؛ تیم پشتیبانی در اولین فرصت پاسخ می‌دهد.</p></div>`}</div><div class="support-reply"><textarea id="chatMessage" maxlength="3000" placeholder="پیام خود را بنویسید ..."></textarea><button class="support-send-btn" onclick="sendChatMessage()">➤</button></div>`;
  }catch(e){box.innerHTML='<div class="support-empty"><div>⚠️</div><b>چت در دسترس نیست</b><small>لطفاً دوباره تلاش کنید.</small></div>'}
}
async function sendChatMessage(){
  const m=$('chatMessage')?.value.trim();if(!m)return;
  const r=await fetch('/api/account/chat',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({message:m})});
  const d=await r.json().catch(()=>({}));if(!r.ok)return toast(d.error||'خطا در ارسال پیام');
  await renderSupportChat();toast('پیام ارسال شد ✓');
}
async function renderLoyaltyClub(){
  const box=$('supportContent');
  try{
    const d=await fetch('/api/account/advanced').then(r=>r.json());
    if(d.error)throw Error(d.error);
    const points=Number(d.points||0),wallet=Number(d.wallet||0),code=d.referral_code||'—';
    const goldAt=650,progress=Math.min(100,Math.round(points/goldAt*100));
    box.innerHTML=`${supportHeader('باشگاه مشتریان','با هر خرید، امتیاز بگیرید و از مزایای ویژه استفاده کنید.','👑')}<div class="loyalty-hero"><div class="loyalty-score"><div class="score-ring" style="--progress:${progress}%"><div><strong>${fa(points)}</strong><small>امتیاز شما</small></div></div></div><div class="loyalty-level"><span>سطح عضویت</span><b>⭐ ${points>=goldAt?'طلایی':'نقره‌ای'}</b><div class="loyalty-progress"><i style="width:${progress}%"></i></div><small>${points>=goldAt?'سطح طلایی فعال است':'تا سطح طلایی: '+fa(Math.max(0,goldAt-points))+' امتیاز'}</small></div><div class="loyalty-ref"><span>کد دعوت شما</span><b>${esc(code)}</b><button onclick="copyReferralCode('${esc(code)}')">کپی کد</button></div></div><div class="loyalty-benefits"><div><b>🎁</b><strong>تخفیف‌های ویژه</strong><small>پیشنهادهای اختصاصی اعضا</small></div><div><b>🪙</b><strong>جمع‌آوری امتیاز</strong><small>با خرید و فعالیت در فروشگاه</small></div><div><b>⭐</b><strong>ارتقای سطح</strong><small>مزایای بیشتر با امتیاز بالاتر</small></div></div><div class="loyalty-info"><div><span>موجودی کیف پول</span><b>${fa(wallet)} تومان</b></div><div><span>مزایای عضویت</span><b>فعال ✓</b></div></div><button class="loyalty-cta" onclick="supportTab('tickets')">مشاهده پشتیبانی و مزایا <span>←</span></button>`;
  }catch(e){box.innerHTML='<div class="support-empty"><div>👑</div><b>اطلاعات باشگاه دریافت نشد</b><small>لطفاً دوباره تلاش کنید.</small></div>'}
}
async function copyReferralCode(code){if(!code||code==='—')return;try{await navigator.clipboard.writeText(code);toast('کد دعوت کپی شد ✓')}catch{toast('کپی خودکار در این مرورگر در دسترس نیست')}}

