create extension if not exists pgcrypto;

create schema if not exists private;

create type public.app_role as enum ('admin', 'staff');
create type public.order_status as enum ('New', 'Confirmed', 'Preparing', 'Ready', 'Delivered', 'Cancelled');
create type public.booking_status as enum ('Pending', 'Confirmed', 'Completed', 'Cancelled');
create type public.payment_status as enum ('Cash due', 'Awaiting verification', 'Verified', 'Not received');

create table public.user_roles (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  role public.app_role not null,
  created_at timestamptz not null default now(),
  unique (user_id, role)
);

create table public.business_settings (
  key text primary key,
  value text not null,
  updated_at timestamptz not null default now()
);

create table public.menu_items (
  id uuid primary key default gen_random_uuid(),
  name text not null check (length(trim(name)) between 2 and 120),
  category text not null check (length(trim(category)) between 2 and 60),
  price numeric(10,2) not null check (price > 0),
  description text not null default '' check (length(description) <= 500),
  popular boolean not null default false,
  image_key text,
  available boolean not null default true,
  sort_order integer not null default 0 check (sort_order >= 0),
  created_at timestamptz not null default now()
);

create table public.orders (
  id uuid primary key default gen_random_uuid(),
  order_number bigint generated always as identity unique,
  customer_name text not null check (length(trim(customer_name)) between 2 and 100),
  customer_email text,
  phone text not null check (length(regexp_replace(phone, '[^0-9]', '', 'g')) between 9 and 15),
  fulfillment text not null check (fulfillment in ('Pickup', 'Delivery')),
  address text,
  delivery_lat double precision,
  delivery_lng double precision,
  notes text check (notes is null or length(notes) <= 1000),
  items jsonb not null check (jsonb_typeof(items) = 'array'),
  total numeric(10,2) not null check (total >= 0),
  status public.order_status not null default 'New',
  payment_method text not null check (payment_method in ('Cash', 'Mobile Money', 'Flutterwave')),
  payment_to text,
  payment_reference text,
  payment_from text,
  payment_status public.payment_status not null default 'Cash due',
  created_at timestamptz not null default now(),
  check ((fulfillment = 'Delivery' and length(trim(coalesce(address, ''))) >= 3) or fulfillment = 'Pickup'),
  check ((payment_method in ('Mobile Money', 'Flutterwave')) or payment_method = 'Cash')
);

create table public.bookings (
  id uuid primary key default gen_random_uuid(),
  booking_number bigint generated always as identity unique,
  event_type text not null check (length(trim(event_type)) between 2 and 80),
  package_name text not null check (length(trim(package_name)) between 2 and 80),
  event_date date not null,
  event_time time,
  venue text not null check (length(trim(venue)) between 2 and 200),
  guests integer not null check (guests between 1 and 5000),
  notes text check (notes is null or length(notes) <= 1500),
  customer_name text not null check (length(trim(customer_name)) between 2 and 100),
  phone text not null check (length(regexp_replace(phone, '[^0-9]', '', 'g')) between 9 and 15),
  email text,
  status public.booking_status not null default 'Pending',
  created_at timestamptz not null default now()
);

create index orders_created_at_idx on public.orders(created_at desc);
create index orders_phone_idx on public.orders ((regexp_replace(phone, '[^0-9]', '', 'g')));
create index orders_status_idx on public.orders(status);
create index bookings_created_at_idx on public.bookings(created_at desc);
create index bookings_status_idx on public.bookings(status);
create index menu_items_available_sort_idx on public.menu_items(available, sort_order);

-- Security-definer helpers are kept out of the exposed API schema.
create or replace function private.has_role(_user_id uuid, _role public.app_role)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.user_roles
    where user_id = _user_id and role = _role
  );
$$;

revoke all on function private.has_role(uuid, public.app_role) from public;
grant usage on schema private to authenticated;
grant execute on function private.has_role(uuid, public.app_role) to authenticated;

