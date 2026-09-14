# آقای موبایل — فروشگاه + پنل مدیریت

این پروژه برای Cloudflare Workers ساخته شده و شامل:
- فروشگاه عمومی
- پنل مدیریت در `/admin`
- ذخیره محصولات در Cloudflare D1
- آپلود تصاویر در Cloudflare R2
- احراز هویت با رمز مدیریت و کوکی HttpOnly
- اتصال GitHub به Cloudflare برای Deploy خودکار

## راه‌اندازی

1. یک D1 Database با نام `mr-mobile-products` بساز.
2. یک R2 Bucket با نام `mr-mobile-images` بساز.
3. شناسه D1 را در `wrangler.json` جایگزین `PASTE_D1_DATABASE_ID_HERE` کن.
4. migration را اجرا کن:
   `npx wrangler d1 migrations apply mr-mobile-products --remote`
5. دو secret بساز:
   `npx wrangler secret put ADMIN_PASSWORD`
   `npx wrangler secret put ADMIN_SECRET`
   برای ADMIN_SECRET یک رشته تصادفی و طولانی استفاده کن.
6. Deploy کن.
7. سایت: `/`
8. پنل: `/admin`

## نکته
برای GitHub/Cloudflare Workers Builds، secretهای بالا را داخل GitHub commit نکن. Cloudflare می‌تواند repository را به Worker متصل کند و با هر push به branch انتخابی، deploy خودکار انجام دهد.
