# Security audit and remediation

## Findings in the original Lovable export

### Critical — first signed-in user could claim admin
The original migration exposed `claim_staff_access()`, allowing the first authenticated account to create the first admin role. This is unsafe on a public deployment because anyone who reaches the application first could become the owner. **Removed.**

### High — browser-controlled order totals
The original checkout inserted `items` and `total` directly from the browser. A malicious caller could change the JSON payload and total. **Remediated:** `place_order()` accepts item IDs and quantities, reads current prices from PostgreSQL, calculates the total server-side, and stores an immutable order snapshot.

### High — public direct writes to orders/bookings
The original RLS allowed anonymous inserts. **Remediated:** direct table inserts are revoked; narrowly scoped RPCs create the records after validation.

### Medium — management UI was discoverable
The original footer linked to `/auth` and `/staff`. **Remediated:** public links removed; management route changed to a private control-room path and marked noindex. This is only an operational concealment measure; authorization is still enforced by Auth/RLS.

### Medium — tracking enumeration
Order tracking uses order number + phone. This is not a perfect secret because order numbers are sequential. **Mitigation:** strict lookup matching plus host-level rate limiting/WAF is required.

### Medium — unrestricted image uploads
The original client accepted arbitrary image types/sizes. The new client caps image size and allows common raster formats; storage policies still require staff role.

### Low — Lovable telemetry/editor hooks
Lovable-specific runtime error reporting and editor configuration were removed so the application owns its runtime and deployment path.

## Additional production hardening

- Use MFA for the owner/admin account.
- Never put `SUPABASE_SERVICE_ROLE_KEY` in browser variables.
- Enable Supabase database backups/PITR as appropriate.
- Keep Supabase Auth redirect URLs exact.
- Use a custom SMTP sender for reliable transactional email if email features are added.
- Monitor failed authentication, RPC errors and unusual order activity.