grant usage on schema public to anon, authenticated;
grant select on public.menu_items to anon, authenticated;
grant select on public.user_roles to authenticated;
grant select, insert, update on public.business_settings to authenticated;
grant select on public.business_settings to anon;
grant select, insert, update, delete on public.menu_items to authenticated;
grant select, update, delete on public.orders to authenticated;
grant select, update, delete on public.bookings to authenticated;
grant all on public.user_roles, public.business_settings, public.menu_items, public.orders, public.bookings to service_role;

alter table public.user_roles enable row level security;
alter table public.business_settings enable row level security;
alter table public.menu_items enable row level security;
alter table public.orders enable row level security;
alter table public.bookings enable row level security;

create policy "users can read their own roles"
on public.user_roles for select to authenticated
using ((select auth.uid()) = user_id);

create policy "admins manage roles"
on public.user_roles for all to authenticated
using ((select private.has_role(auth.uid(), 'admin'::public.app_role)))
with check ((select private.has_role(auth.uid(), 'admin'::public.app_role)));

create policy "public reads public settings"
on public.business_settings for select to anon, authenticated
using (key in ('business_name', 'phone', 'mobile_money_number', 'opening_hours', 'location')); 

create policy "admins manage settings"
on public.business_settings for all to authenticated
using ((select private.has_role(auth.uid(), 'admin'::public.app_role)))
with check ((select private.has_role(auth.uid(), 'admin'::public.app_role)));

create policy "public reads available menu"
on public.menu_items for select to anon, authenticated
using (available = true);

create policy "staff reads all menu"
on public.menu_items for select to authenticated
using ((select private.has_role(auth.uid(), 'admin'::public.app_role)) or (select private.has_role(auth.uid(), 'staff'::public.app_role)));

create policy "staff inserts menu"
on public.menu_items for insert to authenticated
with check ((select private.has_role(auth.uid(), 'admin'::public.app_role)) or (select private.has_role(auth.uid(), 'staff'::public.app_role)));

create policy "staff updates menu"
on public.menu_items for update to authenticated
using ((select private.has_role(auth.uid(), 'admin'::public.app_role)) or (select private.has_role(auth.uid(), 'staff'::public.app_role)))
with check ((select private.has_role(auth.uid(), 'admin'::public.app_role)) or (select private.has_role(auth.uid(), 'staff'::public.app_role)));

create policy "admins delete menu"
on public.menu_items for delete to authenticated
using ((select private.has_role(auth.uid(), 'admin'::public.app_role)));

create policy "staff read orders"
on public.orders for select to authenticated
using ((select private.has_role(auth.uid(), 'admin'::public.app_role)) or (select private.has_role(auth.uid(), 'staff'::public.app_role)));

create policy "staff update orders"
on public.orders for update to authenticated
using ((select private.has_role(auth.uid(), 'admin'::public.app_role)) or (select private.has_role(auth.uid(), 'staff'::public.app_role)))
with check ((select private.has_role(auth.uid(), 'admin'::public.app_role)) or (select private.has_role(auth.uid(), 'staff'::public.app_role)));

create policy "admins delete orders"
on public.orders for delete to authenticated
using ((select private.has_role(auth.uid(), 'admin'::public.app_role)));

create policy "staff read bookings"
on public.bookings for select to authenticated
using ((select private.has_role(auth.uid(), 'admin'::public.app_role)) or (select private.has_role(auth.uid(), 'staff'::public.app_role)));

create policy "staff update bookings"
on public.bookings for update to authenticated
using ((select private.has_role(auth.uid(), 'admin'::public.app_role)) or (select private.has_role(auth.uid(), 'staff'::public.app_role)))
with check ((select private.has_role(auth.uid(), 'admin'::public.app_role)) or (select private.has_role(auth.uid(), 'staff'::public.app_role)));

create policy "admins delete bookings"
on public.bookings for delete to authenticated
using ((select private.has_role(auth.uid(), 'admin'::public.app_role)));

-- The public table has no direct INSERT grants. These narrowly-scoped RPCs are the public write API.
create or replace function public.place_order(
  p_customer_name text,
  p_phone text,
  p_fulfillment text,
  p_address text,
  p_notes text,
  p_payment_method text,
  p_payment_reference text,
  p_items jsonb
)
returns table(order_number bigint, total numeric)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_item jsonb;
  v_id uuid;
  v_qty integer;
  v_count integer := 0;
  v_total numeric(10,2) := 0;
  v_snapshot jsonb := '[]'::jsonb;
  v_name text;
  v_price numeric(10,2);
  v_order_number bigint;
  v_payment_to text;
