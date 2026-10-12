# Data/API matrix

The browser uses Supabase's Data API. There are no hidden application server credentials in the browser.

| Operation | Client | Protection | Purpose |
|---|---|---|---|
| `GET /rest/v1/menu_items` | public | RLS: `available = true` | Public menu |
| `POST /rest/v1/rpc/place_order` | public | Security-definer validation; direct order INSERT revoked | Customer checkout |
| `POST /rest/v1/rpc/create_booking` | public | Security-definer validation; direct booking INSERT revoked | Catering request |
| `POST /rest/v1/rpc/track_order` | public | Exact order-number + normalized-phone match | Customer tracking |
| `GET /rest/v1/orders` | authenticated | Admin/staff RLS | Control-room orders |
| `PATCH /rest/v1/orders` | authenticated | Admin/staff RLS | Status/payment updates |
| `DELETE /rest/v1/orders` | authenticated | Admin-only RLS | Remove records |
| `GET /rest/v1/bookings` | authenticated | Admin/staff RLS | Control-room bookings |
| `PATCH /rest/v1/bookings` | authenticated | Admin/staff RLS | Booking status |
| `DELETE /rest/v1/bookings` | authenticated | Admin-only RLS | Remove records |
| `GET/PATCH/POST /rest/v1/menu_items` | authenticated | Admin/staff RLS | Menu management |
| Storage menu photos | authenticated/public signed access | Storage policies + 5 MB/type limit | Dish photos |

## Important

The public checkout does **not** submit price or item names as trusted values. It submits menu item UUIDs and quantities. PostgreSQL resolves the current available menu price and creates the order snapshot.

## Flutterwave payment endpoints

| Operation | Client | Protection | Purpose |
|---|---|---|---|
| `POST /api/payments/initiate` | customer browser | Server-only Flutterwave secret; authoritative order loaded by UUID | Creates/reuses a Flutterwave hosted checkout link |
| `GET /payment/callback` | Flutterwave redirect | Server-side transaction verification | Verifies redirect result and sends customer to payment result page |
| `POST /api/payments/webhook` | Flutterwave | `verif-hash`/webhook secret + server-side transaction re-query | Processes asynchronous payment events |
| `GET /rest/v1/payment_transactions` | authenticated | Admin/staff RLS | Payment reconciliation dashboard |

The application never trusts the browser's payment amount. Flutterwave is given the amount read from the PostgreSQL order, and a transaction is only treated as paid after the server verifies the provider transaction reference, status, currency and amount.
