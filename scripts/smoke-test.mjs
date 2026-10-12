import "dotenv/config";
const url = process.env.VITE_SUPABASE_URL;
const key = process.env.VITE_SUPABASE_PUBLISHABLE_KEY;

if (!url || !key) {
  console.error("Set VITE_SUPABASE_URL and VITE_SUPABASE_PUBLISHABLE_KEY before running smoke tests.");
  process.exit(1);
}

const headers = { apikey: key, Authorization: `Bearer ${key}`, "Content-Type": "application/json" };
async function request(path, options = {}) {
  const response = await fetch(`${url}${path}`, { ...options, headers: { ...headers, ...(options.headers ?? {}) } });
  const text = await response.text();
  let body;
  try { body = JSON.parse(text); } catch { body = text; }
  if (!response.ok) throw new Error(`${path} ${response.status}: ${typeof body === "string" ? body : JSON.stringify(body)}`);
  return body;
}

const menu = await request('/rest/v1/menu_items?select=id,name,price&available=eq.true&order=sort_order');
if (!Array.isArray(menu) || menu.length === 0) throw new Error('No available menu items returned');

const item = menu[0];
const phone = `097${Date.now().toString().slice(-7)}`;
const order = await request('/rest/v1/rpc/place_order', { method: 'POST', body: JSON.stringify({
  p_customer_name: 'Smoke Test Customer',
  p_customer_email: 'smoke-test@example.com',
  p_phone: phone,
  p_fulfillment: 'Pickup',
  p_address: null,
  p_notes: 'Automated smoke test',
  p_payment_method: 'Cash',
  p_payment_reference: null,
  p_items: [{ id: item.id, qty: 1 }],
}) });
const created = Array.isArray(order) ? order[0] : order;
if (!created?.order_number) throw new Error('place_order did not return an order number');

const tracked = await request('/rest/v1/rpc/track_order', { method: 'POST', body: JSON.stringify({ p_order_number: created.order_number, p_phone: phone }) });
if (!Array.isArray(tracked) || tracked.length !== 1) throw new Error('track_order did not find the newly created order');

const booking = await request('/rest/v1/rpc/create_booking', { method: 'POST', body: JSON.stringify({
  p_event_type: 'Smoke Test',
  p_package_name: 'Standard',
  p_event_date: new Date(Date.now() + 7 * 86400000).toISOString().slice(0, 10),
  p_event_time: '12:00',
  p_venue: 'Smoke Test Venue',
  p_guests: 2,
  p_notes: 'Automated smoke test',
  p_customer_name: 'Smoke Test Customer',
  p_phone: phone,
  p_email: null,
}) });
if (!(Array.isArray(booking) ? booking[0] : booking)?.booking_number) throw new Error('create_booking did not return a booking number');

console.log(JSON.stringify({ ok: true, menuItems: menu.length, orderNumber: created.order_number, bookingNumber: (Array.isArray(booking) ? booking[0] : booking).booking_number }, null, 2));