begin
  if length(trim(coalesce(p_customer_name, ''))) not between 2 and 100 then
    raise exception 'Invalid customer name';
  end if;
  if length(regexp_replace(coalesce(p_phone, ''), '[^0-9]', '', 'g')) not between 9 and 15 then
    raise exception 'Invalid phone number';
  end if;
  if p_fulfillment not in ('Pickup', 'Delivery') then
    raise exception 'Invalid fulfillment';
  end if;
  if p_fulfillment = 'Delivery' and length(trim(coalesce(p_address, ''))) < 3 then
    raise exception 'Delivery address is required';
  end if;
  if p_payment_method not in ('Cash', 'Mobile Money') then
    raise exception 'Invalid payment method';
  end if;
  if p_payment_method = 'Mobile Money' and length(trim(coalesce(p_payment_reference, ''))) < 2 then
    raise exception 'Payment reference is required';
  end if;
  if jsonb_typeof(p_items) <> 'array' or jsonb_array_length(p_items) = 0 or jsonb_array_length(p_items) > 20 then
    raise exception 'Invalid order items';
  end if;

  for v_item in select value from jsonb_array_elements(p_items)
  loop
    v_id := (v_item->>'id')::uuid;
    v_qty := (v_item->>'qty')::integer;
    if v_qty is null or v_qty < 1 or v_qty > 20 then
      raise exception 'Invalid quantity';
    end if;
    v_count := v_count + 1;

    select m.name, m.price into v_name, v_price
    from public.menu_items m
    where m.id = v_id and m.available = true;

    if not found then
      raise exception 'One or more menu items are unavailable';
    end if;

    v_total := v_total + (v_price * v_qty);
    v_snapshot := v_snapshot || jsonb_build_array(jsonb_build_object(
      'id', v_id,
      'name', v_name,
      'price', v_price,
      'qty', v_qty,
      'line_total', v_price * v_qty
    ));
  end loop;

  select value into v_payment_to from public.business_settings where key = 'mobile_money_number';

  insert into public.orders (
    customer_name, phone, fulfillment, address, notes, items, total,
    payment_method, payment_to, payment_reference, payment_status, status
  ) values (
    trim(p_customer_name), trim(p_phone), p_fulfillment,
    nullif(trim(coalesce(p_address, '')), ''),
    nullif(trim(coalesce(p_notes, '')), ''), v_snapshot, v_total,
    p_payment_method, case when p_payment_method = 'Mobile Money' then v_payment_to else null end,
    case when p_payment_method = 'Mobile Money' then trim(p_payment_reference) else null end,
    case when p_payment_method = 'Mobile Money' then 'Awaiting verification'::public.payment_status else 'Cash due'::public.payment_status end,
    'New'::public.order_status
  ) returning orders.order_number into v_order_number;

  return query select v_order_number, v_total;
end;
$$;

create or replace function public.create_booking(
  p_event_type text,
  p_package_name text,
  p_event_date date,
  p_event_time time,
  p_venue text,
  p_guests integer,
  p_notes text,
  p_customer_name text,
  p_phone text,
  p_email text
)
returns table(booking_number bigint)
language plpgsql
security definer
set search_path = ''
as $$
declare v_number bigint;
begin
  if length(trim(coalesce(p_event_type, ''))) not between 2 and 80 then raise exception 'Invalid event type'; end if;
  if p_package_name not in ('Traditional', 'Standard', 'Premium') then raise exception 'Invalid catering package'; end if;
  if p_event_date < current_date then raise exception 'Event date cannot be in the past'; end if;
  if p_guests not between 1 and 5000 then raise exception 'Invalid guest count'; end if;
  if length(trim(coalesce(p_venue, ''))) not between 2 and 200 then raise exception 'Invalid venue'; end if;
  if length(trim(coalesce(p_customer_name, ''))) not between 2 and 100 then raise exception 'Invalid customer name'; end if;
  if length(regexp_replace(coalesce(p_phone, ''), '[^0-9]', '', 'g')) not between 9 and 15 then raise exception 'Invalid phone number'; end if;

  insert into public.bookings(event_type, package_name, event_date, event_time, venue, guests, notes, customer_name, phone, email, status)
  values (trim(p_event_type), p_package_name, p_event_date, p_event_time, trim(p_venue), p_guests,
          nullif(trim(coalesce(p_notes, '')), ''), trim(p_customer_name), trim(p_phone), nullif(trim(coalesce(p_email, '')), ''), 'Pending')
  returning public.bookings.booking_number into v_number;

  return query select v_number;
