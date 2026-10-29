# Mr Mobile V187 — Order and payment workflow refinement

Based on V186. This release keeps the existing checkout and receipt-upload flow while refining order visibility:
- Customer order history shows only orders with a submitted payment receipt or a successfully paid online gateway transaction.
- Admin orders list includes both receipt-submitted orders and successfully paid online orders.
- Successful online gateway payments are reflected as approved in customer/admin payment status.
- Dashboard order/revenue statistics exclude unpaid checkout drafts and include receipt-submitted or successfully paid orders.
- Existing email password recovery, stock, Enamad, product image, navigation, and design changes are preserved.

Deploy this ZIP to the existing `mrmobilestoree` Cloudflare Worker. No database migration or new secret is required for these changes.


## V193 category image layout
- Category artwork uses consistent contain framing, responsive card dimensions, and dark-theme blending to reduce visible image backplates without cropping products.
- Preserves category links and existing app behavior.


V196: refined transparent category artwork by trimming transparent padding and normalizing image canvas dimensions; category image area adjusted responsively. Original V195 archive preserved separately.


V197 category artwork refinement: transparent category assets cropped to visible artwork bounds, improved sizing and responsive image placement.


## V200 — Product color variants
- Product admin supports per-color stock using lines: `نام رنگ | #hex | موجودی`.
- Storefront displays selectable color swatches and disables unavailable colors.
- Selected color is kept in cart and order items; backend validates and decrements per-color stock.
- Color column is added lazily to existing `order_items` tables.

## V201 update
- Fixed the admin product editor: the color-stock textarea expected by the existing V200 JavaScript is now present, preventing `openProductForm()` from failing before the modal opens.
- Added explicit button types and repaired the nested label structure around product quantity/availability controls.
- Added a smooth eased return-to-top animation for the footer link, with reduced-motion support.
- Preserved the V200 color options and inventory data format.


## Product image upload note
- Original image files up to 10 MiB each are accepted in the admin UI.
- Images are resized/compressed in the browser before sending to the Worker so JSON requests remain small enough for the D1-backed product record.
- Combined stored data URLs are capped at 1,200,000 characters. This is a post-compression/storage limit, not a limit on the original selected file.
