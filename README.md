# Mr Mobile V187 — Order and payment workflow refinement

Based on V186. This release keeps the existing checkout and receipt-upload flow while refining order visibility:
- Customer order history shows only orders with a submitted payment receipt or a successfully paid online gateway transaction.
- Admin orders list includes both receipt-submitted orders and successfully paid online orders.
- Successful online gateway payments are reflected as approved in customer/admin payment status.
- Dashboard order/revenue statistics exclude unpaid checkout drafts and include receipt-submitted or successfully paid orders.
- Existing email password recovery, stock, Enamad, product image, navigation, and design changes are preserved.

Deploy this ZIP to the existing `mrmobilestoree` Cloudflare Worker. No database migration or new secret is required for these changes.
