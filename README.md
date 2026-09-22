# MR MOBILE STORE — V110

Homepage polish based on V109.

- Category artwork uses the dedicated category SVG artwork.
- Featured products uses a stable RTL two-column layout: fixed-width promotion card + five-column real product grid on desktop.
- Empty product state no longer causes the promotion card or grid to stretch unexpectedly.
- No fake products are injected; product cards come from `/api/products` / the store database.
- Existing header, hero, authentication and Google OAuth flow are preserved.


V138 change: product-detail cart, favorite, and compare buttons are now equal-width, equal-height, and arranged in one row on mobile; only this button layout was changed.

V142: product detail action buttons kept equal-width; removed compare min-width and removed the primary cart button top margin so all three align cleanly.

V143: fixed admin product thumbnails to display the first saved product image instead of passing the multi-image newline string as a single src; added safe legacy URL parsing without breaking data URLs.
