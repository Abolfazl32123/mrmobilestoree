# MR Mobile V94 – Premium Customer Login

این نسخه ظاهر صفحه ورود مشتری را حرفه‌ای‌تر می‌کند و زیرساخت واقعی ورود با Google و Apple را اضافه می‌کند.

## Google OAuth Secrets در Cloudflare
- GOOGLE_CLIENT_ID
- GOOGLE_CLIENT_SECRET

Redirect URI:
`https://mrmobilestoree.mrstore.workers.dev/api/auth/google/callback`

## Apple Sign in Secrets در Cloudflare
- APPLE_CLIENT_ID (Services ID)
- APPLE_TEAM_ID
- APPLE_KEY_ID
- APPLE_PRIVATE_KEY (کلید خصوصی .p8، به‌صورت Secret)

Redirect URI:
`https://mrmobilestoree.mrstore.workers.dev/api/auth/apple/callback`

تا وقتی این Secretها تنظیم نشوند، دکمه‌های Google/Apple عمداً پیام «هنوز تنظیم نشده است» می‌دهند و هیچ اطلاعات جعلی یا ورود ساختگی انجام نمی‌شود.


## V96 — Customer Login UI Refinement
- Refined customer login modal layout to match the premium reference design.
- Fixed desktop column sizing/alignment and RTL/LTR grid interaction.
- Preserved existing phone/password authentication and Google/Apple button handlers.
- Improved responsive behavior for tablet/mobile.


V97: login layout rebuilt to match supplied reference image; desktop two-column fixed layout with no auth scrollbar, functional right-side form, responsive mobile fallback.
