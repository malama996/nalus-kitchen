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
declare
  v_number bigint;
begin
  if length(trim(coalesce(p_event_type, ''))) not between 2 and 80 then
    raise exception 'Invalid event type';
  end if;

  if p_package_name not in ('Traditional', 'Standard', 'Premium') then
    raise exception 'Invalid catering package';
  end if;

  if p_event_date < current_date then
    raise exception 'Event date cannot be in the past';
  end if;

  if p_guests not between 1 and 5000 then
    raise exception 'Invalid guest count';
  end if;

  if length(trim(coalesce(p_venue, ''))) not between 2 and 200 then
    raise exception 'Invalid venue';
  end if;

  if length(trim(coalesce(p_customer_name, ''))) not between 2 and 100 then
    raise exception 'Invalid customer name';
  end if;

  if length(regexp_replace(coalesce(p_phone, ''), '[^0-9]', '', 'g')) not between 9 and 15 then
    raise exception 'Invalid phone number';
  end if;

  insert into public.bookings(
    event_type,
    package_name,
    event_date,
    event_time,
    venue,
    guests,
    notes,
    customer_name,
    phone,
    email,
    status
  )
  values (
    trim(p_event_type),
    p_package_name,
    p_event_date,
    p_event_time,
    trim(p_venue),
    p_guests,
    nullif(trim(coalesce(p_notes, '')), ''),
    trim(p_customer_name),
    trim(p_phone),
    nullif(trim(coalesce(p_email, '')), ''),
    'Pending'
  )
  returning public.bookings.booking_number into v_number;

  return query
    select v_number;
end;
$$;

revoke all on function public.create_booking(text,text,date,time,text,integer,text,text,text,text) from public;
grant execute on function public.create_booking(text,text,date,time,text,integer,text,text,text,text) to anon, authenticated;