end;
$$;

create or replace function public.track_order(p_order_number bigint, p_phone text)
returns table(
  order_number bigint,
  customer_name text,
  status public.order_status,
  payment_status public.payment_status,
  fulfillment text,
  items jsonb,
  total numeric,
  created_at timestamptz
)
language sql
stable
security definer
set search_path = ''
as $$
  select o.order_number, o.customer_name, o.status, o.payment_status, o.fulfillment, o.items, o.total, o.created_at
  from public.orders o
  where o.order_number = p_order_number
    and regexp_replace(coalesce(o.phone, ''), '[^0-9]', '', 'g') = regexp_replace(coalesce(p_phone, ''), '[^0-9]', '', 'g')
  limit 1;
$$;

revoke all on function public.place_order(text,text,text,text,text,text,text,jsonb) from public;
revoke all on function public.create_booking(text,text,date,time,text,integer,text,text,text,text) from public;
revoke all on function public.track_order(bigint,text) from public;
grant execute on function public.place_order(text,text,text,text,text,text,text,jsonb) to anon, authenticated;
grant execute on function public.create_booking(text,text,date,time,text,integer,text,text,text,text) to anon, authenticated;
grant execute on function public.track_order(bigint,text) to anon, authenticated;

-- Do not expose direct writes to the customer tables.
revoke insert on public.orders from anon, authenticated;
revoke insert on public.bookings from anon, authenticated;

-- Staff must not be able to manipulate generated order numbers or bypass the workflow via INSERT.
revoke insert on public.orders, public.bookings from authenticated;

insert into public.business_settings(key, value) values
  ('business_name', 'Nalu’s Kitchen'),
  ('phone', '+260 978 408 225'),
  ('mobile_money_number', '+260 978 408 225'),
  ('opening_hours', 'Daily 08:00–20:00'),
  ('location', 'Solwezi, North-Western Province')
on conflict (key) do update set value = excluded.value, updated_at = now();

-- Storage bucket and policies.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types) values ('menu-photos', 'menu-photos', false, 5242880, array['image/jpeg','image/png','image/webp'])
on conflict (id) do update set public = false, file_size_limit = 5242880, allowed_mime_types = array['image/jpeg','image/png','image/webp'];

create policy "public can read menu photos"
on storage.objects for select to anon, authenticated
using (bucket_id = 'menu-photos');

create policy "staff can upload menu photos"
on storage.objects for insert to authenticated
with check (bucket_id = 'menu-photos' and ((select private.has_role(auth.uid(), 'admin'::public.app_role)) or (select private.has_role(auth.uid(), 'staff'::public.app_role))));

create policy "staff can update menu photos"
on storage.objects for update to authenticated
using (bucket_id = 'menu-photos' and ((select private.has_role(auth.uid(), 'admin'::public.app_role)) or (select private.has_role(auth.uid(), 'staff'::public.app_role))))
with check (bucket_id = 'menu-photos' and ((select private.has_role(auth.uid(), 'admin'::public.app_role)) or (select private.has_role(auth.uid(), 'staff'::public.app_role))));

create policy "staff can delete menu photos"
on storage.objects for delete to authenticated
using (bucket_id = 'menu-photos' and ((select private.has_role(auth.uid(), 'admin'::public.app_role)) or (select private.has_role(auth.uid(), 'staff'::public.app_role))));

-- Realtime publication for menu/order/booking changes in the private dashboard.
alter publication supabase_realtime add table public.menu_items;
alter publication supabase_realtime add table public.orders;
alter publication supabase_realtime add table public.bookings;


