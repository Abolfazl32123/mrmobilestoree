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
