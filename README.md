# Nalu’s Kitchen — production application

Independent production-ready version of the Nalu’s Kitchen restaurant ordering and catering system. The Lovable-specific runtime/editor hooks have been removed.

## Stack

- React 19 + TypeScript
- TanStack Start + TanStack Router
- Supabase Auth + PostgreSQL + Realtime + Storage
- PostgreSQL RLS for authorization
- Cloudflare Workers (primary) or Netlify (supported)
- Vite + Tailwind CSS

## Architecture

Browser → TanStack Start → Supabase Data API/Auth → PostgreSQL/RLS

The public website can read available menu items and call two narrowly scoped database RPCs: `place_order` and `create_booking`. Customers cannot directly insert or update orders/bookings. Staff access is protected by Supabase Auth plus database role checks. The management URL is intentionally not linked from the public website and is `/_control-room`-style private functionality in the source; obscurity is not relied on for security.

## Local setup

1. Install Node.js 22+.
2. Copy `.env.example` to `.env` and set the public Supabase variables.
3. Create/link a Supabase project.
4. Run the SQL migration in `supabase/migrations/`.
5. Run `supabase/seed.sql` for demo/initial menu data. Do not use the demo orders in production.
6. Create the first Auth user with the Supabase dashboard or run `npm run bootstrap:admin` with `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `ADMIN_EMAIL`, and `ADMIN_PASSWORD`.
7. `npm install`
8. `npm run dev`

## Production deployment

### Cloudflare Workers (recommended)

```bash
npm install
npm run build
npm run deploy:cloudflare
```

Set `VITE_SUPABASE_URL` and `VITE_SUPABASE_PUBLISHABLE_KEY` in the **build environment** used to run Vite. Do not put a Supabase secret/service-role key in a VITE variable.

### Netlify

```bash
npm install
DEPLOY_TARGET=netlify npm run build
npx netlify deploy --prod
```

Set the same public environment variables in Netlify.

## Security controls

- RLS on all application tables.
- No first-user self-claim admin flow.
- No public direct INSERT on orders/bookings.
- Server/database calculates order totals from current menu prices.
- Admin/staff authorization is enforced in PostgreSQL, not merely hidden in React.
- Admin route is not linked from the customer UI and is `noindex`.
- Uploaded menu images are restricted to staff and validated client-side before upload.
- Tracking requires order number + phone and should be protected by host-level rate limiting/WAF in production.
- Supabase secret/service-role credentials never belong in browser environment variables.

## Important operational items before launch

1. Configure a real Supabase custom SMTP sender if customer/staff email is required.
2. Configure Cloudflare/Netlify rate limiting for `/track` and the public RPC endpoints.
3. Configure database backups/PITR according to the chosen Supabase plan.
4. Replace the seeded demo menu/pricing with the restaurant’s verified production menu.
5. Confirm the mobile-money merchant/account details before enabling live payments.
6. Test the complete checkout → staff status update → tracking workflow against the production Supabase project before DNS cutover.

See `docs/DEPLOYMENT.md` and `docs/SECURITY-AUDIT.md`.

## Flutterwave payments

Online checkout is integrated with Flutterwave Standard. Customers can be redirected to Flutterwave for the payment methods enabled on the merchant account, including the supported Zambian mobile-money option and card checkout.

Required server secrets:

```text
FLW_SECRET_KEY
FLW_WEBHOOK_SECRET_HASH
```

Webhook:

```text
POST /api/payments/webhook
```

Customer payment callback:

```text
GET /payment/callback
```

Read `docs/FLUTTERWAVE.md` before enabling live payments.
