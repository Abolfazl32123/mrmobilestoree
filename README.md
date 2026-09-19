# MR MOBILE STORE — V110

Homepage polish based on V109.

- Category artwork uses the dedicated category SVG artwork.
- Featured products uses a stable RTL two-column layout: fixed-width promotion card + five-column real product grid on desktop.
- Empty product state no longer causes the promotion card or grid to stretch unexpectedly.
- No fake products are injected; product cards come from `/api/products` / the store database.
- Existing header, hero, authentication and Google OAuth flow are preserved.
