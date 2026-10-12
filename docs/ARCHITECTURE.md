# Nalu’s Kitchen architecture

```text
Customer browser
  │
  ├── React/TanStack Start UI
  │     ├── Menu read
  │     ├── place_order RPC
  │     ├── create_booking RPC
  │     └── track_order RPC
  │
  └── Supabase Auth (management only)
          │
          ▼
Supabase Data API / Realtime / Storage
          │
          ▼
PostgreSQL
  ├── menu_items
  ├── orders
  ├── bookings
  ├── user_roles
  ├── business_settings
  ├── RLS policies
  └── security-definer validation RPCs

Hosting:
  Cloudflare Workers (primary)
  or Netlify (supported)
```

## Trust boundaries

1. The browser is untrusted. It may display prices but cannot define the authoritative order total.
2. Supabase Auth identifies staff users.
3. PostgreSQL RLS decides whether staff may read/update/delete records.
4. Public RPCs are the only customer write path.
5. Storage policies control menu-photo access.
6. Hosting/WAF provides rate limiting and edge protection.
