import { useCallback, useEffect, useMemo, useState } from "react";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { MapPin, RefreshCcw, Trash2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { signMenuPhotos, uploadMenuPhoto } from "@/lib/menu-photos";
import { bundledImages } from "@/components/nalus-kitchen";

export const Route = createFileRoute("/_authenticated/control-room")({
  head: () => ({
    meta: [
      { title: "Private control room — Nalu’s Kitchen" },
      { name: "description", content: "Manage Nalu’s Kitchen orders, catering bookings, menu items and daily sales." },
      { property: "og:title", content: "Private control room — Nalu’s Kitchen" },
      { property: "og:description", content: "Private team dashboard." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: StaffPage,
});

const orderStatuses = ["New", "Confirmed", "Preparing", "Ready", "Delivered", "Cancelled"] as const;
const paymentStatuses = ["Cash due", "Awaiting verification", "Verified", "Not received"] as const;
const bookingStatuses = ["Pending", "Confirmed", "Completed", "Cancelled"] as const;
const categories = ["Traditional Meals", "Fast Foods", "Sides", "Drinks", "Specials"];
const tabs = ["Orders", "Bookings", "Payments", "Menu", "Sales", "Settings"] as const;

type Tab = (typeof tabs)[number];
type PaymentRow = { id: string; order_id: string; order_number: number; tx_ref: string; transaction_id: number | null; flw_ref: string | null; amount: number; currency: string; status: string; provider_status: string | null; provider_message: string | null; created_at: string; verified_at: string | null };
type OrderRow = {
  id: string; order_number: number; customer_name: string; phone: string; fulfillment: string; address: string | null;
  delivery_lat: number | null; delivery_lng: number | null; notes: string | null; items: unknown; total: number;
  status: (typeof orderStatuses)[number]; payment_method: string; payment_reference: string | null; payment_status: (typeof paymentStatuses)[number]; created_at: string;
};
type BookingRow = {
  id: string; booking_number: number; event_type: string; package_name: string; event_date: string; event_time: string | null;
  venue: string; guests: number; notes: string | null; customer_name: string; phone: string; email: string | null; status: (typeof bookingStatuses)[number]; created_at: string;
};
type MenuRow = { id: string; name: string; category: string; price: number; description: string; popular: boolean; available: boolean; sort_order: number; image_key: string | null };

const money = (value: number) => `K${Number(value).toLocaleString("en-ZM", { maximumFractionDigits: 0 })}`;
const when = (value: string) => new Date(value).toLocaleString("en-ZM", { dateStyle: "medium", timeStyle: "short" });
const lineItems = (items: unknown) => Array.isArray(items) ? (items as Array<{ name: string; qty: number }>) : [];

function StaffPage() {
  const navigate = useNavigate();
  const [tab, setTab] = useState<Tab>("Orders");
  const [roleState, setRoleState] = useState<"loading" | "staff" | "admin" | "none">("loading");
  const [orders, setOrders] = useState<OrderRow[]>([]);
  const [bookings, setBookings] = useState<BookingRow[]>([]);
  const [payments, setPayments] = useState<PaymentRow[]>([]);
  const [menu, setMenu] = useState<MenuRow[]>([]);
  const [notice, setNotice] = useState("");
  const [photos, setPhotos] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);
  const [range, setRange] = useState<"today" | "week" | "month" | "all">("today");
  const [orderFilter, setOrderFilter] = useState<string>("New");
  const [bookingFilter, setBookingFilter] = useState<string>("Pending");
  const [showAddOrder, setShowAddOrder] = useState(false);
  const [showAddBooking, setShowAddBooking] = useState(false);
  const [settings, setSettings] = useState<Record<string, string>>({});

  const loadAll = useCallback(async () => {
    const [o, b, p, m, settingsResult] = await Promise.all([
      supabase.from("orders").select("*").order("created_at", { ascending: false }).limit(200),
      supabase.from("bookings").select("*").order("created_at", { ascending: false }).limit(200),
      supabase.from("payment_transactions").select("id,order_id,order_number,tx_ref,transaction_id,flw_ref,amount,currency,status,provider_status,provider_message,created_at,verified_at").order("created_at", { ascending: false }).limit(200),
      supabase.from("menu_items").select("id,name,category,price,description,popular,available,sort_order,image_key").order("sort_order"),
      supabase.from("business_settings").select("key,value"),
    ]);
    setOrders((o.data ?? []) as OrderRow[]);
    setBookings((b.data ?? []) as BookingRow[]);
    setPayments((p.data ?? []) as PaymentRow[]);
    const menuRows = ((m.data ?? []) as MenuRow[]).map((item) => ({ ...item, price: Number(item.price) }));
    setMenu(menuRows);
    setPhotos(await signMenuPhotos(menuRows.map((item) => item.image_key)));
    setSettings(Object.fromEntries((settingsResult.data ?? []).map((row) => [row.key, row.value])));
  }, []);

  const checkRole = useCallback(async () => {
    const { data } = await supabase.from("user_roles").select("role");
    if (!data || data.length === 0) { setRoleState("none"); return; }
    setRoleState(data.some((row) => row.role === "admin") ? "admin" : "staff");
    await loadAll();
  }, [loadAll]);

  useEffect(() => { void checkRole(); }, [checkRole]);

  useEffect(() => {
    if (roleState !== "staff" && roleState !== "admin") return;
    const channel = supabase.channel("staff-live")
      .on("postgres_changes", { event: "*", schema: "public", table: "orders" }, () => void loadAll())
      .on("postgres_changes", { event: "*", schema: "public", table: "bookings" }, () => void loadAll())
      .on("postgres_changes", { event: "*", schema: "public", table: "menu_items" }, () => void loadAll())
      .on("postgres_changes", { event: "*", schema: "public", table: "payment_transactions" }, () => void loadAll())
      .subscribe();
    return () => { void supabase.removeChannel(channel); };
  }, [roleState, loadAll]);


  async function signOut() {
    await supabase.auth.signOut();
    void navigate({ to: "/control-room-login", replace: true });
  }

  const shownOrders = orderFilter === "All" ? orders : orders.filter((o) => o.status === orderFilter);
  const shownBookings = bookingFilter === "All" ? bookings : bookings.filter((b) => b.status === bookingFilter);

  async function removeRow(table: "orders" | "bookings", id: string) {
    if (!window.confirm("Remove this permanently?")) return;
    const { error } = await supabase.from(table).delete().eq("id", id);
    setNotice(error ? "Only the manager can remove this." : "Removed.");
    await loadAll();
  }

  async function addOrder(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const f = new FormData(form);
    const items = String(f.get("items")).split("\n").map((l) => l.trim()).filter(Boolean).map((l) => {
      const m = l.match(/^(\d+)\s*[x×]\s*(.+)$/i);
      return m ? { qty: Number(m[1]), name: String(m[2]).trim() } : { qty: 1, name: l };
    });
    setBusy(true);
    const payment = String(f.get("payment_method"));
    const { error } = await supabase.from("orders").insert({
      customer_name: String(f.get("customer_name")), phone: String(f.get("phone")), fulfillment: String(f.get("fulfillment")),
      address: String(f.get("address") || "") || null, notes: String(f.get("notes") || "") || null, items, total: Number(f.get("total")),
      payment_method: payment, payment_status: payment === "Cash" ? "Cash due" : "Awaiting verification", status: f.get("status") as OrderRow["status"],
    });
    setBusy(false);
    setNotice(error ? error.message : "Order added.");
    if (!error) { form.reset(); setShowAddOrder(false); await loadAll(); }
  }

  async function addBooking(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const f = new FormData(form);
    setBusy(true);
    const { error } = await supabase.from("bookings").insert({
      customer_name: String(f.get("customer_name")), phone: String(f.get("phone")), email: String(f.get("email") || "") || null,
      event_type: String(f.get("event_type")), package_name: String(f.get("package_name")), event_date: String(f.get("event_date")),
      event_time: String(f.get("event_time") || "") || null, venue: String(f.get("venue")), guests: Number(f.get("guests")),
      notes: String(f.get("notes") || "") || null, status: f.get("status") as BookingRow["status"],
    });
    setBusy(false);
    setNotice(error ? error.message : "Booking added.");
    if (!error) { form.reset(); setShowAddBooking(false); await loadAll(); }
  }

  const sales = useMemo(() => {
    const now = new Date();
    const start = new Date(now);
    if (range === "today") start.setHours(0, 0, 0, 0);
    if (range === "week") start.setDate(now.getDate() - 7);
    if (range === "month") start.setDate(now.getDate() - 30);
    const scoped = orders.filter((order) => order.status !== "Cancelled" && (range === "all" || new Date(order.created_at) >= start));
    const counts = new Map<string, number>();
    scoped.forEach((order) => lineItems(order.items).forEach((line) => counts.set(line.name, (counts.get(line.name) ?? 0) + Number(line.qty || 0))));
    return {
      revenue: scoped.reduce((sum, order) => sum + Number(order.total), 0),
      count: scoped.length,
      popular: [...counts.entries()].sort((a, b) => b[1] - a[1]).slice(0, 6),
    };
  }, [orders, range]);

  async function saveSettings(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const entries = ["phone", "mobile_money_number", "opening_hours", "location"];
    for (const key of entries) {
      const value = String(form.get(key) ?? "").trim();
      const { error } = await supabase.from("business_settings").upsert({ key, value, updated_at: new Date().toISOString() });
      if (error) { setNotice(error.message); return; }
    }
    setNotice("Business settings saved.");
    await loadAll();
  }

  const photoFor = (item: MenuRow) => (item.image_key ? bundledImages[item.image_key] ?? photos[item.image_key] ?? null : null);

  function downloadCsv() {
    const now = new Date();
    const start = new Date(now);
    if (range === "today") start.setHours(0, 0, 0, 0);
    if (range === "week") start.setDate(now.getDate() - 7);
    if (range === "month") start.setDate(now.getDate() - 30);
    const rows = orders.filter((o) => range === "all" || new Date(o.created_at) >= start);
    const esc = (v: unknown) => `"${String(v ?? "").replace(/"/g, '""')}"`;
    const header = ["Order", "Date", "Customer", "Phone", "Fulfillment", "Items", "Total (K)", "Status", "Payment method", "Payment status", "Reference"];
    const lines = rows.map((o) => [o.order_number, when(o.created_at), o.customer_name, o.phone, o.fulfillment,
      lineItems(o.items).map((l) => `${l.qty} x ${l.name}`).join("; "), o.total, o.status, o.payment_method, o.payment_status, o.payment_reference].map(esc).join(","));
    const blob = new Blob([[header.map(esc).join(","), ...lines].join("\n")], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = `nalus-kitchen-sales-${range}-${now.toISOString().slice(0, 10)}.csv`; a.click();
    URL.revokeObjectURL(url);
  }

  async function changePhoto(id: string, file: File) {
    setNotice("Uploading photo…");
    const uploaded = await uploadMenuPhoto(file);
    if (uploaded.error) { setNotice(`Photo upload failed: ${uploaded.error}`); return; }
    const { error } = await supabase.from("menu_items").update({ image_key: uploaded.key }).eq("id", id);
    setNotice(error ? error.message : "Photo updated.");
    await loadAll();
  }

  async function saveMenuItem(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const values = new FormData(form);
    setBusy(true);
    let imageKey: string | null = null;
    const file = values.get("photo");
    if (file instanceof File && file.size > 0) {
      const uploaded = await uploadMenuPhoto(file);
      if (uploaded.error) { setBusy(false); setNotice(`Photo upload failed: ${uploaded.error}`); return; }
      imageKey = uploaded.key;
    }
    const { error } = await supabase.from("menu_items").insert({
      image_key: imageKey,
      name: String(values.get("name")), category: String(values.get("category")), price: Number(values.get("price")),
      description: String(values.get("description") || ""), popular: values.get("popular") === "on",
      sort_order: Number(values.get("sort_order") || 0),
    });
    setBusy(false);
    setNotice(error ? error.message : "Item added to the menu.");
    if (!error) form.reset();
  }

  if (roleState === "loading") return <main className="grid min-h-screen place-items-center text-muted-foreground">Opening the kitchen dashboard…</main>;

  if (roleState === "none") return (
    <main className="grid min-h-screen place-items-center bg-brand-ink px-5 text-brand-cream">
      <div className="w-full max-w-md rounded-md bg-background p-8 text-foreground">
        <h1 className="font-display text-3xl">Access not assigned</h1>
        <p className="mt-3 text-sm text-muted-foreground">Your account is authenticated, but it has no kitchen role. Ask the owner to assign staff or admin access.</p>
        <button onClick={signOut} className="mt-6 min-h-11 w-full rounded-sm bg-primary px-5 text-sm font-semibold text-primary-foreground">Sign out</button>
      </div>
    </main>
  );

  return (
    <main className="min-h-screen bg-muted/40">
      <header className="border-b border-border bg-brand-ink text-brand-cream">
        <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-3 px-5 py-5 lg:px-8">
          <div>
            <p className="eyebrow text-brand-gold">Nalu’s Kitchen</p>
            <h1 className="font-display text-2xl">Private control room</h1>
          </div>
          <div className="flex items-center gap-2">
            <button onClick={() => void loadAll()} className="flex min-h-10 items-center gap-2 rounded-sm border border-brand-cream/30 px-4 text-sm"><RefreshCcw size={15} /> Refresh</button>
            <a href="/" className="min-h-10 rounded-sm border border-brand-cream/30 px-4 py-2 text-sm">Website</a>
            <button onClick={signOut} className="min-h-10 rounded-sm bg-primary px-4 text-sm font-semibold text-primary-foreground">Sign out</button>
          </div>
        </div>
        <div className="mx-auto flex max-w-7xl gap-2 overflow-x-auto px-5 pb-4 lg:px-8">
          {tabs.filter((item) => item !== "Settings" || roleState === "admin").map((item) => (
            <button key={item} onClick={() => setTab(item)} className={`shrink-0 rounded-full px-4 py-2 text-sm ${tab === item ? "bg-brand-gold text-brand-ink" : "border border-brand-cream/25 text-brand-cream/75"}`}>{item}</button>
          ))}
        </div>
      </header>

      <div className="mx-auto max-w-7xl space-y-4 px-5 py-8 lg:px-8">
        {notice && <p className="rounded-sm border border-border bg-card p-3 text-sm">{notice}</p>}

        {tab === "Orders" && <>
          <StatusFilter options={orderStatuses} labels={{ New: "Pending" }} value={orderFilter} onChange={setOrderFilter} counts={orderStatuses.map((s) => orders.filter((o) => o.status === s).length)} total={orders.length} />
          <button onClick={() => setShowAddOrder((v) => !v)} className="min-h-10 rounded-sm bg-primary px-4 text-sm font-semibold text-primary-foreground">{showAddOrder ? "Close" : "+ Add order"}</button>
          {showAddOrder && (
            <form onSubmit={addOrder} className="grid gap-4 rounded-md border border-border bg-card p-5 sm:grid-cols-2">
              <label className="field-label">Customer name<input name="customer_name" required className="field" /></label>
              <label className="field-label">Phone<input name="phone" required className="field" /></label>
              <label className="field-label">Pickup or delivery<select name="fulfillment" className="field"><option>Pickup</option><option>Delivery</option></select></label>
              <label className="field-label">Address<input name="address" className="field" /></label>
              <label className="field-label sm:col-span-2">Items (one per line, e.g. "2 x Nshima & Kapenta")<textarea name="items" required className="field" /></label>
              <label className="field-label">Total (K)<input name="total" type="number" min="0" required className="field" /></label>
              <label className="field-label">Payment<select name="payment_method" className="field"><option>Cash</option><option>Flutterwave</option><option>Mobile Money</option></select></label>
              <label className="field-label">Status<select name="status" className="field">{orderStatuses.map((s) => <option key={s} value={s}>{s === "New" ? "Pending" : s}</option>)}</select></label>
              <label className="field-label">Notes<input name="notes" className="field" /></label>
              <button disabled={busy} className="min-h-11 rounded-sm bg-primary px-4 font-semibold text-primary-foreground sm:col-span-2">Save order</button>
            </form>
          )}
          {shownOrders.length === 0 ? <p className="text-muted-foreground">No orders in this list.</p> : shownOrders.map((order) => (
          <article key={order.id} className="rounded-md border border-border bg-card p-5">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <h2 className="font-display text-xl">#{order.order_number} · {order.customer_name}</h2>
                <p className="text-sm text-muted-foreground"><a href={`tel:${order.phone}`} className="underline">{order.phone}</a> · {order.fulfillment} · {when(order.created_at)}</p>
                {order.address && <p className="text-sm text-muted-foreground">{order.address}</p>}
                {order.delivery_lat != null && order.delivery_lng != null && (
                  <a href={`https://www.google.com/maps/search/?api=1&query=${order.delivery_lat},${order.delivery_lng}`} target="_blank" rel="noreferrer" className="mt-1 inline-flex items-center gap-1 text-sm text-primary underline"><MapPin size={14} /> View on map</a>
                )}
              </div>
              <strong className="text-lg">{money(order.total)}</strong>
            </div>
            <ul className="mt-3 text-sm">{lineItems(order.items).map((line, index) => <li key={index}>{line.qty} × {line.name}</li>)}</ul>
            {order.notes && <p className="mt-2 text-sm italic text-muted-foreground">“{order.notes}”</p>}
            <p className="mt-2 text-sm text-muted-foreground">Payment: {order.payment_method}{order.payment_reference ? ` · ref ${order.payment_reference}` : ""}</p>
            <div className="mt-4 flex flex-wrap items-end gap-3">
              <label className="field-label">Order status
                <select className="field" value={order.status} onChange={(event) => void supabase.from("orders").update({ status: event.target.value as OrderRow["status"] }).eq("id", order.id).then(() => loadAll())}>
                  {orderStatuses.map((value) => <option key={value} value={value}>{value === "New" ? "Pending" : value}</option>)}
                </select>
              </label>
              <label className="field-label">Payment status
                <select className="field" value={order.payment_status} onChange={(event) => void supabase.from("orders").update({ payment_status: event.target.value as OrderRow["payment_status"] }).eq("id", order.id).then(() => loadAll())}>
                  {paymentStatuses.map((value) => <option key={value}>{value}</option>)}
                </select>
              </label>
              <button onClick={() => void removeRow("orders", order.id)} aria-label="Remove order" className="flex min-h-10 items-center gap-1 rounded-sm border border-destructive px-3 text-sm text-destructive"><Trash2 size={15} /> Remove</button>
            </div>
          </article>
        ))}
        </>}

        {tab === "Payments" && <>
          <div className="rounded-md border border-border bg-card p-5">
            <div className="flex flex-wrap items-end justify-between gap-3">
              <div><p className="eyebrow">Flutterwave</p><h2 className="font-display text-2xl">Payment reconciliation</h2><p className="mt-1 text-sm text-muted-foreground">Server-verified payment attempts. A payment only becomes verified after Flutterwave confirmation.</p></div>
              <div className="text-right"><p className="text-xs text-muted-foreground">Successful</p><strong className="text-xl">{money(payments.filter((p) => p.status === "successful").reduce((sum, p) => sum + Number(p.amount), 0))}</strong></div>
            </div>
          </div>
          {payments.length === 0 ? <p className="text-muted-foreground">No Flutterwave transactions yet.</p> : payments.map((payment) => (
            <article key={payment.id} className="rounded-md border border-border bg-card p-5">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div><h2 className="font-display text-xl">Order #NK{payment.order_number} · {money(Number(payment.amount))}</h2><p className="text-sm text-muted-foreground">{when(payment.created_at)} · {payment.tx_ref}</p></div>
                <span className={`rounded-full px-3 py-1 text-xs font-bold uppercase tracking-wide ${payment.status === "successful" ? "bg-brand-green/10 text-brand-green" : payment.status === "failed" || payment.status === "cancelled" ? "bg-destructive/10 text-destructive" : "bg-brand-gold/15 text-brand-ink"}`}>{payment.status}</span>
              </div>
              <div className="mt-3 grid gap-2 text-sm text-muted-foreground sm:grid-cols-3"><p>Flutterwave ID: {payment.transaction_id ?? "—"}</p><p>Provider: {payment.provider_status ?? "—"}</p><p>Verified: {payment.verified_at ? when(payment.verified_at) : "Not verified"}</p></div>
              {payment.provider_message && <p className="mt-2 text-sm">{payment.provider_message}</p>}
            </article>
          ))}
        </>}

        {tab === "Bookings" && <>
          <StatusFilter options={bookingStatuses} value={bookingFilter} onChange={setBookingFilter} counts={bookingStatuses.map((s) => bookings.filter((b) => b.status === s).length)} total={bookings.length} />
          <button onClick={() => setShowAddBooking((v) => !v)} className="min-h-10 rounded-sm bg-primary px-4 text-sm font-semibold text-primary-foreground">{showAddBooking ? "Close" : "+ Add booking"}</button>
          {showAddBooking && (
            <form onSubmit={addBooking} className="grid gap-4 rounded-md border border-border bg-card p-5 sm:grid-cols-2">
              <label className="field-label">Customer name<input name="customer_name" required className="field" /></label>
              <label className="field-label">Phone<input name="phone" required className="field" /></label>
              <label className="field-label">Email<input name="email" type="email" className="field" /></label>
              <label className="field-label">Event type<input name="event_type" required className="field" placeholder="Wedding" /></label>
              <label className="field-label">Package<select name="package_name" className="field"><option>Traditional</option><option>Standard</option><option>Premium</option></select></label>
              <label className="field-label">Date<input name="event_date" type="date" required className="field" /></label>
              <label className="field-label">Time<input name="event_time" type="time" className="field" /></label>
              <label className="field-label">Venue<input name="venue" required className="field" /></label>
              <label className="field-label">Guests<input name="guests" type="number" min="1" required className="field" /></label>
              <label className="field-label">Status<select name="status" className="field">{bookingStatuses.map((s) => <option key={s}>{s}</option>)}</select></label>
              <label className="field-label sm:col-span-2">Notes<textarea name="notes" className="field" /></label>
              <button disabled={busy} className="min-h-11 rounded-sm bg-primary px-4 font-semibold text-primary-foreground sm:col-span-2">Save booking</button>
            </form>
          )}
          {shownBookings.length === 0 ? <p className="text-muted-foreground">No bookings in this list.</p> : shownBookings.map((booking) => (
          <article key={booking.id} className="rounded-md border border-border bg-card p-5">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <h2 className="font-display text-xl">#{booking.booking_number} · {booking.event_type}</h2>
                <p className="text-sm text-muted-foreground">{booking.customer_name} · <a href={`tel:${booking.phone}`} className="underline">{booking.phone}</a>{booking.email ? ` · ${booking.email}` : ""}</p>
                <p className="text-sm text-muted-foreground">{booking.event_date}{booking.event_time ? ` at ${booking.event_time}` : ""} · {booking.venue} · {booking.guests} guests</p>
                <p className="text-sm text-muted-foreground">{booking.package_name} package</p>
                {booking.notes && <p className="mt-2 text-sm italic text-muted-foreground">“{booking.notes}”</p>}
              </div>
              <div className="flex items-end gap-2">
                <label className="field-label">Status
                  <select className="field" value={booking.status} onChange={(event) => void supabase.from("bookings").update({ status: event.target.value as BookingRow["status"] }).eq("id", booking.id).then(() => loadAll())}>
                    {bookingStatuses.map((value) => <option key={value}>{value}</option>)}
                  </select>
                </label>
                <button onClick={() => void removeRow("bookings", booking.id)} aria-label="Remove booking" className="flex min-h-10 items-center gap-1 rounded-sm border border-destructive px-3 text-sm text-destructive"><Trash2 size={15} /> Remove</button>
              </div>
            </div>
          </article>
        ))}
        </>}

        {tab === "Menu" && <>
          <form onSubmit={saveMenuItem} className="grid gap-4 rounded-md border border-border bg-card p-5 sm:grid-cols-2">
            <h2 className="font-display text-xl sm:col-span-2">Add a menu item</h2>
            <label className="field-label">Name<input name="name" required className="field" /></label>
            <label className="field-label">Category<select name="category" className="field">{categories.map((value) => <option key={value}>{value}</option>)}</select></label>
            <label className="field-label">Price (K)<input name="price" type="number" min="0" step="1" required className="field" /></label>
            <label className="field-label">Display order<input name="sort_order" type="number" defaultValue={0} className="field" /></label>
            <label className="field-label sm:col-span-2">Description<input name="description" className="field" /></label>
            <label className="field-label sm:col-span-2">Photo of the dish<input name="photo" type="file" accept="image/*" className="field" /></label>
            <label className="flex items-center gap-2 text-sm sm:col-span-2"><input type="checkbox" name="popular" /> Mark as popular</label>
            <button type="submit" disabled={busy} className="min-h-11 rounded-sm bg-primary px-5 text-sm font-semibold text-primary-foreground disabled:opacity-60 sm:col-span-2">{busy ? "Uploading…" : "Add to menu"}</button>
          </form>
          {menu.map((item) => (
            <article key={item.id} className="flex flex-wrap items-center justify-between gap-3 rounded-md border border-border bg-card p-4">
              <div className="flex items-center gap-4">
                {photoFor(item) ? <img src={photoFor(item)!} alt={item.name} className="size-16 rounded-sm object-cover" /> : <div className="grid size-16 place-items-center rounded-sm bg-muted font-display text-xl text-primary/40">N</div>}
                <div>
                  <h3 className="font-semibold">{item.name} · {money(item.price)}</h3>
                  <p className="text-sm text-muted-foreground">{item.category}{item.description ? ` · ${item.description}` : ""}</p>
                  <label className="mt-2 inline-block cursor-pointer text-sm text-primary underline">
                    {item.image_key ? "Change photo" : "Add photo"}
                    <input type="file" accept="image/*" className="hidden" onChange={(event) => { const file = event.target.files?.[0]; if (file) void changePhoto(item.id, file); }} />
                  </label>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={item.available} onChange={(event) => void supabase.from("menu_items").update({ available: event.target.checked }).eq("id", item.id).then(() => loadAll())} /> Available</label>
                <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={item.popular} onChange={(event) => void supabase.from("menu_items").update({ popular: event.target.checked }).eq("id", item.id).then(() => loadAll())} /> Popular</label>
                <button onClick={async () => { const { error } = await supabase.from("menu_items").delete().eq("id", item.id); setNotice(error ? "Only the manager account can delete items." : "Item removed."); await loadAll(); }} className="flex min-h-10 items-center gap-2 rounded-sm border border-border px-3 text-sm text-destructive"><Trash2 size={15} /> Remove</button>
              </div>
            </article>
          ))}
        </>}

        {tab === "Settings" && roleState === "admin" && <form key={JSON.stringify(settings)} onSubmit={saveSettings} className="grid gap-4 rounded-md border border-border bg-card p-5 sm:max-w-2xl">
          <div className="sm:col-span-2"><h2 className="font-display text-xl">Business settings</h2><p className="mt-1 text-sm text-muted-foreground">These values are stored in Supabase and used by the customer-facing flow.</p></div>
          <label className="field-label">Primary phone<input name="phone" defaultValue={settings['phone'] ?? ""} className="field" /></label>
          <label className="field-label">Mobile Money number<input name="mobile_money_number" defaultValue={settings['mobile_money_number'] ?? ""} className="field" /></label>
          <label className="field-label">Opening hours<input name="opening_hours" defaultValue={settings['opening_hours'] ?? ""} className="field" /></label>
          <label className="field-label">Location<input name="location" defaultValue={settings['location'] ?? ""} className="field" /></label>
          <button className="min-h-11 rounded-sm bg-primary px-4 font-semibold text-primary-foreground sm:col-span-2">Save settings</button>
        </form>}

        {tab === "Sales" && <div className="space-y-5">
          <div className="flex flex-wrap gap-2">{(["today", "week", "month", "all"] as const).map((value) => (
            <button key={value} onClick={() => setRange(value)} className={`rounded-full px-4 py-2 text-sm capitalize ${range === value ? "bg-primary text-primary-foreground" : "border border-border bg-card"}`}>{value}</button>
          ))}<button onClick={downloadCsv} className="ml-auto rounded-sm bg-brand-ink px-4 py-2 text-sm font-semibold text-brand-cream">Download CSV</button></div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="rounded-md border border-border bg-card p-5"><p className="text-sm text-muted-foreground">Revenue</p><p className="font-display text-4xl">{money(sales.revenue)}</p></div>
            <div className="rounded-md border border-border bg-card p-5"><p className="text-sm text-muted-foreground">Orders</p><p className="font-display text-4xl">{sales.count}</p></div>
          </div>
          <div className="rounded-md border border-border bg-card p-5">
            <h2 className="font-display text-xl">Best sellers</h2>
            {sales.popular.length === 0 ? <p className="mt-2 text-sm text-muted-foreground">No sales in this period.</p> : <ul className="mt-3 space-y-2">{sales.popular.map(([name, qty]) => <li key={name} className="flex justify-between text-sm"><span>{name}</span><strong>{qty}</strong></li>)}</ul>}
          </div>
        </div>}
      </div>
    </main>
  );
}

function StatusFilter({ options, labels = {}, value, onChange, counts, total }: {
  options: readonly string[];
  labels?: Record<string, string>;
  value: string;
  onChange: (value: string) => void;
  counts: number[];
  total: number;
}) {
  const choices = ["All", ...options];
  return (
    <div className="flex flex-wrap gap-2">
      {choices.map((choice, index) => {
        const count = index === 0 ? total : counts[index - 1];
        return (
          <button
            key={choice}
            onClick={() => onChange(choice)}
            className={`rounded-full px-4 py-2 text-sm ${value === choice ? "bg-primary text-primary-foreground" : "border border-border bg-card"}`}
          >
            {labels[choice] ?? choice} ({count})
          </button>
        );
      })}
    </div>
  );
}

