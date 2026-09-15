V35 - Robust product loading fix.
- Product GET endpoint now dynamically selects only columns that exist in D1, preventing schema mismatch from breaking /api/products.
- Client validates HTTP/JSON response and disables browser caching for product loads.
- No products, orders, users, or D1 data are deleted.
