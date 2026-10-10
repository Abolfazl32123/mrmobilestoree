Mr Mobile V152

Fix: About Us (#about) section now renders as a stable full-width premium card so clicking the About link no longer leaves a large broken-looking empty area. No product, admin, inventory, sale, login, or support logic changed.

V153: fixed main navigation anchors. Navigation links now use controlled offset-aware smooth scrolling, sticky-nav safe spacing, and active-state synchronization. No product/admin logic changed.

V154: Special offers now show 5 cards per desktop slide; additional discounted products continue on horizontal slides with arrows and dots. Tablet/mobile use 2 cards per slide.

V155: the main products section now paginates into a slider with 5 products per desktop slide and 2 on mobile, with arrows/dots; filters/sorting remain dynamic.

V156: both product and special-offers sliders auto-advance every 3 seconds and loop.

V158: mobile-only special-offers card sizing and newsletter/about spacing. Desktop styles untouched.

## بازیابی رمز عبور با ایمیل (V186)
برای ارسال کد بازیابی، این نسخه از Resend API در سمت Worker استفاده می‌کند. کلیدها را در Cloudflare Worker > Settings > Variables and Secrets تنظیم کنید:
- `RESEND_API_KEY` (Secret): کلید API از Resend
- `EMAIL_FROM` (Text): فرستنده تأییدشده در Resend، مانند `MR Mobile <no-reply@your-verified-domain.com>`

دامنه فرستنده باید در Resend تأیید شده باشد. Cloudflare Email Routing فقط برای دریافت ایمیل است و به‌تنهایی ارسال ایمیل انجام نمی‌دهد. سپس Worker را Deploy کنید.

کاربران جدید هنگام ثبت‌نام باید ایمیل وارد کنند. کاربران قدیمی باید پس از ورود، از بخش «حساب کاربری» ایمیل خود را ذخیره کنند تا بتوانند رمز را از طریق آن بازیابی کنند. کد ۶ رقمی ۱۰ دقیقه اعتبار دارد؛ تعداد درخواست و تلاش برای جلوگیری از سوءاستفاده محدود شده است.