-- Staff may create records manually from the control room. Public users may not.
grant insert on public.orders, public.bookings to authenticated;
create policy "staff can manually create orders"
on public.orders for insert to authenticated
with check ((select private.has_role(auth.uid(), 'admin'::public.app_role)) or (select private.has_role(auth.uid(), 'staff'::public.app_role)));

create policy "staff can manually create bookings"
on public.bookings for insert to authenticated
with check ((select private.has_role(auth.uid(), 'admin'::public.app_role)) or (select private.has_role(auth.uid(), 'staff'::public.app_role)));


-- Flutterwave payment ledger. The browser never writes this table directly.
create table public.payment_transactions (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.orders(id) on delete cascade,
  order_number bigint not null,
  tx_ref text not null unique,
  provider text not null default 'flutterwave',
  transaction_id bigint,
  flw_ref text,
  amount numeric(10,2) not null check (amount > 0),
  currency text not null default 'ZMW' check (currency = 'ZMW'),
  payment_method text not null default 'flutterwave',
  status text not null default 'initiated' check (status in ('initiated','pending','successful','failed','cancelled','verification_failed')),
  provider_status text,
  provider_message text,
  checkout_url text,
  raw_response jsonb,
  webhook_payload jsonb,
  verified_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index payment_transactions_order_idx on public.payment_transactions(order_id, created_at desc);
create index payment_transactions_status_idx on public.payment_transactions(status, created_at desc);
create unique index payment_transactions_transaction_id_idx on public.payment_transactions(transaction_id) where transaction_id is not null;

alter table public.payment_transactions enable row level security;
grant select on public.payment_transactions to authenticated;
grant all on public.payment_transactions to service_role;

create policy "staff read payment transactions"
on public.payment_transactions for select to authenticated
using ((select private.has_role(auth.uid(), 'admin'::public.app_role)) or (select private.has_role(auth.uid(), 'staff'::public.app_role)));

-- Replace the public order RPC with a version that records the customer email.
drop function if exists public.place_order(text,text,text,text,text,text,text,jsonb);
create or replace function public.place_order(
  p_customer_name text,
  p_phone text,
  p_customer_email text,
  p_fulfillment text,
  p_address text,
  p_notes text,
  p_payment_method text,
  p_payment_reference text,
  p_items jsonb
)
returns table(order_id uuid, order_number bigint, total numeric, payment_status public.payment_status)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_order_id uuid;
  v_order_number bigint;
  v_total numeric(10,2) := 0;
  v_snapshot jsonb := '[]'::jsonb;
  v_item jsonb;
  v_id uuid;
  v_qty integer;
  v_count integer := 0;
  v_name text;
  v_price numeric(10,2);
  v_payment_to text;
  v_payment_status public.payment_status;
begin
  if length(trim(coalesce(p_customer_name, ''))) not between 2 and 100 then raise exception 'Invalid customer name'; end if;
  if length(regexp_replace(coalesce(p_phone, ''), '[^0-9]', '', 'g')) not between 9 and 15 then raise exception 'Invalid phone number'; end if;
  if p_fulfillment not in ('Pickup', 'Delivery') then raise exception 'Invalid fulfillment method'; end if;
  if p_fulfillment = 'Delivery' and length(trim(coalesce(p_address, ''))) < 3 then raise exception 'Delivery address is required'; end if;
  if p_payment_method not in ('Cash', 'Flutterwave', 'Mobile Money') then raise exception 'Invalid payment method'; end if;
  if p_customer_email is not null and length(trim(p_customer_email)) > 254 then raise exception 'Invalid email'; end if;
  if jsonb_typeof(p_items) <> 'array' or jsonb_array_length(p_items) = 0 then raise exception 'Your order is empty'; end if;

  for v_item in select value from jsonb_array_elements(p_items) loop
    v_id := (v_item->>'id')::uuid;
    v_qty := (v_item->>'qty')::integer;
    if v_qty is null or v_qty < 1 or v_qty > 20 then raise exception 'Invalid quantity'; end if;
    v_count := v_count + 1;
    if v_count > 50 then raise exception 'Too many order lines'; end if;

    select m.name, m.price into v_name, v_price
    from public.menu_items m
    where m.id = v_id and m.available = true;
    if not found then raise exception 'One or more menu items are unavailable'; end if;

    v_total := v_total + (v_price * v_qty);
    v_snapshot := v_snapshot || jsonb_build_array(jsonb_build_object(
      'id', v_id, 'name', v_name, 'price', v_price, 'qty', v_qty, 'line_total', v_price * v_qty
    ));
  end loop;

  select value into v_payment_to from public.business_settings where key = 'mobile_money_number';
  v_payment_status := case
    when p_payment_method in ('Flutterwave', 'Mobile Money') then 'Awaiting verification'::public.payment_status
    else 'Cash due'::public.payment_status
  end;

  insert into public.orders (
    customer_name, customer_email, phone, fulfillment, address, notes, items, total,
    payment_method, payment_to, payment_reference, payment_status, status
  ) values (
    trim(p_customer_name), nullif(trim(coalesce(p_customer_email, '')), ''), trim(p_phone), p_fulfillment,
    nullif(trim(coalesce(p_address, '')), ''), nullif(trim(coalesce(p_notes, '')), ''), v_snapshot, v_total,
    p_payment_method, case when p_payment_method = 'Mobile Money' then v_payment_to else null end,
    nullif(trim(coalesce(p_payment_reference, '')), ''), v_payment_status, 'New'::public.order_status
  ) returning id, orders.order_number into v_order_id, v_order_number;

  return query select v_order_id, v_order_number, v_total, v_payment_status;
end;
$$;

revoke all on function public.place_order(text,text,text,text,text,text,text,text,jsonb) from public;
grant execute on function public.place_order(text,text,text,text,text,text,text,text,jsonb) to anon, authenticated;

-- Service-role-only payment state transition helpers are intentionally not granted to the API roles.
create or replace function public.apply_flutterwave_result(
  p_order_id uuid,
  p_tx_ref text,
  p_transaction_id bigint,
  p_flw_ref text,
  p_status text,
  p_provider_status text,
  p_provider_message text,
  p_raw_response jsonb,
  p_webhook_payload jsonb
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_order public.orders%rowtype;
  v_payment_id uuid;
begin
  select * into v_order from public.orders where id = p_order_id for update;
  if not found then raise exception 'Order not found'; end if;

  insert into public.payment_transactions(order_id, order_number, tx_ref, transaction_id, flw_ref, amount, currency, status, provider_status, provider_message, raw_response, webhook_payload, verified_at, updated_at)
  values (
    p_order_id, v_order.order_number, p_tx_ref, p_transaction_id, p_flw_ref, v_order.total, 'ZMW', p_status,
    p_provider_status, p_provider_message, p_raw_response, p_webhook_payload,
    case when p_status = 'successful' then now() else null end, now()
  )
  on conflict (tx_ref) do update set
    transaction_id = excluded.transaction_id,
    flw_ref = excluded.flw_ref,
    status = excluded.status,
    provider_status = excluded.provider_status,
    provider_message = excluded.provider_message,
    raw_response = excluded.raw_response,
    webhook_payload = coalesce(excluded.webhook_payload, public.payment_transactions.webhook_payload),
    verified_at = case when excluded.status = 'successful' then now() else public.payment_transactions.verified_at end,
    updated_at = now()
  returning id into v_payment_id;

  if p_status = 'successful' then
    update public.orders
      set payment_status = 'Verified'::public.payment_status,
          payment_reference = p_tx_ref,
          status = case when status = 'New' then 'Confirmed'::public.order_status else status end
    where id = p_order_id;
  elsif p_status in ('failed', 'cancelled', 'verification_failed') then
    update public.orders
      set payment_status = 'Not received'::public.payment_status,
          payment_reference = p_tx_ref
    where id = p_order_id and payment_status <> 'Verified'::public.payment_status;
  end if;
end;
$$;

revoke all on function public.apply_flutterwave_result(uuid,text,bigint,text,text,text,text,jsonb,jsonb) from public, anon, authenticated;
grant execute on function public.apply_flutterwave_result(uuid,text,bigint,text,text,text,text,jsonb,jsonb) to service_role;

