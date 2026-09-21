# MR Mobile V136
Fixes:
- Public product API no longer hides out-of-stock products; they remain visible with ناموجود overlay.
- Inventory is consistently read from stock_qty.
- Admin product form sends stock_qty correctly (legacy quantity is also accepted by backend).
- Editing a product now loads stock_qty correctly.
- Product availability is synchronized with stock quantity.
- Checkout uses stock_qty and preserves legacy products that are marked available but have a zero stock field.
- Product cards/detail/add-to-cart/availability filter now use stock_qty consistently.
