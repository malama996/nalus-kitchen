# Deployment checklist

## Supabase

- Create a new Supabase project.
- Apply `supabase/migrations/20261006000000_production_schema.sql`.
- Apply `supabase/seed.sql` only for initial menu/demo data. Remove demo transactions before launch.
- Create the first owner account in Supabase Auth and insert its UUID into `public.user_roles` as `admin`, or run the bootstrap script.
- Verify Storage bucket `menu-photos` exists after migration.
- Confirm Auth email settings and redirect URL for the management login.

## Cloudflare

- Connect the repository.
- Set Node 22 for the build environment.
- Set `VITE_SUPABASE_URL` and `VITE_SUPABASE_PUBLISHABLE_KEY` in the build environment.
- Run `npm run deploy:cloudflare` or use the Git build.
- Add a custom domain and TLS.
- Add rate limiting/WAF rules for `/track` and abuse-prone public endpoints.

## Netlify

- Set `DEPLOY_TARGET=netlify` for the build.
- Set `VITE_SUPABASE_URL` and `VITE_SUPABASE_PUBLISHABLE_KEY`.
- Build command: `DEPLOY_TARGET=netlify npm run build`.
- Publish directory: `dist/client`.
- Deploy using the Netlify CLI or Git integration.

## Smoke tests

1. Public visitor can load menu.
2. Visitor can place a pickup order.
3. Visitor can place a delivery order.
4. Visitor cannot alter the total by editing browser requests.
5. Visitor can submit a catering request.
6. Customer can track an order with the order number and phone.
7. Wrong phone/order combination returns no data.
8. Unauthenticated visitor cannot read orders/bookings.
9. Authenticated non-staff cannot read orders/bookings.
10. Staff can update operational status.
11. Staff cannot delete orders/bookings.
12. Admin can delete orders/bookings and manage menu.
13. Menu changes propagate through Realtime.
14. Management URL is not linked from the public site and is `noindex`.
15. Refreshing management routes does not produce a 404 on the chosen host.

## Flutterwave secrets

For online payments also configure:

```text
FLW_SECRET_KEY
FLW_WEBHOOK_SECRET_HASH
```

Cloudflare Workers secrets can be configured with `wrangler secret put`; do not place Flutterwave secrets in `wrangler.jsonc` or any `VITE_*` variable. Cloudflare supports accessing Worker secrets through `process.env` when Node compatibility/process environment population is enabled. See the official Cloudflare secrets/environment-variable guidance.

Register this Flutterwave webhook after deployment:

```text
https://YOUR_DOMAIN/api/payments/webhook
```

The application callback is:

```text
https://YOUR_DOMAIN/payment/callback
```
