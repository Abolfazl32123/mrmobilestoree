# آقای موبایل — نسخه حرفه‌ای بدون R2

این نسخه برای Cloudflare Workers + D1 ساخته شده و به R2 نیاز ندارد.

## امکانات
- طراحی RTL مدرن و حرفه‌ای با تم مشکی/سبز
- هدر فروشگاهی، جستجو و دسته‌بندی
- کارت محصولات و افزودن به سبد خرید
- سبد خرید با LocalStorage
- ثبت‌نام و ورود مشتری
- حساب کاربری و تاریخچه سفارش‌ها
- ثبت سفارش در D1
- پنل مدیریت قبلی برای افزودن/ویرایش/حذف محصولات
- تصویر محصول با «لینک مستقیم عکس»
- استفاده از لوگوی موجود در `/public/assets/mr-mobile-logo.png`
- نام Worker روی `mrmobilestoree` تنظیم شده تا با Worker فعلی هماهنگ باشد.

## استقرار
GitHub را به Worker فعلی متصل نگه دارید و با هر Commit، Build اجرا می‌شود.

## D1
Database ID در `wrangler.json` قرار داده شده است.
جدول‌های کاربران و سفارش‌ها در اولین استفاده نیز به صورت خودکار ساخته می‌شوند؛ فایل migration `0002_users_orders.sql` هم برای اجرای دستی موجود است.

## متغیرهای محیطی
در Cloudflare برای Worker این دو Secret را نگه دارید:
- `ADMIN_PASSWORD`
- `ADMIN_SECRET`

R2 در این نسخه استفاده نمی‌شود.


V9: homepage sections for featured, bestseller, sale and new products; admin controls added.
