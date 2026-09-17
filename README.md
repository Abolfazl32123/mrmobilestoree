MR MOBILE STORE — V57

V57 adds timed product discounts and special offers.
- Admin product form: discount price + start/end time.
- Customer storefront: only active timed discounts are applied.
- Countdown shown on sale cards and product detail.
- Special Offers section appears automatically when timed sales are active.
- Server calculates the effective sale price when an order is created.
- Existing inventory, coupons, banners, users, notifications and payment features are preserved.

Deploy the full project as usual. The Worker also auto-adds the new product columns if the migration has not been applied manually.


## V58 — Payment Gateway Ready
- Online payment flow is prepared for Zarinpal and Zibal.
- Customer can be redirected from the payment modal when the gateway is enabled.
- Callback and server-side verification are handled by the Worker.
- Successful gateway payment updates the order to `تأیید شده` and creates an admin notification.
- Gateway credentials are intended to be stored as Cloudflare Worker Secrets, not GitHub files.
- Secret names: `ZARINPAL_MERCHANT_ID` or `ZIBAL_MERCHANT_ID`.
- Current card-to-card payment remains available as a fallback.
- When credentials are obtained: add the corresponding Worker Secret, select the provider in Admin → Payments, enable online payment, and test with the provider's test/live credentials as applicable.
