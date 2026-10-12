# Flutterwave production integration

Nalu's Kitchen uses Flutterwave Standard hosted checkout for online payments. The customer is redirected to Flutterwave, then the application verifies the transaction server-side before confirming the order.

## Supported flow

```text
Customer checkout
  -> Supabase place_order() calculates authoritative total
  -> POST /api/payments/initiate
  -> Flutterwave Standard hosted checkout
  -> card / mobilemoneyzambia (subject to account approval and availability)
  -> Flutterwave redirect /payment/callback
  -> server-side transaction verification
  -> Supabase payment_transactions + orders update

Flutterwave webhook
  -> POST /api/payments/webhook
  -> verify webhook secret
  -> re-query Flutterwave transaction
  -> validate tx_ref + amount + currency + status
  -> idempotent database state transition
```

## Required secrets

Set these only on the server/deployment environment:

```text
FLW_SECRET_KEY=...
FLW_WEBHOOK_SECRET_HASH=...
SUPABASE_URL=...
SUPABASE_SERVICE_ROLE_KEY=...
```

Never use `VITE_` on any secret. Never commit `.env`, `.dev.vars`, or production credentials.

## Flutterwave dashboard

Configure the webhook URL as:

```text
https://YOUR_DOMAIN/api/payments/webhook
```

Set the webhook secret hash to the same value as `FLW_WEBHOOK_SECRET_HASH`.

The customer redirect URL is generated automatically from the incoming request:

```text
https://YOUR_DOMAIN/payment/callback
```

## Going live

1. Complete Flutterwave KYC/account approval.
2. Confirm that ZMW and the desired payment methods are enabled for the merchant account.
3. Replace the test secret with the live secret.
4. Set a strong random webhook secret hash.
5. Register the production webhook URL.
6. Test one small real transaction.
7. Confirm the Flutterwave dashboard transaction, webhook, `payment_transactions` row and order's `payment_status = Verified` all agree.

## Security model

- The browser never supplies the authoritative payment amount to Flutterwave.
- PostgreSQL calculates the order total from current menu prices.
- The payment initiation endpoint reads the order total from Supabase using the service role.
- Webhook requests require the configured Flutterwave secret hash.
- Webhooks are not trusted as proof of payment; the transaction is re-queried from Flutterwave.
- The verified transaction reference, currency, amount and status are compared with the local payment ledger.
- `tx_ref` is unique, preventing duplicate payment records.
- Payment state transitions are idempotent through `apply_flutterwave_result`.
- The service role key is server-only.

## Failed/pending payments

A failed/cancelled/verification-failed payment does not mark the order paid. The order remains available to staff for reconciliation.

If a customer reports being debited while the application says failed/pending, **do not ask them to pay again immediately**. Search the payment ledger and Flutterwave dashboard first.

## Local testing

Use Flutterwave test mode and the test credentials supplied by Flutterwave. Configure a local webhook tunnel if the provider cannot reach localhost.

### Cloudflare Workers secret setup

```bash
npx wrangler secret put FLW_SECRET_KEY
npx wrangler secret put FLW_WEBHOOK_SECRET_HASH
npx wrangler secret put SUPABASE_URL
npx wrangler secret put SUPABASE_SERVICE_ROLE_KEY
```

Cloudflare supports Worker secrets through `process.env` when Node compatibility/process environment population is enabled; the project enables the relevant compatibility settings. Do not put any of these values in `wrangler.jsonc`. citeturn3search0turn3search1
